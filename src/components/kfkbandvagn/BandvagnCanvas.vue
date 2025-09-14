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
      <button @click="resetZoom" class="control-btn" title="Reset zoom">🔍</button>
      <button
        @click="centerOnPlayer"
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

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import GamePopup from './GamePopup.vue'

// Props
const props = defineProps({
  players: {
    type: Array,
    default: () => [],
  },
  boardData: {
    type: Object,
    default: null,
  },
  currentPlayer: {
    type: Object,
    default: null,
  },
  selectedCell: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['cellSelected', 'actionPerformed'])

// Refs
const containerRef = ref(null)
const canvasRef = ref(null)
const ctx = ref(null)

// Canvas state
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const cellSize = ref(30)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })
const isLoading = ref(false)

// Popup state
const showPopup = ref(false)
const popupPosition = ref({ x: 0, y: 0 })
const selectedCell = ref(null)

// Touch state
const lastTouchDistance = ref(0)
const isMultiTouch = ref(false)

// Computed properties
const boardSize = computed(() => {
  if (!props.boardData) return { rows: 20, cols: 20 }
  return {
    rows: props.boardData.size?.rows || 20,
    cols: props.boardData.size?.columns || 20,
  }
})

const playableSize = computed(() => {
  const shrink = props.boardData?.shrink || 0
  return {
    rows: Math.max(1, boardSize.value.rows - shrink * 2),
    cols: Math.max(1, boardSize.value.cols - shrink * 2),
    shrink,
  }
})

const otherPlayersAtCell = computed(() => {
  if (!selectedCell.value) return []
  return props.players.filter(
    (p) =>
      p.position.row === selectedCell.value.row &&
      p.position.column === selectedCell.value.column &&
      p.uuid !== props.currentPlayer?.uuid &&
      p.taken_tank,
  )
})

const canMoveToCell = computed(() => {
  if (!selectedCell.value || !props.currentPlayer) return false

  const { row, col } = selectedCell.value
  const shrink = playableSize.value.shrink

  // Check if cell is within playable area
  if (
    row < shrink ||
    row >= playableSize.value.rows + shrink ||
    col < shrink ||
    col >= playableSize.value.cols + shrink
  ) {
    return false
  }

  // Check if cell is empty
  const hasPlayer = props.players.some(
    (p) => p.position.row === row && p.position.column === col && p.taken_tank,
  )
  if (hasPlayer) return false

  // Check if within range
  const distance =
    Math.abs(row - props.currentPlayer.position.row) +
    Math.abs(col - props.currentPlayer.position.column)

  return distance <= props.currentPlayer.range && distance > 0 && props.currentPlayer.tokens >= 1
})

const canShootAtCell = computed(() => {
  if (!selectedCell.value || !props.currentPlayer) return false

  const targetPlayers = otherPlayersAtCell.value.filter((p) => p.lives > 0)
  if (targetPlayers.length === 0) return false

  // Check if within range
  const { row, col } = selectedCell.value
  const distance =
    Math.abs(row - props.currentPlayer.position.row) +
    Math.abs(col - props.currentPlayer.position.column)

  return distance <= props.currentPlayer.range && distance > 0 && props.currentPlayer.tokens >= 1
})

// Canvas drawing functions
function setupCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value

  if (!canvas || !container) return

  // Set canvas size to container size
  const rect = container.getBoundingClientRect()
  canvasWidth.value = rect.width
  canvasHeight.value = rect.height

  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value

  ctx.value = canvas.getContext('2d')

  // Initial draw
  drawGame()
}

function drawGame() {
  if (!ctx.value) return

  // Clear canvas
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Save context
  ctx.value.save()

  // Apply zoom and pan
  ctx.value.scale(zoom.value, zoom.value)
  ctx.value.translate(pan.value.x, pan.value.y)

  // Draw board
  drawBoard()

  // Draw players
  drawPlayers()

  // Draw selected cell highlight
  if (selectedCell.value) {
    drawCellHighlight(selectedCell.value.row, selectedCell.value.col)
  }

  // Draw current player range
  if (props.currentPlayer) {
    drawPlayerRange()
  }

  // Restore context
  ctx.value.restore()
}

