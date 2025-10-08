<template>
  <div class="canvas-container" ref="containerRef">
    <!-- Main game canvas -->
    <canvas
      ref="canvasRef"
      class="game-canvas"
      @click="handleCanvasClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel.prevent="handleWheel"
      @touchstart.prevent="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
    ></canvas>

    <!-- Game popup overlay -->
    <GamePopup
      v-if="showPopup && selectedCell"
      :cell="selectedCell"
      :current-player="currentPlayer"
      :other-players="otherPlayersAtCell"
      :can-move="canMoveToCell"
      :can-shoot="canShootAtCell"
      :position="popupPosition"
      @action="handlePopupAction"
      @close="closePopup"
    />

    <!-- Canvas controls overlay -->
    <div class="canvas-controls">
      <button @click="resetZoom" class="control-btn" title="Reset zoom">(0,0)</button>
      <button
        @click="centerOnPlayer(currentPlayer)"
        class="control-btn"
        title="Center on player"
        v-if="currentPlayer"
      >
        🎯
      </button>
    </div>

    <!-- Loading overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">⏳</div>
      <p>Laddar spel...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import GamePopup from './GamePopup.vue'
import type { Player } from '@/composables/kfkbandvagn/player'
import { useBandvagnStore } from '@/stores/bandvagnState'
import {
  createAnimationState,
  updateAnimations,
  addClickAnimation,
  addExplosion,
  addBullet,
  addTankMove,
  getTankAnimatedPosition,
  hasActiveAnimations,
  renderAnimations,
  type AnimationState,
} from '@/composables/kfkbandvagn/animations'

// Store
const gameStore = useBandvagnStore()

// Emits
const emit = defineEmits<{
  (e: 'actionPerformed', payload: any): void
}>()

// Refs
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)

// Canvas state
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const cellSize = ref(30)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const isZooming = ref(false)
const dragThreshold = 4
const dragMoved = ref(false)
const lastPointerPos = ref({ x: 0, y: 0 })
const isLoading = ref(false)
const dpr = ref(window.devicePixelRatio || 1)
const tankSprite = ref<HTMLImageElement | null>(null)
const SPRITE_RATIO = 16 / 24 // width / height, from original impl
// Cache for tinted sprites by color to avoid per-frame canvas creation
const tintedSpriteCache = new Map<string, HTMLCanvasElement>()

// Popup state
const showPopup = ref(false)
const popupPosition = ref({ x: 0, y: 0 })
const selectedCell = ref<{ row: number; col: number } | null>(null)

// Touch state
const lastTouchDistance = ref(0)
const isMultiTouch = ref(false)

// Animation state using animations.ts
const animationState = ref<AnimationState>(createAnimationState())
let rafId: number | null = null
const animFramesRemaining = ref(0)
// Keep last drawn position per player to avoid one-frame snapping when store updates before animations
const lastDrawnPositions = ref(new Map<string, { row: number; col: number }>())

// Theme cache to avoid style lookups inside the draw loop
const themeCache = ref({
  bg: '#000',
  grid: '#333',
  text: '#444',
  modalHeader: '#ff6',
})
const boardFont = ref('12px Arial, sans-serif')

function refreshThemeCache() {
  const hostEl = containerRef.value ?? document.documentElement
  const styles = getComputedStyle(hostEl)
  themeCache.value = {
    bg: styles.getPropertyValue('--canvas-bg-color').trim() || '#000',
    grid: styles.getPropertyValue('--canvas-grid-color').trim() || '#333',
    text: styles.getPropertyValue('--canvas-text-color').trim() || '#444',
    modalHeader: styles.getPropertyValue('--modal-header-color').trim() || '#ff6',
  }
  const family = styles.getPropertyValue('--theme-font-family').trim() || 'Arial, sans-serif'
  const px = Math.max(10, Math.floor(cellSize.value * 0.35))
  boardFont.value = `${px}px ${family}`
}

// Computed properties
const currentPlayer = computed(
  () => gameStore.allPlayers.find((p) => p.uuid === gameStore.currentPlayer?.uuid) || null,
)
const allPlayers = computed(() => gameStore.allPlayers)

const boardSize = computed(() => {
  console.log('gameStore.boardData', gameStore.boardData)
  if (!gameStore.boardData) return { rows: 0, cols: 0 }
  return {
    rows: gameStore.boardData.rows,
    cols: gameStore.boardData.cols,
  }
})

const playableSize = computed(() => {
  const hs = (gameStore.boardData as any)?.has_shrunked || { row: 0, column: 0 }
  return {
    rows: Math.max(1, boardSize.value.rows - hs.row * 2),
    cols: Math.max(1, boardSize.value.cols - hs.column * 2),
    has_shrunked: hs,
  }
})

const otherPlayersAtCell = computed(() => {
  if (!selectedCell.value) return [] as Player[]
  return gameStore.allPlayers.filter(
    (p) =>
      p.position.row === selectedCell.value!.row &&
      p.position.column === selectedCell.value!.col &&
      p.uuid !== gameStore.currentPlayer?.uuid,
  )
})

const canMoveToCell = computed(() => {
  if (!selectedCell.value || !gameStore.currentPlayer) return false
  return gameStore.canMoveToCell(selectedCell.value.row, selectedCell.value.col)
})

