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

    <div v-if="monthGroups.length > 0" class="date-selector">
      <h3>Välj datum</h3>

      <!-- Month selector -->
      <div class="month-selector">
        <div
          v-for="group in monthGroups"
          :key="group.key"
          class="month-item"
          :class="{
            selected: selectedMonth === group.key,
          }"
          @click="selectedMonth = group.key"
        >
          {{ group.month }}
        </div>
      </div>

      <!-- Date selector for selected month -->
      <div
        v-if="selectedMonth"
        ref="dateScrollRef"
        class="date-scroll"
        v-for="group in monthGroups.filter((g) => selectedMonth === g.key)"
        :key="group.key"
      >
        <div
          v-for="date in group.dates"
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
            won: isDateWon(date),
            lost: isDateLost(date),
            started: isDateStarted(date),
          }"
          @click="selectDate(date)"
        >
          <div class="date-label">{{ formatDate(date) }}</div>
          <div v-if="isDateCompleted(date)" class="completion-indicator">
            <span v-if="isDateWon(date)">✓</span>
            <span v-else>✗</span>
          </div>
          <button
            v-if="isDateCompleted(date)"
            class="retry-mini-button"
            @click.stop="retryDate(date)"
            title="Försök igen"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import FiveLetter from '@/components/ordel/FiveLetter.vue'
import { supabase } from '@/utils/supabase'
import { useAllowedWords, isAllowed } from '@/composables/ordel/useAllowedWords'

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

interface MonthGroup {
  month: string
  year: number
  dates: string[]
  key: string
}

const gameGrid = ref<InstanceType<typeof FiveLetter> | null>(null)
const currentWord = ref('')
const currentRow = ref(0)
const currentCol = ref(0)
const submittedRows = ref<SubmittedRow[]>([])
const availableDates = ref<string[]>([])
const selectedDate = ref('')
const keyStates = ref<Map<string, 'correct' | 'present' | 'absent'>>(new Map())
const gameWon = ref(false)
const gameLost = ref(false)
const dateScrollRef = ref<HTMLElement | null>(null)
const selectedDateRef = ref<HTMLElement | null>(null)
const monthGroups = ref<MonthGroup[]>([])
const selectedMonth = ref<string>('')
const allGuesses = ref<DateGuesses>({})

const VALID_KEYS = 'qwertyuiopåasdfghjklöäzxcvbnm'
const STORAGE_KEY_GUESSES = 'ordel-date-guesses'

// Helpers
function parseDateStr(date: string) {
  return new Date(date + 'T00:00:00')
}

function monthKeyFromDate(date: string) {
  const d = parseDateStr(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function scrollToSelectedDate() {
  if (selectedDateRef.value) {
    selectedDateRef.value.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
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

/** Get all available dates from the edge function */
async function fetchAvailableDates() {
  try {
    const { data, error } = await supabase.functions.invoke('ordel/available-dates', {
      method: 'GET',
    })

    if (error) {
      throw error
    }

    // Ensure dates are sorted ascending for consistent behavior
    availableDates.value = [...data.dates].sort()
    groupDatesByMonth()

    // Select today's date by default (last date in the array)
    if (availableDates.value.length > 0) {
      const lastDate = availableDates.value[availableDates.value.length - 1]
      if (lastDate) {
        selectedDate.value = lastDate
        selectedMonth.value = monthKeyFromDate(lastDate)
      }
    }
  } catch (error) {
    console.error('Error fetching available dates:', error)
    gameGrid.value?.showMessage('Kunde inte hämta tillgängliga datum', 'error')
  }
}

/** Group dates by month for better organization */
function groupDatesByMonth() {
  const groups = new Map<string, MonthGroup>()

  availableDates.value.forEach((date) => {
    const d = parseDateStr(date)
    const monthKey = monthKeyFromDate(date)
    const monthName = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })

    if (!groups.has(monthKey)) {
      groups.set(monthKey, {
        month: monthName,
        year: d.getFullYear(),
        dates: [],
        key: monthKey,
      })
    }

    groups.get(monthKey)?.dates.push(date)
  })

  // Sort groups chronologically and dates within groups
  monthGroups.value = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key))
  monthGroups.value.forEach((g) => g.dates.sort())
}

