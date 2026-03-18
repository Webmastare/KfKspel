<template>
  <div class="anagram-crossword-shell">
    <div class="anagram-crossword-page">
      <div class="game-header">
        <h1>Anagramkorsord</h1>
      </div>

      <div v-if="!loading" class="setup-panel">
        <div class="difficulty-row">
          <span>Svårighetsgrad:</span>
          <div class="difficulty-buttons">
            <button
              v-for="d in difficulties"
              :key="d.id"
              :class="['difficulty-btn', { active: selectedDifficulty === d.id }]"
              :disabled="isGeneratingPuzzle"
              @click="changeDifficulty(d.id)"
            >
              {{ d.label }}
            </button>
          </div>
        </div>

        <div class="meta-row" v-if="puzzle">
          <span>Bokstäver: {{ puzzle.letters.length }}</span>
          <span>Målord: {{ puzzle.targetWords.length }}</span>
          <span>Korsningar: {{ puzzle.puzzle.intersections }}</span>
        </div>

        <div class="actions-row">
          <button class="action-btn" @click="generatePuzzle" :disabled="isGeneratingPuzzle">
            Nytt pussel
          </button>
          <button
            class="action-btn secondary"
            @click="revealAll"
            :disabled="!puzzle || isGeneratingPuzzle"
          >
            Visa lösning
          </button>
        </div>

        <div v-if="isGeneratingPuzzle" class="checking-spinner generation-spinner">
          <div class="spinner"></div>
          <span class="checking-text">Genererar pussel...</span>
        </div>
      </div>

      <p v-if="loading" class="status-text">Laddar ordlista...</p>
      <p v-else-if="errorMessage" class="status-text error">{{ errorMessage }}</p>

      <div v-if="puzzle" class="game-layout">
        <section class="anagram-panel">
          <h2>Bygg ord av bokstäverna</h2>

          <div class="word-preview">{{ wordPreviewText }}</div>

          <div class="letter-wheel" @pointermove="handleWheelPointerMove">
            <svg class="selection-svg" viewBox="0 0 280 280" preserveAspectRatio="none">
              <polyline
                v-if="selectionPoints.length > 0"
                :points="selectionPolyline"
                fill="none"
                stroke="var(--theme-text-accent)"
                stroke-width="9"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.75"
              />
            </svg>

            <button
              v-for="(letter, index) in letters"
              :key="`${letter}-${index}`"
              class="letter-node"
              :class="{ selected: isIndexSelected(index) }"
              :data-index="index"
              :style="{
                left: `${letterPositions[index]?.x ?? 0}px`,
                top: `${letterPositions[index]?.y ?? 0}px`,
              }"
              @pointerdown.prevent="startSelection(index)"
              @pointerenter.prevent="extendSelection(index)"
            >
              {{ letter }}
            </button>
          </div>

          <div class="feedback-row">
            <p>Hittade ord: {{ foundCount }} / {{ targetCount }}</p>
          </div>
        </section>

        <section class="crossword-panel">
          <h2>Korsord</h2>

          <div class="progress-row">
            <span>Fyllda rutor: {{ filledCells }} / {{ playableCells }}</span>
            <span>Ord hittade: {{ foundCount }} / {{ targetCount }}</span>
          </div>

          <div class="crossword-grid" :style="crosswordGridStyle">
            <template v-for="(row, rIndex) in crosswordGrid" :key="`r-${rIndex}`">
              <div
                v-for="(cell, cIndex) in row"
                :key="`c-${rIndex}-${cIndex}`"
                class="crossword-cell"
                :class="{ blocked: cell.blocked, filled: !!cell.value }"
              >
                <span v-if="cell.number" class="cell-number">{{ cell.number }}</span>
                <span v-if="!cell.blocked" class="cell-value">{{ cell.value }}</span>
              </div>
            </template>
          </div>
        </section>
      </div>

      <div v-if="isCompleted" class="win-banner">Klart! Bra jobbat 🎉</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import {
  DIFFICULTIES,
  countFilledCells,
  countPlayableCells,
  createAnagramCrosswordPuzzle,
  findDifficultyById,
  normalizeWord,
  revealAllWordsInGrid,
  revealWordInGrid,
  type CrosswordCell,
  type DifficultyId,
  type PuzzleBundle,
} from '@/composables/word-games/anagramCrossword'