const canShootAtCell = computed(() => {
  if (!selectedCell.value || !gameStore.currentPlayer) return false

  // Allow shooting any tank here (taken or not) that has lives > 0
  const targetPlayers = otherPlayersAtCell.value.filter((p) => p.lives > 0)
  if (targetPlayers.length === 0) return false

  // Check if within range
  const { row, col } = selectedCell.value
  const distance =
    Math.abs(row - currentPlayer.value!.position.row) +
    Math.abs(col - currentPlayer.value!.position.column)

  return distance <= currentPlayer.value!.range && distance > 0 && currentPlayer.value!.tokens >= 1
})

// Measure container content box (excludes borders/scrollbars)
function getContainerContentSize(el: HTMLElement) {
  let width = el.clientWidth
  let height = el.clientHeight
  if (!width || !height) {
    const rect = el.getBoundingClientRect()
    const styles = getComputedStyle(el)
    const borderX =
      parseFloat(styles.borderLeftWidth || '0') + parseFloat(styles.borderRightWidth || '0')
    const borderY =
      parseFloat(styles.borderTopWidth || '0') + parseFloat(styles.borderBottomWidth || '0')
    width = Math.max(0, Math.floor(rect.width - borderX))
    height = Math.max(0, Math.floor(rect.height - borderY))
  }
  return { width, height }
}

// Canvas drawing functions
function setupCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value

  if (!canvas || !container) return

  // Use content-box size to avoid border-induced growth
  const { width: cw, height: ch } = getContainerContentSize(container)
  const nextW = Math.max(1, Math.floor(cw))
  const nextH = Math.max(1, Math.floor(ch))

  // If size hasn't changed, skip
  if (nextW === canvasWidth.value && nextH === canvasHeight.value) {
    return
  }

  canvasWidth.value = nextW
  canvasHeight.value = nextH

  dpr.value = window.devicePixelRatio || 1

  canvas.width = Math.floor(canvasWidth.value * dpr.value)
  canvas.height = Math.floor(canvasHeight.value * dpr.value)
  // Do not set inline CSS width/height — let CSS layout control sizing

  ctx.value = canvas.getContext('2d')
  if (!ctx.value) return
  ctx.value.setTransform(dpr.value, 0, 0, dpr.value, 0, 0)
  ctx.value.imageSmoothingEnabled = false

  // Compute cell size so the entire board fits in the container
  cellSize.value = 30

  // Refresh theme cache and schedule a draw
  refreshThemeCache()
  ensureLoopActive(1)
}

function drawGame() {
  if (!ctx.value) return
  if (boardSize.value.rows <= 0 || boardSize.value.cols <= 0) return

  // Advance animations first so players and range use up-to-date animated positions
  animationState.value = updateAnimations(animationState.value)

  // Clear canvas
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Save context
  ctx.value.save()

  // Apply zoom and pan
  ctx.value.scale(zoom.value, zoom.value)
  ctx.value.translate(pan.value.x, pan.value.y)

  // Draw board and entities
  drawBoard()
  drawPlayers()

  // Draw selected cell highlight
  if (selectedCell.value) {
    drawCellHighlight(selectedCell.value.row, selectedCell.value.col)
  }

  // Draw current player range
  if (currentPlayer.value) {
    drawPlayerRange()
  }

  // Restore context
  ctx.value.restore()

  // Draw UI overlays (e.g., animations) in screen space
  drawAnimations()
}

function drawPlayers() {
  const uuidWithAnimation = animationState.value.tankMoves
    .filter((tank) => tank.active)
    .map((t) => t.tankUuid)
  for (const player of allPlayers.value!) {
    // Check if this player has an active move animation
    const animatedPos = uuidWithAnimation.includes(player.uuid)
      ? getTankAnimatedPosition(animationState.value, player.uuid)
      : null

    // Determine position to draw this frame with a fallback to prevent single-frame snaps
    const prev = lastDrawnPositions.value.get(player.uuid) ?? {
      row: player.position.row,
      col: player.position.column,
    }

    let position = animatedPos || {
      row: player.position.row,
      col: player.position.column,
    }

    // If no animation is active but the store cell changed since last frame,
    // start an animation immediately and draw at the previous position this frame
    const prevCellRow = Math.round(prev.row)
    const prevCellCol = Math.round(prev.col)
    const jumpedCell = prevCellRow !== player.position.row || prevCellCol !== player.position.column
    if (!animatedPos && jumpedCell) {
      // Kick off a move animation from prev -> current store position
      animationState.value = addTankMove(
        animationState.value,
        prev.row,
        prev.col,
        player.position.row,
        player.position.column,
        player.uuid,
      )
      ensureLoopActive(6)
      // Draw using the previous position for this frame to avoid a visible snap
      position = prev
    }

    const x = position.col * cellSize.value
    const y = position.row * cellSize.value

    // Draw tank marker (closer to original): body + turret
    const isTaken = player.taken_tank
    const displayLives = frozenLives.value.get(player.uuid)?.display ?? player.lives
    const isAlive = displayLives > 0

    drawTank(
      ctx.value!,
      x,
      y,
      cellSize.value,
      player.color,
      isAlive,
      isTaken,
      player.uuid === currentPlayer.value?.uuid,
    )

    // Draw current player indicator
    if (player.uuid === currentPlayer.value?.uuid) {
      ctx.value!.strokeStyle = themeCache.value.modalHeader
      ctx.value!.lineWidth = 3
      ctx.value!.beginPath()
      ctx.value!.arc(
        x + cellSize.value / 2,
        y + cellSize.value / 2,
        cellSize.value / 2,
        0,
        Math.PI * 2,
      )
      ctx.value!.stroke()
    }

    // Draw lives indicator (freeze during hit animation if needed)
    if (displayLives > 0) {
      if (displayLives > 3) {
        // Draw life count if more than 3 lives
        ctx.value!.fillStyle = '#e74c3c'
        ctx.value!.font = `${Math.floor(cellSize.value * 0.3)}px Arial`
        ctx.value!.textAlign = 'left'
        ctx.value!.textBaseline = 'top'
        ctx.value!.fillText(`${displayLives}❤`, x, y + 1)
      } else {
        ctx.value!.fillStyle = '#e74c3c'
        const heartSize = cellSize.value / 8
        for (let i = 0; i < displayLives; i++) {
          const heartX = x + 5 + i * (heartSize + 2)
          const heartY = y + 5
          ctx.value!.fillRect(heartX, heartY, heartSize, heartSize)
        }
      }
    }
    // Update last drawn position for continuity
    lastDrawnPositions.value.set(player.uuid, { row: position.row, col: position.col })
  }
}