function drawBoard() {
  const { rows, cols } = boardSize.value
  const { shrink } = playableSize.value

  // Draw grid
  ctx.value.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--canvas-grid-color')
    .trim()
  ctx.value.lineWidth = 1

  // Draw vertical lines
  for (let col = 0; col <= cols; col++) {
    const x = col * cellSize.value
    ctx.value.beginPath()
    ctx.value.moveTo(x, 0)
    ctx.value.lineTo(x, rows * cellSize.value)
    ctx.value.stroke()
  }

  // Draw horizontal lines
  for (let row = 0; row <= rows; row++) {
    const y = row * cellSize.value
    ctx.value.beginPath()
    ctx.value.moveTo(0, y)
    ctx.value.lineTo(cols * cellSize.value, y)
    ctx.value.stroke()
  }

  // Draw playable area
  if (shrink > 0) {
    ctx.value.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas-bg-color')
      .trim()
    ctx.value.fillRect(
      shrink * cellSize.value,
      shrink * cellSize.value,
      (cols - shrink * 2) * cellSize.value,
      (rows - shrink * 2) * cellSize.value,
    )

    // Draw shrunk area overlay
    ctx.value.fillStyle = 'rgba(255, 0, 0, 0.2)'

    // Top
    ctx.value.fillRect(0, 0, cols * cellSize.value, shrink * cellSize.value)
    // Bottom
    ctx.value.fillRect(
      0,
      (rows - shrink) * cellSize.value,
      cols * cellSize.value,
      shrink * cellSize.value,
    )
    // Left
    ctx.value.fillRect(
      0,
      shrink * cellSize.value,
      shrink * cellSize.value,
      (rows - shrink * 2) * cellSize.value,
    )
    // Right
    ctx.value.fillRect(
      (cols - shrink) * cellSize.value,
      shrink * cellSize.value,
      shrink * cellSize.value,
      (rows - shrink * 2) * cellSize.value,
    )
  }
}

function drawPlayers() {
  props.players.forEach((player) => {
    if (!player.taken_tank) return

    const x = player.position.column * cellSize.value
    const y = player.position.row * cellSize.value

    // Draw player circle
    ctx.value.fillStyle = player.color
    ctx.value.strokeStyle = player.lives > 0 ? '#333' : '#999'
    ctx.value.lineWidth = 2

    ctx.value.beginPath()
    ctx.value.arc(
      x + cellSize.value / 2,
      y + cellSize.value / 2,
      cellSize.value / 3,
      0,
      Math.PI * 2,
    )
    ctx.value.fill()
    ctx.value.stroke()

    // Draw player name
    ctx.value.fillStyle = '#000'
    ctx.value.font = `${Math.max(10, cellSize.value / 3)}px Arial`
    ctx.value.textAlign = 'center'
    ctx.value.fillText(player.playerID, x + cellSize.value / 2, y + cellSize.value + 15)

    // Draw current player indicator
    if (player.uuid === props.currentPlayer?.uuid) {
      ctx.value.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--modal-header-color')
        .trim()
      ctx.value.lineWidth = 3
      ctx.value.beginPath()
      ctx.value.arc(
        x + cellSize.value / 2,
        y + cellSize.value / 2,
        cellSize.value / 2,
        0,
        Math.PI * 2,
      )
      ctx.value.stroke()
    }

    // Draw lives indicator
    if (player.lives > 0) {
      ctx.value.fillStyle = '#e74c3c'
      const heartSize = cellSize.value / 8
      for (let i = 0; i < player.lives; i++) {
        const heartX = x + 5 + i * (heartSize + 2)
        const heartY = y + 5
        ctx.value.fillRect(heartX, heartY, heartSize, heartSize)
      }
    }
  })
}

function drawCellHighlight(row, col) {
  const x = col * cellSize.value
  const y = row * cellSize.value

  ctx.value.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--modal-header-color')
    .trim()
  ctx.value.lineWidth = 3
  ctx.value.setLineDash([5, 5])
  ctx.value.strokeRect(x, y, cellSize.value, cellSize.value)
  ctx.value.setLineDash([])
}

function drawPlayerRange() {
  const range = props.currentPlayer.range
  const centerRow = props.currentPlayer.position.row
  const centerCol = props.currentPlayer.position.column

  ctx.value.fillStyle = 'rgba(76, 175, 80, 0.15)'

  for (let row = centerRow - range; row <= centerRow + range; row++) {
    for (let col = centerCol - range; col <= centerCol + range; col++) {
      const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol)
      if (distance <= range && distance > 0) {
        const x = col * cellSize.value
        const y = row * cellSize.value
        ctx.value.fillRect(x, y, cellSize.value, cellSize.value)
      }
    }
  }
}

// Coordinate transformation
function screenToBoard(screenX, screenY) {
  const rect = canvasRef.value.getBoundingClientRect()
  const canvasX = (screenX - rect.left) / zoom.value - pan.value.x
  const canvasY = (screenY - rect.top) / zoom.value - pan.value.y

  const col = Math.floor(canvasX / cellSize.value)
  const row = Math.floor(canvasY / cellSize.value)

  return { row, col }
}

