<template>
  <div class="sandfall-page">
    <section class="sandfall-card">
      <div class="quantization-controls">
        <label for="quantization-base">Color Base</label>
        <input
          id="quantization-base"
          v-model.number="quantizationBase"
          type="range"
          min="2"
          max="12"
          step="1"
        />
        <span class="quantization-value">
          {{ quantizationBase }}^3 = {{ quantizedColorCount }} colors
        </span>
        <span class="quantization-step">step {{ quantizationStep }}</span>
      </div>

      <header class="sandfall-header">
        <div class="title-group">
          <h1>Pixel Clear</h1>
          <p>Upload an image, then click a color bucket to sweep the bottom row.</p>
          <p class="sweep-limit" v-if="hasImage">
            Active buckets: {{ activeSweepCount }}/{{ MAX_ACTIVE_SWEEPS }}
          </p>
        </div>

        <label class="upload-btn">
          <span>Load Image</span>
          <input type="file" accept="image/png, image/jpeg" @change="handleFileUpload" />
        </label>
      </header>

      <div class="playfield" ref="playfieldRef">
        <div class="canvas-wrapper" :class="{ empty: !hasImage }">
          <canvas ref="gameCanvas" :width="canvasSize" :height="canvasSize"></canvas>
          <p v-if="!hasImage" class="empty-state">No image loaded yet.</p>
        </div>

        <div class="drop-layer" aria-hidden="true">
          <span
            v-for="drop in fallingPixels"
            :key="drop.id"
            class="falling-pixel"
            :style="fallingPixelStyle(drop)"
          ></span>
        </div>

        <div class="buckets" v-if="bucketList.length">
          <button
            v-for="bucket in bucketList"
            :key="bucket.colorId"
            :ref="(el) => setBucketRef(bucket.colorId, el)"
            class="bucket-btn"
            :style="bucketButtonStyle(bucket.colorId)"
            :disabled="isBucketDisabled"
            @click="triggerColor(bucket.colorId)"
          >
            <span class="swatch"></span>
            <span class="percent">{{ bucketCompletion(bucket) }}%</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { GameEngine } from '@/composables/sandfall/GameEngine'
import { GRID_SIZE, MAX_ACTIVE_SWEEPS, PIXEL_SIZE } from '@/composables/sandfall/types'
import type { Bucket, Pixel } from '@/composables/sandfall/types'

interface FallingPixel {
  id: number
  colorId: string
  x: number
  y: number
  dx: number
  dy: number
}

const gameCanvas = ref<HTMLCanvasElement | null>(null)
const playfieldRef = ref<HTMLElement | null>(null)
const canvasSize = GRID_SIZE * PIXEL_SIZE
const buckets = ref<Map<string, Bucket>>(new Map())
const bucketList = computed(() =>
  Array.from(buckets.value.values()).sort((a, b) => compareColorIds(a.colorId, b.colorId)),
)
const hasImage = ref(false)
const activeSweepCount = ref(0)
const isBucketDisabled = computed(() => activeSweepCount.value >= MAX_ACTIVE_SWEEPS)
const fallingPixels = ref<FallingPixel[]>([])
const quantizationBase = ref(4)
const quantizationStep = computed(() => Math.round(256 / quantizationBase.value))
const quantizedColorCount = computed(() => quantizationBase.value ** 3)
const loadedImage = ref<HTMLImageElement | null>(null)

let engine: GameEngine | null = null
let fallingPixelId = 0
const bucketElements = new Map<string, HTMLButtonElement>()

const parseRgb = (colorId: string) => {
  const match = colorId.match(/^rgb\((\d+),(\d+),(\d+)\)$/)
  if (!match) return null

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  }
}

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6
    } else if (max === gn) {
      h = (bn - rn) / delta + 2
    } else {
      h = (rn - gn) / delta + 4
    }

    h *= 60
    if (h < 0) h += 360
  }

  return { h, s, l }
}

const compareColorIds = (aColorId: string, bColorId: string) => {
  const aRgb = parseRgb(aColorId)
  const bRgb = parseRgb(bColorId)

  if (!aRgb || !bRgb) {
    return aColorId.localeCompare(bColorId)
  }

  const aHsl = rgbToHsl(aRgb.r, aRgb.g, aRgb.b)
  const bHsl = rgbToHsl(bRgb.r, bRgb.g, bRgb.b)

  // Primary sort by hue for relative channel strength, then by saturation,
  // and finally by lightness so brighter tones move toward the back.
  if (aHsl.h !== bHsl.h) return aHsl.h - bHsl.h
  if (aHsl.s !== bHsl.s) return bHsl.s - aHsl.s
  if (aHsl.l !== bHsl.l) return aHsl.l - bHsl.l

  return aColorId.localeCompare(bColorId)
}

