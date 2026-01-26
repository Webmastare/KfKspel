<template>
  <div class="game-2048">
    <!-- Header -->
    <div class="game-header">
      <h1>2048</h1>
    </div>

    <!-- Stats -->
    <div class="game-stats-header">
      <div v-if="hasSavedGame && savedGame.score > score" class="stat-item game-controls-header">
        <div class="stat-label">Sparat spel (lokalt)</div>
        <div class="stat-value">{{ savedGame.score }} poäng</div>
        <div class="stat-value-small">{{ savedGame.gameOver ? 'Spelet är slut' : '' }}</div>
        <div class="button-group">
          <button class="control-header-btn load-btn" @click="loadGame">Ladda spel</button>
          <button class="control-header-btn close-btn" @click="hasSavedGame = false">Avbryt</button>
        </div>
      </div>
      <!-- Cloud saved game prompt -->
      <div
        v-if="hasCloudSavedGame && cloudSavedGame.score > score"
        class="stat-item game-controls-header"
      >
        <div class="stat-label">Sparat spel (i molnet)</div>
        <div class="stat-value">{{ cloudSavedGame.score }} poäng</div>
        <div class="stat-value-small">{{ cloudSavedGame.gameOver ? 'Spelet är slut' : '' }}</div>
        <div class="button-group">
          <button class="control-header-btn load-btn" @click="loadCloudGame">Ladda spel</button>
          <button class="control-header-btn close-btn" @click="hasCloudSavedGame = false">
            Avbryt
          </button>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="game-controls-header">
      <button class="control-header-btn settings-btn" @click="showSettings = true">
        Inställningar
      </button>
      <button class="control-header-btn restart-btn" @click="resetGame">Starta om</button>
      <button
        v-if="authStore.isAuthed"
        class="control-header-btn save-btn"
        @click="manualCloudSave"
        :disabled="cloudSaveStatus === 'saving'"
      >
        <span v-if="cloudSaveStatus === 'saving'">Sparar...</span>
        <span v-else>Spara spel till molnet</span>
      </button>
      <div v-else class="auth-notice">Logga in för att spara till molnet</div>
    </div>

    <!-- Score -->
    <div class="score-display stat-item">
      <div class="stat-label">Poäng</div>
      <div class="stat-value">{{ score }}</div>
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
          <h3>Spara och ladda spel</h3>
          <p>
            Spelet sparas automatiskt lokalt efter varje drag. Du kan också spara och ladda spel
            från molnet om du är inloggad. Molnsparningar sker automatiskt med jämna mellanrum när
            du gör drag eller manuellt genom att klicka på "Spara spel till molnet".
          </p>
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
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/utils/supabase'

// Global theme store
const themeStore = useThemeStore()
const authStore = useAuthStore()

// Game state
const gameCanvas = ref(null)
const score = ref(0)
const gameOver = ref(false)
const rows = ref(4)
const columns = ref(4)
const boardSize = ref(4)
const useClassicColors = ref(false)
const hasSavedGame = ref(false)
const savedGame = ref(null)
const hasCloudSavedGame = ref(false)
const cloudSavedGame = ref(null)
const showSettings = ref(false)
const isSavingToCloud = ref(false)
const cloudSaveStatus = ref('') // 'saving', 'success', 'error', ''
// Cloud save tracking
const lastMoveTime = ref(null)
const lastCloudSaveTime = ref(0)
const cloudSaveInterval = 5000 // 5 seconds in milliseconds

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

  // Cloud save callbacks
  gameLogic.onCloudSaveStart = () => {
    cloudSaveStatus.value = 'saving'
    saveGameToCloud()
  }

  // Initialize the game with proper board setup
  gameLogic.setBoardSize(rows.value, columns.value)
  gameLogic.initGame()
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
  // Called after each move thus updating last move time
  lastMoveTime.value = Date.now()
  if (gameLogic) {
    gameLogic.saveGame()
  }

  const now = Date.now()
  // Only save to cloud if:
  // 1. A move was made in the last 10 seconds
  // 2. At least 10 seconds have passed since last cloud save
  if (
    lastMoveTime.value &&
    now - lastMoveTime.value <= cloudSaveInterval &&
    now - lastCloudSaveTime.value >= cloudSaveInterval
  ) {
    lastCloudSaveTime.value = now
    saveGameToCloud()
  }
}

async function manualCloudSave() {
  if (!authStore.isAuthed) {
    alert('Du måste vara inloggad för att spara till molnet')
    return
  }

  await saveGameToCloud()
}