function boardToScreen(row, col) {
  const canvasX = (col * cellSize.value + pan.value.x) * zoom.value
  const canvasY = (row * cellSize.value + pan.value.y) * zoom.value

  return { x: canvasX, y: canvasY }
}

// Event handlers
function handleCanvasClick(event) {
  if (isDragging.value) return

  const { row, col } = screenToBoard(event.clientX, event.clientY)

  // Check if click is within board bounds
  if (row < 0 || col < 0 || row >= boardSize.value.rows || col >= boardSize.value.cols) {
    return
  }

  selectedCell.value = { row, col }

  // Calculate popup position
  const { x, y } = boardToScreen(row, col)
  popupPosition.value = {
    x: Math.min(x + 50, canvasWidth.value - 250),
    y: Math.max(y - 50, 0),
  }

  showPopup.value = true
  emit('cellSelected', { row, col })
}

function handleMouseDown(event) {
  isDragging.value = false
  lastMousePos.value = { x: event.clientX, y: event.clientY }
}

function handleMouseMove(event) {
  const deltaX = event.clientX - lastMousePos.value.x
  const deltaY = event.clientY - lastMousePos.value.y

  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    isDragging.value = true
    pan.value.x += deltaX / zoom.value
    pan.value.y += deltaY / zoom.value
    drawGame()
  }

  lastMousePos.value = { x: event.clientX, y: event.clientY }
}

function handleMouseUp() {
  // Add small delay to prevent click after drag
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleWheel(event) {
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.5, Math.min(3, zoom.value * delta))

  // Zoom towards mouse position
  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const zoomFactor = newZoom / zoom.value
  pan.value.x = mouseX / zoom.value - mouseX / newZoom
  pan.value.y = mouseY / zoom.value - mouseY / newZoom

  zoom.value = newZoom
  drawGame()
}

// Touch events
function handleTouchStart(event) {
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    lastMousePos.value = { x: touch.clientX, y: touch.clientY }
    isDragging.value = false
  } else if (event.touches.length === 2) {
    isMultiTouch.value = true
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    lastTouchDistance.value = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
    )
  }
}

function handleTouchMove(event) {
  if (event.touches.length === 1 && !isMultiTouch.value) {
    const touch = event.touches[0]
    const deltaX = touch.clientX - lastMousePos.value.x
    const deltaY = touch.clientY - lastMousePos.value.y

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      isDragging.value = true
      pan.value.x += deltaX / zoom.value
      pan.value.y += deltaY / zoom.value
      drawGame()
    }

    lastMousePos.value = { x: touch.clientX, y: touch.clientY }
  } else if (event.touches.length === 2) {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2),
    )

    const delta = distance / lastTouchDistance.value
    const newZoom = Math.max(0.5, Math.min(3, zoom.value * delta))
    zoom.value = newZoom
    lastTouchDistance.value = distance
    drawGame()
  }
}

function handleTouchEnd() {
  setTimeout(() => {
    isDragging.value = false
    isMultiTouch.value = false
  }, 100)
}

// Control functions
function resetZoom() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  drawGame()
}

function centerOnPlayer() {
  if (!props.currentPlayer) return

  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2

  pan.value.x =
    centerX / zoom.value -
    (props.currentPlayer.position.column * cellSize.value + cellSize.value / 2)
  pan.value.y =
    centerY / zoom.value - (props.currentPlayer.position.row * cellSize.value + cellSize.value / 2)

  drawGame()
}

// Popup handlers
function handlePopupAction(action) {
  emit('actionPerformed', action)
  closePopup()
}

function closePopup() {
  showPopup.value = false
  selectedCell.value = null
  emit('cellSelected', null)
}

// Resize handler
function handleResize() {
  nextTick(() => {
    setupCanvas()
  })
}

// Watchers
watch(
  [() => props.players, () => props.boardData],
  () => {
    nextTick(() => {
      drawGame()
    })
  },
  { deep: true },
)

// Lifecycle
onMounted(() => {
  setupCanvas()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="scss">
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: 2px solid var(--canvas-border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--canvas-bg-color);
}

.game-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  display: block;
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
  background: var(--button-modal-action-bg);
  border: none;
  border-radius: 8px;
  color: var(--button-text-color);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--button-modal-action-hover-bg);
    transform: scale(1.05);
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 20;
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

/* Mobile adjustments */
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
