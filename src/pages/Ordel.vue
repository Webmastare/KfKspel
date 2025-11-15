<template>
  <div id="app-container">
    <h1 class="game-header">Ordel</h1>

    <!-- Mode switcher -->
    <div class="mode-switcher">
      <button
        v-for="mode in modes"
        :key="mode.value"
        :class="['mode-btn', { active: selectedMode === mode.value }]"
        @click="selectMode(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>

    <button @click="showWordRequestForm = !showWordRequestForm" class="open-request-word-btn">
      Saknar du ord i listan?
    </button>
    <div v-if="showWordRequestForm" class="request-word-container">
      <p>Tänk på att endast grundformen (lemma) används.</p>
      <label for="request-word-input">Önska ett ord:</label>
      <input
        id="request-word-input"
        type="text"
        :maxlength="selectedMode"
        :placeholder="`Skriv ditt ${selectedMode}-bokstavsord här`"
        v-model="requestedWord"
      />
      <p>{{ requestMessage }}</p>
      <button @click="submitWordRequest">Skicka förslag</button>
      <p>Det kan ta ett tag innan det läggs till och eventuellt kommer med som "dagens-ord"</p>
    </div>

    <component
      :is="currentGameComponent"
      ref="gameGrid"
      :current-word="currentWord"
      :current-row="currentRow"
      :current-col="currentCol"
      :submitted-rows="submittedRows"
      :animating-cells="animatingCells"
      :animating-row-data="animatingRowData"
    />

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
import { onMounted, ref, watch, nextTick, computed } from 'vue'
import FiveLetter from '@/components/ordel/FiveLetter.vue'
import FourLetter from '@/components/ordel/FourLetter.vue'
import SixLetter from '@/components/ordel/SixLetter.vue'
import SevenLetter from '@/components/ordel/SevenLetter.vue'
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

// Mode management
type GameMode = 4 | 5 | 6 | 7
const selectedMode = ref<GameMode>(5)
const modes = [
  { value: 4 as GameMode, label: '4 bokstäver' },
  { value: 5 as GameMode, label: '5 bokstäver' },
  { value: 6 as GameMode, label: '6 bokstäver' },
  { value: 7 as GameMode, label: '7 bokstäver' },
]

const currentGameComponent = computed(() => {
  switch (selectedMode.value) {
    case 4:
      return FourLetter
    case 5:
      return FiveLetter
    case 6:
      return SixLetter
    case 7:
      return SevenLetter
    default:
      return FiveLetter
  }
})

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
const checkingWord = ref(false)
const animatingCells = ref<Array<Array<boolean>>>(
  Array(6)
    .fill(null)
    .map(() => Array(selectedMode.value).fill(false)),
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
  Array(6)
    .fill(null)
    .map(() => Array(selectedMode.value).fill(null)),
)

const VALID_KEYS = 'qwertyuiopåasdfghjklöäzxcvbnm'
const getStorageKey = () => `ordel-date-guesses-${selectedMode.value}letter`

// Animation constants
const FLIP_DURATION = 400 // Total flip animation duration in ms
const FLIP_DELAY = 20 // Delay between each letter flip
const FLIP_MIDPOINT = FLIP_DURATION / 2 // When to change the letter state

// Word request feature
const showWordRequestForm = ref(false)
const requestedWord = ref('')
const isSubmittingRequest = ref(false)
const requestMessage = ref('')

