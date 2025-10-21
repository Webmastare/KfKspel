<template>
  <div class="dvd-canvas-container">
    <canvas ref="canvasRef" class="dvd-canvas"></canvas>
    <div class="fps-counter">FPS: {{ fps }}</div>
    <audio v-if="hitSound" ref="audioRef" :src="hitSound" preload="auto" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface DvdEntity {
  x: number
  y: number
  vx: number
  vy: number
  color: string
}

const props = defineProps<{
  dvdCount?: number
  logoSrc?: string
  speed?: number
  hitSound?: string
  volume?: number
  colorChangeOnBounce?: boolean
  showRain?: boolean
  showThunder?: boolean
}>()

const emit = defineEmits<{
  (e: 'hit', bounceValue: number): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const fps = ref(0)

let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null

const dvds = ref<DvdEntity[]>([])
const DVD_WIDTH = 80
const DVD_HEIGHT = 60

// DVD logo image
let dvdImage: HTMLImageElement | null = null
let coloredImages: Map<string, HTMLCanvasElement> = new Map()

// FPS tracking
let lastFpsUpdate = Date.now()
let frameCount = 0

// Rain
interface Rain {
  x: number
  y: number
  speed: number
}
const rain = ref<Rain[]>([])

// Thunder
let thunderAlpha = 0
let nextThunder = 0

// Colors for DVDs
const colors = [
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FFA500',
  '#800080',
]
const getRandomColor = (): string => colors[Math.floor(Math.random() * colors.length)] || '#FF0000'

function createColoredImage(color: string): HTMLCanvasElement {
  if (coloredImages.has(color)) {
    return coloredImages.get(color)!
  }

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = DVD_WIDTH
  tempCanvas.height = DVD_HEIGHT
  const tempCtx = tempCanvas.getContext('2d')!

  if (dvdImage && dvdImage.complete) {
    // Draw the image
    tempCtx.drawImage(dvdImage, 0, 0, DVD_WIDTH, DVD_HEIGHT)

    // Apply color tint
    tempCtx.globalCompositeOperation = 'multiply'
    tempCtx.fillStyle = color
    tempCtx.fillRect(0, 0, DVD_WIDTH, DVD_HEIGHT)

    // Restore alpha
    tempCtx.globalCompositeOperation = 'destination-in'
    tempCtx.drawImage(dvdImage, 0, 0, DVD_WIDTH, DVD_HEIGHT)
  }

  coloredImages.set(color, tempCanvas)
  return tempCanvas
}

function createDvd(): DvdEntity {
  const canvas = canvasRef.value
  if (!canvas) return { x: 10, y: 10, vx: 2, vy: 2, color: getRandomColor() }

  const speed = props.speed ?? 2
  return {
    x: Math.random() * (canvas.width - DVD_WIDTH),
    y: Math.random() * (canvas.height - DVD_HEIGHT),
    vx: (Math.random() > 0.5 ? 1 : -1) * speed,
    vy: (Math.random() > 0.5 ? 1 : -1) * speed,
    color: getRandomColor(),
  }
}

function drawDvd(dvd: DvdEntity) {
  if (!ctx || !dvdImage || !dvdImage.complete) return

  if (props.colorChangeOnBounce) {
    // Use pre-rendered colored image
    const coloredImg = createColoredImage(dvd.color)
    ctx.drawImage(coloredImg, dvd.x, dvd.y)
  } else {
    // Draw normally
    ctx.drawImage(dvdImage, dvd.x, dvd.y, DVD_WIDTH, DVD_HEIGHT)
  }
}

function updateDvd(dvd: DvdEntity) {
  const canvas = canvasRef.value
  if (!canvas) return

  dvd.x += dvd.vx
  dvd.y += dvd.vy

  let bounced = false

  if (dvd.x <= 0 || dvd.x >= canvas.width - DVD_WIDTH) {
    dvd.vx = -dvd.vx
    dvd.x = Math.max(0, Math.min(dvd.x, canvas.width - DVD_WIDTH))
    bounced = true
  }

  if (dvd.y <= 0 || dvd.y >= canvas.height - DVD_HEIGHT) {
    dvd.vy = -dvd.vy
    dvd.y = Math.max(0, Math.min(dvd.y, canvas.height - DVD_HEIGHT))
    bounced = true
  }

  if (bounced) {
    if (props.colorChangeOnBounce) {
      dvd.color = getRandomColor()
    }

    const value = props.colorChangeOnBounce ? 5 : 1
    emit('hit', value)

    if (audioRef.value) {
      try {
        audioRef.value.volume = props.volume ?? 0.3
        audioRef.value.currentTime = 0
        audioRef.value.play()
      } catch {}
    }
  }
}

function initRain() {
  const canvas = canvasRef.value
  if (!canvas) return

  rain.value = []
  for (let i = 0; i < 150; i++) {
    rain.value.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: Math.random() * 4 + 3,
    })
  }
}

