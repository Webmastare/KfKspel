<template>
  <div id="app-container">
    <h1 class="game-header">Plinko</h1>

    <!-- Mobile controls bar - shows on small screens -->
    <div class="mobile-controls-bar">
      <div class="mobile-top-row">
        <div class="mobile-score-info">
          <span class="mobile-score">{{ score.toFixed(0) }} poäng</span>
          <span class="mobile-level" v-if="lastMultiplier">x{{ lastMultiplier }}</span>
        </div>
      </div>
    </div>

    <div class="game-layout">
      <!-- Desktop sidebar - hidden on mobile -->
      <div class="sidebar desktop-only">
        <div class="game-info">
          <div class="info-item">
            <span class="info-label">Poäng</span>
            <span class="info-value">{{ score.toFixed(0) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Senaste multiplikator</span>
            <span
              class="info-value multiplier"
              :class="{ highlight: lastMultiplier !== null && lastMultiplier > 1 }"
            >
              {{ lastMultiplier ? `x${lastMultiplier}` : '-' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Bollar släppta</span>
            <span class="info-value">{{ ballsDropped }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kostnad/boll</span>
            <div class="betting-amount-input">
              <button @click="changeBettingAmount(-1)">-</button>
              <span>{{ bettingAmount }}</span>
              <button @click="changeBettingAmount(1)">+</button>
            </div>
            <div class="betting-amount-control">
              <button @click="changeBettingAmount(bettingAmount)">x2</button>
              <button @click="changeBettingAmount(-bettingAmount / 2)">/2</button>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas-outer-wrapper">
        <div class="canvas-container">
          <canvas
            ref="canvasRef"
            class="plinko-canvas"
            @click="handleCanvasClick"
            @mousemove="handleMouseMove"
          ></canvas>
        </div>
      </div>
    </div>

    <!-- Mobile stats - shows on small screens -->
    <div class="mobile-stats">
      <div class="mobile-stats-grid">
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Bollar</span>
          <span class="mobile-stat-value">{{ ballsDropped }}</span>
        </div>
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Senaste</span>
          <span class="mobile-stat-value">x{{ lastMultiplier || 0 }}</span>
        </div>
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Kostnad</span>
          <span class="mobile-stat-value">100p</span>
        </div>
        <div class="mobile-stat-item">
          <span class="mobile-stat-label">Vinst</span>
          <span class="mobile-stat-value">{{ lastWin || 0 }}p</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/theme'

// Global theme store
const themeStore = useThemeStore()

// --- Types & Interfaces ---
interface Vector {
  x: number
  y: number
}

interface Ball {
  pos: Vector
  vel: Vector
  radius: number
  active: boolean
  color: string
  cost: number
}

interface Peg {
  x: number
  y: number
  radius: number
}

interface Slot {
  x: number
  y: number
  w: number
  h: number
  multiplier: number
  color: string
}

// --- Configuration ---
const BASE_CANVAS_WIDTH = 600
const BASE_CANVAS_HEIGHT = 700
const GRAVITY = 0.25
const FRICTION = 0.98 // Air resistance
const BOUNCE_DAMPING = 0.7 // Energy lost on impact
const BASE_PEG_RADIUS = 6
const BASE_BALL_RADIUS = 9
const ROWS = 14

// --- State ---
const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(1000) // Starting "credits"
const bettingAmount = ref(100) // Amount to bet per round
const lastMultiplier = ref<number | null>(null)
const lastWin = ref<number>(0)
const ballsDropped = ref(0)
const isBallActive = ref(false)
const isMobile = ref(false)

// Responsive canvas dimensions
const canvasWidth = ref(BASE_CANVAS_WIDTH)
const canvasHeight = ref(BASE_CANVAS_HEIGHT)
const scale = ref(1) // Scale factor for responsive sizing
const mouseX = ref(BASE_CANVAS_WIDTH / 2) // For aiming visualization

// Game Objects
let ctx: CanvasRenderingContext2D | null = null
let animationId: number
let pegs: Peg[] = []
let slots: Slot[] = []
let resizeHandler: (() => void) | null = null

// The active balls
const balls = ref<Ball[]>([])

function changeBettingAmount(amount: number) {
  const newAmount = bettingAmount.value + Math.floor(amount)
  bettingAmount.value = Math.max(1, Math.min(newAmount, score.value))
}

// --- Initialization ---

// Responsive canvas setup with DPI handling
const adjustCanvasSize = () => {
  if (!canvasRef.value) return

  const dpr = Math.ceil(window.devicePixelRatio || 1)

  // Check if we're on mobile
  isMobile.value = window.innerWidth <= 768

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let availableWidth, availableHeight

  if (isMobile.value) {
    const mobileUIReservedHeight = 280
    const mobileHorizontalPadding = 40
    availableHeight = Math.max(400, viewportHeight - mobileUIReservedHeight)
    availableWidth = Math.max(300, viewportWidth - mobileHorizontalPadding)
  } else {
    const desktopUIReservedHeight = 150
    const desktopHorizontalReserved = 450
    availableHeight = Math.max(500, viewportHeight - desktopUIReservedHeight)
    availableWidth = Math.max(400, viewportWidth - desktopHorizontalReserved)
  }

  // Calculate scale to fit available space while maintaining aspect ratio
  const scaleByWidth = availableWidth / BASE_CANVAS_WIDTH
  const scaleByHeight = availableHeight / BASE_CANVAS_HEIGHT
  scale.value = Math.min(scaleByWidth, scaleByHeight, 1) // Don't scale up beyond base size

  canvasWidth.value = BASE_CANVAS_WIDTH * scale.value
  canvasHeight.value = BASE_CANVAS_HEIGHT * scale.value

  // Set canvas size with DPI handling
  canvasRef.value.width = Math.max(1, Math.floor(canvasWidth.value * dpr))
  canvasRef.value.height = Math.max(1, Math.floor(canvasHeight.value * dpr))
  canvasRef.value.style.width = `${canvasWidth.value}px`
  canvasRef.value.style.height = `${canvasHeight.value}px`

  // Scale context for HiDPI
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Recreate game elements with new scale
  createPegs()
  createSlots()
}

// Generate the pyramid of pegs
const createPegs = () => {
  pegs = []
  const spacingX = canvasWidth.value / 16 // Horizontal distance
  const spacingY = 40 * scale.value // Vertical distance (scaled)
  const startY = 100 * scale.value // Top margin (scaled)
  const pegRadius = BASE_PEG_RADIUS * scale.value

  for (let row = 0; row < ROWS; row++) {
    // Offset every other row for the "hex/triangular" lattice
    const isOffset = row % 2 === 1
    const colsInRow = isOffset ? 14 : 15

    // Center the row
    const rowWidth = (colsInRow - 1) * spacingX
    const xOffset = (canvasWidth.value - rowWidth) / 2

    for (let col = 0; col < colsInRow; col++) {
      pegs.push({
        x: xOffset + col * spacingX,
        y: startY + row * spacingY,
        radius: pegRadius,
      })
    }
  }
}

// Generate scoring slots at the bottom
const createSlots = () => {
  slots = []
  const multipliers = [10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10]
  const slotCount = multipliers.length
  const padding = 20 * scale.value
  const slotWidth = (canvasWidth.value - padding * 2) / slotCount
  const slotHeight = 40 * scale.value
  const startX = padding
  const y = canvasHeight.value - slotHeight - 10 * scale.value

  multipliers.forEach((mult, index) => {
    // Color coding based on risk/reward
    let color = themeStore.isDarkMode ? '#4a5568' : '#6b7280' // Default gray
    if (mult >= 5)
      color = '#ef4444' // Red/High
    else if (mult >= 2)
      color = '#f59e0b' // Orange
    else if (mult < 1) color = '#10b981' // Green/Safe

    slots.push({
      x: startX + index * slotWidth,
      y: y,
      w: slotWidth,
      h: slotHeight,
      multiplier: mult,
      color: color,
    })
  })
}

// --- Physics Engine ---

// Helper: Distance between two points squared (optimization to avoid sqrt unless needed)
const distSq = (x1: number, y1: number, x2: number, y2: number) => (x2 - x1) ** 2 + (y2 - y1) ** 2

const updatePhysics = () => {
  // 1. Apply Forces
  balls.value.forEach((ball) => {
    if (!ball.active) return

    ball.vel.y += GRAVITY
    ball.vel.x *= FRICTION
    ball.vel.y *= FRICTION

    // 2. Update Position
    ball.pos.x += ball.vel.x
    ball.pos.y += ball.vel.y

    // 3. Wall Collisions
    if (ball.pos.x < ball.radius) {
      ball.pos.x = ball.radius
      ball.vel.x *= -BOUNCE_DAMPING
    } else if (ball.pos.x > canvasWidth.value - ball.radius) {
      ball.pos.x = canvasWidth.value - ball.radius
      ball.vel.x *= -BOUNCE_DAMPING
    }

    // 4. Peg Collisions
    // We check all pegs (could be optimized with a spatial grid, but fine for <200 pegs)
    for (const peg of pegs) {
      const minDist = peg.radius + ball.radius
      const distanceSquared = distSq(ball.pos.x, ball.pos.y, peg.x, peg.y)

      if (distanceSquared < minDist ** 2) {
        const dist = Math.sqrt(distanceSquared)

        // Calculate Normal Vector (direction from peg to ball)
        const n = {
          x: (ball.pos.x - peg.x) / dist,
          y: (ball.pos.y - peg.y) / dist,
        }

        // Resolve Overlap (push ball out of peg immediately)
        const overlap = minDist - dist
        ball.pos.x += n.x * overlap
        ball.pos.y += n.y * overlap

        // Reflect Velocity
        // V_new = V_old - 2(V_old • n) * n
        const dotProduct = ball.vel.x * n.x + ball.vel.y * n.y

        ball.vel.x = (ball.vel.x - 2 * dotProduct * n.x) * BOUNCE_DAMPING
        ball.vel.y = (ball.vel.y - 2 * dotProduct * n.y) * BOUNCE_DAMPING

        // Add a tiny bit of random jitter to prevent "stacking" perfectly vertical bounces
        ball.vel.x += (Math.random() - 0.5) * 0.5
      }
    }

    // 5. Slot / Floor Detection
    if (ball.pos.y > canvasHeight.value - ball.radius - 30 * scale.value) {
      checkWinCondition(ball)
    }
  })
}

const checkWinCondition = (ball: Ball) => {
  // Find which slot center is closest to ball x
  const centerPos = ball.pos.x

  // Simple bounds check
  const hitSlot = slots.find((s) => centerPos >= s.x && centerPos <= s.x + s.w)

  if (hitSlot) {
    // Scoring Logic
    const profit = ball.cost * hitSlot.multiplier // Assuming base bet is 100
    score.value += profit
    lastMultiplier.value = hitSlot.multiplier
    lastWin.value = profit
    balls.value.splice(balls.value.indexOf(ball), 1)
  } else {
    // Hit floor but missed slots (edge case, rare)
    lastMultiplier.value = 0
    lastWin.value = 0
    balls.value.splice(balls.value.indexOf(ball), 1)
  }
  isBallActive.value = false
}

// --- Input Handling ---

const handleMouseMove = (e: MouseEvent) => {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  // Clamp aiming area to top region within walls
  const padding = 20 * scale.value
  mouseX.value = Math.max(padding, Math.min(canvasWidth.value - padding, x))
}

const handleCanvasClick = (e: MouseEvent) => {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
  const clickX = e.clientX - rect.left

  // Only allow drops from the top area
  if (e.clientY - rect.top > 150) return

  dropBall(clickX)
}

const dropBall = (x: number) => {
  // Deduct cost (e.g., 100)
  score.value -= bettingAmount.value
  lastMultiplier.value = null
  ballsDropped.value++

  const padding = 20 * scale.value
  const newBall: Ball = {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: BASE_BALL_RADIUS * scale.value,
    active: true,
    color: '#ffdd57',
    cost: bettingAmount.value,
  }
  newBall.pos.x = Math.max(padding, Math.min(canvasWidth.value - padding, x))
  newBall.pos.y = 30 * scale.value
  newBall.vel.x = (Math.random() - 0.5) * 0.5 // Slight random start to prevent identical drops
  newBall.vel.y = 0

  balls.value.push(newBall)
  isBallActive.value = true
}

// --- Rendering ---

const draw = () => {
  if (!ctx || !canvasRef.value) return

  // 1. Clear Screen
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // 2. Draw Pegs
  ctx.fillStyle = themeStore.isDarkMode ? '#e2e8f0' : '#4a5568'
  for (const peg of pegs) {
    ctx.beginPath()
    ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.closePath()
  }

  // 3. Draw Slots
  for (const slot of slots) {
    // Slot Background
    ctx.fillStyle = slot.color
    // Round corners helper using standard path
    ctx.beginPath()
    const cornerRadius = 4 * scale.value
    ctx.roundRect(slot.x + 2 * scale.value, slot.y, slot.w - 4 * scale.value, slot.h, cornerRadius)
    ctx.fill()

    // Slot Text
    ctx.fillStyle = themeStore.isDarkMode ? '#1a1a1a' : '#ffffff'
    const fontSize = Math.max(10, 12 * scale.value)
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${slot.multiplier}x`, slot.x + slot.w / 2, slot.y + slot.h / 2)
  }

  // 4. Draw Ghost Ball (Aiming)
  ctx.beginPath()
  ctx.arc(mouseX.value, 30 * scale.value, BASE_BALL_RADIUS * scale.value, 0, Math.PI * 2)
  ctx.fillStyle = themeStore.isDarkMode ? 'rgba(255, 221, 87, 0.5)' : 'rgba(255, 221, 87, 0.4)' // Transparent yellow
  ctx.fill()
  ctx.closePath()

  // 5. Draw Active Ball
  for (const ball of balls.value) {
    ctx.beginPath()
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2)
    ctx.fillStyle = ball.color
    ctx.fill()
    // Ball Shadow/Glow
    ctx.shadowColor = ball.color
    ctx.shadowBlur = 10 * scale.value
    ctx.stroke()
    ctx.shadowBlur = 0 // Reset
    ctx.closePath()
  }

  // Loop
  updatePhysics()
  animationId = requestAnimationFrame(draw)
}

// --- Helper Functions ---

// Extend Window interface for resize tracking
declare global {
  interface Window {
    lastResizeWidth?: number
    lastResizeHeight?: number
  }
}

function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), delay)
  }
}

// --- Lifecycle ---

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')

    // Support rounded rects for older browsers (polyfill-ish check)
    if (ctx && !ctx.roundRect) {
      ctx.roundRect = (x, y, w, h) => ctx!.rect(x, y, w, h)
    }

    adjustCanvasSize()

    // Add resize handler with debounce
    resizeHandler = debounce(() => {
      const currentWidth = window.innerWidth
      const currentHeight = window.innerHeight
      const threshold = 100

      if (isMobile.value) {
        const widthChanged = Math.abs(currentWidth - (window.lastResizeWidth || 0)) > 10
        const heightChanged = Math.abs(currentHeight - (window.lastResizeHeight || 0)) > threshold

        if (widthChanged || heightChanged) {
          window.lastResizeWidth = currentWidth
          window.lastResizeHeight = currentHeight
          adjustCanvasSize()
        }
      } else {
        if (
          Math.abs(currentWidth - (window.lastResizeWidth || 0)) > threshold ||
          Math.abs(currentHeight - (window.lastResizeHeight || 0)) > threshold
        ) {
          window.lastResizeWidth = currentWidth
          window.lastResizeHeight = currentHeight
          adjustCanvasSize()
        }
      }
    }, 500)

    window.addEventListener('resize', resizeHandler)
    window.lastResizeWidth = window.innerWidth
    window.lastResizeHeight = window.innerHeight

    // Start loop
    animationId = requestAnimationFrame(draw)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})
</script>

<style scoped lang="scss">
/* Plinko Game - Styled to match KfKblock */

#app-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 10px;
  max-width: 100vw;
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  border-radius: 8px;
  box-shadow: var(--theme-shadow-md);
  transition: background-color 0.3s;
  position: relative;
  overflow-x: hidden;
  user-select: none;
}

.game-header {
  font-size: 2rem;
  font-weight: bold;
  color: var(--theme-text-primary);
  margin: 10px 0;
  text-align: center;
  transition: color 0.3s;
}

.game-layout {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  gap: 20px;
  width: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 180px;
  flex-shrink: 0;
  user-select: none;

  .game-info {
    background-color: var(--theme-sidebar-bg);
    padding: 15px;
    border-radius: 8px;
    box-shadow: var(--theme-shadow-sm);
    text-align: center;
    transition: background-color 0.3s;

    .info-item {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-size: 1rem;
        color: var(--theme-sidebar-text);
        display: block;
        margin-bottom: 2px;
        transition: color 0.3s;
      }

      .info-value {
        font-size: 1.4em;
        font-weight: bold;
        color: var(--theme-sidebar-value);
        transition: color 0.3s;

        &.multiplier.highlight {
          color: var(--theme-success);
          text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
        }
      }

      .info-text {
        font-size: 0.85rem;
        color: var(--theme-text-secondary);
        line-height: 1.4;
        text-align: left;
        margin: 8px 0 0 0;
      }
    }

    .betting-amount-input {
      display: flex;
      gap: 5px;
      margin-top: 5px;
      align-items: center;
      justify-content: center;

      button {
        background-color: var(--theme-button-secondary-bg);
        border: none;
        color: var(--theme-button-secondary-text);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition:
          background-color 0.3s,
          color 0.3s;

        &:hover {
          background-color: var(--theme-button-secondary-hover-bg);
          color: var(--theme-button-secondary-hover-text);
        }
      }

      span {
        min-width: 40px;
        text-align: center;
        font-size: 1rem;
        font-weight: bold;
        color: var(--theme-text-primary);
        transition: color 0.3s;
      }
    }

    .betting-amount-control {
      display: flex;
      gap: 5px;
      margin-top: 5px;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      button {
        background-color: var(--theme-button-secondary-bg);
        border: none;
        color: var(--theme-button-secondary-text);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition:
          background-color 0.3s,
          color 0.3s;

        &:hover {
          background-color: var(--theme-button-secondary-hover-bg);
          color: var(--theme-button-secondary-hover-text);
        }
      }
    }
  }
}

.canvas-outer-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.canvas-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.plinko-canvas {
  border: 3px solid var(--theme-canvas-border);
  background-color: var(--theme-canvas-bg);
  image-rendering: crisp-edges;
  border-radius: 8px;
  transition:
    background-color 0.3s,
    border-color 0.3s;
  cursor: crosshair;
  display: block;
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.overlay-hint {
  position: absolute;
  top: 60px;
  left: 0;
  width: 100%;
  text-align: center;
  color: var(--theme-text-tertiary);
  opacity: 0.5;
  pointer-events: none;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.desktop-only {
  display: flex;
}

/* Mobile controls bar - shows on small screens */
.mobile-controls-bar {
  display: none;
  width: 100%;
  background-color: var(--theme-sidebar-bg);
  border-radius: 8px;
  padding: 10px;
  box-shadow: var(--theme-shadow-sm);
  transition: background-color 0.3s;
  user-select: none;

  .mobile-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .mobile-score-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;

    .mobile-score {
      font-size: 1.4em;
      font-weight: bold;
      color: var(--theme-sidebar-value);
    }

    .mobile-level {
      font-size: 1em;
      color: var(--theme-success);
      font-weight: 600;
    }
  }
}

/* Mobile stats */
.mobile-stats {
  display: none;
  width: 100%;
  background-color: var(--theme-sidebar-bg);
  padding: 12px;
  border-radius: 8px;
  box-shadow: var(--theme-shadow-sm);
  transition: background-color 0.3s;

  .mobile-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    text-align: center;

    .mobile-stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;

      .mobile-stat-label {
        font-size: 0.7em;
        color: var(--theme-sidebar-text);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .mobile-stat-value {
        font-size: 1.1em;
        font-weight: bold;
        color: var(--theme-sidebar-value);
      }
    }
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  #app-container {
    padding: 8px;
    gap: 10px;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .game-header {
    font-size: 1.5rem;
    margin: 5px 0;
  }

  .game-layout {
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .canvas-outer-wrapper {
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  .mobile-controls-bar {
    display: block;
  }

  .mobile-stats {
    display: block;
  }

  .desktop-only {
    display: none !important;
  }

  .overlay-hint {
    font-size: 0.8rem;
    top: 40px;
  }
}

/* Prevent zoom behaviors on mobile */
@media (max-width: 768px) {
  body {
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }
}
</style>