const themeStore = useThemeStore()
themeStore.init()

const difficulties = DIFFICULTIES
const selectedDifficulty = ref<DifficultyId>('easy')

const loading = ref(true)
const errorMessage = ref('')
const gameMessage = ref('')
const isGeneratingPuzzle = ref(false)

const dictionary = ref<string[]>([])
const puzzle = ref<PuzzleBundle | null>(null)
const crosswordGrid = ref<CrosswordCell[][]>([])
const foundWords = ref<Set<string>>(new Set())

const selectionIndices = ref<number[]>([])
const selecting = ref(false)

const cloneGrid = (grid: CrosswordCell[][]): CrosswordCell[][] =>
  grid.map((row) => row.map((cell) => ({ ...cell, belongsTo: [...cell.belongsTo] })))

const letters = computed(() => puzzle.value?.letters || [])
const allowedWordsSet = computed(() => new Set(dictionary.value.map((w) => normalizeWord(w))))

const buildableDictionaryWordsSet = computed(() => {
  if (!puzzle.value) return new Set<string>()

  const bag = new Map<string, number>()
  for (const ch of puzzle.value.letters) {
    bag.set(ch, (bag.get(ch) || 0) + 1)
  }

  const canBuild = (word: string) => {
    if (
      word.length < puzzle.value!.difficulty.minWordLength ||
      word.length > puzzle.value!.difficulty.maxWordLength
    ) {
      return false
    }

    const need = new Map<string, number>()
    for (const ch of word) {
      need.set(ch, (need.get(ch) || 0) + 1)
    }

    for (const [ch, count] of need.entries()) {
      if ((bag.get(ch) || 0) < count) return false
    }

    return true
  }

  const out = new Set<string>()
  for (const word of allowedWordsSet.value) {
    if (word && canBuild(word)) {
      out.add(word)
    }
  }
  return out
})

const letterPositions = computed(() => {
  const radius = 106
  const center = 140
  const count = letters.value.length
  if (count === 0) return []

  return letters.value.map((_letter: string, index: number) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    }
  })
})

const selectionPoints = computed(() =>
  selectionIndices.value
    .map((i) => letterPositions.value[i])
    .filter((p): p is { x: number; y: number } => Boolean(p)),
)

const selectionPolyline = computed(() =>
  selectionPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
)

const selectedWord = computed(() =>
  selectionIndices.value.map((i) => letters.value[i] || '').join(''),
)

const wordPreviewText = computed(() => {
  if (selectedWord.value) return selectedWord.value
  return gameMessage.value || 'Dra mellan bokstäverna'
})

const foundCount = computed(() => foundWords.value.size)
const targetCount = computed(() => puzzle.value?.targetWords.length || 0)

const isCompleted = computed(() => targetCount.value > 0 && foundCount.value === targetCount.value)

const playableCells = computed(() => countPlayableCells(crosswordGrid.value))
const filledCells = computed(() => countFilledCells(crosswordGrid.value))

const crosswordGridStyle = computed(() => {
  if (!puzzle.value) return {}
  const size = puzzle.value.puzzle.cols > 8 ? 34 : 40
  return {
    gridTemplateColumns: `repeat(${puzzle.value.puzzle.cols}, ${size}px)`,
  }
})

const isIndexSelected = (index: number) => selectionIndices.value.includes(index)

const clearSelection = () => {
  selectionIndices.value = []
  selecting.value = false
}

const markWordFound = (word: string) => {
  if (!puzzle.value) return

  const next = new Set(foundWords.value)
  if (next.has(word)) return
  next.add(word)
  foundWords.value = next

  const entries = puzzle.value.puzzle.placedWords.filter((entry: any) => entry.word === word)
  let nextGrid = crosswordGrid.value
  for (const entry of entries) {
    nextGrid = revealWordInGrid(nextGrid, entry)
  }
  crosswordGrid.value = nextGrid

  gameMessage.value = `Rätt ord: ${word}`
}