function updateRain() {
  const canvas = canvasRef.value
  if (!canvas) return

  rain.value.forEach((drop) => {
    drop.y += drop.speed
    if (drop.y > canvas.height) {
      drop.y = 0
      drop.x = Math.random() * canvas.width
    }
  })
}

function drawRain() {
  if (!ctx) return

  ctx.strokeStyle = 'rgba(174, 194, 224, 0.6)'
  ctx.lineWidth = 2

  rain.value.forEach((drop) => {
    ctx!.beginPath()
    ctx!.moveTo(drop.x, drop.y)
    ctx!.lineTo(drop.x, drop.y + 15)
    ctx!.stroke()
  })
}

function updateThunder() {
  if (!props.showThunder) {
    thunderAlpha = 0
    return
  }

  const now = Date.now()
  if (now > nextThunder) {
    thunderAlpha = 0.8
    nextThunder = now + Math.random() * 8000 + 4000 // 4-12 seconds
  }

  if (thunderAlpha > 0) {
    thunderAlpha *= 0.9 // Fade out
    if (thunderAlpha < 0.01) thunderAlpha = 0
  }
}

function drawThunder() {
  if (!ctx || thunderAlpha <= 0) return

  ctx.fillStyle = `rgba(255, 255, 255, ${thunderAlpha})`
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

function updateFPS() {
  frameCount++
  const now = Date.now()
  if (now - lastFpsUpdate >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastFpsUpdate = now
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return

  // Update FPS
  updateFPS()

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Thunder
  updateThunder()
  drawThunder()

  // Rain
  if (props.showRain && rain.value.length > 0) {
    updateRain()
    drawRain()
  }

  // DVDs
  dvds.value.forEach((dvd) => {
    updateDvd(dvd)
    drawDvd(dvd)
  })

  animationId = requestAnimationFrame(animate)
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  if (props.showRain && rain.value.length === 0) {
    initRain()
  }
}

// Watch DVD count - only add/remove, don't reset positions
watch(
  () => props.dvdCount,
  (newCount) => {
    const target = newCount || 0
    const current = dvds.value.length

    if (target > current) {
      for (let i = current; i < target; i++) {
        dvds.value.push(createDvd())
      }
    } else if (target < current) {
      dvds.value = dvds.value.slice(0, target)
    }
  },
)

// Watch rain
watch(
  () => props.showRain,
  (show) => {
    if (show) {
      initRain()
    } else {
      rain.value = []
    }
  },
)

// Watch thunder
watch(
  () => props.showThunder,
  (show) => {
    if (show) {
      nextThunder = Date.now() + 2000
    } else {
      thunderAlpha = 0
    }
  },
)

// Watch color change - clear cached colored images when toggled
watch(
  () => props.colorChangeOnBounce,
  () => {
    coloredImages.clear()
  },
)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  ctx = canvas.getContext('2d')
  if (!ctx) return

  // Load DVD image
  if (props.logoSrc) {
    dvdImage = new Image()
    dvdImage.src = props.logoSrc
    dvdImage.onload = () => {
      console.log('DVD image loaded!')
      // Start animation once image is loaded
      if (!animationId) {
        animate()
      }
    }
    dvdImage.onerror = () => {
      console.error('Failed to load DVD image:', props.logoSrc)
    }
  }

  resize()
  window.addEventListener('resize', resize)

  // Initialize DVDs
  const count = props.dvdCount || 0
  for (let i = 0; i < count; i++) {
    dvds.value.push(createDvd())
  }

  if (props.showRain) {
    initRain()
  }

  if (props.showThunder) {
    nextThunder = Date.now() + 2000
  }

  // Start animation (will wait for image if needed)
  if (dvdImage && dvdImage.complete) {
    animate()
  } else if (!props.logoSrc) {
    animate()
  }
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.dvd-canvas-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
}

.dvd-canvas {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.fps-counter {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #00ff00;
  padding: 5px 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 14px;
  z-index: 1000;
  pointer-events: none;
}
</style>
