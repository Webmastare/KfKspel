<template>
  <div class="game-2048">
    <!-- Header -->
    <div class="game-header">
      <h1>2048</h1>
    </div>

    <!-- Stats -->
    <div class="game-stats-header">
      <div class="stat-item">
        <div class="stat-label">Poäng</div>
        <div class="stat-value">{{ score }}</div>
      </div>
      <div v-if="hasSavedGame && savedGameScore > score" class="stat-item game-controls-header">
        <div class="stat-label">Sparat spel</div>
        <div class="stat-value">{{ savedGameScore }} poäng</div>
        <div class="button-group">
          <button class="control-header-btn load-btn" @click="loadGame">💾 Ladda spel</button>
          <button class="control-header-btn close-btn" @click="hasSavedGame = false">Avbryt</button>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="game-controls-header">
      <button class="control-header-btn settings-btn" @click="showSettings = true">
        ⚙️ Inställningar
      </button>
      <button class="control-header-btn restart-btn" @click="resetGame">🔄 Starta om</button>
    </div>

    <!-- Game Canvas -->
    <div class="game-container">
      <canvas
        ref="gameCanvas"
        class="game-canvas"
        tabindex="0"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchmove.prevent
      ></canvas>

      <div v-if="gameOver" class="game-over-modal">
        <div class="modal-content">
          <h2>Spelet är slut!</h2>
          <p>Din slutpoäng: {{ score }}</p>
          <button class="action-button" @click="resetGame">Starta Om</button>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="game-instructions">
      <details>
        <summary>Hur man spelar</summary>
        <div class="instructions-content">
          <p>
            Använd piltangenterna för att flytta brickorna. När två brickor med samma nummer
            krockar, slås de samman till en ny bricka med det dubbla värdet. Försök nå 2048!
          </p>
          <ul>
            <li>Styr med piltangenter eller svep på mobil.</li>
            <li>Du kan ändra brädstorlek och färgtema i Inställningar.</li>
            <li>Spelet sparas automatiskt efter varje drag.</li>
          </ul>
        </div>
      </details>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="settings-overlay">
      <div class="settings-modal">
        <button class="close-settings-button" @click="showSettings = false" aria-label="Stäng">
          ✕
        </button>
        <h2>Inställningar</h2>

        <div class="settings-content">
          <!-- Board Size -->
          <div class="setting-item">
            <label for="board-size-slider" class="form-label">Brädstorlek</label>
            <input
              id="board-size-slider"
              v-model="boardSize"
              type="range"
              min="2"
              max="10"
              class="form-input range-input"
              @input="updateBoardSize"
            />
            <div class="range-value">{{ rows }} x {{ columns }}</div>
          </div>

          <!-- Classic Colors -->
          <div class="setting-item checkbox-item">
            <label class="checkbox-label">
              <input v-model="useClassicColors" type="checkbox" @change="applyColorSetting" />
              <span>Använd klassiska 2048-färger</span>
            </label>
          </div>
        </div>

        <div class="button-group">
          <button class="action-button" @click="showSettings = false">Stäng</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Game2048Logic } from '@/components/2048/game2048Logic.js'
import { useThemeStore } from '@/stores/theme'

// Global theme store
const themeStore = useThemeStore()

// Game state
const gameCanvas = ref(null)
const score = ref(0)
const gameOver = ref(false)
const rows = ref(4)
const columns = ref(4)
const boardSize = ref(4)
const useClassicColors = ref(false)
const hasSavedGame = ref(false)
const savedGameScore = ref(0)
const showSettings = ref(false)

// Touch handling
const touchStartX = ref(0)
const touchStartY = ref(0)

// Game logic instance
let gameLogic = null

function initializeGame() {
  if (!gameCanvas.value) return

  gameLogic = new Game2048Logic(gameCanvas.value)
  gameLogic.setDarkMode(themeStore.isDarkMode) // Use global theme store
  gameLogic.setUseClassicColors(useClassicColors.value)

  // Set up callbacks
  gameLogic.onScoreUpdate = (newScore) => {
    score.value = newScore
  }

  gameLogic.onGameOver = () => {
    gameOver.value = true
  }

  // Initialize the game with proper board setup
  gameLogic.setBoardSize(rows.value, columns.value)
  gameLogic.initGame()

  checkForSavedGame()
  console.log('Has saved game:', hasSavedGame.value) // Debug log;
}