/** Load completed dates and guesses from localStorage */
function loadAllGuesses() {
  const stored = localStorage.getItem(STORAGE_KEY_GUESSES)
  if (stored) {
    try {
      allGuesses.value = JSON.parse(stored)
    } catch (error) {
      console.error('Error loading guesses:', error)
      allGuesses.value = {}
    }
  } else {
    allGuesses.value = {}
  }
}

/** Save completed dates to localStorage */
/** Load guesses for a specific date */
function loadGuessesForDate(date: string): DateGuesses[string] | null {
  return allGuesses.value[date] || null
}

/** Save guesses for a specific date */
function saveGuessesForDate(
  date: string,
  guesses: SubmittedRow[],
  completed: boolean,
  won: boolean,
) {
  try {
    allGuesses.value[date] = {
      guesses,
      completed,
      won,
    }

    localStorage.setItem(STORAGE_KEY_GUESSES, JSON.stringify(allGuesses.value))
  } catch (error) {
    console.error('Error saving guesses:', error)
  }
}

/** Remove guesses for a specific date (for retry) */
function removeGuessesForDate(date: string) {
  try {
    delete allGuesses.value[date]
    localStorage.setItem(STORAGE_KEY_GUESSES, JSON.stringify(allGuesses.value))
  } catch (error) {
    console.error('Error removing guesses:', error)
  }
}

/** Check if a date has been completed */
function isDateCompleted(date: string): boolean {
  const savedGame = loadGuessesForDate(date)
  return savedGame?.completed === true
}

/** Check if a date was won */
function isDateWon(date: string): boolean {
  const savedGame = loadGuessesForDate(date)
  return savedGame?.won === true
}

/** Check if a date was lost */
function isDateLost(date: string): boolean {
  const savedGame = loadGuessesForDate(date)
  return savedGame?.completed === true && savedGame?.won === false
}

function isDateStarted(date: string): boolean {
  const savedGame = loadGuessesForDate(date)
  return savedGame !== null && savedGame.guesses.length > 0
}

