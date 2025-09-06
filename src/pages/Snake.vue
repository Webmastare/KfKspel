<template>
  <div id="snake-app-container">
    <h1>Snake</h1>

    <!-- Game Stats Header -->
    <div class="game-stats-header">
      <div class="stat-item">
        <span class="stat-label">Poäng</span>
        <span class="stat-value">{{ score }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Bästa</span>
        <span class="stat-value">{{ bestScore }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Hastighet</span>
        <span class="stat-value">{{ gameSpeed }}</span>
      </div>
    </div>

    <!-- Game Controls Header -->
    <div class="game-controls-header">
      <button @click="toggleTheme" class="control-header-btn">
        <span v-if="isDarkMode">☀️</span>
        <span v-else>🌙</span>
      </button>

      <button @click="togglePause" class="control-header-btn">
        <span v-if="!gamePaused">Pausa</span>
        <span v-else>Fortsätt</span>
      </button>

      <button @click="startGame" class="control-header-btn">Starta Om</button>

      <button @click="showSettings = true" class="control-header-btn">⚙️</button>
    </div>

    <!-- Settings Overlay -->
    <div v-if="showSettings" class="settings-overlay">
      <div class="settings-modal">
        <button type="button" class="close-settings-button" @click="showSettings = false">
          &#215;
        </button>
        <h2>Inställningar</h2>

        <div class="settings-content">
          <div class="setting-item">
            <label for="difficulty-select" class="form-label">Svårighetsgrad</label>
            <select
              id="difficulty-select"
              v-model="selectedDifficulty"
              @change="updateDifficulty"
              class="form-input"
            >
              <option value="dynamic">Dynamisk</option>
              <option value="easy">Lätt</option>
              <option value="medium">Medel</option>
              <option value="hard">Svår</option>
              <option value="extreme">Extrem</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="food-count" class="form-label">Mat: {{ foodCount }}</label>
            <input
              type="range"
              id="food-count"
              v-model="foodCount"
              min="1"
              max="10"
              @input="updateFoodCount"
              class="form-input range-input"
            />
          </div>

          <div class="setting-item checkbox-item">
            <label class="checkbox-label">
              <input type="checkbox" v-model="wrapSnake" @change="updateWrapSetting" />
              <span>Svep runt väggarna</span>
            </label>
          </div>

          <div class="setting-item checkbox-item">
            <label class="checkbox-label">
              <input type="checkbox" v-model="leftRightOnly" @change="updateLeftRightSetting" />
              <span>Endast höger/vänster kontroller</span>
            </label>
          </div>
        </div>

        <div class="button-group">
          <button @click="showSettings = false" class="submit-button primary">Stäng</button>
        </div>
      </div>
    </div>

    <!-- Game Canvas Container -->
    <div class="game-container">
      <!-- Game Over Overlay -->
      <div v-if="gameOver" class="game-over-overlay">
        <div class="game-over-content">
          <h2>Game Over!</h2>
          <p>Poäng: {{ score }}</p>
          <p v-if="score === bestScore">🎉 Nytt rekord!</p>
          <button @click="startGame" class="restart-btn">Spela igen</button>
        </div>
      </div>

      <!-- Pause Overlay -->
      <div v-if="gamePaused && gameStarted" class="pause-overlay">
        <div class="pause-content">
          <h2 v-if="pauseCountdown === 0">Pausad</h2>
          <h2 v-else>{{ pauseCountdown }}</h2>
        </div>
      </div>

      <canvas
        ref="gameCanvas"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        :width="canvasWidth"
        :height="canvasHeight"
      ></canvas>
    </div>

    <!-- Game Controls -->
    <div class="game-controls" style="display: none">
      <!-- Touch Controls -->
      <div class="touch-controls" :class="{ hidden: leftRightOnly }">
        <div class="control-row">
          <button @click="changeDirection('up')" class="direction-btn up-btn">↑</button>
        </div>
        <div class="control-row">
          <button @click="changeDirection('left')" class="direction-btn left-btn">←</button>
          <button @click="changeDirection('right')" class="direction-btn right-btn">→</button>
        </div>
        <div class="control-row">
          <button @click="changeDirection('down')" class="direction-btn down-btn">↓</button>
        </div>
      </div>

      <!-- Left/Right Only Controls -->
      <div class="lr-controls" :class="{ hidden: !leftRightOnly }">
        <button @click="turnLeft" class="direction-btn left-turn-btn">↺ Vänster</button>
        <button @click="turnRight" class="direction-btn right-turn-btn">↻ Höger</button>
      </div>
    </div>

    <!-- Game Instructions -->
    <div class="game-instructions">
      <details>
        <summary>Hur man spelar</summary>
        <div class="instructions-content">
          <p>
            Styr ormen för att samla mat och väx längre. Undvik att krocka med väggarna eller dig
            själv!
          </p>
          <ul>
            <li>Använd piltangenterna på tangentbordet</li>
            <li>Tryck på knapparna ovan</li>
            <li>Svep på skärmen (mobil)</li>
          </ul>
          <p><strong>Svårighetsgrad:</strong> Dynamisk ökar hastigheten när du växer.</p>
          <p>
            <strong>Inställningar:</strong> Experimentera med olika inställningar för olika
            spelupplevelser!
          </p>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import '@/components/snake/SnakeGame.scss'

// Game Constants
const GRID_SIZE = 20
const BASE_SPEED = 150 // milliseconds

// Reactive State
const gameCanvas = ref(null)
const ctx = ref(null)
const gameStarted = ref(false)
const gameOver = ref(false)
const gamePaused = ref(false)
const pauseCountdown = ref(0)

// Game State
const snake = ref([])
const direction = ref({ x: 0, y: 0 })
const lastDirection = ref({ x: 0, y: 0 })
const food = ref([])
const score = ref(0)
const bestScore = ref(0)
const gameSpeed = ref(8)

// Settings
const isDarkMode = ref(false)
const selectedDifficulty = ref('dynamic')
const foodCount = ref(1)
const wrapSnake = ref(false)
const leftRightOnly = ref(false)
const showSettings = ref(false)

// Canvas Properties
const canvasWidth = ref(400)
const canvasHeight = ref(400)
const cellSize = ref(20)

// Touch Controls
const touchStartX = ref(null)
const touchStartY = ref(null)
const touchThreshold = 30

// Game Loop
const gameLoopId = ref(null)
const lastGameUpdate = ref(0)

// Difficulty Settings
const difficultySettings = {
  dynamic: { baseSpeed: 8, speedIncrease: true },
  easy: { baseSpeed: 5, speedIncrease: false },
  medium: { baseSpeed: 8, speedIncrease: false },
  hard: { baseSpeed: 15, speedIncrease: false },
  extreme: { baseSpeed: 25, speedIncrease: false },
}

// Computed Properties
const currentSpeed = computed(() => {
  const settings = difficultySettings[selectedDifficulty.value]
  if (settings.speedIncrease) {
    return Math.min(settings.baseSpeed + Math.floor(snake.value.length / 5), 20)
  }
  return settings.baseSpeed
})

const gameInterval = computed(() => {
  return Math.max(50, BASE_SPEED - currentSpeed.value * 5)
})

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  applyTheme()
}

// Theme Management
function applyTheme() {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme')
    document.documentElement.classList.remove('light-theme')
  } else {
    document.documentElement.classList.add('light-theme')
    document.documentElement.classList.remove('dark-theme')
  }

  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

function updateDifficulty() {
  gameSpeed.value = currentSpeed.value
  localStorage.setItem('snake-difficulty', selectedDifficulty.value)
}

function updateFoodCount() {
  if (gameStarted.value) {
    adjustFoodCount()
  }
  localStorage.setItem('snake-food-count', foodCount.value.toString())
}

function updateWrapSetting() {
  localStorage.setItem('snake-wrap', wrapSnake.value.toString())
}

function updateLeftRightSetting() {
  localStorage.setItem('snake-left-right', leftRightOnly.value.toString())
}

// Game Initialization
function initializeGame() {
  console.log('Initializing Snake game...')

  // Load settings from localStorage
  const savedTheme = localStorage.getItem('theme')
  const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
    isDarkMode.value = savedTheme === 'dark'
  } else {
    isDarkMode.value = prefersDarkQuery.matches
  }

  const savedDifficulty = localStorage.getItem('snake-difficulty')
  if (savedDifficulty) selectedDifficulty.value = savedDifficulty

  const savedFoodCount = localStorage.getItem('snake-food-count')
  if (savedFoodCount) foodCount.value = parseInt(savedFoodCount)

  const savedWrap = localStorage.getItem('snake-wrap')
  if (savedWrap) wrapSnake.value = savedWrap === 'true'

  const savedLeftRight = localStorage.getItem('snake-left-right')
  if (savedLeftRight) leftRightOnly.value = savedLeftRight === 'true'

  const savedBestScore = localStorage.getItem('snake-best-score')
  if (savedBestScore) bestScore.value = parseInt(savedBestScore)

  console.log('⚙️ Settings loaded:', {
    theme: isDarkMode.value ? 'dark' : 'light',
    difficulty: selectedDifficulty.value,
    foodCount: foodCount.value,
    wrap: wrapSnake.value,
    leftRight: leftRightOnly.value,
    bestScore: bestScore.value,
  })

  applyTheme()
  updateDifficulty()

  const canvasReady = setupCanvas()
  if (canvasReady) {
    resetGame()
    console.log('Snake game initialized successfully')
  } else {
    console.error('Failed to initialize canvas')
  }

  // Start Game
  startGame()
}