async function submitWordRequest() {
  if (requestedWord.value) {
    // Handle the word request submission
    console.log('Requested word:', requestedWord.value)
    // Handle by sending a feedback form to the database
    isSubmittingRequest.value = true
    requestMessage.value = ''

    try {
      // Insert feedback record
      const feedbackRecord = {
        type: 'word_request',
        title: `Word request: ${requestedWord.value}`,
        email: null,
        severity: 'low',
        description: `Lägg till ordet ${requestedWord.value} i ordlistan`,
        browser_info: null,
        media_urls: null,
        status: 'open',
      }

      const { error } = await supabase.from('feedback').insert([feedbackRecord])

      if (error) {
        throw new Error('Failed to submit feedback')
      }
      requestMessage.value = 'Ditt förslag har skickats in!'
      // Hide message after 5 seconds
      setTimeout(() => {
        requestMessage.value = ''
      }, 5000)
    } catch (error) {
      console.error('Submission error:', error)
      requestMessage.value =
        error instanceof Error ? error.message : 'Ett fel uppstod vid skickning av feedback'
    } finally {
      requestMessage.value = 'Tack för ditt förslag!'
    }
  }
}

// Helpers
async function selectMode(mode: GameMode) {
  // Save current game state if in progress
  if (currentRow.value > 0 && !gameWon.value && !gameLost.value) {
    saveGuessesForDate(selectedDate.value, submittedRows.value, false, false)
  }

  selectedMode.value = mode

  // Reset animation arrays with new word length
  animatingCells.value = Array(6)
    .fill(null)
    .map(() => Array(mode).fill(false))
  animatingRowData.value = Array(6)
    .fill(null)
    .map(() => Array(mode).fill(null))

  // Reset game state
  resetGame()

  // Refetch available dates for the new mode
  await fetchAvailableDates()

  // Load guesses for new mode
  loadAllGuesses()

  // Load game for selected date if available
  if (selectedDate.value) {
    loadGameForDate(selectedDate.value)
  }
}

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
      throw new Error(`Error fetching available dates: ${error.message}`)
    }

    if (!data || !data.dates) {
      throw new Error('Invalid response format')
    }

    // Filter dates that have words for the current mode
    const filteredDates = data.dates
      .filter((dateInfo: any) => dateInfo.available[selectedMode.value])
      .map((dateInfo: any) => dateInfo.date)

    availableDates.value = filteredDates
    groupDatesByMonth()

    // Select today's date by default if available
    const today = new Date().toISOString().split('T')[0]
    if (today && filteredDates.includes(today)) {
      selectedDate.value = today
      selectedMonth.value = monthKeyFromDate(today)
    } else if (filteredDates.length > 0) {
      // Select most recent date if today isn't available
      const lastDate = filteredDates[filteredDates.length - 1]
      selectedDate.value = lastDate
      selectedMonth.value = monthKeyFromDate(lastDate)
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
  const stored = localStorage.getItem(getStorageKey())
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

    localStorage.setItem(getStorageKey(), JSON.stringify(allGuesses.value))
  } catch (error) {
    console.error('Error saving guesses:', error)
  }
}

/** Remove guesses for a specific date (for retry) */
function removeGuessesForDate(date: string) {
  try {
    delete allGuesses.value[date]
    localStorage.setItem(getStorageKey(), JSON.stringify(allGuesses.value))
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
  checkingWord.value = false
  // Reset animation state
  animatingCells.value = Array(6)
    .fill(null)
    .map(() => Array(selectedMode.value).fill(false))
  animatingRowData.value = Array(6)
    .fill(null)
    .map(() => Array(selectedMode.value).fill(null))
}

/** Animate row reveal with letter flipping */
async function animateRowReveal(
  rowIndex: number,
  results: Array<{ letter: string; correct: boolean; exist: boolean }>,
): Promise<void> {
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
      if (animatingRow && animatingRow[i]) {
        animatingRow[i]!.correct = letterResult.correct
        animatingRow[i]!.present = letterResult.exist && !letterResult.correct
        animatingRow[i]!.absent = !letterResult.exist
      }
    }, FLIP_MIDPOINT)

    // Wait for the entire animation to complete
    await new Promise((resolve) => setTimeout(resolve, FLIP_DURATION))

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
    for (let i = 0; i < 5; i++) {
      animatingRow[i] = null
    }
  }
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
  if (gameWon.value || gameLost.value || showWordRequestForm.value || checkingWord.value) return

  const upperKey = key.toUpperCase()

  if (currentCol.value < selectedMode.value) {
    currentWord.value += upperKey
    currentCol.value++
  }
}