function drawTank(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  isAlive: boolean,
  isTaken: boolean,
  isCurrent: boolean,
) {
  context.save()
  context.imageSmoothingEnabled = false

  // Alpha based on lives and whether tank is taken
  const baseAlpha = isAlive ? Math.min(1, Math.max(0.4, (isTaken ? 0.7 : 0.5) + 0.15)) : 0.1
  context.globalAlpha = baseAlpha

  const sprite = tankSprite.value
  if (sprite && sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
    // Compute destination size keeping ratio and fitting in cell with padding
    const padding = Math.max(1, size * 0.08)
    let destH = size - padding * 2
    let destW = destH * SPRITE_RATIO
    if (destW > size - padding * 2) {
      destW = size - padding * 2
      destH = destW / SPRITE_RATIO
    }
    const destX = x + (size - destW) / 2
    const destY = y + (size - destH) / 2

    // Get or create tinted sprite for this color
    let tinted = tintedSpriteCache.get(color)
    if (!tinted) {
      const off = document.createElement('canvas')
      off.width = sprite.naturalWidth
      off.height = sprite.naturalHeight
      const octx = off.getContext('2d')!
      octx.imageSmoothingEnabled = false
      // Fill with tint color and multiply with sprite luminance
      octx.clearRect(0, 0, off.width, off.height)
      octx.fillStyle = color
      octx.fillRect(0, 0, off.width, off.height)
      octx.globalCompositeOperation = 'multiply'
      octx.drawImage(sprite, 0, 0)
      // Keep sprite alpha
      octx.globalCompositeOperation = 'destination-in'
      octx.drawImage(sprite, 0, 0)
      octx.globalCompositeOperation = 'source-over'
      tintedSpriteCache.set(color, off)
      tinted = off
    }
    // Draw tinted sprite scaled
    context.drawImage(tinted, destX, destY, destW, destH)
  } else {
    // Fallback to simple rectangle tank if image not loaded
    const bodyW = size * 0.8
    const bodyH = size * 0.55
    const bodyX = x + (size - bodyW) / 2
    const bodyY = y + (size - bodyH) / 2
    const radius = Math.max(2, size * 0.08)

    // Body
    context.fillStyle = color
    context.strokeStyle = isAlive ? '#222' : '#999'
    context.lineWidth = Math.max(1, size * 0.06)
    roundRect(context, bodyX, bodyY, bodyW, bodyH, radius)
    context.fill()
    context.stroke()

    // Turret (upwards)
    const turretR = size * 0.18
    const cx = x + size / 2
    const cy = y + size / 2
    context.beginPath()
    context.arc(cx, cy, turretR, 0, Math.PI * 2)
    context.fillStyle = '#fff8'
    context.fill()
    context.stroke()

    // Barrel
    const barrelW = Math.max(2, size * 0.08)
    const barrelL = size * 0.35
    context.beginPath()
    context.moveTo(cx - barrelW / 2, cy - turretR)
    context.lineTo(cx - barrelW / 2, cy - turretR - barrelL)
    context.lineTo(cx + barrelW / 2, cy - turretR - barrelL)
    context.lineTo(cx + barrelW / 2, cy - turretR)
    context.closePath()
    context.fillStyle = '#222a'
    context.fill()
  }

  context.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawBoard() {
  if (!ctx.value) return

  const rows = boardSize.value.rows
  const cols = boardSize.value.cols
  const hs = (gameStore.boardData && (gameStore.boardData as any).has_shrunked) || {
    row: 0,
    column: 0,
  }
  const ts = (gameStore.boardData && (gameStore.boardData as any).to_shrink) || {
    row: 0,
    column: 0,
  }

  // Background
  ctx.value.fillStyle = themeCache.value.bg
  // Fill the entire visible canvas area, not just the board area
  ctx.value.save()
  ctx.value.setTransform(1, 0, 0, 1, 0, 0) // Reset transform to fill entire canvas
  ctx.value.fillRect(0, 0, canvasRef.value!.width, canvasRef.value!.height)
  ctx.value.restore()

  // Determine visible board region in content coordinates to limit draw work
  const viewLeft = Math.max(0, -pan.value.x)
  const viewTop = Math.max(0, -pan.value.y)
  const viewRight = Math.min(cols * cellSize.value, viewLeft + canvasWidth.value / zoom.value)
  const viewBottom = Math.min(rows * cellSize.value, viewTop + canvasHeight.value / zoom.value)
  const startCol = Math.max(0, Math.floor(viewLeft / cellSize.value) - 1)
  const endCol = Math.min(cols, Math.ceil(viewRight / cellSize.value) + 1)
  const startRow = Math.max(0, Math.floor(viewTop / cellSize.value) - 1)
  const endRow = Math.min(rows, Math.ceil(viewBottom / cellSize.value) + 1)

  // Grid color
  ctx.value.strokeStyle = themeCache.value.grid
  ctx.value.lineWidth = 0.5

  // Batch draw vertical lines
  ctx.value.beginPath()
  for (let col = startCol; col <= endCol; col++) {
    const x = Math.floor(col * cellSize.value) + 0.5
    ctx.value.moveTo(x, startRow * cellSize.value)
    ctx.value.lineTo(x, endRow * cellSize.value)
  }
  ctx.value.stroke()

  // Batch draw horizontal lines
  ctx.value.beginPath()
  for (let row = startRow; row <= endRow; row++) {
    const y = Math.floor(row * cellSize.value) + 0.5
    ctx.value.moveTo(startCol * cellSize.value, y)
    ctx.value.lineTo(endCol * cellSize.value, y)
  }
  ctx.value.stroke()

  // Draw overlays for already shrunk and to-be-shrunk zones
  const top = hs.row
  const left = hs.column
  const bottomStart = rows - hs.row
  const rightStart = cols - hs.column
  // Already shrunk areas - slight red (draw as 4 rectangles instead of per-cell)
  if (top > 0 || left > 0) {
    ctx.value.fillStyle = 'rgba(255, 64, 64, 0.25)'
    // Top band
    ctx.value.fillRect(0, 0, cols * cellSize.value, top * cellSize.value)
    // Bottom band
    ctx.value.fillRect(0, bottomStart * cellSize.value, cols * cellSize.value, top * cellSize.value)
    // Left band (trim to exclude top/bottom corners)
    const middleY = top * cellSize.value
    const middleH = Math.max(0, (rows - top * 2) * cellSize.value)
    if (left > 0 && middleH > 0) {
      ctx.value.fillRect(0, middleY, left * cellSize.value, middleH)
    }
    // Right band (trim to exclude top/bottom corners)
    if (left > 0 && middleH > 0) {
      ctx.value.fillRect(rightStart * cellSize.value, middleY, left * cellSize.value, middleH)
    }
  }

  // To be shrunk areas - yellowish
  if (ts.row > 0 || ts.column > 0) {
    ctx.value.fillStyle = 'rgba(255, 215, 0, 0.25)'
    const innerW = (cols - left * 2) * cellSize.value
    const innerH = (rows - top * 2) * cellSize.value
    const innerX = left * cellSize.value
    const innerY = top * cellSize.value
    // Top to-shrink band
    const topH = Math.max(0, Math.min(ts.row, rows - 2 * top)) * cellSize.value
    if (topH > 0) {
      ctx.value.fillRect(innerX, innerY, innerW, topH)
    }
    // Bottom to-shrink band
    const bottomH = Math.max(0, Math.min(ts.row, rows - 2 * top)) * cellSize.value
    if (bottomH > 0) {
      ctx.value.fillRect(innerX, innerY + innerH - bottomH, innerW, bottomH)
    }
    // Middle height for side bands to avoid overlapping top/bottom corners
    const middleY2 = innerY + topH
    const middleH2 = Math.max(0, innerH - topH - bottomH)
    // Left to-shrink band (only middle area)
    const leftW = Math.max(0, Math.min(ts.column, cols - 2 * left)) * cellSize.value
    if (leftW > 0 && middleH2 > 0) {
      ctx.value.fillRect(innerX, middleY2, leftW, middleH2)
    }
    // Right to-shrink band (only middle area)
    const rightW = Math.max(0, Math.min(ts.column, cols - 2 * left)) * cellSize.value
    if (rightW > 0 && middleH2 > 0) {
      ctx.value.fillRect(innerX + innerW - rightW, middleY2, rightW, middleH2)
    }
  }

  // Grid indices (like original script)
  ctx.value.fillStyle = themeCache.value.text
  ctx.value.font = boardFont.value
  ctx.value.textAlign = 'center'
  ctx.value.textBaseline = 'top'
  for (let c = startCol; c < endCol; c++) {
    const x = c * cellSize.value + cellSize.value / 2
    ctx.value.fillText(String(c), x, 5 - Math.min(pan.value.y, cellSize.value))
  }
  ctx.value.textAlign = 'left'
  ctx.value.textBaseline = 'middle'
  for (let r = startRow; r < endRow; r++) {
    const y = r * cellSize.value + cellSize.value / 2
    ctx.value.fillText(String(r), 5 - Math.min(pan.value.x, cellSize.value), y)
  }
}

// Animation rendering using animations.ts
function drawAnimations() {
  if (!ctx.value) return

  // Render all animations
  renderAnimations(
    ctx.value,
    animationState.value,
    cellSize.value,
    zoom.value,
    pan.value.x,
    pan.value.y,
  )
}

// Adaptive render loop: runs while active, coasts for a few frames when activity stops
let lastDrawTime = 0
function updateLoop() {
  // Optional FPS calc (disabled by default to avoid console overhead)
  // const now = performance.now()
  // const fps = 1000 / (now - lastDrawTime)
  // lastDrawTime = now

  const activeNow =
    isPanning.value ||
    isMultiTouch.value ||
    isZooming.value ||
    hasActiveAnimations(animationState.value)

  // If active, reset coast; otherwise, count down
  if (activeNow) {
    animFramesRemaining.value = 10
  } else if (animFramesRemaining.value > 0) {
    animFramesRemaining.value -= 1
  }
  // Continue while there is activity or coast frames left
  if (activeNow || animFramesRemaining.value > 0) {
    drawGame()
  }
  rafId = requestAnimationFrame(updateLoop)
}

function ensureLoopActive(minCoast = 3) {
  animFramesRemaining.value = Math.max(animFramesRemaining.value, minCoast)
}

function drawCellHighlight(row: number, col: number) {
  const x = col * cellSize.value
  const y = row * cellSize.value

  ctx.value!.strokeStyle = themeCache.value.modalHeader
  ctx.value!.lineWidth = 3
  ctx.value!.setLineDash([5, 5])
  ctx.value!.strokeRect(x, y, cellSize.value, cellSize.value)
  ctx.value!.setLineDash([])
}

function drawPlayerRange() {
  if (!currentPlayer.value || !ctx.value) return
  const range = currentPlayer.value!.range
  // Follow animated position if moving
  const animated = currentPlayer.value
    ? getTankAnimatedPosition(animationState.value, currentPlayer.value.uuid)
    : null
  const centerRow = animated ? Math.round(animated.row) : currentPlayer.value!.position.row
  const centerCol = animated ? Math.round(animated.col) : currentPlayer.value!.position.column

  ctx.value.fillStyle = 'rgba(76, 175, 80, 0.15)'
  // Manhattan distance range
  for (let row = centerRow - range; row <= centerRow + range; row++) {
    for (let col = centerCol - range; col <= centerCol + range; col++) {
      const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol)
      if (
        distance <= range &&
        distance > 0 &&
        row >= 0 &&
        col >= 0 &&
        row < boardSize.value.rows &&
        col < boardSize.value.cols
      ) {
        const x = col * cellSize.value
        const y = row * cellSize.value
        ctx.value.fillRect(x, y, cellSize.value, cellSize.value)
      }
    }
  }
  /*
  ctx.value.fillStyle = 'rgba(180, 75, 80, 0.15)'
  // Euclidean distance range
  for (let row = centerRow - range; row <= centerRow + range; row++) {
    for (let col = centerCol - range; col <= centerCol + range; col++) {
      const distance = Math.round(Math.sqrt((row - centerRow) ** 2 + (col - centerCol) ** 2))
      if (
        distance <= range &&
        distance > 0 &&
        row >= 0 &&
        col >= 0 &&
        row < boardSize.value.rows &&
        col < boardSize.value.cols
      ) {
        const x = col * cellSize.value
        const y = row * cellSize.value
        ctx.value.fillRect(x, y, cellSize.value, cellSize.value)
      }
    }
  }
  // Euclidean Circle outline
  ctx.value.strokeStyle = 'rgba(180, 75, 80, 0.5)'
  ctx.value.lineWidth = 2
  ctx.value.beginPath()
  ctx.value.arc(
    centerCol * cellSize.value + cellSize.value / 2,
    centerRow * cellSize.value + cellSize.value / 2,
    range * cellSize.value,
    0,
    Math.PI * 2,
  )
  ctx.value.stroke()
  */
}

