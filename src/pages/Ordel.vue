<template>
  <div id="app-container">
    <h1 class="game-header">Ordel</h1>

    <FiveLetter
      ref="gameGrid"
      :current-word="currentWord"
      :current-row="currentRow"
      :current-col="currentCol"
      :submitted-rows="submittedRows"
    />

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
        <div class="key special-key" @click="handleEnter">Enter</div>
      </div>
    </div>

    <div v-if="availableDates.length > 0" class="date-selector">
      <div class="date-header">
        <h3>Välj datum</h3>
        <button
          v-if="isDateCompleted(selectedDate) && !gameWon && !gameLost"
          class="retry-button"
          @click="retryDate"
        >
          Försök igen
        </button>
      </div>
      <div ref="dateScrollRef" class="date-scroll">
        <div
          v-for="date in availableDates"
          :key="date"
          :ref="
            (el) => {
              if (date === selectedDate) selectedDateRef = el as HTMLElement
            }
          "
          class="date-item"
          :class="{
            selected: date === selectedDate,
            completed: isDateCompleted(date),
          }"
          @click="selectDate(date)"
        >
          <div class="date-label">{{ formatDate(date) }}</div>
          <div v-if="isDateCompleted(date)" class="completion-indicator">✓</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import FiveLetter from '@/components/ordel/FiveLetter.vue'
import { supabase } from '@/utils/supabase'

interface LetterResult {
  letter: string
  correct: boolean
  exist: boolean
}

interface SubmittedRow {
  word: string
  result: LetterResult[]
}

interface DateGuesses {
  [date: string]: {
    guesses: SubmittedRow[]
    completed: boolean
    won: boolean
  }
}

const gameGrid = ref<InstanceType<typeof FiveLetter> | null>(null)
const currentWord = ref('')
const currentRow = ref(0)
const currentCol = ref(0)
const submittedRows = ref<SubmittedRow[]>([])
const availableDates = ref<string[]>([])
const selectedDate = ref('')
const completedDates = ref<Set<string>>(new Set())
const keyStates = ref<Map<string, 'correct' | 'present' | 'absent'>>(new Map())
const gameWon = ref(false)
const gameLost = ref(false)
const dateScrollRef = ref<HTMLElement | null>(null)
const selectedDateRef = ref<HTMLElement | null>(null)

const VALID_KEYS = 'QWERTYUIOPÅASDFGHJKLÖÄZXCVBNM'
const STORAGE_KEY_DATES = 'ordel-completed-dates'
const STORAGE_KEY_GUESSES = 'ordel-date-guesses'

/** Get all available dates from the edge function */
async function fetchAvailableDates() {
  try {
    const { data, error } = await supabase.functions.invoke('ordel/available-dates', {
      method: 'GET',
    })

    if (error) {
      throw error
    }

    availableDates.value = data.dates

    // Select today's date by default (last date in the array)
    if (availableDates.value.length > 0) {
      const lastDate = availableDates.value[availableDates.value.length - 1]
      if (lastDate) {
        selectedDate.value = lastDate
      }
    }
  } catch (error) {
    console.error('Error fetching available dates:', error)
    gameGrid.value?.showMessage('Kunde inte hämta tillgängliga datum', 'error')
  }
}

/** Load completed dates and guesses from localStorage */
function loadCompletedDates() {
  const storedDates = localStorage.getItem(STORAGE_KEY_DATES)
  if (storedDates) {
    try {
      const dates = JSON.parse(storedDates)
      completedDates.value = new Set(dates)
    } catch (error) {
      console.error('Error loading completed dates:', error)
    }
  }
}

/** Save completed dates to localStorage */
function saveCompletedDates() {
  localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify([...completedDates.value]))
}

/** Load guesses for a specific date */
function loadGuessesForDate(date: string): DateGuesses[string] | null {
  const stored = localStorage.getItem(STORAGE_KEY_GUESSES)
  if (stored) {
    try {
      const allGuesses: DateGuesses = JSON.parse(stored)
      return allGuesses[date] || null
    } catch (error) {
      console.error('Error loading guesses:', error)
      return null
    }
  }
  return null
}