function setupCanvas() {
  const canvas = gameCanvas.value
  if (!canvas) {
    console.error('Canvas element not found')
    return false
  }

  ctx.value = canvas.getContext('2d')
  if (!ctx.value) {
    console.error('Could not get canvas context')
    return false
  }

  // Responsive canvas sizing
  const containerWidth = Math.min(window.innerWidth - 40, 600)
  const containerHeight = Math.min(window.innerHeight * 0.6, 600)
  const size = Math.min(containerWidth, containerHeight)

  canvasWidth.value = size
  canvasHeight.value = size
  cellSize.value = size / GRID_SIZE

  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value

  return true
}

function resetGame() {
  console.log('Resetting game...')

  // Initialize snake in center
  const centerX = Math.floor(GRID_SIZE / 2)
  const centerY = Math.floor(GRID_SIZE / 2)

  snake.value = [{ x: centerX, y: centerY }]
  direction.value = { x: 0, y: 0 }
  lastDirection.value = { x: 0, y: 0 }
  score.value = 0
  gameSpeed.value = currentSpeed.value
  food.value = []

  generateFood()
  gameOver.value = false
  gameStarted.value = false
  // Always draw the initial state
  draw()
}

function startGame() {
  console.log('Starting new game...')

  if (gameLoopId.value) {
    clearInterval(gameLoopId.value)
  }

  // Only reset if game is over, otherwise just start
  resetGame()

  gameStarted.value = true
  gameOver.value = false
  gamePaused.value = false
  lastGameUpdate.value = Date.now()

  gameLoopId.value = setInterval(gameLoop, 16) // ~60 FPS
}