// Coordinate transformation
function screenToBoard(screenX: number, screenY: number) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const canvasX = (screenX - rect.left) / zoom.value - pan.value.x
  const canvasY = (screenY - rect.top) / zoom.value - pan.value.y

  const col = Math.floor(canvasX / cellSize.value)
  const row = Math.floor(canvasY / cellSize.value)

  return { row, col }
}

function boardToScreen(row: number, col: number) {
  const canvasX = (col * cellSize.value + pan.value.x) * zoom.value
  const canvasY = (row * cellSize.value + pan.value.y) * zoom.value

  return { x: canvasX, y: canvasY }
}

// Event handlers
function handleCanvasClick(event: MouseEvent) {
  if (isPanning.value || dragMoved.value) return

  const { row, col } = screenToBoard(event.clientX, event.clientY)

  // Check if click is within board bounds
  if (row < 0 || col < 0 || row >= boardSize.value.rows || col >= boardSize.value.cols) {
    return
  }

  // Check if clicked cell is same as selected
  if (selectedCell.value && selectedCell.value.row === row && selectedCell.value.col === col) {
    console.log('Cell clicked again, toggling popup off')
    // Toggle popup visibility
    showPopup.value = !showPopup.value
    // Deselect cell
    selectedCell.value = null
    ensureLoopActive(1)
    return
  }

  selectedCell.value = { row, col }
  console.log('Cell clicked:', row, col)

  // If clicked cell has any player, trigger click animation
  const playerAtCell = allPlayers.value!.find(
    (p) => p.position.row === row && p.position.column === col,
  )
  if (playerAtCell) {
    // Add click animation using animations.ts
    animationState.value = addClickAnimation(
      animationState.value,
      row,
      col,
      cellSize.value,
      playerAtCell.color,
    )
    ensureLoopActive(5)
  }

  // Calculate popup position
  const { x, y } = boardToScreen(row, col)
  popupPosition.value = {
    x: Math.min(x + 50, canvasWidth.value - 250),
    y: Math.max(y - 250, 0),
  }

  showPopup.value = true
  ensureLoopActive(1)
}