/** Format date for display */
function formatDate(date: string): string {
  const d = parseDateStr(date)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Select a date */
function selectDate(date: string) {
  // Save current game state if in progress
  if (currentRow.value > 0 && !gameWon.value && !gameLost.value) {
    saveGuessesForDate(selectedDate.value, submittedRows.value, false, false)
  }

  selectedDate.value = date
  selectedMonth.value = monthKeyFromDate(date)
  loadGameForDate(date)

  // Scroll to selected date
  nextTick(() => {
    scrollToSelectedDate()
  })
}

/** Load game state for a specific date */
function loadGameForDate(date: string) {
  resetGame()

  const savedGame = loadGuessesForDate(date)
  if (savedGame) {
    // Load previous guesses
    submittedRows.value = savedGame.guesses
    currentRow.value = savedGame.guesses.length
    gameWon.value = savedGame.won

    // Restore keyboard states
    savedGame.guesses.forEach((row) => updateKeyStatesFromResult(row.result))
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
function retryDate(date?: string) {
  const targetDate = date || selectedDate.value

  if (
    !confirm(
      'Är du säker på att du vill försöka igen? Detta kommer radera dina tidigare gissningar.',
    )
  ) {
    return
  }

  // Remove previous guesses only
  removeGuessesForDate(targetDate)

  // If retrying the currently selected date, reset the game
  if (targetDate === selectedDate.value) {
    resetGame()
    gameGrid.value?.showMessage('', 'info')
  } else {
    // Otherwise, just switch to that date
    selectDate(targetDate)
  }
}

/** Handle key press from keyboard or on-screen keyboard */
function handleKeyPress(key: string) {
  if (gameWon.value || gameLost.value) return

  const upperKey = key.toUpperCase()

  if (currentCol.value < 5) {
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

  // Client-side allowed word check (authoritative check should also happen on the server)
  try {
    const allowed = await isAllowed(currentWord.value)
    if (!allowed) {
      gameGrid.value?.showMessage('Inte ett giltigt ord', 'error')
      return
    }
  } catch (e) {
    // If the list failed to load, don't block the guess; server will still validate format
    console.warn('[ordel] Allowed-words check skipped due to load error', e)
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
    updateKeyStatesFromResult(data.result)

    // Check if won
    const won = data.result.every((r: LetterResult) => r.correct)

    if (won) {
      gameWon.value = true
      saveGuessesForDate(selectedDate.value, submittedRows.value, true, true)
      setTimeout(() => {
        gameGrid.value?.showMessage('Great Success!', 'success')
      }, 500)
    } else if (currentRow.value >= 5) {
      gameLost.value = true
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

  const key = event.key

  if (VALID_KEYS.includes(key)) {
    handleKeyPress(key)
  } else if (key === 'Backspace') {
    handleBackspace()
  } else if (key === 'Enter') {
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
  loadAllGuesses()
  await fetchAvailableDates()
  window.addEventListener('keydown', handleKeydown)
  // Warm up the allowed words list
  useAllowedWords()

  // Scroll to today's date after mounting
  nextTick(() => {
    if (dateScrollRef.value) scrollToSelectedDate()
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

  h3 {
    margin: 0 0 15px 0;
    font-size: 1.2rem;
    color: var(--theme-text-primary);
    text-align: center;
  }

  .month-selector {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 10px;
    background: var(--theme-bg-secondary);
    border-radius: 8px 8px 0 0;
    scroll-behavior: smooth;
    margin-bottom: 2px;

    &::-webkit-scrollbar {
      height: 6px;
    }

    &::-webkit-scrollbar-track {
      background: var(--theme-bg-primary);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--theme-button-primary-border);
      border-radius: 3px;

      &:hover {
        background: var(--theme-button-primary-bg);
      }
    }

    .month-item {
      min-width: 120px;
      padding: 12px 20px;
      background: var(--theme-bg-tertiary);
      border: 2px solid var(--theme-button-primary-border);
      border-radius: 5px;
      text-align: center;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;

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
    }
  }

  .date-scroll {
    display: flex;
    flex-direction: row;
    gap: 8px;
    overflow-x: auto;
    padding: 10px;
    background: var(--theme-bg-secondary);
    border-radius: 0 0 8px 8px;
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
        font-size: 0.9rem;
        color: inherit;
      }

      .retry-mini-button {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 20px;
        height: 20px;
        padding: 0;
        background: rgba(0, 0, 0, 0.3);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 0.9rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 0.2s;

        &:hover {
          background: rgba(0, 0, 0, 0.6);
          transform: scale(1.1);
        }
      }

      &:hover .retry-mini-button {
        opacity: 1;
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

        .retry-mini-button {
          opacity: 1;
        }
      }

      &.won {
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

      &.lost {
        background: #b54e4e;
        border-color: #b54e4e;
        color: white;

        &:hover {
          background: #c96262;
        }

        &.selected {
          background: #9a4242;
          border-color: #ebd126;
        }
      }

      &.completed:not(.won):not(.lost) {
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

      &.started:not(.completed) {
        background: linear-gradient(135deg, #b59f3b, #538d4e);
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

    h3 {
      font-size: 1rem;
    }

    .month-selector .month-item {
      min-width: 100px;
      padding: 10px 15px;
      font-size: 0.9rem;
    }

    .date-scroll .date-item {
      min-width: 60px;
      padding: 10px 12px;

      .date-label {
        font-size: 0.9rem;
      }

      .completion-indicator {
        font-size: 0.8rem;
      }

      .retry-mini-button {
        width: 18px;
        height: 18px;
        font-size: 0.8rem;
      }
    }
  }
}
</style>