/** Handle backspace */
function handleBackspace() {
  if (gameWon.value || gameLost.value || checkingWord.value) return

  if (currentCol.value > 0) {
    currentWord.value = currentWord.value.slice(0, -1)
    currentCol.value--
  }
}

/** Handle enter - submit the word */
async function handleEnter() {
  if (gameWon.value || gameLost.value || checkingWord.value) return

  if (currentCol.value !== selectedMode.value) {
    gameGrid.value?.showMessage(`Ordet måste vara ${selectedMode.value} bokstäver`, 'error')
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

  // Set checking state to prevent multiple submissions
  checkingWord.value = true

  try {
    // Make API call to check word with date and length
    const { data, error } = await supabase.functions.invoke(
      `ordel/check-word/${selectedDate.value}/${selectedMode.value}`,
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

    // Animate the row reveal with letter flipping
    await animateRowReveal(currentRow.value, data.result)

    // Update keyboard states after animation
    updateKeyStatesFromResult(data.result)

    // Check if won
    const won = data.result.every((r: LetterResult) => r.correct)

    if (won) {
      gameWon.value = true
      saveGuessesForDate(selectedDate.value, submittedRows.value, true, true)
      setTimeout(() => {
        gameGrid.value?.showMessage('Great Success!', 'success')
      }, 300)
    } else if (currentRow.value >= 5) {
      gameLost.value = true
      saveGuessesForDate(selectedDate.value, submittedRows.value, true, false)
      setTimeout(() => {
        gameGrid.value?.showMessage('Typiskt det var fel :(', 'error')
      }, 300)
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
  } finally {
    // Always reset checking state when the request completes
    checkingWord.value = false
  }
}

/** Handle physical keyboard input */
function handleKeydown(event: KeyboardEvent) {
  if (gameWon.value || gameLost.value || checkingWord.value) return

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
@use '@/styles/generalGames.scss';
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

.game-header {
  margin-bottom: 10px;
}

.mode-switcher {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 8px;
  background: var(--theme-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--theme-button-primary-border);

  .mode-btn {
    @extend .button-base;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
    }

    &.active {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border-color: var(--theme-button-primary-bg);
      font-weight: 600;
    }
  }
}

.open-request-word-btn {
  @extend .button-base;
  padding: 5px 10px;
  border-radius: 5px;
}

.debug-info {
  margin: 10px 0;
  padding: 8px 12px;
  background: var(--theme-bg-tertiary);
  border-radius: 4px;
  opacity: 0.7;

  small {
    color: var(--theme-text-secondary);
    font-size: 0.75rem;
  }
}

.request-word-container {
  margin: 15px 0;
  padding: 15px;
  border: 2px solid var(--theme-button-primary-border);
  border-radius: 8px;
  background: var(--theme-bg-secondary);
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  label {
    font-weight: bold;
    margin-bottom: 5px;
  }

  input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--theme-button-primary-border);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--theme-bg-primary);
    color: var(--theme-text-primary);

    &::placeholder {
      color: var(--theme-text-secondary);
    }
  }

  button {
    @extend .button-base;
    margin-top: 10px;
    box-shadow: 0 4px 15px rgba(27, 94, 32, 0.3);
  }

  p {
    font-size: 0.9rem;
    text-align: center;
    color: var(--theme-text-secondary);
  }
}

.checking-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 15px 0;
  color: var(--theme-text-secondary);
  font-size: 0.9rem;

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid var(--theme-bg-tertiary);
    border-top: 3px solid var(--theme-button-primary-bg);
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

      &.key-disabled {
        background: #6a6a6c;
        border-color: #6a6a6c;
        color: #999;
        cursor: not-allowed;
        opacity: 0.7;

        &:hover {
          background: #6a6a6c;
          transform: none;
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
  .mode-switcher {
    gap: 4px;
    padding: 6px;

    .mode-btn {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
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
