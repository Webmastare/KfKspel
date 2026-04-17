<template>
  <div class="game-container">
    <div class="stats">
      <p>{{ points }} | {{ Math.round(velocity) }} varv/s</p>
    </div>

    <div class="spinner-wrapper" @pointerdown="handleClick">
      <div class="spinner-object" :style="{ transform: `rotate(${rotation}deg)` }">
        <img
          class="spinner-image"
          src="/assets/yoda/yoda.png"
          alt="Spinning Yoda"
          draggable="false"
        />
      </div>
    </div>

    <div class="instructions">Klicka på Yoda eller tryck mellanslag sa snabbt du kan!</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
themeStore.init()

const rotation = ref(0)
const velocity = ref(0)
const points = ref(0)

const CLICK_IMPULSE_MAX = 1.15
const CLICK_IMPULSE_MIN = 0.12
const SOFT_CAP_SPEED = 35
const SOFT_CAP_CURVE = 1.2
const FRICTION = 0.998
const COAST_DELAY_MS = 450
const MIN_SPEED = 0.015
const SPACEBAR_REPEAT_MS = 3

let animationFrame: number | null = null
let lastFrameTime = 0
let lastClickTime = 0
let isSpacebarHeld = false
let spacebarHoldInterval: ReturnType<typeof setInterval> | null = null

const getImpulseAtSpeed = (speed: number) => {
  const normalizedSpeed = Math.pow(speed, 0.5) // Math.log1p(Math.max(speed, 0) / SOFT_CAP_SPEED)
  const diminishingFactor = 1 / Math.pow(1 + normalizedSpeed, SOFT_CAP_CURVE)

  return CLICK_IMPULSE_MIN + (CLICK_IMPULSE_MAX - CLICK_IMPULSE_MIN) * diminishingFactor
}

const addSpinImpulse = () => {
  lastClickTime = performance.now()
  velocity.value += getImpulseAtSpeed(velocity.value)
}

const update = (timestamp: number) => {
  const deltaFrames = Math.min((timestamp - lastFrameTime) / (1000 / 60), 3)
  lastFrameTime = timestamp

  if (velocity.value > MIN_SPEED) {
    const previousRotation = rotation.value
    rotation.value += velocity.value * deltaFrames

    if (timestamp - lastClickTime > COAST_DELAY_MS) {
      velocity.value *= Math.pow(FRICTION, deltaFrames)
    }

    const revolutionsGained = Math.floor(rotation.value / 360) - Math.floor(previousRotation / 360)
    if (revolutionsGained > 0) {
      points.value += revolutionsGained
    }
  } else {
    velocity.value = 0
  }

  animationFrame = requestAnimationFrame(update)
}

const handleClick = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  addSpinImpulse()
}

const stopSpacebarHold = () => {
  isSpacebarHeld = false

  if (spacebarHoldInterval !== null) {
    clearInterval(spacebarHoldInterval)
    spacebarHoldInterval = null
  }
}

const handleSpacebarDown = (event: KeyboardEvent) => {
  if (event.code !== 'Space') return

  const target = event.target as HTMLElement | null
  const tagName = target?.tagName
  const isEditableTarget =
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    target?.isContentEditable ||
    tagName === 'SELECT'

  if (isEditableTarget) return

  event.preventDefault()

  if (isSpacebarHeld) return

  isSpacebarHeld = true
  addSpinImpulse()

  spacebarHoldInterval = setInterval(() => {
    addSpinImpulse()
  }, SPACEBAR_REPEAT_MS)
}

const handleSpacebarUp = (event: KeyboardEvent) => {
  if (event.code !== 'Space') return
  stopSpacebarHold()
}

onMounted(() => {
  const startTime = performance.now()
  lastFrameTime = startTime
  lastClickTime = startTime
  animationFrame = requestAnimationFrame(update)
  window.addEventListener('keydown', handleSpacebarDown)
  window.addEventListener('keyup', handleSpacebarUp)
  window.addEventListener('blur', stopSpacebarHold)
})

onUnmounted(() => {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
  }

  stopSpacebarHold()
  window.removeEventListener('keydown', handleSpacebarDown)
  window.removeEventListener('keyup', handleSpacebarUp)
  window.removeEventListener('blur', stopSpacebarHold)
})
</script>

<style lang="scss" scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 20% 20%, var(--theme-bg-secondary), transparent 45%),
    radial-gradient(circle at 80% 80%, var(--theme-bg-elevated), transparent 50%),
    var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
  user-select: none;
  overflow: hidden;
}

.stats {
  text-align: center;
  margin-bottom: 2rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  p {
    font-size: clamp(1rem, 4vw, 1.5rem);
    color: var(--theme-text-secondary);
    margin-top: 0px;
  }
}

.spinner-wrapper {
  cursor: pointer;
  padding: clamp(0.8rem, 3vw, 2rem);
  border-radius: 999px;
  touch-action: manipulation;
  transition: transform 0.1s ease;

  &:active .spinner-object {
    filter: brightness(1.08);
  }

  &:active {
    transform: scale(0.985);
  }
}

.spinner-object {
  width: min(78vw, 520px);
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  will-change: transform;
}

.spinner-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 20px 26px rgba(0, 0, 0, 0.35));
}

.instructions {
  margin-top: 3rem;
  color: var(--theme-text-secondary);
  opacity: 0.85;
  font-style: italic;
  text-align: center;
}

@media (max-width: 600px) {
  .stats {
    margin-bottom: 1.4rem;
  }

  .instructions {
    margin-top: 1.6rem;
  }
}
</style>
