<template>
  <div id="app-container">
    <h1 class="game-header">KfKblock</h1>

    <!-- Leaderboard Section -->
    <div class="leaderboard-container">
      <button @click="toggleLeaderboard" class="leaderboard-toggle">
        <span>🏆 Topplista</span>
        <span class="toggle-icon" :class="{ expanded: showLeaderboard }">▼</span>
      </button>
      <div class="leaderboard-wrapper" :class="{ expanded: showLeaderboard }">
        <div class="leaderboard-content">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Plats</th>
                <th>Spelare</th>
                <th>Poäng</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(player, index) in topPlayers"
                :key="player.playerID"
                class="leaderboard-row"
              >
                <td class="position">{{ index + 1 }}</td>
                <td class="player-name">{{ player.playerID }}</td>
                <td class="score">{{ player.Score.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Mobile controls bar - shows on small screens -->
    <div class="mobile-controls-bar">
      <div class="mobile-top-row">
        <div class="mobile-score-info">
          <span class="mobile-score">Poäng: {{ score }}</span>
          <span class="mobile-level">Nivå: {{ level }}</span>
        </div>
        <div class="mobile-btn-container">
          <button
            @click="togglePause"
            class="mobile-btn"
            :title="gamePaused ? 'Fortsätt' : 'Pausa'"
          >
            <span v-if="gamePaused && pauseTimer == 0">▶</span>
            <span v-else-if="gamePaused && pauseTimer > 0">{{ pauseTimer.toFixed(1) }}</span>
            <span v-else>⏸</span>
          </button>
          <button
            @click="cycleControlsMode"
            class="mobile-btn"
            :title="controlsMode === 1 ? 'Dölj pilar' : 'Visa pilar'"
          >
            <span v-if="controlsMode === 1">◆</span>
            <span v-else>◇</span>
          </button>
          <button @click="toggleInfo" class="mobile-btn" title="Info">ℹ︎</button>
        </div>
      </div>
      <div class="mobile-stats-mini">
        <div class="mini-stat">
          <span class="mini-label">Rader</span
          ><span class="mini-value">{{ levelClearedRows }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Totala</span><span class="mini-value">{{ linesCleared }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Tid</span><span class="mini-value">{{ formattedTime }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Block</span><span class="mini-value">{{ blocksUsed }}</span>
        </div>
      </div>
    </div>

    <div class="game-layout">
      <!-- Desktop sidebar - hidden on mobile -->
      <div class="sidebar desktop-only">
        <div class="sidebar-btn-container">
          <button @click="togglePause" class="sidebar-btn">
            <span v-if="gamePaused && pauseTimer == 0"> Fortsätt </span>
            <span v-else-if="gamePaused && pauseTimer > 0"> {{ pauseTimer.toFixed(1) }} </span>
            <span v-else> Pausa </span>
          </button>
          <button @click="cycleControlsMode" class="sidebar-btn">
            <span v-if="controlsMode === 1">Dölj pilar</span>
            <span v-else>Visa pilar</span>
          </button>
          <button
            @click="toggleInfo"
            class="sidebar-btn"
            :title="infoShown ? 'Dölj info' : 'Visa info'"
          >
            <span>{{ infoShown ? 'ℹ︎ Dölj' : 'ℹ︎ Info' }}</span>
          </button>
        </div>
        <div class="next-piece-container">
          <span class="info-label">Next</span>
          <canvas class="kfkblock-canvas" id="nextPieceCanvas"></canvas>
        </div>
      </div>

      <div class="canvas-outer-wrapper">
        <AddPlayerForm
          v-if="showModal"
          :score="score"
          :level="level"
          :linesCleared="linesCleared"
          :gameData="gameDataForSubmission"
          :gameOver="gameOver"
          :gameStarted="gameStarted"
          @startGame="startGame"
        />
        <div class="canvas-and-next-container">
          <div class="canvas-container">
            <!-- Canvas Overlay Controls -->
            <div class="canvas-overlay-controls">
              <button
                @click="rotate"
                class="overlay-btn rotate-btn"
                :class="{ 'hidden-mode': controlsMode === 0, 'arrow-mode': controlsMode === 1 }"
                title="Rotera"
              >
                ↻
              </button>

              <button
                @click="moveLeft"
                class="overlay-btn left-btn"
                :class="{ 'hidden-mode': controlsMode === 0, 'arrow-mode': controlsMode === 1 }"
                title="Vänster"
              >
                ←
              </button>

              <button
                @click="moveRight"
                class="overlay-btn right-btn"
                :class="{ 'hidden-mode': controlsMode === 0, 'arrow-mode': controlsMode === 1 }"
                title="Höger"
              >
                →
              </button>

              <button
                @click="softDrop"
                class="overlay-btn down-btn"
                :class="{ 'hidden-mode': controlsMode === 0, 'arrow-mode': controlsMode === 1 }"
                title="Ner"
              >
                ↓
              </button>
            </div>

            <canvas class="kfkblock-canvas" id="tetrisCanvas"></canvas>
          </div>

          <!-- Mobile next piece - shows on small screens -->
          <div class="mobile-next-piece">
            <span class="mobile-next-label">Next</span>
            <canvas class="kfkblock-canvas" id="nextPieceCanvasMobile"></canvas>
          </div>
        </div>

        <!-- Hard Drop Button - Always visible below canvas -->
        <button @click="hardDrop" class="hard-drop-btn">Släpp</button>
      </div>

      <!-- Desktop sidebar - hidden on mobile -->
      <div class="sidebar desktop-only">
        <div class="game-info">
          <div class="info-item">
            <span class="info-label">Poäng</span>
            <span class="info-value">{{ score }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nivå</span>
            <span class="info-value">{{ level }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Rader</span>
            <span class="info-value">{{ levelClearedRows }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Totala Rader</span>
            <span class="info-value">{{ linesCleared }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tid</span>
            <span class="info-value">{{ formattedTime }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Använda Block</span>
            <span class="info-value">{{ blocksUsed }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile stats moved to top bar -->

    <!-- Information Section -->
    <div v-if="infoShown" class="information-container">
      <div class="information-text">
        <strong>Grunderna</strong>
        <p>
          Använd pilarna och mellanslagstangenten på tangentbordet, eller knapparna ovan för att
          flytta och rotera blocken. Fyll horisontella rader helt för att få poäng och därmed rensa
          dem från spelplanen. Om blocken staplas upp till toppen av spelplanen så att nästa block
          inte kan placeras förlorar du spelet.
        </p>

        <strong>Block</strong>
        <p>
          Det finns 7 olika block. Blocken väljs slupmässigt ur en säck som innehåller två av varje
          bit. När alla block är tagna fylls säcken på igen.
        </p>
        <p>
          Genom att trycka på pil ner eller mellanslag faller blocken snabbare. Du får ett poäng för
          varje ruta blocket faller. När du kommer till högre nivåer faller blocket snabbare, efter
          nivå 10 ökar inte hastigheten mer.
        </p>
      </div>
      <div class="information-text">
        <strong>Poäng</strong>
        <p>
          Rensa rader för att få poäng, fler rensade rader med samma block ger mer poäng enligt
          tabellen nedan. Poängen för rensade rader multipliceras med den nivån du spelar på, plus
          ett. Till exempel, om du rensar två rader på nivå 2 får du 100*(2+1) = 300p. För varje tio
          rader du rensar går du upp en nivå.
        </p>
        <table>
          <thead>
            <tr>
              <td>Rensade rader</td>
              <th>1</th>
              <th>2</th>
              <th>3</th>
              <th>4</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Poäng</td>
              <td>40p</td>
              <td>100p</td>
              <td>300p</td>
              <td>1200p</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  drawBoard,
  drawPiece,
  drawNextPieces,
  drawGame,
  shape_colors,
} from '@/components/kfkblock/drawTetris.js'
import AddPlayerForm from '@/components/kfkblock/AddPlayerForm.vue'
import { getTopScores } from '@/components/kfkblock/kfkblockTopscores.js'
import { useThemeStore } from '@/stores/theme'

// Global theme store
const themeStore = useThemeStore()

// --- Constants ---
const COLS = 10
const ROWS = 20 // Visible rows
const BASE_BLOCK_SIZE = 30 // Default block size if screen is large enough

// Shapes from original gameObject.js
const shapes = [
  [
    [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ],
  ], //O
  [
    [
      [-1, -1],
      [0, -1],
      [0, 0],
      [1, 0],
    ],
  ], //Z
  [
    [
      [-1, 0],
      [0, 0],
      [0, -1],
      [1, -1],
    ],
  ], //S
  [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, -1],
    ],
  ], //T
  [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  ], //I
  [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, -1],
    ],
  ], //L
  [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, -1],
    ],
  ], //J
]

// Drop speeds at how many frames for one block to drop one block, at 60 fps
const dropSpeeds = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 4, 4, 3, 2, 2, 1]

// --- Reactive State ---
const ctx = ref(null)
const nextCtx = ref(null)
const nextCtxMobile = ref(null)
const board = ref([])
const currentPiece = ref(null)
const nextPieces = ref([]) // Array of next 3 pieces
const score = ref(0)
const level = ref(0)
const linesCleared = ref(0)
const levelClearedRows = ref(0)
const blocksUsed = ref(0)
const timeElapsed = ref(0)
const gameTimerId = ref(null)

const gameLoopIntervalId = ref(null)
const framesToNextDrop = ref(0)

const gameOver = ref(false)
const gamePaused = ref(false)
const pauseTimer = ref(0)
const gameStarted = ref(false)
const sack = ref([])
const blockSize = ref(BASE_BLOCK_SIZE)
const canvasWidth = ref(COLS * BASE_BLOCK_SIZE)
const canvasHeight = ref(ROWS * BASE_BLOCK_SIZE)
const infoShown = ref(false)
const showLeaderboard = ref(false)
const controlsMode = ref(1) // 0: hidden, 1: arrows only
const autoHideOnKeyboard = ref(true) // hide arrows once when keyboard is first used
let resizeHandler = null
const isMobile = ref(false)

const leaderBoardData = ref([])

// --- Computed ---
const formattedTime = computed(() => {
  const minutes = Math.floor(timeElapsed.value / 60)
  const seconds = timeElapsed.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const showModal = computed(() => !gameStarted.value || gameOver.value)

const topPlayers = computed(() => {
  // Initialize dummy data if empty
  return leaderBoardData.value.sort((a, b) => b.Score - a.Score).slice(0, 100)
})

const gameDataForSubmission = computed(() => ({
  blocksUsed: blocksUsed.value,
  level: level.value,
  levelClearedRows: levelClearedRows.value,
}))

// Helper function to refresh all drawing
function refreshDisplay() {
  if (!ctx.value) return

  if (gameStarted.value && !gameOver.value) {
    // Game is active - use full game drawing
    drawGame(
      gameOver.value,
      ctx.value,
      board.value,
      canvasWidth.value,
      canvasHeight.value,
      blockSize.value,
      themeStore.isDarkMode,
      COLS,
      ROWS,
      currentPiece.value,
      intersects,
      nextPieces.value,
      isMobile.value ? nextCtxMobile.value : nextCtx.value,
    )
  } else {
    // Game not started or game over - draw empty/final board and next pieces
    drawBoard(
      ctx.value,
      board.value,
      canvasWidth.value,
      canvasHeight.value,
      blockSize.value,
      themeStore.isDarkMode,
      COLS,
      ROWS,
    )
    if (nextPieces.value.length > 0) {
      const nextCanvas = isMobile.value ? nextCtxMobile.value : nextCtx.value
      if (nextCanvas) {
        drawNextPieces(nextPieces.value, nextCanvas, blockSize.value, themeStore.isDarkMode)
      }
    }
  }
}

function togglePause() {
  if (gamePaused.value) {
    // Resuming game
    pauseTimer.value = 3 // Give a 3 second countdown
    // Start countdown, when reaching 0 unpause
    const countdownInterval = setInterval(() => {
      if (pauseTimer.value > 0) {
        pauseTimer.value -= 0.1
      } else {
        clearInterval(countdownInterval)
        pauseTimer.value = 0
        gamePaused.value = false
      }
    }, 100)
  } else {
    // Pausing game
    pauseTimer.value = 0
    gamePaused.value = true
  }
}

function toggleInfo() {
  infoShown.value = !infoShown.value
}

function toggleLeaderboard() {
  showLeaderboard.value = !showLeaderboard.value
}

function cycleControlsMode() {
  // Toggle between hidden and arrows only
  controlsMode.value = controlsMode.value === 1 ? 0 : 1
  // If user turns arrows back on, keep them until they choose to hide
  if (controlsMode.value === 1) autoHideOnKeyboard.value = false
}

// --- Board & Canvas Setup ---
function initBoard() {
  board.value = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function debounce(func, delay) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), delay)
  }
}

function adjustCanvasSize() {
  // Device pixel ratio for HiDPI rendering
  const dpr = Math.ceil(window.devicePixelRatio || 1)

  // Check if we're on mobile
  isMobile.value = window.innerWidth <= 768

  const appContainer = document.getElementById('app-container')
  const hardDropBtn = document.querySelector('.hard-drop-btn')
  const leaderboard = document.querySelector('.leaderboard-container')
  const mobileControls = document.querySelector('.mobile-controls-bar')
  const mobileStatsMini = document.querySelector('.mobile-stats-mini')

  const hardDropBtnHeight = hardDropBtn ? hardDropBtn.offsetHeight + 10 : 50
  const leaderboardHeight = leaderboard ? leaderboard.offsetHeight : 0
  const mobileControlsHeight = mobileControls ? mobileControls.offsetHeight + 10 : 0
  const mobileStatsHeight = mobileStatsMini ? mobileStatsMini.offsetHeight + 10 : 0
  const appContainerVPadding = 10 * 2
  const appContainerHPadding = 10 * 2
  const verticalGapsAroundGame = 15 * 3

  let availableHeightForGame, availableWidthForCanvas

  if (isMobile.value) {
    // Mobile layout calculations
    availableHeightForGame =
      window.innerHeight -
      hardDropBtnHeight -
      leaderboardHeight -
      mobileControlsHeight -
      mobileStatsHeight -
      appContainerVPadding -
      verticalGapsAroundGame

    // On mobile, canvas takes most of the width, leaving space for next piece
    const appContainerContentWidth =
      (appContainer?.offsetWidth || window.innerWidth) - appContainerHPadding
    const nextPieceWidth = 4 * 25 + 20 // Smaller next piece + gap
    availableWidthForCanvas = appContainerContentWidth - nextPieceWidth
  } else {
    // Desktop layout calculations (existing logic)
    const sidebar = document.querySelector('.sidebar')
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 180
    const gameLayoutGap = 20

    availableHeightForGame =
      window.innerHeight -
      hardDropBtnHeight -
      leaderboardHeight -
      appContainerVPadding -
      verticalGapsAroundGame

    const appContainerContentWidth =
      (appContainer?.offsetWidth || window.innerWidth) - appContainerHPadding
    availableWidthForCanvas = appContainerContentWidth - sidebarWidth * 2 - gameLayoutGap * 2
  }

  let newBlockSizeByHeight = Math.floor(availableHeightForGame / ROWS)
  let newBlockSizeByWidth = Math.floor(availableWidthForCanvas / COLS)

  blockSize.value = Math.max(
    10,
    Math.min(newBlockSizeByHeight, newBlockSizeByWidth, BASE_BLOCK_SIZE),
  )

  canvasWidth.value = COLS * blockSize.value
  canvasHeight.value = ROWS * blockSize.value

  // Set up main canvas
  const mainCanvas = document.getElementById('tetrisCanvas')
  if (mainCanvas) {
    // Backing store size (physical pixels)
    mainCanvas.width = Math.max(1, Math.floor(canvasWidth.value * dpr))
    mainCanvas.height = Math.max(1, Math.floor(canvasHeight.value * dpr))
    // CSS size (logical pixels)
    mainCanvas.style.width = `${canvasWidth.value}px`
    mainCanvas.style.height = `${canvasHeight.value}px`
    // Scale context to keep drawing units in CSS pixels
    if (ctx.value) ctx.value.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Set up next piece canvases
  const nextCanvas = document.getElementById('nextPieceCanvas')
  if (nextCanvas) {
    const cssW = 4 * blockSize.value
    const cssH = 8 * blockSize.value
    nextCanvas.width = Math.max(1, Math.floor(cssW * dpr))
    nextCanvas.height = Math.max(1, Math.floor(cssH * dpr))
    nextCanvas.style.width = `${cssW}px`
    nextCanvas.style.height = `${cssH}px`
    if (nextCtx.value) nextCtx.value.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const nextCanvasMobile = document.getElementById('nextPieceCanvasMobile')
  if (nextCanvasMobile) {
    const mobileNextSize = Math.min(blockSize.value, 25) // Smaller on mobile
    const cssW = 4 * mobileNextSize
    const cssH = 8 * mobileNextSize
    nextCanvasMobile.width = Math.max(1, Math.floor(cssW * dpr))
    nextCanvasMobile.height = Math.max(1, Math.floor(cssH * dpr))
    nextCanvasMobile.style.width = `${cssW}px`
    nextCanvasMobile.style.height = `${cssH}px`
    if (nextCtxMobile.value) nextCtxMobile.value.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Refresh display after canvas size changes
  refreshDisplay()
}

function initializeCanvases() {
  const canvasEl = document.getElementById('tetrisCanvas')
  if (canvasEl) ctx.value = canvasEl.getContext('2d')

  const nextCanvasEl = document.getElementById('nextPieceCanvas')
  if (nextCanvasEl) nextCtx.value = nextCanvasEl.getContext('2d')

  const nextCanvasMobileEl = document.getElementById('nextPieceCanvasMobile')
  if (nextCanvasMobileEl) nextCtxMobile.value = nextCanvasMobileEl.getContext('2d')

  adjustCanvasSize() // Call after contexts are set
  if (!resizeHandler) {
    resizeHandler = debounce(adjustCanvasSize, 100)
  }
  window.addEventListener('resize', resizeHandler)
}

// --- Block Class ---
class Block {
  constructor(x, y, shape_type) {
    this.x = x
    this.y = y
    this.type = shape_type
    this.shape = shapes[shape_type][0]
    this.color = shape_colors[shape_type]
    this.rotation = 0
  }

  getShape() {
    return this.shape
  }

  getPositions() {
    return this.shape.map((coord) => [coord[0] + this.x, coord[1] + this.y])
  }

  rotate() {
    let rotated = []
    this.shape.forEach((pos) => {
      if (this.type == 4) {
        rotated.push([-pos[1] + 1, pos[0]])
      } else if (this.type == 0) {
        rotated.push([-pos[1] - 1, pos[0]])
      } else {
        rotated.push([-pos[1], pos[0]])
      }
    })
    this.shape = rotated
  }
}

// --- Sack System ---
function refillSack() {
  sack.value = []
  let piecesOfEach = 2
  for (let i = 0; i < shapes.length * piecesOfEach; i++) {
    sack.value.push(i % shapes.length)
  }
}

function getRandomPieceFromSack() {
  if (sack.value.length == 0) refillSack()
  let nextBlockIndex = sack.value.splice(Math.floor(sack.value.length * Math.random()), 1)
  return new Block(5, 0, nextBlockIndex[0])
}

function fillNextPiecesQueue() {
  // Fill the queue with 3 next pieces
  nextPieces.value = []
  for (let i = 0; i < 3; i++) {
    nextPieces.value.push(getRandomPieceFromSack())
  }
}

function spawnPiece() {
  // Take the first piece from the queue
  currentPiece.value = nextPieces.value.shift()
  // Add a new piece to the end of the queue
  nextPieces.value.push(getRandomPieceFromSack())

  if (intersects()) {
    // If it intersects directly its game over
    gameOver.value = true
    currentPiece.value = null
    endGame()
  }
}

// --- Game Control ---
function startGame() {
  gameOver.value = false
  gameStarted.value = true
  score.value = 0
  level.value = 0
  linesCleared.value = 0
  levelClearedRows.value = 0
  blocksUsed.value = 0
  timeElapsed.value = 0
  framesToNextDrop.value = dropSpeeds[0]

  initBoard()
  refillSack()
  fillNextPiecesQueue()
  spawnPiece()
  startGameTimer()
  gameLoopIntervalId.value = setInterval(gameLoop, 1000 / 60) // 60 FPS
}

function endGame() {
  gameOver.value = true
  clearInterval(gameLoopIntervalId.value)
  stopGameTimer()
  removeKeyboardListeners()
  drawBoard(
    ctx.value,
    board.value,
    canvasWidth.value,
    canvasHeight.value,
    blockSize.value,
    themeStore.isDarkMode,
    COLS,
    ROWS,
  )
  if (currentPiece.value)
    drawPiece(
      currentPiece.value,
      ctx.value,
      currentPiece.value.x,
      currentPiece.value.y,
      null,
      blockSize.value,
    )
}

function gameLoop() {
  if (gameOver.value || !gameStarted.value) return

  if (!gamePaused.value) {
    // Frame-based dropping like original
    if (framesToNextDrop.value <= 0) {
      moveVertical()
      framesToNextDrop.value = dropSpeeds[Math.min(level.value, dropSpeeds.length - 1)]
    }
    framesToNextDrop.value--
  }

  drawGame(
    gameOver.value,
    ctx.value,
    board.value,
    canvasWidth.value,
    canvasHeight.value,
    blockSize.value,
    themeStore.isDarkMode,
    COLS,
    ROWS,
    currentPiece.value,
    intersects,
    nextPieces.value,
    isMobile.value ? nextCtxMobile.value : nextCtx.value,
  )
}
function startGameTimer() {
  if (gameTimerId.value) clearInterval(gameTimerId.value)
  gameTimerId.value = setInterval(() => {
    if (!gameOver.value && gameStarted.value && !gamePaused.value) timeElapsed.value++
  }, 1000)
}
function stopGameTimer() {
  clearInterval(gameTimerId.value)
}

// --- Piece Manipulation ---
function moveHorizontal(dir) {
  if (!currentPiece.value || gameOver.value) return
  if (dir == -1 || dir == 1) {
    // -1 == Left, 1 == Right
    currentPiece.value.x = currentPiece.value.x + dir
    if (intersects()) {
      currentPiece.value.x = currentPiece.value.x - dir
    }
  }
}

function moveVertical() {
  if (!currentPiece.value || gameOver.value) return false
  currentPiece.value.y = currentPiece.value.y + 1
  if (intersects()) {
    currentPiece.value.y = currentPiece.value.y - 1
    freezeBlock()
    return true
  }
  return false
}

function moveBottom() {
  if (!currentPiece.value || gameOver.value) return
  let intersect = false
  while (!intersect) {
    intersect = moveVertical()
    updateScore(1)
  }
  updateScore(-1)
}

function moveRotate() {
  if (!currentPiece.value || gameOver.value) return
  let oldShape = currentPiece.value.shape
  currentPiece.value.rotate()
  if (intersects()) {
    currentPiece.value.x++
    if (intersects()) {
      currentPiece.value.x--
      currentPiece.value.x--
      if (intersects()) {
        currentPiece.value.shape = oldShape
        currentPiece.value.x++
      }
    }
  }
}

function intersects() {
  if (!currentPiece.value) return false
  let intersects = false
  // Check if activeblock intersects
  currentPiece.value.getPositions().forEach((pos) => {
    const x = pos[0]
    const y = pos[1]
    if (y >= 0) {
      if (y > ROWS - 1 || x < 0 || x > COLS - 1 || (board.value[y] && board.value[y][x] != null)) {
        intersects = true
      }
    } else {
      // y < 0 (above the visible board): only check horizontal bounds
      if (x < 0 || x > COLS - 1) {
        intersects = true
      }
    }
  })
  return intersects
}

function freezeBlock() {
  if (!currentPiece.value) return
  currentPiece.value.getPositions().forEach((pos) => {
    if (pos[1] >= 0 && pos[0] >= 0) {
      board.value[pos[1]][pos[0]] = currentPiece.value.type
    }
  })
  spawnPiece()
  const lines = filledRow()
  blocksUsed.value++
}

function filledRow() {
  let clearedRows = 0
  for (let row = board.value.length - 1; row >= 0; row--) {
    const isFull = board.value[row].every((cell) => cell !== null)
    if (isFull) {
      // Remove the full row
      board.value.splice(row, 1)
      // Add a new empty row at the top
      board.value.unshift(Array(COLS).fill(null))
      clearedRows++
      row++ // Re-check the same index after unshifting
    }
  }
  let scoreIncrease = 0
  if (clearedRows == 1) {
    scoreIncrease = 40 * (level.value + 1)
  } else if (clearedRows == 2) {
    scoreIncrease = 100 * (level.value + 1)
  } else if (clearedRows == 3) {
    scoreIncrease = 300 * (level.value + 1)
  } else if (clearedRows == 4) {
    scoreIncrease = 1200 * (level.value + 1)
  }
  updateScore(scoreIncrease)

  levelClearedRows.value = levelClearedRows.value + clearedRows
  linesCleared.value += clearedRows
  if (levelClearedRows.value >= 10) {
    level.value++
    levelClearedRows.value = 0
  }
  return clearedRows
}

// Simple movement functions for buttons
function moveLeft() {
  if (gamePaused.value || gameOver.value) return
  moveHorizontal(-1)
}
function moveRight() {
  if (gamePaused.value || gameOver.value) return
  moveHorizontal(1)
}
function softDrop() {
  if (gamePaused.value || gameOver.value) return
  updateScore(1)
  moveVertical()
}
function rotate() {
  if (gamePaused.value || gameOver.value) return
  moveRotate()
}
function hardDrop() {
  if (gamePaused.value || gameOver.value) return
  moveBottom()
}

// --- Scoring & Leveling ---
function updateScore(points) {
  score.value += points
}

// --- Input Handling ---
function _handleKeydown(e) {
  // Hide overlay once on first keyboard input if it's currently visible
  if (controlsMode.value === 1 && autoHideOnKeyboard.value) {
    controlsMode.value = 0
    autoHideOnKeyboard.value = false
  }
  if (showModal.value) {
    if (['Enter', 'Space'].includes(e.code)) startGame()
    e.preventDefault()
    return
  }

  // Pause handling
  if (e.code == 'Escape' || e.code == 'KeyP') {
    if (!gameStarted.value) return
    togglePause()
    e.preventDefault()
    return
  }

  if (gameOver.value || gamePaused.value || !gameStarted.value) {
    return
  }

  const movementKeys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowDown',
    'ArrowUp',
    'Space',
    'KeyA',
    'KeyD',
    'KeyS',
    'KeyW',
  ]
  if (movementKeys.includes(e.code)) e.preventDefault()

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      moveHorizontal(-1)
      break
    case 'ArrowRight':
    case 'KeyD':
      moveHorizontal(1)
      break
    case 'ArrowDown':
    case 'KeyS':
      updateScore(1)
      moveVertical()
      break
    case 'ArrowUp':
    case 'KeyW':
      moveRotate()
      break
    case 'Space':
      moveBottom()
      break
  }
}
function addKeyboardListeners() {
  document.addEventListener('keydown', _handleKeydown)
}
function removeKeyboardListeners() {
  document.removeEventListener('keydown', _handleKeydown)
}

// --- Leaderboard ---
async function getTopPlayers() {
  const data = await getTopScores()
  if (!data || !Array.isArray(data)) return
  leaderBoardData.value = data
}

// --- Watchers ---
// Watch for theme changes and redraw canvas
watch(
  () => themeStore.isDarkMode,
  () => {
    // Redraw the canvas when theme changes
    refreshDisplay()
  },
)

// --- Lifecycle ---
onMounted(async () => {
  initBoard()
  initializeCanvases() // This will call adjustCanvasSize
  addKeyboardListeners()
  // Default overlay controls: on for mobile, off for desktop
  controlsMode.value = isMobile.value ? 1 : 0
  await getTopPlayers()
})

onBeforeUnmount(() => {
  removeKeyboardListeners()
  stopGameTimer()
  clearInterval(gameLoopIntervalId.value)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped lang="scss">
@use '@/components/kfkblock/style.scss';
</style>