// MVP Quantization: Round colors to nearest 64 to restrict palette size
const quantizeColor = (r: number, g: number, b: number) => {
  const base = Math.max(2, quantizationBase.value)
  const step = 256 / base

  // Use equal buckets by base, then remap to 0..255 to guarantee base^3 possible colors.
  const quantizeChannel = (channel: number) => {
    const bucket = Math.min(base - 1, Math.floor(channel / step))
    return Math.round((bucket / (base - 1)) * 255)
  }

  const qr = quantizeChannel(r)
  const qg = quantizeChannel(g)
  const qb = quantizeChannel(b)
  return `rgb(${qr},${qg},${qb})`
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const img = new Image()
  const url = URL.createObjectURL(file)

  img.onload = () => {
    loadedImage.value = img
    processImage(img)
    URL.revokeObjectURL(url)
  }
  img.src = url
}

const processImage = (img: HTMLImageElement) => {
  if (!gameCanvas.value) return

  const offscreen = document.createElement('canvas')
  offscreen.width = GRID_SIZE
  offscreen.height = GRID_SIZE
  const ctx = offscreen.getContext('2d')
  if (!ctx) return

  // Draw and scale image into 64x64 grid
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE)
  const imageData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data

  const initialGrid: (Pixel | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null as Pixel | null),
  )

  buckets.value.clear()
  bucketElements.clear()
  fallingPixels.value = []
  activeSweepCount.value = 0

  for (let y = 0; y < GRID_SIZE; y++) {
    const row = initialGrid[y]
    if (!row) continue

    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = (y * GRID_SIZE + x) * 4
      const r = imageData[idx] ?? 0
      const g = imageData[idx + 1] ?? 0
      const b = imageData[idx + 2] ?? 0
      const a = imageData[idx + 3] ?? 0

      if (a <= 128) {
        row[x] = null
        continue
      }

      const colorId = quantizeColor(r, g, b)
      if (!buckets.value.has(colorId)) {
        buckets.value.set(colorId, { colorId, collected: 0, total: 0 })
      }

      const bucket = buckets.value.get(colorId)
      if (bucket) {
        bucket.total += 1
      }

      row[x] = {
        colorId,
        x: x * PIXEL_SIZE,
        y: y * PIXEL_SIZE,
        targetY: y * PIXEL_SIZE,
        velocity: 0,
      }
    }
  }

  engine?.destroy()

  // Boot Engine
  engine = new GameEngine(gameCanvas.value, initialGrid)
  engine.onPixelCollected = (colorId: string, column: number) => {
    const bucket = buckets.value.get(colorId)
    if (bucket) bucket.collected++
    spawnFallingPixel(colorId, column)
  }
  engine.onActiveSweepCountChanged = (count: number) => {
    activeSweepCount.value = count
  }

  hasImage.value = true
}

const triggerColor = (colorId: string) => {
  if (engine && activeSweepCount.value < MAX_ACTIVE_SWEEPS) {
    engine.triggerSweep(colorId)
  }
}

const bucketCompletion = (bucket: Bucket) => {
  if (!bucket.total) return 0
  return Math.min(100, Math.round((bucket.collected / bucket.total) * 100))
}

const setBucketRef = (colorId: string, el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLButtonElement) {
    bucketElements.set(colorId, el)
    return
  }

  bucketElements.delete(colorId)
}

const spawnFallingPixel = (colorId: string, column: number) => {
  const playfieldEl = playfieldRef.value
  const canvasEl = gameCanvas.value
  const bucketEl = bucketElements.get(colorId)
  if (!playfieldEl || !canvasEl || !bucketEl) return

  const playfieldRect = playfieldEl.getBoundingClientRect()
  const canvasRect = canvasEl.getBoundingClientRect()
  const bucketRect = bucketEl.getBoundingClientRect()
  const scale = canvasRect.width / canvasSize

  const startX =
    canvasRect.left - playfieldRect.left + (column * PIXEL_SIZE + PIXEL_SIZE / 2) * scale
  const startY = canvasRect.top - playfieldRect.top + (canvasSize - PIXEL_SIZE / 2) * scale
  const endX = bucketRect.left - playfieldRect.left + bucketRect.width / 2
  const endY = bucketRect.top - playfieldRect.top + 14

  const id = ++fallingPixelId
  fallingPixels.value = [
    ...fallingPixels.value,
    {
      id,
      colorId,
      x: startX,
      y: startY,
      dx: endX - startX,
      dy: endY - startY,
    },
  ]

  window.setTimeout(() => {
    fallingPixels.value = fallingPixels.value.filter((pixel) => pixel.id !== id)
  }, 550)
}