function togglePause() {
  if (!gameStarted.value || gameOver.value) return

  if (gamePaused.value) {
    // Resume with countdown
    pauseCountdown.value = 3
    const countdownInterval = setInterval(() => {
      pauseCountdown.value--
      if (pauseCountdown.value <= 0) {
        clearInterval(countdownInterval)
        gamePaused.value = false
        lastGameUpdate.value = Date.now()
        pauseCountdown.value = 0
      }
    }, 1000)
  } else {
    gamePaused.value = true
  }
}

// Food Management
function generateFood() {
  const availablePositions = []

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const isSnake = snake.value.some((segment) => segment.x === x && segment.y === y)
      const isFood = food.value.some((f) => f.x === x && f.y === y)

      if (!isSnake && !isFood) {
        availablePositions.push({ x, y })
      }
    }
  }

  while (food.value.length < foodCount.value && availablePositions.length > 0) {
    const randomIndex = Math.floor(Math.random() * availablePositions.length)
    const newFood = availablePositions.splice(randomIndex, 1)[0]
    food.value.push(newFood)
  }
}

function adjustFoodCount() {
  if (food.value.length < foodCount.value) {
    generateFood()
  } else if (food.value.length > foodCount.value) {
    food.value = food.value.slice(0, foodCount.value)
  }
}

// Game Logic
function gameLoop() {
  if (!gameStarted.value || gameOver.value || gamePaused.value) return

  const now = Date.now()
  if (now - lastGameUpdate.value >= gameInterval.value) {
    update()
    lastGameUpdate.value = now
  }

  draw()
}

function update() {
  // Don't move snake if no direction is set (game hasn't really started yet)
  if (direction.value.x === 0 && direction.value.y === 0) {
    return
  }

  // Move snake
  const head = { ...snake.value[0] }
  head.x += direction.value.x
  head.y += direction.value.y

  // Handle wrapping or collision
  if (wrapSnake.value) {
    head.x = (head.x + GRID_SIZE) % GRID_SIZE
    head.y = (head.y + GRID_SIZE) % GRID_SIZE
  } else {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      console.log('Wall collision at:', head)
      endGame()
      return
    }
  }

  // Check self collision
  if (snake.value.some((segment) => segment.x === head.x && segment.y === head.y)) {
    console.log('Self collision at:', head)
    endGame()
    return
  }

  snake.value.unshift(head)

  // Check food collision
  const foodIndex = food.value.findIndex((f) => f.x === head.x && f.y === head.y)
  if (foodIndex !== -1) {
    food.value.splice(foodIndex, 1)
    score.value += 1
    generateFood()

    if (selectedDifficulty.value === 'dynamic') {
      gameSpeed.value = currentSpeed.value
    }
  } else {
    snake.value.pop()
  }

  lastDirection.value = { ...direction.value }
}

