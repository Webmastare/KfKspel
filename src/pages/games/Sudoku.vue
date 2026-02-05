<template>
  <div class="sudoku-container" @keydown="handleKeydown" tabindex="0" ref="gameContainer">
    <div class="header">
      <h1>Sudoku</h1>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="instantCheck" />
          Instant Feedback
        </label>
        <button @click="newGame">New Game</button>
      </div>
    </div>

    <div class="game-area">
      <div class="grid">
        <div v-for="(row, rowIndex) in displayBoard" :key="rowIndex" class="row">
          <div
            v-for="(cell, colIndex) in row"
            :key="colIndex"
            class="cell"
            :class="{
              fixed: cell.isFixed,
              selected: isSelected(rowIndex, colIndex),
              error: cell.isError,
              highlight: shouldHighlight(cell.value),
              'box-right': (colIndex + 1) % 3 === 0 && colIndex !== 8,
              'box-bottom': (rowIndex + 1) % 3 === 0 && rowIndex !== 8,
            }"
            @click="selectCell(rowIndex, colIndex)"
          >
            {{ cell.value !== 0 ? cell.value : '' }}
          </div>
        </div>
      </div>

      <div class="numpad">
        <button v-for="n in 9" :key="n" @click="inputNumber(n)">
          {{ n }}
        </button>
        <button class="clear-btn" @click="inputNumber(0)">X</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { generateSudoku, isValid, type Board } from '@/composables/sudoku/sudokuLogic'

// Types
interface CellState {
  value: number
  isFixed: boolean // Was this part of the initial puzzle?
  isError: boolean // Visual red flag
}

// State
const fullSolution = ref<Board>([])
const displayBoard = ref<CellState[][]>([])
const selected = ref<{ r: number; c: number } | null>(null)
const instantCheck = ref(false)
const gameContainer = ref<HTMLElement | null>(null)

// -- Core Game Logic --

const newGame = () => {
  const { full, puzzle } = generateSudoku(45) // Generate ~45 holes
  fullSolution.value = full

  // Map raw numbers to rich CellState objects
  displayBoard.value = puzzle.map((row) =>
    row.map((val) => ({
      value: val,
      isFixed: val !== 0,
      isError: false,
    })),
  )

  selected.value = null
  // Focus div to catch keyboard events immediately
  nextTick(() => gameContainer.value?.focus())
}

const selectCell = (r: number, c: number) => {
  selected.value = { r, c }
}

const isSelected = (r: number, c: number) => {
  return selected.value?.r === r && selected.value?.c === c
}

const shouldHighlight = (val: number) => {
  // Highlight all cells containing the same number as the selected one (if not 0)
  if (!selected.value || val === 0) return false
  const selectedCell = displayBoard.value[selected.value.r]?.[selected.value.c]
  if (!selectedCell) return false
  const selectedVal = selectedCell.value
  return selectedVal !== 0 && selectedVal === val
}

const inputNumber = (num: number) => {
  if (!selected.value) return

  const { r, c } = selected.value
  const cell = displayBoard.value[r]?.[c]
  if (!cell) return

  if (cell.isFixed) return // Cannot edit fixed cells

  cell.value = num

  if (instantCheck.value) {
    validateCellInstant(r, c)
  } else {
    // Clear error if they change the number in classic mode
    cell.isError = false
  }

  checkWinCondition()
}

const validateCellInstant = (r: number, c: number) => {
  const cell = displayBoard.value[r]?.[c]
  if (!cell) return

  if (cell.value === 0) {
    cell.isError = false
    return
  }
  // Compare against the pre-generated solution for 100% accuracy
  const correctVal = fullSolution.value[r]?.[c]
  if (correctVal !== undefined) {
    cell.isError = cell.value !== correctVal
  }
}

const checkWinCondition = () => {
  // 1. Are all cells filled?
  const allFilled = displayBoard.value.every((row) => row.every((c) => c.value !== 0))
  if (!allFilled) return

  // 2. Validate entire board
  let isWon = true
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = displayBoard.value[r]?.[c]
      const correct = fullSolution.value[r]?.[c]
      if (!cell || correct === undefined) continue

      if (cell.value !== correct) {
        cell.isError = true
        isWon = false
      } else {
        cell.isError = false
      }
    }
  }

  if (isWon) {
    console.log('GAME WON!')
    alert('Congratulations! You solved the Sudoku.')
  }
}

// -- Keyboard Handling --

const handleKeydown = (e: KeyboardEvent) => {
  if (!selected.value) return

  const key = e.key
  // Arrow Navigation
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    e.preventDefault()
    let { r, c } = selected.value
    if (key === 'ArrowUp') r = Math.max(0, r - 1)
    if (key === 'ArrowDown') r = Math.min(8, r + 1)
    if (key === 'ArrowLeft') c = Math.max(0, c - 1)
    if (key === 'ArrowRight') c = Math.min(8, c + 1)
    selected.value = { r, c }
    return
  }

  // Number Input
  if (key >= '1' && key <= '9') {
    inputNumber(parseInt(key))
  } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
    inputNumber(0)
  }
}

onMounted(() => {
  newGame()
})
</script>

<style scoped lang="scss">
$border-color: #333;
$border-light: #ccc;
$cell-size: 50px;
$highlight-color: #e2e8f0;
$select-color: #bbdefb;
$error-color: #ffcdd2;
$fixed-text: #000;
$user-text: #2c3e50; // A nice dark blue-ish grey

.sudoku-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Segoe UI', sans-serif;
  outline: none; // Remove browser outline on focus
  padding: 20px;

  .header {
    text-align: center;
    margin-bottom: 20px;

    .controls {
      display: flex;
      gap: 15px;
      align-items: center;
      justify-content: center;
      margin-top: 10px;

      button {
        padding: 8px 16px;
        background: #2c3e50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        &:hover {
          background: #34495e;
        }
      }
    }
  }

  .grid {
    display: grid;
    // 9 rows
    grid-template-rows: repeat(9, $cell-size);
    border: 2px solid $border-color;
    user-select: none;
    background: white;
  }

  .row {
    display: grid;
    // 9 cols
    grid-template-columns: repeat(9, $cell-size);
  }

  .cell {
    width: $cell-size;
    height: $cell-size;
    border-right: 1px solid $border-light;
    border-bottom: 1px solid $border-light;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    cursor: pointer;
    color: $user-text;

    // Subgrid (3x3) thick borders
    &.box-right {
      border-right: 2px solid $border-color;
    }
    &.box-bottom {
      border-bottom: 2px solid $border-color;
    }
    // Last column/row doesn't need border (handled by container)
    &:last-child {
      border-right: none;
    }

    // States
    &.fixed {
      font-weight: bold;
      color: $fixed-text;
      background-color: #f8f9fa;
      cursor: default;
    }

    &.highlight {
      background-color: $highlight-color;
    }

    &.selected {
      background-color: $select-color;
    }

    &.error {
      background-color: $error-color;
      color: #b71c1c;
    }
  }

  .numpad {
    margin-top: 20px;
    display: flex;
    gap: 5px;

    button {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
      background: white;
      border: 1px solid $border-light;
      border-radius: 4px;
      cursor: pointer;
      &:hover {
        background: #f0f0f0;
      }

      &.clear-btn {
        color: red;
        font-weight: bold;
      }
    }
  }
}
</style>