async function fetchCloudGame() {
  if (!authStore.isAuthed) {
    hasCloudSavedGame.value = false
    cloudSavedGame.value = null
    return
  }

  try {
    const { data, error } = await supabase
      .from('2048_game')
      .select('*')
      .eq('user_id', authStore.user.id)
      .single()

    if (error) {
      console.error('Error fetching cloud game:', error)
      return
    }
    if (data && data.state && data.state.score > 0) {
      const isGameOver = gameLogic.isGameOver(data.state.board, data.state.rows, data.state.columns)
      data.state.gameOver = isGameOver
      cloudSavedGame.value = data.state
      hasCloudSavedGame.value = true
      console.log('Found cloud saved game:', data.state)
    } else {
      hasCloudSavedGame.value = false
      cloudSavedGame.value = null
      console.log('No cloud game found')
    }
  } catch (error) {
    console.error('Error fetching cloud game:', error)
    hasCloudSavedGame.value = false
    cloudSavedGame.value = null
  }
}

async function saveGameToCloud() {
  if (!gameLogic || !authStore.isAuthed) {
    if (gameLogic && gameLogic.onCloudSaveError) {
      gameLogic.onCloudSaveError('User not authenticated')
    }
    cloudSaveStatus.value = ''
    return
  }

  try {
    cloudSaveStatus.value = 'saving'
    const gameState = gameLogic.getGameState()

    // First, try to get existing record for this user
    const { data: existingGame, error: fetchError } = await supabase
      .from('2048_game')
      .select('*')
      .eq('user_id', authStore.user.id)
      .single()

    let result
    if (existingGame && !fetchError) {
      // Update existing record
      result = await supabase
        .from('2048_game')
        .update({
          state: gameState,
          username: authStore.profile.username,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', authStore.user.id)
        .select()
    } else {
      // Create new record
      result = await supabase
        .from('2048_game')
        .insert({
          user_id: authStore.user.id,
          username: authStore.profile.username,
          state: gameState,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
    }

    if (result.error) {
      throw result.error
    }

    cloudSaveStatus.value = 'success'
    if (gameLogic.onCloudSaveComplete) {
      gameLogic.onCloudSaveComplete()
    }

    // Reset status after 2 seconds
    setTimeout(() => {
      cloudSaveStatus.value = ''
    }, 2000)
  } catch (error) {
    console.error('Error saving game to cloud:', error)
    cloudSaveStatus.value = 'error'
    if (gameLogic.onCloudSaveError) {
      gameLogic.onCloudSaveError(error.message)
    }

    // Reset status after 3 seconds for errors
    setTimeout(() => {
      cloudSaveStatus.value = ''
    }, 3000)
  }
}

function loadGame() {
  loadLocalGame()
}

function loadLocalGame() {
  if (gameLogic) {
    let gameState = savedGame.value
    if (!gameState) {
      gameState = gameLogic.loadGame()
    }
    if (gameState) {
      // Update reactive variables first
      rows.value = gameState.rows
      columns.value = gameState.columns
      boardSize.value = gameState.rows
      score.value = gameState.score
      gameOver.value = false
      hasSavedGame.value = false

      // Update game logic properties
      gameLogic.rows = gameState.rows
      gameLogic.columns = gameState.columns
      gameLogic.score = gameState.score

      // Reconstruct the board with raw values
      gameLogic.board = gameState.board

      // Resize board and canvas to match the loaded game dimensions
      gameLogic.resizeBoard()
      gameLogic.drawBoard()

      // Update localStorage to match the loaded game size
      localStorage.setItem('2048-board-size', String(gameState.rows))
    }
  }
}

function loadCloudGame() {
  if (gameLogic && cloudSavedGame.value) {
    const gameState = cloudSavedGame.value

    // Update reactive variables first
    rows.value = gameState.rows
    columns.value = gameState.columns
    boardSize.value = gameState.rows
    score.value = gameState.score
    gameOver.value = false
    hasCloudSavedGame.value = false

    // Update game logic properties
    gameLogic.rows = gameState.rows
    gameLogic.columns = gameState.columns
    gameLogic.score = gameState.score

    // Reconstruct the board with raw values
    gameLogic.board = gameState.board

    // Resize board and canvas to match the loaded game dimensions
    gameLogic.resizeBoard()
    gameLogic.drawBoard()

    // Update localStorage to match the loaded game size
    localStorage.setItem('2048-board-size', String(gameState.rows))
  }
}

function checkForSavedGame() {
  const savedState = localStorage.getItem('2048GameState')
  if (savedState) {
    console.log('Found saved game state:', savedState) // Debug log
    const gameState = JSON.parse(savedState)
    if (gameState.score > 0) {
      const isGameOver = gameLogic.isGameOver(gameState.board, gameState.rows, gameState.columns)
      gameState.gameOver = isGameOver
      console.log('Saved game is game over', isGameOver) // Debug log;
      hasSavedGame.value = true
      savedGame.value = gameState
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

// Watch for auth changes and update cloud game data
watch(
  () => authStore.isAuthed,
  (isAuthed) => {
    if (isAuthed) {
      fetchCloudGame()
    } else {
      hasCloudSavedGame.value = false
      cloudSavedGame.value = null
    }
  },
)

onMounted(async () => {
  await nextTick()

  // Initialize auth store
  await authStore.init()

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

  // Check for saved games
  checkForSavedGame()
  await fetchCloudGame()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped src="@/components/2048/game2048.scss" lang="scss"></style>
