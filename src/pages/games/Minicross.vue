<template>
  <div class="crossword-container">
    <h1>Mini Crossword</h1>

    <div v-if="!gameStarted" class="setup-panel">
      <p>Loaded {{ totalWords }} possible words.</p>

      <label>
        Number of words to place:
        <input type="number" v-model.number="targetWordCount" min="4" max="20" />
      </label>

      <label>
        Difficulty (shown letters at start):
        <input type="range" v-model.number="startRevealPercent" min="0" max="45" step="1" />
        <span class="difficulty-value">{{ startRevealPercent }}%</span>
      </label>

      <p class="hint-note">Higher % = easier game (more letters shown initially).</p>

      <button @click="startGame" :disabled="loading">
        {{ loading ? 'Loading Dictionary...' : 'Generate Puzzle' }}
      </button>

      <p v-if="generationMessage" class="generation-message">{{ generationMessage }}</p>
    </div>

    <div v-else class="game-board">
      <div class="controls">
        <button @click="resetGame">New Game</button>
        <button @click="checkAnswers">Check Answers</button>
        <button @click="revealAnswers">Reveal Answers</button>
      </div>

      <div class="status-row" v-if="layout">
        <span>Placed words: {{ layout.placedWordCount }}</span>
        <span>Intersections: {{ layout.totalIntersections }}</span>
        <span>Given letters: {{ givenLettersCount }}</span>
        <span>Filled: {{ filledCells }} / {{ totalPlayableCells }}</span>
      </div>

      <p v-if="generationMessage" class="generation-message in-game">{{ generationMessage }}</p>

      <div class="layout">
        <div class="grid" :style="gridStyle">
          <template v-if="layout" v-for="(row, rIndex) in layout.grid" :key="rIndex">
            <div
              v-for="(cell, cIndex) in row"
              :key="`${rIndex}-${cIndex}`"
              class="cell"
              :class="{
                black: cell.isBlack,
                active: cell === activeCell,
                given: !cell.isBlack && cell.isGiven,
                correct: isChecked && !cell.isBlack && cell.input.toUpperCase() === cell.char,
                wrong:
                  isChecked &&
                  !cell.isBlack &&
                  cell.input &&
                  cell.input.toUpperCase() !== cell.char,
              }"
              :data-row="cell.row"
              :data-col="cell.col"
              @click="selectCell(cell)"
            >
              <span v-if="cell.acrossNum || cell.downNum" class="cell-num">
                {{ cell.acrossNum || cell.downNum }}
              </span>

              <input
                v-if="!cell.isBlack"
                type="text"
                maxlength="1"
                v-model="cell.input"
                :readonly="!!cell.isGiven"
                @focus="activeCell = cell"
                @keydown="handleKey($event, cell)"
              />
            </div>
          </template>
        </div>

        <div class="clues" v-if="layout">
          <div class="clue-column">
            <h3>Across</h3>
            <ul>
              <li
                v-for="clue in acrossClues"
                :key="`a-${clue.number}`"
                :class="{ highlight: isClueHighlighted(clue.wordRef) }"
                @click="jumpToWord(clue.wordRef)"
              >
                <strong>{{ clue.number }}.</strong>
                <div class="feature" v-for="feature in clue.features" :key="feature">
                  {{ feature }}
                </div>
              </li>
            </ul>
          </div>

          <div class="clue-column">
            <h3>Down</h3>
            <ul>
              <li
                v-for="clue in downClues"
                :key="`d-${clue.number}`"
                :class="{ highlight: isClueHighlighted(clue.wordRef) }"
                @click="jumpToWord(clue.wordRef)"
              >
                <strong>{{ clue.number }}.</strong>
                <div class="feature" v-for="feature in clue.features" :key="feature">
                  {{ feature }}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type {
  CrosswordLayout,
  GridCell,
  PlacedWord,
  WordData,
} from '@/composables/word-games/minicrossTypes'
import { CrosswordGenerator } from '@/composables/word-games/CrosswordGenerator'
import { useThemeStore } from '@/stores/theme'