function handleMouseDown(event: MouseEvent) {
  isPanning.value = true
  dragMoved.value = false
  lastPointerPos.value = { x: event.clientX, y: event.clientY }
}

function handleMouseMove(event: MouseEvent) {
  if (!isPanning.value) return
  const deltaX = event.clientX - lastPointerPos.value.x
  const deltaY = event.clientY - lastPointerPos.value.y
  if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
    dragMoved.value = true
  }
  pan.value.x += deltaX / zoom.value
  pan.value.y += deltaY / zoom.value
  lastPointerPos.value = { x: event.clientX, y: event.clientY }
  ensureLoopActive(10)
}

function handleMouseUp() {
  isPanning.value = false
  ensureLoopActive(5)
}

function handleWheel(event: WheelEvent) {
  isZooming.value = true
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.5, Math.min(3, zoom.value * delta))

  // Zoom towards mouse position
  const rect = canvasRef.value!.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  // Compute world coords under cursor before zoom
  const worldX = mouseX / zoom.value - pan.value.x
  const worldY = mouseY / zoom.value - pan.value.y

  // Apply new zoom and adjust pan so the same world point stays under cursor
  pan.value.x = mouseX / newZoom - worldX
  pan.value.y = mouseY / newZoom - worldY

  zoom.value = newZoom
  ensureLoopActive(10)
  // Clear zooming flag after this turn of the event loop
  setTimeout(() => (isZooming.value = false), 0)
}