const validateSelection = () => {
  if (!puzzle.value) return

  const direct = normalizeWord(selectedWord.value)
  if (!direct) return

  if (!allowedWordsSet.value.has(direct)) {
    gameMessage.value = `${direct} finns inte i ordlistan`
    return
  }

  if (!buildableDictionaryWordsSet.value.has(direct)) {
    gameMessage.value = `${direct} kan inte bildas av dessa bokstäver`
    return
  }

  if (!puzzle.value.targetWords.includes(direct)) {
    gameMessage.value = `${direct} finns men är inte med i detta pussel`
    return
  }

  if (foundWords.value.has(direct)) {
    gameMessage.value = `${direct} är redan hittat`
    return
  }

  markWordFound(direct)
}

const endSelection = () => {
  if (!selecting.value) return
  validateSelection()
  clearSelection()
}

const startSelection = (index: number) => {
  if (!puzzle.value) return
  selecting.value = true
  selectionIndices.value = [index]
  gameMessage.value = ''
}

const extendSelection = (index: number) => {
  if (!selecting.value) return

  const current = selectionIndices.value
  const alreadyIndex = current.indexOf(index)

  if (alreadyIndex === -1) {
    selectionIndices.value = [...current, index]
    return
  }

  if (current.length >= 2 && current[current.length - 2] === index) {
    selectionIndices.value = current.slice(0, -1)
  }
}

const handleWheelPointerMove = (event: PointerEvent) => {
  if (!selecting.value) return
  const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  const node = target?.closest('.letter-node') as HTMLElement | null
  const indexAttr = node?.dataset.index
  const index = indexAttr ? Number.parseInt(indexAttr, 10) : -1
  if (index >= 0) {
    extendSelection(index)
  }
}

const revealAll = () => {
  if (!puzzle.value) return
  crosswordGrid.value = revealAllWordsInGrid(crosswordGrid.value)
  foundWords.value = new Set(puzzle.value.targetWords)
  gameMessage.value = 'Lösningen visas'
}

const generatePuzzle = async () => {
  if (dictionary.value.length === 0 || isGeneratingPuzzle.value) return

  errorMessage.value = ''
  gameMessage.value = 'Genererar pussel...'
  isGeneratingPuzzle.value = true

  await nextTick()

  await new Promise((resolve) => window.setTimeout(resolve, 30))

  const generated = createAnagramCrosswordPuzzle(
    dictionary.value,
    findDifficultyById(selectedDifficulty.value),
  )

  if (!generated) {
    errorMessage.value = 'Kunde inte skapa pussel. Testa en annan svårighetsgrad.'
    gameMessage.value = ''
    isGeneratingPuzzle.value = false
    return
  }

  puzzle.value = generated
  crosswordGrid.value = cloneGrid(generated.puzzle.grid)
  foundWords.value = new Set()
  clearSelection()

  isGeneratingPuzzle.value = false
  gameMessage.value = 'Dra mellan bokstäverna för att skapa ord'
}

const changeDifficulty = async (difficulty: DifficultyId) => {
  selectedDifficulty.value = difficulty
  if (!loading.value) {
    await generatePuzzle()
  }
}

const onWindowPointerUp = () => {
  endSelection()
}

onMounted(async () => {
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)

  try {
    const res = await fetch('/ordel/allowed-words.json')
    const data = await res.json()
    const words = data.words || data

    if (!Array.isArray(words)) {
      throw new Error('Ordlistan har fel format')
    }

    dictionary.value = words
    await generatePuzzle()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Kunde inte läsa ordlistan.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
})
</script>

<style scoped lang="scss">
.anagram-crossword-shell {
  min-height: calc(100vh - 3rem);
  width: 100%;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  padding: 1rem 0 2.5rem;
}

.anagram-crossword-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1rem;
  color: var(--theme-text-primary);
}

