<template>
  <div class="word-search-container">
    <h1>Svensk Ordjakt</h1>

    <div v-if="!gameStarted" class="setup-panel">
      <p>Ordbok laddad: {{ totalWords }} svenska ord.</p>
      <label>
        Rutnätsstorlek (10-20):
        <input type="number" v-model.number="gridSize" min="10" max="20" />
      </label>
      <label>
        Antal ord (5-15):
        <input type="number" v-model.number="targetWordCount" min="5" max="15" />
      </label>
      <button @click="startNewGame" :disabled="loading">
        {{ loading ? 'Laddar...' : 'Starta spel' }}
      </button>
    </div>

    <div v-else class="game-area" @mouseup="endSelection" @mouseleave="endSelection">
      <div class="header">
        <button @click="gameStarted = false">Tillbaka</button>
        <button @click="revealWords">Visa lösning</button>
        <span class="score">Hittade: {{ foundCount }} / {{ targetWordCount }}</span>
      </div>

      <div class="main-layout">
        <div
          class="grid"
          :style="gridStyle"
          @mousedown="startSelection"
          @touchstart="startSelection"
          @touchmove="handleTouchMove"
          @touchend="endSelection"
        >
          <div
            v-for="(cell, index) in flattenedGrid"
            :key="index"
            class="cell"
            :class="{
              selected: isCellSelected(cell),
              found: cell.isFound,
            }"
            :style="cell.isFound && cell.foundColor ? { '--found-color': cell.foundColor } : {}"
            @mouseenter="updateSelection(cell)"
            :data-row="cell.row"
            :data-col="cell.col"
          >
            <span class="cell-char">{{ cell.char }}</span>
          </div>
        </div>

        <div class="word-list">
          <h3>Hitta dessa ord:</h3>
          <ul>
            <li v-for="w in placedWords" :key="w.word" :class="{ crossed: isWordFound(w.word) }">
              {{ w.word }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="foundCount === targetWordCount" class="win-overlay">
        <h2>Du vann! 🎉</h2>
        <button @click="startNewGame">Spela igen</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import {
  WordSearchGenerator,
  type Cell,
  type PlacedWord,
} from '@/composables/word-games/wordSearchGenerator'

// --- State ---
const allWords = ref<string[]>([])
const loading = ref(true)
const gameStarted = ref(false)

const gridSize = ref(12)
const targetWordCount = ref(8)

const grid = ref<Cell[][]>([])
const placedWords = ref<PlacedWord[]>([])
const foundWords = ref<Set<string>>(new Set())

// Selection State
const selecting = ref(false)
const startCell = ref<Cell | null>(null)
const currentCell = ref<Cell | null>(null)

// Initialize theme store
const themeStore = useThemeStore()
themeStore.init()

// --- Computeds ---
const totalWords = computed(() => allWords.value.length)
const foundCount = computed(() => foundWords.value.size)
const flattenedGrid = computed(() => grid.value.flat()) // Easier for v-for

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${gridSize.value}, 1fr)`, // Auto-sizing cells
  gap: '2px',
  maxWidth: '500px', // Keep grid contained
}))

// --- Lifecycle ---
onMounted(async () => {
  try {
    const res = await fetch('/ordel/allowed-words.json')
    const data = await res.json()
    const wordArray = data.words || data
    // Normalize to flat string array
    if (Array.isArray(wordArray)) {
      allWords.value = wordArray
        .map((w: string) => w.toUpperCase())
        .filter((w: string) => w.length >= 3 && w.length <= 10) // Filter suitable lengths
    }
  } catch (e) {
    console.error('Failed to load words', e)
  } finally {
    loading.value = false
  }
})

// --- Game Logic ---
const startNewGame = () => {
  if (allWords.value.length === 0) return

  // 1. Pick random words
  const pool = [...allWords.value].sort(() => 0.5 - Math.random())
  const selected = pool.slice(0, targetWordCount.value)

  // 2. Generate
  const generator = new WordSearchGenerator(gridSize.value)
  const result = generator.generate(selected)

  grid.value = result.grid
  placedWords.value = result.placed
  foundWords.value = new Set()
  startCell.value = null
  currentCell.value = null
  selecting.value = false

  gameStarted.value = true
}

// --- Selection Logic ---
// We only highlight cells that form a straight line from startCell to currentCell
const selectedPath = computed(() => {
  if (!startCell.value || !currentCell.value) return []

  const r1 = startCell.value.row
  const c1 = startCell.value.col
  const r2 = currentCell.value.row
  const c2 = currentCell.value.col

  const dr = r2 - r1
  const dc = c2 - c1

  // Valid Lines: Horizontal (dr=0), Vertical (dc=0), Diagonal (|dr| == |dc|)
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
    return [startCell.value] // Invalid path, just highlight start
  }

  // Calculate steps
  const steps = Math.max(Math.abs(dr), Math.abs(dc))
  const rStep = dr === 0 ? 0 : dr / steps
  const cStep = dc === 0 ? 0 : dc / steps

  const path: Cell[] = []
  for (let i = 0; i <= steps; i++) {
    const r = r1 + i * rStep
    const c = c1 + i * cStep
    // Check bounds
    if (r >= 0 && r < gridSize.value && c >= 0 && c < gridSize.value) {
      const row = grid.value[r]
      const cell = row?.[c]
      if (cell) path.push(cell)
    }
  }
  return path
})

const isCellSelected = (cell: Cell) => {
  if (!selecting.value) return false
  return selectedPath.value.includes(cell)
}

const startSelection = (e: MouseEvent | TouchEvent) => {
  // Prevent default to stop scrolling on mobile
  // e.preventDefault();
  selecting.value = true

  // Identify cell from event target
  const target = (e.target as HTMLElement).closest('.cell')
  if (target) {
    const rAttr = target.getAttribute('data-row')
    const cAttr = target.getAttribute('data-col')
    const r = rAttr ? Number.parseInt(rAttr, 10) : -1
    const c = cAttr ? Number.parseInt(cAttr, 10) : -1
    if (r >= 0 && c >= 0) {
      const row = grid.value[r]
      const cell = row?.[c]
      if (cell) {
        startCell.value = cell
        currentCell.value = cell
      }
    }
  }
}

const updateSelection = (cell: Cell) => {
  if (selecting.value) {
    currentCell.value = cell
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (!selecting.value) return
  e.preventDefault() // Stop scroll
  const touch = e.touches[0]
  if (!touch) return
  const target = document.elementFromPoint(touch.clientX, touch.clientY)
  if (target && (target as HTMLElement).classList.contains('cell')) {
    const el = target as HTMLElement
    const rAttr = el.getAttribute('data-row')
    const cAttr = el.getAttribute('data-col')
    const r = rAttr ? Number.parseInt(rAttr, 10) : -1
    const c = cAttr ? Number.parseInt(cAttr, 10) : -1
    if (r >= 0 && c >= 0) {
      const row = grid.value[r]
      const cell = row?.[c]
      if (cell) currentCell.value = cell
    }
  }
}

const endSelection = () => {
  if (!selecting.value) return
  selecting.value = false

  // Construct the word from the selected path
  const word = selectedPath.value.map((c) => c.char).join('')
  const reverseWord = word.split('').reverse().join('') // Check both directions

  const match = placedWords.value.find((p) => p.word === word || p.word === reverseWord)

  if (match && !foundWords.value.has(match.word)) {
    // Correct!
    foundWords.value.add(match.word)

    // Mark cells as permanently found
    // We need to find the specific cells for THIS word occurrence
    // (In case the same word appears twice by chance, usually rare)
    const color = match.color || '#10b981'
    selectedPath.value.forEach((cell) => {
      cell.isFound = true
      cell.foundColor = color
    })
  }

  startCell.value = null
  currentCell.value = null
}

const isWordFound = (word: string) => foundWords.value.has(word)

const getWordPath = (word: PlacedWord): Cell[] => {
  const path: Cell[] = []
  const dr = Math.sign(word.end.r - word.start.r)
  const dc = Math.sign(word.end.c - word.start.c)
  const length = Math.max(Math.abs(word.end.r - word.start.r), Math.abs(word.end.c - word.start.c))

  for (let i = 0; i <= length; i++) {
    const r = word.start.r + i * dr
    const c = word.start.c + i * dc
    const row = grid.value[r]
    const cell = row?.[c]
    if (cell) path.push(cell)
  }

  return path
}

const revealWords = () => {
  placedWords.value.forEach((word) => {
    const path = getWordPath(word)
    const color = word.color || '#10b981'
    path.forEach((cell) => {
      cell.isFound = true
      cell.foundColor = color
    })
    foundWords.value.add(word.word)
  })
}
</script>

<style scoped lang="scss">
.word-search-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  user-select: none;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: calc(100vh - 3rem);
  transition:
    background-color 0.3s ease,
    color 0.3s ease;

  h1 {
    color: var(--theme-text-accent);
    margin-bottom: 20px;
    font-size: 2rem;
  }

  .setup-panel {
    background: var(--theme-bg-secondary);
    padding: 30px;
    border-radius: 12px;
    box-shadow: var(--theme-shadow-md);
    border: 1px solid var(--theme-border-light);

    p {
      margin-bottom: 20px;
      font-size: 1.1rem;
    }

    label {
      display: block;
      margin-bottom: 16px;
      font-weight: 600;

      input {
        margin-left: 10px;
        padding: 8px;
        border: 1px solid var(--theme-border-medium);
        border-radius: 6px;
        background: var(--theme-input-bg);
        color: var(--theme-input-text);
        width: 90px;
      }
    }

    button {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border: 2px solid var(--theme-button-primary-border);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: var(--theme-shadow-sm);

      &:hover:not(:disabled) {
        background: var(--theme-button-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--theme-shadow-md);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
}

.game-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  gap: 16px;

  .header {
    display: flex;
    align-items: center;
    gap: 16px;

    button {
      background: var(--theme-button-secondary-bg);
      color: var(--theme-button-secondary-text);
      border: 1px solid var(--theme-border-medium);
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;

      &:hover {
        background: var(--theme-button-secondary-hover);
        transform: translateY(-1px);
      }
    }

    .score {
      font-weight: 600;
      color: var(--theme-text-accent);
    }
  }
}

.main-layout {
  display: flex;
  gap: 2rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  justify-content: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
}

.grid {
  background: var(--theme-canvas-border);
  padding: 6px;
  border-radius: 10px;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 1;
  box-shadow: var(--theme-shadow-lg);
  touch-action: none;
}

.cell {
  background: var(--theme-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
  cursor: pointer;
  border-radius: 4px;
  color: var(--theme-text-primary);
  transition: all 0.12s ease;
  border: 1px solid var(--theme-border-light);
  position: relative;
  overflow: hidden;

  &.selected {
    background: var(--theme-warning);
    color: var(--theme-text-on-dark);
  }

  &.found::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 3px;
    background: var(--found-color, var(--theme-success));
    opacity: 0.85;
    z-index: 0;
  }

  .cell-char {
    position: relative;
    z-index: 1;
  }
}

.word-list {
  text-align: left;
  min-width: 200px;
  background: var(--theme-bg-secondary);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--theme-border-light);
  box-shadow: var(--theme-shadow-sm);

  h3 {
    margin-bottom: 12px;
    color: var(--theme-text-accent);
  }

  ul {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  li {
    padding: 6px 8px;
    background: var(--theme-bg-tertiary);
    border-radius: 6px;
    border: 1px solid var(--theme-border-light);
  }

  li.crossed {
    text-decoration: line-through;
    opacity: 0.6;
    background: var(--theme-bg-elevated);
  }
}

.win-overlay {
  position: absolute;
  inset: 0;
  background: var(--theme-bg-overlay);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  gap: 12px;

  h2 {
    color: var(--theme-text-on-dark);
  }

  button {
    background: var(--theme-button-primary-bg);
    color: var(--theme-button-primary-text);
    border: 2px solid var(--theme-button-primary-border);
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
  }
}
</style>