function updateBoardSize() {
  const size = parseInt(boardSize.value)
  if (size >= 2 && size <= 10) {
    rows.value = size
    columns.value = size
    localStorage.setItem('2048-board-size', String(size))
    resetGame()
  }
}

function resetGame() {
  gameOver.value = false
  score.value = 0
  if (gameLogic) {
    gameLogic.setBoardSize(rows.value, columns.value)
    gameLogic.resetGame()
  }
}

function drawBoard() {
  if (gameLogic) {
    gameLogic.setUseClassicColors(useClassicColors.value)
    gameLogic.drawBoard()
  }
}

function applyColorSetting() {
  // Update logic and redraw without resetting game state
  localStorage.setItem('2048-classic-colors', String(useClassicColors.value))
  drawBoard()
}

function saveGame() {
  if (gameLogic) {
    gameLogic.saveGame()
  }
}

function loadGame() {
  if (gameLogic) {
    const gameState = gameLogic.loadGame()
    if (gameState) {
      rows.value = gameState.rows
      columns.value = gameState.columns
      boardSize.value = gameState.rows
      score.value = gameState.score
      gameOver.value = false
      hasSavedGame.value = false
    }
  }
}

function checkForSavedGame() {
  const savedState = localStorage.getItem('2048GameState')
  if (savedState) {
    console.log('Found saved game state:', savedState) // Debug log
    const gameState = JSON.parse(savedState)
    if (gameState.score > 0) {
      hasSavedGame.value = true
      savedGameScore.value = gameState.score
    }
  }
}

function handleTouchStart(e) {
  e.preventDefault()
  e.stopPropagation()
  const touch = e.touches[0] || e.changedTouches[0]
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
}

function handleTouchEnd(e) {
  e.preventDefault()
  e.stopPropagation()

  if (!gameLogic || gameOver.value) return

  const touch = e.changedTouches[0]
  const touchEndX = touch.clientX
  const touchEndY = touch.clientY

  const diffX = touchEndX - touchStartX.value
  const diffY = touchEndY - touchStartY.value

  const threshold = 30 // Increased threshold for better mobile experience
  if (Math.abs(diffX) < threshold && Math.abs(diffY) < threshold) return

  // Determine swipe direction
  if (Math.abs(diffX) > Math.abs(diffY)) {
    // Horizontal swipe
    if (diffX > 0) {
      gameLogic.slideRight()
    } else {
      gameLogic.slideLeft()
    }
  } else {
    // Vertical swipe
    if (diffY > 0) {
      gameLogic.slideDown()
    } else {
      gameLogic.slideUp()
    }
  }
  saveGame()
}

function handleKeyDown(e) {
  if (!gameLogic || gameOver.value) return

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault()
      gameLogic.slideLeft()
      saveGame()
      break
    case 'ArrowRight':
      e.preventDefault()
      gameLogic.slideRight()
      saveGame()
      break
    case 'ArrowUp':
      e.preventDefault()
      gameLogic.slideUp()
      saveGame()
      break
    case 'ArrowDown':
      e.preventDefault()
      gameLogic.slideDown()
      saveGame()
      break
  }
}

function handleResize() {
  if (gameLogic) {
    gameLogic.resizeBoard()
  }
}

// Watch for theme changes and update game accordingly
watch(
  () => themeStore.isDarkMode,
  (newDarkMode) => {
    if (gameLogic) {
      gameLogic.setDarkMode(newDarkMode)
      gameLogic.drawBoard()
    }
  },
)

onMounted(async () => {
  await nextTick()

  // Ensure canvas is available before initializing game
  if (gameCanvas.value) {
    initializeGame()
  } else {
    // Wait a bit more if canvas isn't ready
    setTimeout(() => {
      if (gameCanvas.value) {
        initializeGame()
      }
    }, 100)
  }

  // Load persisted settings
  const savedClassic = localStorage.getItem('2048-classic-colors')
  if (savedClassic !== null) {
    useClassicColors.value = savedClassic === 'true'
    applyColorSetting()
  }
  const savedSize = localStorage.getItem('2048-board-size')
  if (savedSize) {
    const sizeNum = parseInt(savedSize)
    if (!Number.isNaN(sizeNum) && sizeNum >= 2 && sizeNum <= 10) {
      boardSize.value = sizeNum
      rows.value = sizeNum
      columns.value = sizeNum
      resetGame()
    }
  }

  // Add event listeners
  document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', handleResize)
})
</script>

<style src="@/components/2048/game2048.scss" lang="scss"></style>
