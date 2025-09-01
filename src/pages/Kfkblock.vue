<template>
  <div id="app-container">
    <h1>KfKblock</h1>

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

    <div class="game-layout">
      <div class="sidebar">
        <div class="sidebar-btn-container">
          <button @click="toggleTheme" class="sidebar-btn">
            <span v-if="isDarkMode">☀️</span>
            <span v-else>🌙</span>
          </button>
          <button @click="togglePause" class="sidebar-btn">
            <span v-if="gamePaused && pauseTimer == 0"> Fortsätt </span>
            <span v-else-if="gamePaused && pauseTimer > 0"> {{ pauseTimer.toFixed(1) }} </span>
            <span v-else> Pausa </span>
          </button>
          <button @click="cycleControlsMode" class="sidebar-btn">
            <span v-if="controlsMode === 0">Dölj</span>
            <span v-else-if="controlsMode === 1">Pilar</span>
            <span v-else>Knappar</span>
          </button>
          <button @click="toggleInfo" class="sidebar-btn">
            <span v-if="infoShown"> Dölj Info </span>
            <span v-else> Visa Info </span>
          </button>
        </div>
        <div class="next-piece-container">
          <span class="info-label">Next</span>
          <canvas id="nextPieceCanvas"></canvas>
        </div>
      </div>
      <div class="canvas-outer-wrapper">
        <div class="canvas-container">
          <AddPlayerForm
            v-if="showModal"
            :score="score"
            :level="level"
            :linesCleared="linesCleared"
            :gameData="gameDataForSubmission"
            :gameOver="gameOver"
            :gameStarted="gameStarted"
            @close="showAddPlayerForm = false"
            @startGame="startGame"
          />
          <!-- Canvas Overlay Controls -->
          <div class="canvas-overlay-controls">
            <!-- Rotate Button - Top Left -->
            <button
              @click="rotate"
              class="overlay-btn rotate-btn"
              :class="{
                'hidden-mode': controlsMode === 0,
                'arrow-mode': controlsMode === 1,
                'full-mode': controlsMode === 2,
              }"
            >
              <span v-if="controlsMode === 1">↻</span>
              <span v-else>Rotera</span>
            </button>

            <!-- Left Button - Middle Left -->
            <button
              @click="moveLeft"
              class="overlay-btn left-btn"
              :class="{
                'hidden-mode': controlsMode === 0,
                'arrow-mode': controlsMode === 1,
                'full-mode': controlsMode === 2,
              }"
            >
              <span v-if="controlsMode === 1">←</span>
              <span v-else>Vänster</span>
            </button>

            <!-- Right Button - Middle Right -->
            <button
              @click="moveRight"
              class="overlay-btn right-btn"
              :class="{
                'hidden-mode': controlsMode === 0,
                'arrow-mode': controlsMode === 1,
                'full-mode': controlsMode === 2,
              }"
            >
              <span v-if="controlsMode === 1">→</span>
              <span v-else>Höger</span>
            </button>

            <!-- Down Button - Bottom Middle -->
            <button
              @click="softDrop"
              class="overlay-btn down-btn"
              :class="{
                'hidden-mode': controlsMode === 0,
                'arrow-mode': controlsMode === 1,
                'full-mode': controlsMode === 2,
              }"
            >
              <span v-if="controlsMode === 1">↓</span>
              <span v-else>Ner</span>
            </button>
          </div>

          <canvas id="tetrisCanvas"></canvas>
        </div>
        <!-- Hard Drop Button - Always visible below canvas -->
        <button @click="hardDrop" class="hard-drop-btn">Släpp</button>
      </div>

      <div class="sidebar">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import '@/components/kfkblock/style.scss'
import {
  drawBoard,
  drawPiece,
  drawNextPieces,
  drawGame,
  shape_colors,
} from '@/components/kfkblock/drawTetris.js'
import AddPlayerForm from '@/components/kfkblock/AddPlayerForm.vue'
import { getTopScores } from '@/components/kfkblock/kfkblockTopscores.js'

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
const isDarkMode = ref(false)
const infoShown = ref(false)
const showLeaderboard = ref(false)
const showAddPlayerForm = ref(false)
const controlsMode = ref(1) // 0: hidden, 1: arrows only, 2: full buttons

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
  return leaderBoardData.value.sort((a, b) => b.Score - a.Score).slice(0, 10)
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
      isDarkMode.value,
      COLS,
      ROWS,
      currentPiece.value,
      intersects,
      nextPieces.value,
      nextCtx.value,
    )
  } else {
    // Game not started or game over - draw empty/final board and next pieces
    drawBoard(
      ctx.value,
      board.value,
      canvasWidth.value,
      canvasHeight.value,
      blockSize.value,
      isDarkMode.value,
      COLS,
      ROWS,
    )
    if (nextPieces.value.length > 0 && nextCtx.value) {
      drawNextPieces(nextPieces.value, nextCtx.value, blockSize.value, isDarkMode.value)
    }
  }
}