const bucketButtonStyle = (colorId: string) => ({
  '--bucket-color': colorId,
})

const fallingPixelStyle = (pixel: FallingPixel): CSSProperties => ({
  left: `${pixel.x}px`,
  top: `${pixel.y}px`,
  '--pixel-drop-x': `${pixel.dx}px`,
  '--pixel-drop-y': `${pixel.dy}px`,
  '--pixel-color': pixel.colorId,
})

onBeforeUnmount(() => {
  engine?.destroy()
  bucketElements.clear()
})

watch(quantizationBase, (base) => {
  if (!Number.isFinite(base)) {
    quantizationBase.value = 4
    return
  }

  const normalizedBase = Math.max(2, Math.min(12, Math.round(base)))
  if (normalizedBase !== base) {
    quantizationBase.value = normalizedBase
    return
  }

  if (loadedImage.value) {
    processImage(loadedImage.value)
  }
})
</script>

<style scoped lang="scss">
.sandfall-page {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  background:
    radial-gradient(
      circle at 20% 20%,
      color-mix(in srgb, var(--theme-bg-tertiary), transparent 20%),
      transparent 55%
    ),
    radial-gradient(
      circle at 85% 80%,
      color-mix(in srgb, var(--theme-bg-secondary), transparent 35%),
      transparent 60%
    ),
    var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100vh;
}

.sandfall-card {
  width: min(100%, 740px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--theme-border-medium);
  border-radius: 14px;
  background: var(--theme-bg-secondary);
  box-shadow: var(--theme-shadow-lg);
}

.quantization-controls {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--theme-border-medium);
  background: var(--theme-bg-tertiary);

  label {
    font-weight: 700;
    color: var(--theme-text-accent);
    font-size: 0.9rem;
    white-space: nowrap;
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--theme-success);
  }

  .quantization-value,
  .quantization-step {
    color: var(--theme-text-secondary);
    font-size: 0.85rem;
    white-space: nowrap;
  }
}

.sandfall-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.title-group {
  h1 {
    margin: 0;
    font-size: clamp(1.6rem, 2vw, 2rem);
    color: var(--theme-text-accent);
  }

  p {
    margin: 6px 0 0;
    color: var(--theme-text-secondary);
    font-size: 0.95rem;
  }

  .sweep-limit {
    margin: 8px 0 0;
    color: var(--theme-text-secondary);
    font-size: 0.9rem;
  }
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  border: 1px solid var(--theme-button-primary-border);
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    background: var(--theme-button-primary-hover);
  }

  input {
    display: none;
  }
}

.playfield {
  position: relative;
  width: min(100%, 540px);
  margin: 0 auto;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  border: 2px solid var(--theme-canvas-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--theme-canvas-bg);
  box-shadow: var(--theme-shadow-md);

  canvas {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }

  &.empty {
    min-height: 220px;
  }
}

.empty-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  margin: 0;
  color: var(--theme-text-secondary);
  background: color-mix(in srgb, var(--theme-bg-primary), transparent 35%);
}

.drop-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  overflow: visible;
}

.falling-pixel {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--pixel-color);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  animation: pixel-drop 0.55s cubic-bezier(0.2, 0.85, 0.3, 1);
}

.buckets {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
  width: 100%;

  .bucket-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    width: 100%;
    height: 46px;
    padding: 4px 0;
    border: 1px solid var(--theme-border-medium);
    border-radius: 8px;
    background: var(--theme-bg-tertiary);
    color: var(--theme-text-primary);
    cursor: pointer;
    font-size: 11px;
    font-weight: bold;
    transition:
      transform 0.1s,
      border-color 0.2s,
      opacity 0.2s;

    .swatch {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid var(--theme-border-light);
      background: var(--bucket-color);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
    }

    .percent {
      color: var(--theme-text-accent);
      font-weight: 600;
      white-space: nowrap;
      line-height: 1;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--theme-button-primary-border);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.65;
      transform: none;
    }
  }
}

@keyframes pixel-drop {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.95;
  }

  70% {
    opacity: 1;
  }

  100% {
    transform: translate(calc(-50% + var(--pixel-drop-x)), calc(-50% + var(--pixel-drop-y)))
      scale(0.35);
    opacity: 0;
  }
}

@media (max-width: 720px) {
  .sandfall-page {
    padding: 12px;
  }

  .sandfall-card {
    padding: 14px;
    border-radius: 12px;
  }

  .sandfall-header {
    flex-direction: column;
    align-items: stretch;
  }

  .upload-btn {
    width: 100%;
  }

  .quantization-controls {
    grid-template-columns: 1fr;

    label,
    .quantization-value,
    .quantization-step {
      white-space: normal;
    }
  }

  .buckets {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }
}

@media (max-width: 520px) {
  .buckets {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
