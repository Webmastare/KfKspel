<template>
  <div id="app-container">
    <div class="game-grid">
      <div v-for="(row, rowIndex) in grid" :key="rowIndex" class="word-row">
        <div
          v-for="(cell, cellIndex) in row"
          :key="cellIndex"
          class="letter-cell"
          :class="{
            filled: cell.letter,
            correct: cell.correct,
            present: cell.present,
            absent: cell.absent,
            active: rowIndex === currentRow && cellIndex === currentCol,
            flipping: cell.flipping,
          }"
        >
          {{ cell.letter }}
        </div>
      </div>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>

    <!-- Checking word spinner -->
    <div v-if="checkingWord" class="checking-spinner">
      <div class="spinner"></div>
      <span class="checking-text">Kontrollerar ord...</span>
    </div>

    <div class="keyboard-container">
      <div class="keyboard-row">
        <div
          v-for="key in ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Å']"
          :key="key"
          class="key"
          :class="getKeyClass(key)"
          @click="handleKeyPress(key)"
        >
          {{ key }}
        </div>
      </div>
      <div class="keyboard-row">
        <div
          v-for="key in ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä']"
          :key="key"
          class="key"
          :class="getKeyClass(key)"
          @click="handleKeyPress(key)"
        >
          {{ key }}
        </div>
      </div>
      <div class="keyboard-row">
        <div class="key special-key" @click="handleBackspace">Backsteg</div>
        <div
          v-for="key in ['Z', 'X', 'C', 'V', 'B', 'N', 'M']"
          :key="key"
          class="key"
          :class="getKeyClass(key)"
          @click="handleKeyPress(key)"
        >
          {{ key }}
        </div>
        <div class="key special-key" :class="{ 'key-disabled': checkingWord }" @click="handleEnter">
          {{ checkingWord ? 'Kontrollerar...' : 'Enter' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { useAllowedWords, isAllowed } from '@/composables/ordel/useAllowedWords'

// Interfaces
interface LetterResult {
  letter: string
  correct: boolean
  exist: boolean
}

interface SubmittedRow {
  word: string
  result: LetterResult[]
}

interface TodaysGameData {
  date: string | undefined
  guesses: SubmittedRow[]
  completed: boolean
  won: boolean
}

// Constants
const WORD_LENGTH = 5
const MAX_GUESSES = 6
const VALID_KEYS = 'qwertyuiopåasdfghjklöäzxcvbnm'
const FLIP_DURATION = 400
const FLIP_DELAY = 20
const FLIP_MIDPOINT = FLIP_DURATION / 2
const STORAGE_KEY = 'ordel-embed-progress'

// Game state
const currentWord = ref('')
const currentRow = ref(0)
const currentCol = ref(0)
const submittedRows = ref<SubmittedRow[]>([])
const keyStates = ref<Map<string, 'correct' | 'present' | 'absent'>>(new Map())
const gameWon = ref(false)
const gameLost = ref(false)
const checkingWord = ref(false)
const isAnimating = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')

// Animation state - like in the original
const animatingCells = ref<Array<Array<boolean>>>(
  Array(MAX_GUESSES)
    .fill(null)
    .map(() => Array(WORD_LENGTH).fill(false)),
)
const animatingRowData = ref<
  Array<
    Array<{
      letter: string
      correct: boolean
      present: boolean
      absent: boolean
    } | null>
  >
>(
  Array(MAX_GUESSES)
    .fill(null)
    .map(() => Array(WORD_LENGTH).fill(null)),
)

// Create grid for display
const grid = computed(() => {
  const gridArray = Array(MAX_GUESSES)
    .fill(null)
    .map(() =>
      Array(WORD_LENGTH)
        .fill(null)
        .map(() => ({
          letter: '',
          correct: false,
          present: false,
          absent: false,
          flipping: false,
        })),
    )

  // Fill current row with typed letters (only show if not animating and not submitted)
  if (currentRow.value < MAX_GUESSES && gridArray[currentRow.value] && !isAnimating.value) {
    for (let i = 0; i < currentWord.value.length && i < WORD_LENGTH; i++) {
      const cell = gridArray[currentRow.value]?.[i]
      if (cell) {
        cell.letter = currentWord.value[i]?.toUpperCase() || ''
      }
    }
  }

  // Fill submitted rows
  submittedRows.value.forEach((submittedRow, rowIndex) => {
    submittedRow.result.forEach((letterResult, colIndex) => {
      if (gridArray[rowIndex] && gridArray[rowIndex][colIndex]) {
        gridArray[rowIndex][colIndex] = {
          letter: letterResult.letter.toUpperCase(),
          correct: letterResult.correct,
          present: letterResult.exist && !letterResult.correct,
          absent: !letterResult.exist,
          flipping: animatingCells.value[rowIndex]?.[colIndex] || false,
        }
      }
    })
  })

  // Update animating rows (overrides submitted rows for cells currently animating)
  animatingRowData.value.forEach((animatingRow, rowIndex) => {
    const row = gridArray[rowIndex]
    if (row && animatingRow) {
      animatingRow.forEach((animatingCell, colIndex) => {
        if (animatingCell && row[colIndex]) {
          row[colIndex] = {
            letter: animatingCell.letter,
            correct: animatingCell.correct,
            present: animatingCell.present,
            absent: animatingCell.absent,
            flipping: animatingCells.value[rowIndex]?.[colIndex] || false,
          }
        }
      })
    }
  })

  return gridArray
})

// Get today's date
const todaysDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

// Game functions
function showMessage(msg: string, type: 'success' | 'error' | 'info') {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

// Local storage functions for today's game only
function loadTodaysGame(): TodaysGameData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const data: TodaysGameData = JSON.parse(stored)
    const today = todaysDate.value

    // Only return data if it's for today's date
    if (data.date === today) {
      return data
    }

    // If stored data is for a different date, remove it
    localStorage.removeItem(STORAGE_KEY)
    return null
  } catch (error) {
    console.error("Error loading today's game:", error)
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function saveTodaysGame(guesses: SubmittedRow[], completed: boolean, won: boolean) {
  try {
    const gameData: TodaysGameData = {
      date: todaysDate.value,
      guesses,
      completed,
      won,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData))
  } catch (error) {
    console.error("Error saving today's game:", error)
  }
}

function updateKeyStatesFromResult(result: LetterResult[]) {
  result.forEach((letterResult: LetterResult) => {
    const letter = letterResult.letter.toUpperCase()
    const currentState = keyStates.value.get(letter)

    if (letterResult.correct) {
      keyStates.value.set(letter, 'correct')
    } else if (letterResult.exist && currentState !== 'correct') {
      keyStates.value.set(letter, 'present')
    } else if (!letterResult.exist && !currentState) {
      keyStates.value.set(letter, 'absent')
    }
  })
}

function loadGameState() {
  const savedGame = loadTodaysGame()
  if (savedGame) {
    // Load previous guesses and game state
    submittedRows.value = savedGame.guesses
    currentRow.value = savedGame.guesses.length
    gameWon.value = savedGame.won
    gameLost.value = savedGame.completed && !savedGame.won

    // Restore keyboard states from all previous guesses
    savedGame.guesses.forEach((row) => updateKeyStatesFromResult(row.result))
  }
}

/**
 * Animate row reveal with letter flipping - matches original game behavior
 * Each letter flips individually with a delay between letters
 * Color states are revealed at the midpoint of each letter's flip animation
 */
async function animateRowReveal(rowIndex: number, results: LetterResult[]): Promise<void> {
  isAnimating.value = true

  // Initialize the animating row data with just letters, no colors
  const animatingRow = animatingRowData.value[rowIndex]
  if (animatingRow) {
    results.forEach((letterResult, colIndex) => {
      animatingRow[colIndex] = {
        letter: letterResult.letter.toUpperCase(),
        correct: false,
        present: false,
        absent: false,
      }
    })
  }

  // Animate each letter one by one
  for (let i = 0; i < results.length; i++) {
    // Check if animation should be aborted
    if (!isAnimating.value) {
      isAnimating.value = false
      return
    }

    const letterResult = results[i]
    if (!letterResult) continue

    // Start flip animation for this cell
    const cellRow = animatingCells.value[rowIndex]
    if (cellRow) {
      cellRow[i] = true
    }

    // Wait for half the animation (when the letter is "face down")
    setTimeout(() => {
      // Update the letter state at the midpoint of the flip
      if (animatingRow && animatingRow[i] && isAnimating.value) {
        animatingRow[i]!.correct = letterResult.correct
        animatingRow[i]!.present = letterResult.exist && !letterResult.correct
        animatingRow[i]!.absent = !letterResult.exist
      }
    }, FLIP_MIDPOINT)

    // Wait for the entire animation to complete
    await new Promise((resolve) => setTimeout(resolve, FLIP_DURATION))

    // Check again if animation should continue
    if (!isAnimating.value) {
      isAnimating.value = false
      return
    }

    // Stop flipping animation for this cell
    if (cellRow) {
      cellRow[i] = false
    }

    // Wait before starting next letter animation
    if (i < results.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, FLIP_DELAY))
    }
  }

  // After all animations complete, add to submitted rows
  submittedRows.value.push({
    word: currentWord.value,
    result: results,
  })

  // Clear the animating row data
  if (animatingRow) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      animatingRow[i] = null
    }
  }

  isAnimating.value = false
}

