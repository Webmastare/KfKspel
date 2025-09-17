<template>
  <div class="game-2048">
    <div class="game-header">
      <h1>2048</h1>
      <div class="score-display">
        Poäng: <span class="score-value">{{ score }}</span>
      </div>
    </div>

    <div class="game-settings">
      <div class="board-size-control">
        <label for="board-size-slider">
          Storlek (<span>{{ rows }} x {{ columns }}</span
          >)
        </label>
        <div class="slider-container">
          <span class="slider-min">2</span>
          <input
            id="board-size-slider"
            v-model="boardSize"
            type="range"
            min="2"
            max="10"
            class="board-size-slider"
            @input="updateBoardSize"
          />
          <span class="slider-max">10</span>
        </div>
      </div>

      <div class="settings-toggles">
        <label class="checkbox-container">
          <input v-model="useClassicColors" type="checkbox" @change="drawBoard" />
          <span class="checkmark"></span>
          Klassiska färger
        </label>
      </div>

      <div v-if="hasSavedGame" class="load-game-section">
        <div class="saved-game-info">
          Ladda ditt sparade spel? Du hade {{ savedGameScore }} poäng
        </div>
        <button class="action-button load-button" @click="loadGame">Ladda Spel</button>
      </div>

      <button class="action-button restart-button" @click="resetGame">Starta Om</button>
    </div>

    <div class="game-container">
      <canvas
        ref="gameCanvas"
        class="game-canvas"
        tabindex="0"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchmove="(e) => e.preventDefault()"
      ></canvas>

      <div v-if="gameOver" class="game-over-modal">
        <div class="modal-content">
          <h2>Spelet är slut!</h2>
          <p>Din slutpoäng: {{ score }}</p>
          <button class="action-button" @click="resetGame">Starta Om</button>
        </div>
      </div>
    </div>

    <div class="game-instructions">
      <p>Använd piltangenterna för att flytta brickorna. Kombinera lika nummer för att nå 2048!</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
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
}

function updateBoardSize() {
  const size = parseInt(boardSize.value)
  if (size >= 2 && size <= 10) {
    rows.value = size
    columns.value = size
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
  hasSavedGame.value = false
}

function drawBoard() {
  if (gameLogic) {
    gameLogic.setUseClassicColors(useClassicColors.value)
    gameLogic.drawBoard()
  }
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

  // Add event listeners
  document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', handleResize)
})
</script>

<style src="../components/2048/game2048.scss" lang="scss"></style>