interface SyntheticClue {
  number: number
  features: string[]
  wordRef: PlacedWord
}

const SWEDISH_VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y', 'Å', 'Ä', 'Ö'])

const allWords = ref<WordData[]>([])
const totalWords = computed(() => allWords.value.length)
const loading = ref(true)
const gameStarted = ref(false)

const targetWordCount = ref(10)
const startRevealPercent = ref(18)
const generationMessage = ref('')

const layout = ref<CrosswordLayout | null>(null)
const activeCell = ref<GridCell | null>(null)
const currentDirection = ref<'across' | 'down'>('across')
const isChecked = ref(false)

const themeStore = useThemeStore()
themeStore.init()

onMounted(async () => {
  try {
    const res = await fetch('/ordel/allowed-words.json')
    const data = await res.json()
    const wordArray = data.words || data

    if (Array.isArray(wordArray)) {
      allWords.value = wordArray
        .filter((w: string) => w.length >= 3 && w.length <= 12)
        .map((w: string) => ({
          word: w.toUpperCase(),
          clue: 'Generated clue',
        }))
    }
  } catch (e) {
    console.error('Failed to load words', e)
  } finally {
    loading.value = false
  }
})

const gridStyle = computed(() => {
  if (!layout.value) return {}
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.value.cols}, 40px)`,
    gap: '2px',
  }
})

const totalPlayableCells = computed(() => {
  if (!layout.value) return 0
  let count = 0
  for (const row of layout.value.grid) {
    for (const cell of row) {
      if (!cell.isBlack) count++
    }
  }
  return count
})

const filledCells = computed(() => {
  if (!layout.value) return 0
  let count = 0
  for (const row of layout.value.grid) {
    for (const cell of row) {
      if (!cell.isBlack && cell.input) count++
    }
  }
  return count
})

const givenLettersCount = computed(() => {
  if (!layout.value) return 0
  let count = 0
  for (const row of layout.value.grid) {
    for (const cell of row) {
      if (!cell.isBlack && cell.isGiven) count++
    }
  }
  return count
})

const activeWord = computed<PlacedWord | null>(() => {
  if (!layout.value || !activeCell.value || activeCell.value.isBlack) return null
  const clues =
    currentDirection.value === 'across' ? layout.value.acrossClues : layout.value.downClues
  return clues.find((word) => cellBelongsToWord(activeCell.value as GridCell, word)) || null
})

const acrossClues = computed<SyntheticClue[]>(() => {
  if (!layout.value) return []
  return layout.value.acrossClues
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((word) => ({
      number: word.number,
      features: buildSyntheticClueFeatures(word.word),
      wordRef: word,
    }))
})

const downClues = computed<SyntheticClue[]>(() => {
  if (!layout.value) return []
  return layout.value.downClues
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((word) => ({
      number: word.number,
      features: buildSyntheticClueFeatures(word.word),
      wordRef: word,
    }))
})

const isVowel = (char: string) => SWEDISH_VOWELS.has(char.toUpperCase())

const hasRepeatedLetter = (word: string) => {
  const seen = new Set<string>()
  for (const ch of word) {
    if (seen.has(ch)) return true
    seen.add(ch)
  }
  return false
}

const hasSwedishSpecialVowel = (word: string) => /[ÅÄÖ]/.test(word)

const getVowelConsonantPattern = (word: string) =>
  word
    .split('')
    .map((ch) => (isVowel(ch) ? 'V' : 'K'))
    .join('')

const buildSyntheticClueFeatures = (word: string): string[] => {
  const vowels = word.split('').filter((ch) => isVowel(ch)).length
  const startsWith = isVowel(word[0] || '') ? 'vowel' : 'consonant'
  const endsWith = isVowel(word[word.length - 1] || '') ? 'vowel' : 'consonant'
  const hasSpecial = hasSwedishSpecialVowel(word)
  const repeated = hasRepeatedLetter(word)
  const pattern = getVowelConsonantPattern(word)

  return [
    `Length: ${word.length}`,
    `Vowels: ${vowels}`,
    `Starts with ${startsWith}, ends with ${endsWith}`,
    hasSpecial ? 'Contains Å/Ä/Ö: Yes' : 'Contains Å/Ä/Ö: No',
    repeated ? 'Has repeated letter: Yes' : 'Has repeated letter: No',
    `Pattern (V/K): ${pattern}`,
  ]
}

const cellBelongsToWord = (cell: GridCell, word: PlacedWord): boolean => {
  const len = word.word.length
  if (word.direction === 'across') {
    return cell.row === word.row && cell.col >= word.col && cell.col < word.col + len
  }
  return cell.col === word.col && cell.row >= word.row && cell.row < word.row + len
}

const isClueHighlighted = (word: PlacedWord) => {
  const current = activeWord.value
  if (!current) return false
  return (
    current.number === word.number &&
    current.direction === word.direction &&
    current.row === word.row &&
    current.col === word.col
  )
}

const focusCellInput = (cell: GridCell) => {
  nextTick(() => {
    const cellInput = document.querySelector(
      `.cell[data-row="${cell.row}"][data-col="${cell.col}"] input`,
    ) as HTMLInputElement | null
    if (cellInput) cellInput.focus()
  })
}

const clearBoardInputs = () => {
  if (!layout.value) return
  for (const row of layout.value.grid) {
    for (const cell of row) {
      if (!cell.isBlack) {
        cell.input = ''
        cell.isGiven = false
      }
    }
  }
}

const pickRandomUniqueIndices = (maxExclusive: number, amount: number): number[] => {
  const pool = Array.from({ length: maxExclusive }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = pool[i]
    pool[i] = pool[j] as number
    pool[j] = temp as number
  }
  return pool.slice(0, Math.min(amount, maxExclusive))
}

const applyStartingHints = () => {
  if (!layout.value) return
  clearBoardInputs()

  const words = [...layout.value.acrossClues, ...layout.value.downClues]
  const revealRatio = Math.max(0, Math.min(100, startRevealPercent.value)) / 100
  if (revealRatio <= 0) return

  for (const word of words) {
    const desired = Math.max(1, Math.round(word.word.length * revealRatio))
    const indices = pickRandomUniqueIndices(word.word.length, desired)

    for (const i of indices) {
      const r = word.direction === 'across' ? word.row : word.row + i
      const c = word.direction === 'across' ? word.col + i : word.col
      const targetRow = layout.value.grid[r]
      if (!targetRow) continue
      const targetCell = targetRow[c]
      if (!targetCell || targetCell.isBlack) continue
      targetCell.input = targetCell.char
      targetCell.isGiven = true
    }
  }
}

const startGame = () => {
  if (allWords.value.length === 0) return

  generationMessage.value = ''
  const generator = new CrosswordGenerator()
  let bestLayout: CrosswordLayout | null = null

  for (let i = 0; i < 5; i++) {
    const shuffled = [...allWords.value].sort(() => 0.5 - Math.random())
    const sampleSize = Math.min(shuffled.length, Math.max(targetWordCount.value * 8, 70))
    const selected = shuffled.slice(0, sampleSize)

    const candidate = generator.generate(selected, {
      targetWordCount: targetWordCount.value,
      attempts: 45,
    })

    if (!bestLayout) {
      bestLayout = candidate
      continue
    }

    const candidateScore = candidate.placedWordCount * 100 + candidate.totalIntersections * 120
    const bestScore = bestLayout.placedWordCount * 100 + bestLayout.totalIntersections * 120
    if (candidateScore > bestScore) bestLayout = candidate
  }

  layout.value = bestLayout
  gameStarted.value = true
  isChecked.value = false
  activeCell.value = null
  currentDirection.value = 'across'

  applyStartingHints()

  if (!layout.value || layout.value.placedWordCount < targetWordCount.value) {
    generationMessage.value =
      'Could not place all requested words with strong crossing. Generated the best dense board found.'
  }
}

const resetGame = () => {
  gameStarted.value = false
  layout.value = null
  activeCell.value = null
  isChecked.value = false
}

const selectCell = (cell: GridCell) => {
  if (cell.isBlack) return
  if (activeCell.value === cell) {
    currentDirection.value = currentDirection.value === 'across' ? 'down' : 'across'
  }
  activeCell.value = cell
  focusCellInput(cell)
}

const jumpToWord = (word: PlacedWord) => {
  if (!layout.value) return
  const row = layout.value.grid[word.row]
  if (!row) return
  const cell = row[word.col]
  if (!cell || cell.isBlack) return

  currentDirection.value = word.direction
  activeCell.value = cell
  focusCellInput(cell)
}

const moveFocus = (current: GridCell, key: string): GridCell | null => {
  if (!layout.value) return null

  let dr = 0
  let dc = 0
  if (key === 'ArrowUp') dr = -1
  if (key === 'ArrowDown') dr = 1
  if (key === 'ArrowLeft') dc = -1
  if (key === 'ArrowRight') dc = 1
  if (dr === 0 && dc === 0) return null

  let r = current.row + dr
  let c = current.col + dc

  while (r >= 0 && r < layout.value.rows && c >= 0 && c < layout.value.cols) {
    const row = layout.value.grid[r]
    const cell = row?.[c]
    if (cell && !cell.isBlack) {
      activeCell.value = cell
      return cell
    }
    r += dr
    c += dc
  }

  return null
}

const handleKey = (e: KeyboardEvent, cell: GridCell) => {
  if (!layout.value || cell.isBlack) return

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
    const next = moveFocus(cell, e.key)
    if (next) focusCellInput(next)
    return
  }

  if (cell.isGiven && ['Backspace', 'Delete'].includes(e.key)) {
    e.preventDefault()
    return
  }

  if (e.key === 'Backspace') {
    e.preventDefault()
    if (cell.isGiven) return

    if (cell.input === '') {
      const next = moveFocus(cell, currentDirection.value === 'across' ? 'ArrowLeft' : 'ArrowUp')
      if (next) {
        if (!next.isGiven) next.input = ''
        focusCellInput(next)
      }
    } else {
      cell.input = ''
    }
    return
  }

  if (e.key.length === 1 && /[a-zåäö]/i.test(e.key)) {
    e.preventDefault()
    if (cell.isGiven) return

    cell.input = e.key.toUpperCase()
    const next = moveFocus(cell, currentDirection.value === 'across' ? 'ArrowRight' : 'ArrowDown')
    if (next) focusCellInput(next)
  }
}

const checkAnswers = () => {
  isChecked.value = true
}

const revealAnswers = () => {
  if (!layout.value) return
  for (const row of layout.value.grid) {
    for (const cell of row) {
      if (!cell.isBlack) cell.input = cell.char
    }
  }
  isChecked.value = true
}
</script>

<style scoped lang="scss">
.crossword-container {
  font-family: var(--theme-font-family, sans-serif);
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: calc(100vh - 3rem);
  transition:
    background-color 0.3s ease,
    color 0.3s ease;

  h1 {
    text-align: center;
    color: var(--theme-text-accent);
    margin-bottom: 20px;
    font-size: 2rem;
  }

  .setup-panel {
    background: var(--theme-bg-secondary);
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    box-shadow: var(--theme-shadow-md);
    border: 1px solid var(--theme-border-light);

    p {
      margin-bottom: 18px;
      font-size: 1.05rem;
    }

    label {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
      font-weight: 600;

      input[type='number'] {
        padding: 8px;
        border: 1px solid var(--theme-border-medium);
        border-radius: 6px;
        background: var(--theme-input-bg);
        color: var(--theme-input-text);
        width: 90px;
      }

      input[type='range'] {
        width: 220px;
      }

      .difficulty-value {
        min-width: 50px;
        text-align: left;
        color: var(--theme-text-accent);
      }
    }

    .hint-note {
      color: var(--theme-text-secondary);
      font-size: 0.95rem;
      margin-top: 4px;
    }

    .generation-message {
      margin-top: 14px;
      color: var(--theme-text-secondary);
      font-size: 0.95rem;
    }

    button {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border: 2px solid var(--theme-button-primary-border);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1.05rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: var(--theme-shadow-sm);

      &:hover:not(:disabled) {
        background: var(--theme-button-primary-hover);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }

  .game-board {
    .in-game {
      margin-top: 0;
      margin-bottom: 14px;
      text-align: center;
      color: var(--theme-text-secondary);
      font-size: 0.95rem;
    }

    .controls {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 14px;
      flex-wrap: wrap;

      button {
        background: var(--theme-button-secondary-bg);
        color: var(--theme-button-secondary-text);
        border: 1px solid var(--theme-border-medium);
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
          background: var(--theme-button-secondary-hover);
          transform: translateY(-1px);
        }
      }
    }

    .status-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
      color: var(--theme-text-secondary);
      font-size: 0.92rem;

      span {
        background: var(--theme-bg-secondary);
        border: 1px solid var(--theme-border-light);
        border-radius: 20px;
        padding: 5px 10px;
      }
    }

    .layout {
      display: flex;
      gap: 30px;
      align-items: flex-start;
      justify-content: center;
      flex-wrap: wrap;

      @media (max-width: 900px) {
        flex-direction: column;
        align-items: center;
      }
    }
  }

  .grid {
    background: var(--theme-crossword-black-cell);
    padding: 3px;
    border: 3px solid var(--theme-crossword-cell-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-lg);
    user-select: none;

    .cell {
      width: 40px;
      height: 40px;
      background: var(--theme-crossword-cell-bg);
      position: relative;
      border: 1px solid var(--theme-crossword-cell-border);
      transition: all 0.15s ease;

      &.black {
        background: var(--theme-crossword-black-cell);
        border: 1px solid var(--theme-crossword-black-cell);
      }

      &.active {
        background: var(--theme-crossword-active-cell);
        border: 2px solid var(--theme-canvas-glow);
        box-shadow: 0 0 10px var(--theme-canvas-glow);
        z-index: 10;
      }

      &.given input {
        color: var(--theme-text-accent);
        font-weight: 700;
      }

      &.correct input {
        color: var(--theme-crossword-correct);
        font-weight: bold;
      }

      &.wrong input {
        color: var(--theme-crossword-wrong);
        font-weight: bold;
        background: rgba(244, 67, 54, 0.1);
      }

      &:not(.black):hover {
        background: var(--theme-bg-elevated);
        cursor: pointer;
      }

      input {
        width: 100%;
        height: 100%;
        border: none;
        text-align: center;
        font-size: 1.3rem;
        font-weight: 600;
        text-transform: uppercase;
        outline: none;
        background: transparent;
        color: var(--theme-text-primary);
      }

      .cell-num {
        position: absolute;
        top: 2px;
        left: 3px;
        font-size: 10px;
        font-weight: bold;
        color: var(--theme-text-secondary);
        pointer-events: none;
        z-index: 5;
      }
    }
  }

  .clues {
    width: min(560px, 100%);
    max-height: 640px;
    overflow-y: auto;
    background: var(--theme-bg-secondary);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--theme-border-light);
    box-shadow: var(--theme-shadow-md);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;

    @media (max-width: 780px) {
      grid-template-columns: 1fr;
    }

    .clue-column {
      h3 {
        color: var(--theme-text-accent);
        margin-bottom: 12px;
        font-size: 1.2rem;
        border-bottom: 2px solid var(--theme-border-medium);
        padding-bottom: 6px;
      }

      ul {
        list-style: none;
        padding: 0;

        li {
          padding: 10px;
          margin-bottom: 8px;
          border-radius: 8px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: 1px solid transparent;

          &:hover {
            background: var(--theme-bg-elevated);
            border-color: var(--theme-border-medium);
          }

          &.highlight {
            background: var(--theme-crossword-clue-highlight);
            border-color: var(--theme-canvas-glow);
          }

          strong {
            color: var(--theme-text-accent);
            display: inline-block;
            margin-bottom: 6px;
          }

          .feature {
            color: var(--theme-text-secondary);
            font-size: 0.9rem;
            line-height: 1.35;
          }
        }
      }
    }
  }
}
</style>