// Touch events
function handleTouchStart(event: TouchEvent) {
  if (event.touches.length === 1) {
    const touch = event.touches.item(0)!
    lastPointerPos.value = { x: touch.clientX, y: touch.clientY }
    isPanning.value = true
    dragMoved.value = false
  } else if (event.touches.length === 2) {
    isMultiTouch.value = true
    const touch1 = event.touches.item(0)!
    const touch2 = event.touches.item(1)!
    lastTouchDistance.value = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
    )
  }
}

function handleTouchMove(event: TouchEvent) {
  if (event.touches.length === 1 && !isMultiTouch.value) {
    const touch = event.touches.item(0)!
    const deltaX = touch.clientX - lastPointerPos.value.x
    const deltaY = touch.clientY - lastPointerPos.value.y

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      pan.value.x += deltaX / zoom.value
      pan.value.y += deltaY / zoom.value
      ensureLoopActive(10)
    }

    lastPointerPos.value = { x: touch.clientX, y: touch.clientY }
    // Ensure we redraw during touch panning
    ensureLoopActive(10)
  } else if (event.touches.length === 2) {
    const touch1 = event.touches.item(0)!
    const touch2 = event.touches.item(1)!
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
    )

    const delta = distance / lastTouchDistance.value
    const newZoom = Math.max(0.5, Math.min(3, zoom.value * delta))
    zoom.value = newZoom
    lastTouchDistance.value = distance
    isMultiTouch.value = true
    ensureLoopActive(10)
  }
}

function handleTouchEnd() {
  isPanning.value = false
  isMultiTouch.value = false
}

// Control functions
function resetZoom() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  ensureLoopActive(5)
}

function centerOnPlayer(p?: any) {
  if (!p) return
  console.log('Centering on player', p.name, p.position)
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2

  pan.value.x = centerX / zoom.value - (p.position.column * cellSize.value + cellSize.value / 2)
  pan.value.y = centerY / zoom.value - (p.position.row * cellSize.value + cellSize.value / 2)

  // Show popup
  selectedCell.value = { row: p.position.row, col: p.position.column }
  const { x, y } = boardToScreen(p.position.row, p.position.column)
  popupPosition.value = {
    x: Math.min(x + 50, canvasWidth.value - 250),
    y: Math.max(y - 250, 0),
  }
  showPopup.value = true
  ensureLoopActive(3)
}

// Animation helper functions
function triggerExplosion(row: number, col: number, onComplete?: () => void) {
  animationState.value = addExplosion(
    animationState.value,
    row,
    col,
    cellSize.value,
    'explosion',
    onComplete,
  )
  ensureLoopActive(10)
}

function triggerBullet(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  onComplete?: () => void,
) {
  const startX = (fromCol + 0.5) * cellSize.value
  const startY = (fromRow + 0.5) * cellSize.value
  const endX = (toCol + 0.5) * cellSize.value
  const endY = (toRow + 0.5) * cellSize.value

  animationState.value = addBullet(
    animationState.value,
    startX,
    startY,
    endX,
    endY,
    0.05,
    onComplete,
  )
  ensureLoopActive(10)
}

/**
 * Trigger a tank movement animation
 */