.game-header {
  text-align: center;
  margin-bottom: 16px;

  h1 {
    margin: 0;
    font-size: 2.45rem;
    font-weight: 700;
    color: var(--theme-text-accent);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  }
}

.setup-panel {
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  box-shadow: var(--theme-shadow-sm);
  margin-bottom: 1rem;
}

.difficulty-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
}

.difficulty-buttons {
  display: flex;
  gap: 0.55rem;
}

.difficulty-btn {
  border: 1px solid var(--theme-border-medium);
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  border-radius: 8px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  font-weight: 600;

  &.active {
    background: var(--theme-button-primary-bg);
    border-color: var(--theme-button-primary-border);
    color: var(--theme-button-primary-text);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 0.7rem;
  font-size: 0.95rem;
  opacity: 0.9;
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.75rem;
}

.action-btn {
  border: 1px solid var(--theme-button-primary-border);
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  border-radius: 8px;
  padding: 0.48rem 0.95rem;
  font-weight: 700;
  cursor: pointer;

  &.secondary {
    background: var(--theme-button-secondary-bg);
    border-color: var(--theme-border-medium);
    color: var(--theme-button-secondary-text);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.status-text {
  margin: 0.75rem 0;
  text-align: center;
  color: var(--theme-text-secondary);

  &.error {
    color: #ff6b6b;
  }
}

.checking-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 12px 0 8px;
  color: var(--theme-text-secondary);
  font-size: 0.9rem;

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(0, 0, 0, 0.12);
    border-top: 3px solid #23641e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .checking-text {
    font-weight: 600;
    opacity: 0.86;
  }
}

.game-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1rem;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}

.anagram-panel,
.crossword-panel {
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  border-radius: 14px;
  padding: 1rem;
  box-shadow: var(--theme-shadow-sm);

  h2 {
    margin: 0 0 0.75rem;
    color: var(--theme-text-accent);
  }
}

.word-preview {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px dashed var(--theme-border-medium);
  border-radius: 10px;
  margin-bottom: 0.8rem;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.letter-wheel {
  width: 280px;
  height: 280px;
  margin: 0 auto;
  border-radius: 50%;
  position: relative;
  background: radial-gradient(circle at center, var(--theme-bg-primary), var(--theme-bg-secondary));
  border: 1px solid var(--theme-border-light);
}

.selection-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.letter-node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--theme-border-medium);
  background: var(--theme-input-bg);
  color: var(--theme-input-text);
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: none;
  user-select: none;

  &.selected {
    background: var(--theme-button-primary-bg);
    color: var(--theme-button-primary-text);
    border-color: var(--theme-button-primary-border);
    transform: translate(-50%, -50%) scale(1.08);
  }
}

.feedback-row {
  margin-top: 0.9rem;
  font-size: 0.95rem;
  color: var(--theme-text-secondary);

  p {
    margin: 0.2rem 0;
  }
}

.progress-row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
  font-size: 0.93rem;
}

.crossword-grid {
  display: grid;
  gap: 2px;
  width: fit-content;
  margin-bottom: 0.9rem;
}

.crossword-cell {
  width: 40px;
  height: 40px;
  position: relative;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-light);
  display: flex;
  justify-content: center;
  align-items: center;

  &.blocked {
    background: var(--theme-bg-tertiary);
    border-color: var(--theme-border-medium);
  }

  &.filled {
    background: var(--theme-bg-elevated);
    border-color: var(--theme-border-medium);
  }
}

.cell-number {
  position: absolute;
  left: 3px;
  top: 2px;
  font-size: 0.57rem;
  opacity: 0.84;
}

.cell-value {
  font-weight: 700;
  font-size: 1rem;
  color: var(--theme-text-primary);
}

.win-banner {
  margin-top: 1rem;
  text-align: center;
  border: 1px solid var(--theme-button-primary-border);
  color: var(--theme-button-primary-text);
  background: var(--theme-button-primary-bg);
  border-radius: 10px;
  padding: 0.75rem;
  font-weight: 800;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