function handleKeyPress(key: string) {
  if (gameWon.value || gameLost.value || checkingWord.value || isAnimating.value) return

  const upperKey = key.toUpperCase()
  if (currentCol.value < WORD_LENGTH) {
    currentWord.value += upperKey
    currentCol.value++
  }
}

function handleBackspace() {
  if (gameWon.value || gameLost.value || checkingWord.value || isAnimating.value) return

  if (currentCol.value > 0) {
    currentWord.value = currentWord.value.slice(0, -1)
    currentCol.value--
  }
}

async function handleEnter() {
  if (gameWon.value || gameLost.value || checkingWord.value || isAnimating.value) return

  if (currentCol.value !== WORD_LENGTH) {
    showMessage(`Ordet måste vara ${WORD_LENGTH} bokstäver`, 'error')
    return
  }

  // Check if word is allowed
  try {
    const allowed = await isAllowed(currentWord.value)
    if (!allowed) {
      showMessage('Inte ett giltigt ord', 'error')
      return
    }
  } catch (e) {
    console.warn('[ordel] Allowed-words check skipped due to load error', e)
  }

  checkingWord.value = true

  try {
    // Make API call to check word
    const { data, error } = await supabase.functions.invoke(
      `ordel/check-word/${todaysDate.value}/${WORD_LENGTH}`,
      {
        method: 'POST',
        body: {
          word: currentWord.value.toLowerCase(),
        },
      },
    )

    if (error) {
      throw new Error(`Error checking word: ${error.message}`)
    }

    if (!data || !data.result) {
      throw new Error('Invalid response format')
    }

    checkingWord.value = false

    // Animate the row reveal
    await animateRowReveal(currentRow.value, data.result)

    // Update keyboard states
    updateKeyStatesFromResult(data.result)

    // Check if won
    const won = data.result.every((r: LetterResult) => r.correct)

    if (won) {
      gameWon.value = true
      saveTodaysGame(submittedRows.value, true, true)
      setTimeout(() => {
        showMessage('Great Success!', 'success')
      }, 300)
    } else if (currentRow.value >= MAX_GUESSES - 1) {
      gameLost.value = true
      saveTodaysGame(submittedRows.value, true, false)
      setTimeout(() => {
        showMessage('Typiskt det var fel :(', 'error')
      }, 300)
    } else {
      // Save progress even if game is not complete
      saveTodaysGame(submittedRows.value, false, false)
    }

    // Move to next row
    currentRow.value++
    currentCol.value = 0
    currentWord.value = ''
  } catch (error) {
    console.error('Error submitting word:', error)
    showMessage('Kunde inte kontrollera ordet', 'error')
  } finally {
    checkingWord.value = false
  }
}