function triggerTankMove(
  tankUuid: string,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
) {
  animationState.value = addTankMove(animationState.value, fromRow, fromCol, toRow, toCol, tankUuid)
  ensureLoopActive(10)
}

// Composite function to trigger bullet followed by explosion
function triggerBulletAndExplosion(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  onExplosionComplete?: () => void,
) {
  // Capture target at time of firing to unfreeze correctly
  const targetAtFire = (allPlayers.value || []).find(
    (p) => p.position.row === toRow && p.position.column === toCol,
  )
  triggerBullet(fromRow, fromCol, toRow, toCol, () => {
    // When bullet reaches target, trigger explosion
    triggerExplosion(toRow, toCol, () => {
      if (targetAtFire) {
        unfreezePlayerLives(targetAtFire.uuid)
      }
      onExplosionComplete?.()
    })
  })
}

// Expose functions for external use
defineExpose({
  triggerExplosion,
  triggerBullet,
  triggerBulletAndExplosion,
  triggerTankMove,
  centerOnPlayer,
})
function handlePopupAction(action: any) {
  // For move actions, we need to handle them specially to trigger animations
  // Watcher will dedupe identical moves
  if (action.action === 'move' && currentPlayer.value) {
    const fromRow = currentPlayer.value.position.row
    const fromCol = currentPlayer.value.position.column
    const toRow = action.targetCell.row
    const toCol = action.targetCell.col

    // Add animation trigger to the action
    const actionWithAnimation = {
      ...action,
      animationTrigger: {
        triggerTankMove: () => {
          triggerTankMove(currentPlayer.value!.uuid, fromRow, fromCol, toRow, toCol)
        },
      },
    }

    emit('actionPerformed', actionWithAnimation)
  } else {
    emit('actionPerformed', action)
  }
  closePopup()
}

function closePopup() {
  showPopup.value = false
  selectedCell.value = null
}

// Resize handler: coalesce via requestAnimationFrame
let pendingResizeRaf: number | null = null
function handleResize() {
  if (pendingResizeRaf !== null) {
    cancelAnimationFrame(pendingResizeRaf)
  }
  pendingResizeRaf = requestAnimationFrame(() => {
    pendingResizeRaf = null
    setupCanvas()
    ensureLoopActive(2)
  })
}

// Watchers
watch(
  () => [allPlayers.value, gameStore.boardData, currentPlayer.value],
  () => {
    nextTick(() => ensureLoopActive(3))
  },
  { deep: true },
)

// Dedupe state
const processedLogKeys = ref(new Set<string>())
const frozenLives = ref(new Map<string, { display: number; pending: number }>()) // uuid -> frozen display and pending explosions

// Helper: build a unique key for logs to avoid double-processing
function logKey(log: any): string {
  const t = String(log.timestamp ?? log.created_at ?? '')
  const a = String(log.action ?? '')
  const p = String(log.playerID ?? '')
  const tgt = String(log.details?.targetUUID ?? log.details?.targetUser ?? '')
  return `${t}|${a}|${p}|${tgt}`
}

/** Helper: get player by playerID or uuid */
function findPlayerByIdentifiers(idOrName: string): Player | null {
  if (!idOrName) return null
  return (
    allPlayers.value!.find((p) => p.uuid === idOrName) ||
    allPlayers.value!.find((p) => p.playerID === idOrName) ||
    null
  )
}

function hasActiveMoveTo(tankUuid: string, toRow: number, toCol: number): boolean {
  return (
    animationState.value.tankMoves.find(
      (m) =>
        m.tankUuid === tankUuid &&
        m.active &&
        Math.round(m.endRow) === toRow &&
        Math.round(m.endCol) === toCol,
    ) !== undefined
  )
}

function freezePlayerLives(uuid: string, prevLives: number) {
  const entry = frozenLives.value.get(uuid)
  if (!entry) {
    frozenLives.value.set(uuid, { display: prevLives, pending: 1 })
  } else {
    entry.pending += 1
    // Keep the larger of the existing display and new prevLives to ensure we don't drop early
    entry.display = Math.max(entry.display, prevLives)
  }
}
function unfreezePlayerLives(uuid: string) {
  const entry = frozenLives.value.get(uuid)
  if (!entry) return
  entry.pending -= 1
  if (entry.pending <= 0) {
    frozenLives.value.delete(uuid)
  }
}