// --- Theme Management ---
function applyTheme() {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme')
    document.documentElement.classList.remove('light-theme')
  } else {
    document.documentElement.classList.add('light-theme')
    document.documentElement.classList.remove('dark-theme')
  }
  // Redraw with new theme
  refreshDisplay()
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
  applyTheme()
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
  controlsMode.value = (controlsMode.value + 1) % 3
}

function setInitialTheme() {
  const storedTheme = localStorage.getItem('theme')
  const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

  if (storedTheme) {
    isDarkMode.value = storedTheme === 'dark'
  } else {
    isDarkMode.value = prefersDarkQuery.matches
  }
  applyTheme()

  prefersDarkQuery.addEventListener('change', (e) => {
    // Only update if no manual override is stored
    if (!localStorage.getItem('theme')) {
      isDarkMode.value = e.matches
      applyTheme()
    }
  })
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
  console.log('Adjusting canvas size...')
  const appContainer = document.getElementById('app-container')
  const hardDropBtn = document.querySelector('.hard-drop-btn')
  const leaderboard = document.querySelector('.leaderboard-container')
  const sidebar = document.querySelector('.sidebar')

  const hardDropBtnHeight = hardDropBtn ? hardDropBtn.offsetHeight + 10 : 50 // Include gap
  const leaderboardHeight = leaderboard ? leaderboard.offsetHeight : 0
  const sidebarWidth = sidebar ? sidebar.offsetWidth : 180 // Fallback to CSS width
  const gameLayoutGap = 20 // As defined in .game-layout CSS for gap
  const appContainerVPadding = 10 * 2 // app-container padding top+bottom
  const appContainerHPadding = 10 * 2 // app-container padding left+right
  const verticalGapsAroundGame = 15 * 3 // From #app-container gap (title, leaderboard, game, info)

  const availableHeightForGame =
    window.innerHeight -
    hardDropBtnHeight -
    leaderboardHeight -
    appContainerVPadding -
    verticalGapsAroundGame
  const appContainerContentWidth = appContainer.offsetWidth - appContainerHPadding
  const availableWidthForCanvas = appContainerContentWidth - sidebarWidth * 2 - gameLayoutGap * 2

  let newBlockSizeByHeight = Math.floor(availableHeightForGame / ROWS)
  let newBlockSizeByWidth = Math.floor(availableWidthForCanvas / COLS)

  blockSize.value = Math.max(
    10,
    Math.min(newBlockSizeByHeight, newBlockSizeByWidth, BASE_BLOCK_SIZE),
  )

  canvasWidth.value = COLS * blockSize.value
  canvasHeight.value = ROWS * blockSize.value

  const mainCanvas = document.getElementById('tetrisCanvas')
  if (mainCanvas) {
    mainCanvas.width = canvasWidth.value
    mainCanvas.height = canvasHeight.value
  }
  const nextCanvas = document.getElementById('nextPieceCanvas')
  if (nextCanvas) {
    nextCanvas.width = 4 * blockSize.value
    nextCanvas.height = 8 * blockSize.value
  }

  // Refresh display after canvas size changes
  refreshDisplay()
}

function initializeCanvases() {
  const canvasEl = document.getElementById('tetrisCanvas')
  if (canvasEl) ctx.value = canvasEl.getContext('2d')

  const nextCanvasEl = document.getElementById('nextPieceCanvas')
  if (nextCanvasEl) nextCtx.value = nextCanvasEl.getContext('2d')

  adjustCanvasSize() // Call after contexts are set
  window.addEventListener('resize', debounce(adjustCanvasSize, 100))
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
  addKeyboardListeners()
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
    isDarkMode.value,
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
    isDarkMode.value,
    COLS,
    ROWS,
    currentPiece.value,
    intersects,
    nextPieces.value,
    nextCtx.value,
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
    if (pos[1] >= 0) {
      if (
        pos[1] > ROWS - 1 ||
        pos[0] < 0 ||
        pos[0] > COLS - 1 ||
        (board.value[pos[1]] && board.value[pos[1]][pos[0]] != null)
      ) {
        intersects = true
      }
    } else if (pos[1] < 0) {
      if (pos[1] > ROWS - 1 || pos[0] < 0 || pos[0] > COLS - 1) {
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
  for (let row = 0; row < board.value.length; row++) {
    const rowArray = board.value[row]
    let zeroes = 0
    for (let col = 0; col < rowArray.length; col++) {
      const spot = rowArray[col]
      if (spot === null) {
        zeroes++
      }
    }
    if (zeroes === 0) {
      // The row was filled
      clearedRows++
      for (let i = row; i > 1; i--) {
        for (let j = 0; j < COLS; j++) {
          board.value[i][j] = board.value[i - 1][j]
        }
      }
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

  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code))
    e.preventDefault()

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

// --- Lifecycle ---
onMounted(async () => {
  initBoard()
  initializeCanvases() // This will call adjustCanvasSize
  setInitialTheme() // Apply theme after canvases are ready for initial draw
  addKeyboardListeners()
  await getTopPlayers()
})

onBeforeUnmount(() => {
  removeKeyboardListeners()
  stopGameTimer()
  clearInterval(gameLoopIntervalId.value)
  window.removeEventListener('resize', debounce(adjustCanvasSize, 100))
})
</script>