function endGame() {
  console.log('Game Over! Final score:', score.value)

  gameOver.value = true
  gameStarted.value = false

  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('snake-best-score', bestScore.value.toString())
    console.log('🏆 New best score achieved:', bestScore.value)
  }

  if (gameLoopId.value) {
    clearInterval(gameLoopId.value)
    console.log('Game loop stopped')
  }
}

// Drawing
function draw() {
  if (!ctx.value) {
    console.warn('Canvas context not available')
    return
  }

  const canvas = gameCanvas.value
  if (!canvas) {
    console.warn('Canvas element not available')
    return
  }

  // Get CSS variables with fallbacks
  const rootStyles = getComputedStyle(document.documentElement)
  const canvasBg = rootStyles.getPropertyValue('--snake-bg').trim() || '#f5f7f5'
  const snakeColor = rootStyles.getPropertyValue('--snake-color').trim() || '#22c55e'
  const snakeHeadColor = rootStyles.getPropertyValue('--snake-head-color').trim() || '#16a34a'
  const foodColor = rootStyles.getPropertyValue('--food-color').trim() || '#ef4444'
  const gridColor = rootStyles.getPropertyValue('--grid-color').trim() || '#e5e7eb'

  // Clear canvas with background color
  ctx.value.fillStyle = canvasBg
  ctx.value.fillRect(0, 0, canvas.width, canvas.height)

  // Draw grid
  ctx.value.strokeStyle = gridColor
  ctx.value.lineWidth = 1
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * cellSize.value
    ctx.value.beginPath()
    ctx.value.moveTo(pos, 0)
    ctx.value.lineTo(pos, canvasHeight.value)
    ctx.value.stroke()

    ctx.value.beginPath()
    ctx.value.moveTo(0, pos)
    ctx.value.lineTo(canvasWidth.value, pos)
    ctx.value.stroke()
  }

  // Draw snake
  snake.value.forEach((segment, index) => {
    const x = segment.x * cellSize.value
    const y = segment.y * cellSize.value

    if (index === 0) {
      // Snake head
      ctx.value.fillStyle = snakeHeadColor
      ctx.value.fillRect(x + 2, y + 2, cellSize.value - 4, cellSize.value - 4)

      // Eyes
      ctx.value.fillStyle = 'white'
      const eyeSize = cellSize.value * 0.15
      const eyeOffset = cellSize.value * 0.3

      if (direction.value.x === 1) {
        // Right
        ctx.value.fillRect(x + cellSize.value - eyeOffset, y + eyeOffset, eyeSize, eyeSize)
        ctx.value.fillRect(
          x + cellSize.value - eyeOffset,
          y + cellSize.value - eyeOffset - eyeSize,
          eyeSize,
          eyeSize,
        )
      } else if (direction.value.x === -1) {
        // Left
        ctx.value.fillRect(x + eyeOffset - eyeSize, y + eyeOffset, eyeSize, eyeSize)
        ctx.value.fillRect(
          x + eyeOffset - eyeSize,
          y + cellSize.value - eyeOffset - eyeSize,
          eyeSize,
          eyeSize,
        )
      } else if (direction.value.y === -1) {
        // Up
        ctx.value.fillRect(x + eyeOffset, y + eyeOffset - eyeSize, eyeSize, eyeSize)
        ctx.value.fillRect(
          x + cellSize.value - eyeOffset - eyeSize,
          y + eyeOffset - eyeSize,
          eyeSize,
          eyeSize,
        )
      } else {
        // Down
        ctx.value.fillRect(x + eyeOffset, y + cellSize.value - eyeOffset, eyeSize, eyeSize)
        ctx.value.fillRect(
          x + cellSize.value - eyeOffset - eyeSize,
          y + cellSize.value - eyeOffset,
          eyeSize,
          eyeSize,
        )
      }
    } else {
      // Snake body
      ctx.value.fillStyle = snakeColor
      ctx.value.fillRect(x + 3, y + 3, cellSize.value - 6, cellSize.value - 6)
    }
  })

  // Draw food
  food.value.forEach((f) => {
    const x = f.x * cellSize.value
    const y = f.y * cellSize.value

    ctx.value.fillStyle = foodColor
    ctx.value.beginPath()
    ctx.value.arc(
      x + cellSize.value / 2,
      y + cellSize.value / 2,
      cellSize.value / 2 - 3,
      0,
      Math.PI * 2,
    )
    ctx.value.fill()
  })
}