function handleSpace() {
  currentWord.value = ''
  currentCol.value = 0
}

function handleKeydown(event: KeyboardEvent) {
  if (gameWon.value || gameLost.value || checkingWord.value || isAnimating.value) return

  const key = event.key.toLowerCase()
  if (VALID_KEYS.includes(key)) {
    handleKeyPress(key)
  } else if (key === 'backspace') {
    handleBackspace()
  } else if (key === 'enter') {
    handleEnter()
  } else if (event.code === 'Space') {
    event.preventDefault()
    handleSpace()
  }
}

function getKeyClass(key: string) {
  const state = keyStates.value.get(key)
  return {
    'key-correct': state === 'correct',
    'key-present': state === 'present',
    'key-absent': state === 'absent',
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // Warm up the allowed words list
  useAllowedWords()

  // Add no-navbar class to #inner-app for embedded mode
  const innerApp = document.getElementById('inner-app')
  if (innerApp) {
    innerApp.classList.add('no-navbar')
  }

  // Load today's saved game state if it exists
  loadGameState()
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped lang="scss">
@use '@/styles/theme.scss';
#app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #1a1a1a;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.game-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 20px 0;
}

.word-row {
  display: flex;
  gap: 8px;
}

.letter-cell {
  width: 60px;
  height: 60px;
  border: 2px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  text-transform: uppercase;
  background: #ffffff;
  color: #1a1a1a;
  border-radius: 4px;
  transition: all 0.3s ease;

  &.filled {
    border-color: var(--theme-text-primary);
    transform: scale(1.05);
  }

  &.active {
    border-color: #23641e;
    border-width: 3px;
  }

  &.correct {
    background: #538d4e;
    border-color: #538d4e;
    color: white;
  }

  &.present {
    background: #b59f3b;
    border-color: #b59f3b;
    color: white;
  }

  &.absent {
    background: #3a3a3c;
    border-color: #3a3a3c;
    color: white;
  }

  &.flipping {
    animation: flip 0.4s cubic-bezier(0.75, 0, 0.25, 1);
  }
}

@keyframes flip {
  0% {
    transform: rotateY(0);
  }
  50% {
    transform: rotateY(90deg);
  }
  100% {
    transform: rotateY(0);
  }
}

.message {
  margin: 10px 0;
  padding: 10px 20px;
  border-radius: 5px;
  font-weight: bold;
  text-align: center;

  &.success {
    background: #538d4e;
    color: white;
  }

  &.error {
    background: #ef4444;
    color: white;
  }

  &.info {
    background: #3b82f6;
    color: white;
  }
}

.checking-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 15px 0;
  color: #6b7280;
  font-size: 0.9rem;

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #23641e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .checking-text {
    font-weight: 500;
    opacity: 0.8;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.keyboard-container {
  width: 90%;
  max-width: 600px;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .keyboard-row {
    display: flex;
    justify-content: center;
    gap: 6px;
    width: 100%;

    .key {
      min-width: 40px;
      padding: 15px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e5e7eb;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
      color: #1a1a1a;

      &.special-key {
        min-width: 70px;
        font-size: 0.8rem;
      }

      &:hover {
        background: #d1d5db;
        transform: translateY(-2px);
      }

      &:active {
        transform: translateY(0);
      }

      &.key-correct {
        background: #538d4e;
        border-color: #538d4e;
        color: white;

        &:hover {
          background: #6aad5d;
        }
      }

      &.key-present {
        background: #b59f3b;
        border-color: #b59f3b;
        color: white;

        &:hover {
          background: #c9b458;
        }
      }

      &.key-absent {
        background: #787c7e;
        border-color: #787c7e;
        color: white;

        &:hover {
          background: #8a8e90;
        }
      }

      &.key-disabled {
        background: #9ca3af;
        border-color: #9ca3af;
        color: #6b7280;
        cursor: not-allowed;
        opacity: 0.7;

        &:hover {
          background: #9ca3af;
          transform: none;
        }
      }
    }
  }
}

/* Responsive design for mobile devices */

@media (max-width: 768px) {
  #app-container {
    padding: 15px;
    min-height: 100vh;
  }

  .letter-cell {
    width: 50px;
    height: 50px;
    font-size: 1.5rem;
  }

  .word-row {
    gap: 5px;
  }

  .checking-spinner {
    margin: 10px 0;
    font-size: 0.8rem;

    .spinner {
      width: 18px;
      height: 18px;
      border-width: 2px;
    }
  }

  .keyboard-container {
    width: 95%;

    .keyboard-row .key {
      min-width: 30px;
      padding: 12px 6px;
      font-size: 0.9rem;

      &.special-key {
        min-width: 55px;
        font-size: 0.7rem;
      }
    }
  }
}

@media (max-width: 480px) {
  .letter-cell {
    width: 45px;
    height: 45px;
    font-size: 1.3rem;
  }

  .keyboard-container .keyboard-row .key {
    min-width: 28px;
    padding: 10px 5px;
    font-size: 0.8rem;

    &.special-key {
      min-width: 50px;
      font-size: 0.6rem;
    }
  }
}
</style>