// Process new logs for animations
/* We watch logs for making the animations since the data from 
supabase realtime is missing details such as the shooter in shot action 
*/
watch(
  () => gameStore.boardData?.logs,
  (logs) => {
    if (!logs || !Array.isArray(logs)) return
    for (const log of logs) {
      const key = logKey(log)
      if (processedLogKeys.value.has(key)) continue

      if (log.action === 'move') {
        // Expected schema of move log:
        // details: { from: {row,column}, to: {row,column}, distance, cost }
        const mover = findPlayerByIdentifiers(String(log.playerID ?? ''))
        const from = (log.details?.from ?? null) as { row: number; column: number } | null
        const to = (log.details?.to ?? null) as { row: number; column: number } | null
        if (
          mover &&
          from &&
          to &&
          typeof from.row === 'number' &&
          typeof from.column === 'number' &&
          typeof to.row === 'number' &&
          typeof to.column === 'number'
        ) {
          // Avoid double-animating if an identical target is already active
          if (!hasActiveMoveTo(mover.uuid, to.row, to.column)) {
            triggerTankMove(mover.uuid, from.row, from.column, to.row, to.column)
            ensureLoopActive(6)
          }
        }
      } else if (log.action === 'shot') {
        // details: may include from/to or only targetUser/targetUUID and possibly targetUserLives (left after shot)
        const shooter = findPlayerByIdentifiers(String(log.playerID ?? ''))
        const target = findPlayerByIdentifiers(
          String(log.details?.targetUUID ?? log.details?.targetUser ?? ''),
        )

        // Freeze target lives to previous value until explosion completes
        if (target) {
          const livesAfter = Number(log.details?.targetUserLives)
          if (Number.isFinite(livesAfter)) {
            freezePlayerLives(target.uuid, livesAfter + 1)
          } else {
            // Fallback: assume 1 life was removed
            freezePlayerLives(target.uuid, target.lives + 1)
          }
        }

        // Determine bullet path
        const fromPos = (log.details?.from ?? null) as { row: number; column: number } | null
        const toPos = (log.details?.to ?? null) as { row: number; column: number } | null

        // Prefer explicit positions in logs; otherwise use on-screen positions
        const shooterAnim = shooter
          ? getTankAnimatedPosition(animationState.value, shooter.uuid)
          : null
        const fromRow =
          fromPos && typeof fromPos.row === 'number'
            ? fromPos.row
            : shooterAnim
              ? Math.round(shooterAnim.row)
              : shooter?.position.row
        const fromCol =
          fromPos && typeof fromPos.column === 'number'
            ? fromPos.column
            : shooterAnim
              ? Math.round(shooterAnim.col)
              : shooter?.position.column
        const toRow = toPos && typeof toPos.row === 'number' ? toPos.row : target?.position.row
        const toCol =
          toPos && typeof toPos.column === 'number' ? toPos.column : target?.position.column

        if ([fromRow, fromCol, toRow, toCol].every((v) => typeof v === 'number')) {
          triggerBulletAndExplosion(
            fromRow as number,
            fromCol as number,
            toRow as number,
            toCol as number,
            () => {
              if (target) unfreezePlayerLives(target.uuid)
            },
          )
        } else if (target && typeof toRow === 'number' && typeof toCol === 'number') {
          // Fallback: explosion-only at the target
          triggerExplosion(toRow as number, toCol as number, () => {
            unfreezePlayerLives(target.uuid)
          })
        }
        ensureLoopActive(8)
      }

      processedLogKeys.value.add(key)
    }
  },
  { deep: false },
)

// Keep font cache in sync with cell size
watch(
  () => cellSize.value,
  () => {
    refreshThemeCache()
    ensureLoopActive(2)
  },
)

onMounted(() => {
  setupCanvas()
  // Robust resize handling via ResizeObserver
  window.addEventListener('resize', handleResize)

  // Load tank sprite from public assets once
  const img = new Image()
  img.src = '/assets/bandvagn no shadow.png'
  img.decoding = 'async'
  img.onload = () => {
    tankSprite.value = img
    ensureLoopActive(2)
  }
  // Populate theme cache in case CSS loads late
  refreshThemeCache()
  updateLoop()
  ensureLoopActive(1)

  // Initialize processed logs to prevent retroactive animations
  const logs = gameStore.boardData?.logs || []
  for (const log of logs) {
    processedLogKeys.value.add(logKey(log))
  }
  // Seed last drawn positions to current player positions on mount
  for (const p of allPlayers.value || []) {
    lastDrawnPositions.value.set(p.uuid, { row: p.position.row, col: p.position.column })
  }
})

onBeforeUnmount(() => {
  if (pendingResizeRaf !== null) {
    cancelAnimationFrame(pendingResizeRaf)
    pendingResizeRaf = null
  }
  window.removeEventListener('resize', handleResize)
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  animFramesRemaining.value = 0
  // Clear all animations
  animationState.value = createAnimationState()
})
</script>

<style scoped lang="scss">
/* Import theme to get access to CSS custom properties */
@use '@/styles/theme.scss';

/* Map theme variables for canvas */
.canvas-container,
.game-canvas {
  /* Canvas theme variables mapped to centralized theme */
  --canvas-bg-color: var(--theme-canvas-bg);
  --canvas-grid-color: var(--theme-canvas-grid);
  --canvas-text-color: var(--theme-text-primary);
  --modal-header-color: var(--theme-canvas-kfkbandvagn-accent);
  --canvas-border-color: var(--theme-canvas-border);
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  max-height: 80vh;
  overflow: hidden;
  background: var(--canvas-bg-color);
  border: 1px solid var(--canvas-border-color);
  border-radius: 8px;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}
.game-canvas:active {
  cursor: grabbing;
}

.canvas-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.control-btn {
  width: 40px;
  height: 40px;
  cursor: pointer;
  background: var(--theme-button-success-bg);
  color: var(--theme-button-primary-text);
  border: 1px solid var(--theme-button-primary-border);
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.loading-overlay {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: var(--theme-bg-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-on-dark);
  z-index: 20;
  backdrop-filter: blur(4px);
}

.loading-spinner {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .canvas-container {
    min-height: 300px;
  }
  .control-btn {
    width: 35px;
    height: 35px;
    font-size: 14px;
  }
}
</style>