// Input Handling
function changeDirection(newDirection) {
  const directionMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }

  const newDir = directionMap[newDirection]
  if (!newDir) {
    console.warn('⚠️ Invalid direction:', newDirection)
    return
  }

  // Start game on first input if not started yet
  if (!gameStarted.value && !gameOver.value) {
    startGame()
  }

  // Don't change direction if game is paused or over
  if (gameOver.value || gamePaused.value) {
    return
  }

  // Prevent immediate reversal (only if we already have a direction set)
  if (lastDirection.value.x !== 0 || lastDirection.value.y !== 0) {
    if (newDir.x === -lastDirection.value.x && newDir.y === -lastDirection.value.y) {
      return
    }
  }

  direction.value = newDir
}

function turnLeft() {
  // Start game on first input if not started yet
  if (!gameStarted.value && !gameOver.value) {
    startGame()
  }

  // Don't change direction if game is paused or over
  if (gameOver.value || gamePaused.value) {
    return
  }

  const currentDir = direction.value

  // If no direction is set yet, default to moving up then turn left
  if (currentDir.x === 0 && currentDir.y === 0) {
    direction.value = { x: -1, y: 0 } // Start by going left
    return
  }

  if (currentDir.x === 1)
    direction.value = { x: 0, y: -1 } // Right -> Up
  else if (currentDir.x === -1)
    direction.value = { x: 0, y: 1 } // Left -> Down
  else if (currentDir.y === 1)
    direction.value = { x: 1, y: 0 } // Down -> Right
  else if (currentDir.y === -1) direction.value = { x: -1, y: 0 } // Up -> Left
}

function turnRight() {
  // Start game on first input if not started yet
  if (!gameStarted.value && !gameOver.value) {
    startGame()
  }

  // Don't change direction if game is paused or over
  if (gameOver.value || gamePaused.value) {
    return
  }

  const currentDir = direction.value

  // If no direction is set yet, default to moving up then turn right
  if (currentDir.x === 0 && currentDir.y === 0) {
    direction.value = { x: 1, y: 0 } // Start by going right
    return
  }

  if (currentDir.x === 1)
    direction.value = { x: 0, y: 1 } // Right -> Down
  else if (currentDir.x === -1)
    direction.value = { x: 0, y: -1 } // Left -> Up
  else if (currentDir.y === 1)
    direction.value = { x: -1, y: 0 } // Down -> Left
  else if (currentDir.y === -1) direction.value = { x: 1, y: 0 } // Up -> Right
}

function handleKeyPress(event) {
  // Handle start/restart/pause keys
  if (event.code === 'Space' || event.code === 'Enter') {
    if (gameStarted.value && !gameOver.value) {
      togglePause()
    } else if (gameOver.value) {
      startGame()
    }
    event.preventDefault()
    return
  }

  // Handle movement keys
  const isMovementKey = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
  ].includes(event.code)

  if (!isMovementKey) {
    return
  }

  if (leftRightOnly.value) {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        turnLeft()
        break
      case 'ArrowRight':
      case 'KeyD':
        turnRight()
        break
    }
  } else {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        changeDirection('up')
        break
      case 'ArrowDown':
      case 'KeyS':
        changeDirection('down')
        break
      case 'ArrowLeft':
      case 'KeyA':
        changeDirection('left')
        break
      case 'ArrowRight':
      case 'KeyD':
        changeDirection('right')
        break
    }
  }
  event.preventDefault()
}

// Touch Controls
function handleTouchStart(event) {
  const touch = event.touches[0]
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  event.preventDefault()
}

function handleTouchEnd(event) {
  if (touchStartX.value === null || touchStartY.value === null) return

  const touch = event.changedTouches[0]
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value

  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (Math.max(absX, absY) < touchThreshold) {
    touchStartX.value = null
    touchStartY.value = null
    return
  }

  if (leftRightOnly.value) {
    if (deltaX > 0) turnRight()
    else turnLeft()
  } else {
    if (absX > absY) {
      changeDirection(deltaX > 0 ? 'right' : 'left')
    } else {
      changeDirection(deltaY > 0 ? 'down' : 'up')
    }
  }

  touchStartX.value = null
  touchStartY.value = null
  event.preventDefault()
}

function handleResize() {
  if (setupCanvas()) {
    draw() // Redraw after resize
  }
}

// Lifecycle
onMounted(async () => {
  await nextTick() // Wait for DOM to be fully rendered
  initializeGame()
  document.addEventListener('keydown', handleKeyPress)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  if (gameLoopId.value) {
    clearInterval(gameLoopId.value)
  }
  document.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('resize', handleResize)
})
</script>