/** Save guesses for a specific date */
function saveGuessesForDate(
  date: string,
  guesses: SubmittedRow[],
  completed: boolean,
  won: boolean,
) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_GUESSES)
    const allGuesses: DateGuesses = stored ? JSON.parse(stored) : {}

    allGuesses[date] = {
      guesses,
      completed,
      won,
    }

    localStorage.setItem(STORAGE_KEY_GUESSES, JSON.stringify(allGuesses))
  } catch (error) {
    console.error('Error saving guesses:', error)
  }
}

/** Remove guesses for a specific date (for retry) */
function removeGuessesForDate(date: string) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_GUESSES)
    if (stored) {
      const allGuesses: DateGuesses = JSON.parse(stored)
      delete allGuesses[date]
      localStorage.setItem(STORAGE_KEY_GUESSES, JSON.stringify(allGuesses))
    }
  } catch (error) {
    console.error('Error removing guesses:', error)
  }
}

/** Check if a date has been completed */
function isDateCompleted(date: string): boolean {
  return completedDates.value.has(date)
}

/** Format date for display */
function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Select a date */
function selectDate(date: string) {
  if (currentRow.value > 0 && !gameWon.value && !gameLost.value) {
    if (!confirm('Du har ett pågående spel. Vill du verkligen byta datum?')) {
      return
    }
  }

  selectedDate.value = date
  loadGameForDate(date)

  // Scroll to selected date
  nextTick(() => {
    if (selectedDateRef.value) {
      selectedDateRef.value.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  })
}

/** Load game state for a specific date */
function loadGameForDate(date: string) {
  resetGame()

  const savedGame = loadGuessesForDate(date)
  if (savedGame && savedGame.completed) {
    // Load previous guesses
    submittedRows.value = savedGame.guesses
    currentRow.value = savedGame.guesses.length
    gameWon.value = savedGame.won
    gameLost.value = !savedGame.won

    // Restore keyboard states
    savedGame.guesses.forEach((row) => {
      row.result.forEach((letterResult) => {
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
    })
  }
}

/** Reset game state */
function resetGame() {
  currentWord.value = ''
  currentRow.value = 0
  currentCol.value = 0
  submittedRows.value = []
  keyStates.value.clear()
  gameWon.value = false
  gameLost.value = false
}

/** Retry a completed date */
function retryDate() {
  if (
    !confirm(
      'Är du säker på att du vill försöka igen? Detta kommer radera dina tidigare gissningar.',
    )
  ) {
    return
  }

  // Remove from completed dates and guesses
  completedDates.value.delete(selectedDate.value)
  saveCompletedDates()
  removeGuessesForDate(selectedDate.value)

  // Reset the game
  resetGame()
  gameGrid.value?.showMessage('Försöker igen!', 'info')
}

/** Handle key press from keyboard or on-screen keyboard */
function handleKeyPress(key: string) {
  if (gameWon.value || gameLost.value) return

  const upperKey = key.toUpperCase()

  if (VALID_KEYS.includes(upperKey) && currentCol.value < 5) {
    currentWord.value += upperKey
    currentCol.value++
  }
}

/** Handle backspace */
function handleBackspace() {
  if (gameWon.value || gameLost.value) return

  if (currentCol.value > 0) {
    currentWord.value = currentWord.value.slice(0, -1)
    currentCol.value--
  }
}

/** Handle enter - submit the word */
async function handleEnter() {
  if (gameWon.value || gameLost.value) return

  if (currentCol.value !== 5) {
    gameGrid.value?.showMessage('Ordet måste vara 5 bokstäver', 'error')
    return
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      `ordel/check-word/${selectedDate.value}`,
      {
        method: 'POST',
        body: { word: currentWord.value.toLowerCase() },
      },
    )

    if (error) {
      throw error
    }

    // Add to submitted rows
    submittedRows.value.push({
      word: currentWord.value,
      result: data.result,
    })

    // Update keyboard states
    data.result.forEach((letterResult: LetterResult) => {
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

    // Check if won
    const won = data.result.every((r: LetterResult) => r.correct)

    if (won) {
      gameWon.value = true
      completedDates.value.add(selectedDate.value)
      saveCompletedDates()
      saveGuessesForDate(selectedDate.value, submittedRows.value, true, true)
      setTimeout(() => {
        gameGrid.value?.showMessage('Great Success!', 'success')
      }, 500)
    } else if (currentRow.value >= 5) {
      gameLost.value = true
      completedDates.value.add(selectedDate.value)
      saveCompletedDates()
      saveGuessesForDate(selectedDate.value, submittedRows.value, true, false)
      setTimeout(() => {
        gameGrid.value?.showMessage('Typiskt det var fel :(', 'error')
      }, 500)
    } else {
      // Save progress even if not complete
      saveGuessesForDate(selectedDate.value, submittedRows.value, false, false)
    }

    // Move to next row
    currentRow.value++
    currentCol.value = 0
    currentWord.value = ''
  } catch (error) {
    console.error('Error submitting word:', error)
    gameGrid.value?.showMessage('Kunde inte kontrollera ordet', 'error')
  }
}

/** Handle physical keyboard input */
function handleKeydown(event: KeyboardEvent) {
  if (gameWon.value || gameLost.value) return

  const key = event.key.toUpperCase()

  if (VALID_KEYS.includes(key)) {
    handleKeyPress(key)
  } else if (key === 'BACKSPACE') {
    handleBackspace()
  } else if (key === 'ENTER') {
    handleEnter()
  }
}

/** Get CSS class for keyboard key based on its state */
function getKeyClass(key: string) {
  const state = keyStates.value.get(key)
  return {
    'key-correct': state === 'correct',
    'key-present': state === 'present',
    'key-absent': state === 'absent',
  }
}

onMounted(async () => {
  loadCompletedDates()
  await fetchAvailableDates()
  window.addEventListener('keydown', handleKeydown)

  // Scroll to today's date after mounting
  nextTick(() => {
    if (selectedDateRef.value && dateScrollRef.value) {
      selectedDateRef.value.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  })
})

// Clean up event listener
import { onUnmounted } from 'vue'
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Watch for date changes
watch(selectedDate, (newDate) => {
  if (newDate) {
    loadGameForDate(newDate)
  }
})
</script>

<style scoped lang="scss">
#app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100%;
  padding: 20px;
  overflow: hidden;
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
      background: var(--theme-bg-tertiary);
      border: 1px solid var(--theme-button-primary-border);
      border-radius: 5px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;

      &.special-key {
        min-width: 70px;
        font-size: 0.8rem;
      }

      &:hover {
        background: var(--theme-button-secondary-hover);
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
        background: #3a3a3c;
        border-color: #3a3a3c;
        color: #818384;

        &:hover {
          background: #4a4a4c;
        }
      }
    }
  }
}

.date-selector {
  margin-top: 30px;
  width: 90%;
  max-width: 800px;

  .date-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding: 0 10px;

    h3 {
      margin: 0;
      font-size: 1.2rem;
      color: var(--theme-text-primary);
    }

    .retry-button {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;

      &:hover {
        background: #c82333;
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  .date-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 10px;
    background: var(--theme-bg-secondary);
    border-radius: 8px;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: var(--theme-bg-primary);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--theme-button-primary-border);
      border-radius: 4px;

      &:hover {
        background: var(--theme-button-primary-bg);
      }
    }

    .date-item {
      position: relative;
      min-width: 70px;
      padding: 12px 15px;
      background: var(--theme-bg-tertiary);
      border: 2px solid var(--theme-button-primary-border);
      border-radius: 5px;
      text-align: center;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      .date-label {
        font-size: 1rem;
      }

      .completion-indicator {
        font-size: 0.8rem;
        color: inherit;
      }

      &:hover {
        background: var(--theme-button-secondary-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }

      &.selected {
        border-color: #ebd126;
        border-width: 3px;
        background: var(--theme-button-primary-bg);
        color: white;
        transform: scale(1.05);

        &:hover {
          transform: scale(1.08) translateY(-2px);
        }
      }

      &.completed {
        background: #538d4e;
        border-color: #538d4e;
        color: white;

        &:hover {
          background: #6aad5d;
        }

        &.selected {
          background: #457a42;
          border-color: #ebd126;
        }
      }
    }
  }
}

@media (max-width: 768px) {
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

  .date-selector {
    width: 95%;

    .date-header {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;

      h3 {
        font-size: 1rem;
      }

      .retry-button {
        font-size: 0.8rem;
        padding: 6px 12px;
      }
    }

    .date-scroll .date-item {
      min-width: 60px;
      padding: 10px 12px;

      .date-label {
        font-size: 0.9rem;
      }

      .completion-indicator {
        font-size: 0.7rem;
      }
    }
  }
}
</style>
