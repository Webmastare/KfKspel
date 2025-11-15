<template>
  <div class="five-letter-container">
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

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface Cell {
  letter: string
  correct: boolean
  present: boolean
  absent: boolean
  flipping: boolean
}

const props = defineProps<{
  currentWord: string
  currentRow: number
  currentCol: number
  submittedRows: Array<{
    word: string
    result: Array<{ letter: string; correct: boolean; exist: boolean }>
  }>
  animatingCells?: Array<Array<boolean>>
  animatingRowData?: Array<
    Array<{
      letter: string
      correct: boolean
      present: boolean
      absent: boolean
    } | null>
  >
}>()

// Initialize grid
const initializeGrid = (): Cell[][] => {
  return Array(6)
    .fill(null)
    .map(() =>
      Array(4)
        .fill(null)
        .map(() => ({
          letter: '',
          correct: false,
          present: false,
          absent: false,
          flipping: false,
        })),
    )
}

const grid = ref<Cell[][]>(initializeGrid())
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')

// Update grid based on props
const updateGrid = () => {
  // Reset grid
  grid.value = initializeGrid()

  // Update current row with typing
  const currentRowData = grid.value[props.currentRow]
  if (currentRowData) {
    for (let i = 0; i < 4; i++) {
      currentRowData[i] = {
        letter: props.currentWord[i] || '',
        correct: false,
        present: false,
        absent: false,
        flipping: props.animatingCells?.[props.currentRow]?.[i] || false,
      }
    }
  }

  // Update submitted rows
  props.submittedRows.forEach((submission, rowIndex) => {
    const row = grid.value[rowIndex]
    if (row) {
      submission.result.forEach((letterResult, colIndex) => {
        if (row[colIndex]) {
          row[colIndex] = {
            letter: letterResult.letter.toUpperCase(),
            correct: letterResult.correct,
            present: letterResult.exist && !letterResult.correct,
            absent: !letterResult.exist,
            flipping: props.animatingCells?.[rowIndex]?.[colIndex] || false,
          }
        }
      })
    }
  })

  // Update animating rows (overrides submitted rows for cells currently animating)
  props.animatingRowData?.forEach((animatingRow, rowIndex) => {
    const row = grid.value[rowIndex]
    if (row && animatingRow) {
      animatingRow.forEach((animatingCell, colIndex) => {
        if (animatingCell && row[colIndex]) {
          row[colIndex] = {
            letter: animatingCell.letter,
            correct: animatingCell.correct,
            present: animatingCell.present,
            absent: animatingCell.absent,
            flipping: props.animatingCells?.[rowIndex]?.[colIndex] || false,
          }
        }
      })
    }
  })
}

// Watch for prop changes
watch(
  () => [
    props.currentWord,
    props.currentRow,
    props.submittedRows,
    props.animatingCells,
    props.animatingRowData,
  ],
  updateGrid,
  { deep: true },
)

// Initialize on mount
updateGrid()

defineExpose({
  showMessage: (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    message.value = msg
    messageType.value = type
    setTimeout(() => {
      message.value = ''
    }, 3000)
  },
})
</script>

<style scoped lang="scss">
.five-letter-container {
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
  border: 2px solid var(--theme-button-primary-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  text-transform: uppercase;
  background: var(--theme-bg-secondary);
  color: var(--theme-text-primary);
  border-radius: 4px;
  transition: all 0.3s ease;

  &.filled {
    border-color: var(--theme-text-primary);
    transform: scale(1.05);
  }

  &.active {
    border-color: var(--theme-button-primary-bg);
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
  margin-top: 10px;
  padding: 10px 20px;
  border-radius: 5px;
  font-weight: bold;

  &.success {
    background: #538d4e;
    color: white;
  }

  &.error {
    background: #dc3545;
    color: white;
  }

  &.info {
    background: var(--theme-bg-tertiary);
    color: var(--theme-text-primary);
  }
}

@media (max-width: 768px) {
  .letter-cell {
    width: 50px;
    height: 50px;
    font-size: 1.5rem;
  }

  .word-row {
    gap: 5px;
  }
}
</style>
