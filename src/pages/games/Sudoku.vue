<template>
  <div class="sudoku-container" @keydown="handleKeydown" tabindex="0" ref="gameContainer">
    <div class="header">
      <h1>Sudoku</h1>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="instantCheck" @change="validateAllCells()" />
          Instant Feedback
        </label>
        <label>
          <input type="checkbox" v-model="devMode" />
          Dev Mode
        </label>
        <div class="difficulty-control">
          <span>Svårighetsgrad:</span>
          <select v-model.number="difficulty" @change="newGame">
            <option value="25">Lätt</option>
            <option value="45" selected>Medel</option>
            <option value="55">Svår</option>
            <option value="81">Expert</option>
          </select>
        </div>
        <button @click="newGame">Nytt Spel</button>
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
              'same-row': isInSameRow(rowIndex, colIndex),
              'same-column': isInSameColumn(rowIndex, colIndex),
              'same-box': isInSameBox(rowIndex, colIndex),
              'box-right': (colIndex + 1) % 3 === 0 && colIndex !== 8,
              'box-bottom': (rowIndex + 1) % 3 === 0 && rowIndex !== 8,
            }"
            @click="selectCell(rowIndex, colIndex)"
          >
            <span v-if="cell.value !== 0" class="cell-value">{{ cell.value }}</span>
            <div
              v-else-if="cell.annotations && cell.annotations.some(Boolean)"
              class="annotations-grid"
            >
              <span
                v-for="(annotation, index) in cell.annotations"
                :key="index"
                class="annotation-cell"
              >
                {{ annotation || '' }}
              </span>
            </div>
            <span v-if="devMode" class="solution-hint">{{
              fullSolution[rowIndex]?.[colIndex] || ''
            }}</span>
          </div>
        </div>
      </div>

      <div class="numpad">
        <button v-for="n in 9" :key="n" @click="inputNumber(n)">
          {{ n }}
        </button>
        <button class="clear-btn" @click="inputNumber(0)">✕</button>
        <button
          class="annotate-btn"
          :class="{ active: annotateMode }"
          @click="annotateMode = !annotateMode"
        >
          ✎
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { generateSudoku, isValid, type Board } from '@/composables/sudoku/sudokuLogic'
import { useThemeStore } from '@/stores/theme'

// Types
interface CellState {
  value: number
  isFixed: boolean // Was this part of the initial puzzle?
  isError: boolean // Visual red flag
  annotations: (number | null)[] // Array of 9 positions for annotations (1-9)
}

// Initialize theme store
const themeStore = useThemeStore()

// State
const fullSolution = ref<Board>([])
const displayBoard = ref<CellState[][]>([])
const selected = ref<{ r: number; c: number } | null>(null)
const instantCheck = ref(false)
const devMode = ref(true)
const gameContainer = ref<HTMLElement | null>(null)

const annotateMode = ref(false)
const difficulty = ref(45) // Number of holes to create

// -- Core Game Logic --
function newGame() {
  const { full, puzzle } = generateSudoku(difficulty.value) // Generate ~45 holes
  fullSolution.value = full

  // Map raw numbers to rich CellState objects
  displayBoard.value = puzzle.map((row) =>
    row.map((val) => ({
      value: val,
      isFixed: val !== 0,
      isError: false,
      annotations: new Array(9).fill(null),
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

const isInSameRow = (r: number, c: number) => {
  if (!selected.value) return false
  return selected.value.r === r && selected.value.c !== c
}

const isInSameColumn = (r: number, c: number) => {
  if (!selected.value) return false
  return selected.value.c === c && selected.value.r !== r
}

const isInSameBox = (r: number, c: number) => {
  if (!selected.value) return false
  if (selected.value.r === r && selected.value.c === c) return false

  const boxRowStart = Math.floor(selected.value.r / 3) * 3
  const boxColStart = Math.floor(selected.value.c / 3) * 3
  const cellBoxRowStart = Math.floor(r / 3) * 3
  const cellBoxColStart = Math.floor(c / 3) * 3

  return boxRowStart === cellBoxRowStart && boxColStart === cellBoxColStart
}

function inputNumber(num: number) {
  if (!selected.value) return

  const { r, c } = selected.value
  const cell = displayBoard.value[r]?.[c]
  if (!cell) return

  if (cell.isFixed) return // Cannot edit fixed cells

  if (annotateMode.value) {
    // Annotation mode: toggle annotation
    if (num === 0) {
      // Clear all annotations
      cell.annotations = new Array(9).fill(null)
    } else {
      // Toggle specific annotation
      const annotationIndex = num - 1
      if (cell.annotations[annotationIndex] === num) {
        cell.annotations[annotationIndex] = null
      } else {
        cell.annotations[annotationIndex] = num
      }
    }
  } else {
    // Normal mode: set cell value
    cell.value = num

    if (instantCheck.value) {
      validateCellInstant(r, c)
    } else {
      // Clear error if they change the number in classic mode
      cell.isError = false
    }

    checkWinCondition()
  }

  // Update save
  saveGame()
}

function validateAllCells() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      validateCellInstant(r, c)
    }
  }
}

function validateCellInstant(r: number, c: number) {
  const cell = displayBoard.value[r]?.[c]
  if (!cell) return

  if (!instantCheck.value) {
    cell.isError = false
    return
  }

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

function checkWinCondition() {
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
function handleKeydown(e: KeyboardEvent) {
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

// -- Save & Load Game --
function saveGame() {
  const gameState = {
    displayBoard: displayBoard.value,
    fullSolution: fullSolution.value,
    difficulty: difficulty.value,
  }
  localStorage.setItem('sudokuGame', JSON.stringify(gameState))
}

function loadGame() {
  const saved = localStorage.getItem('sudokuGam')
  if (saved) {
    const gameState = JSON.parse(saved)
    displayBoard.value = gameState.displayBoard
    fullSolution.value = gameState.fullSolution
    difficulty.value = gameState.difficulty
  } else {
    newGame()
  }
}

onMounted(() => {
  themeStore.init()
  loadGame()
})
</script>

<style scoped lang="scss">
// Import the centralized theme system
@use '@/styles/theme.scss';

.sudoku-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
  max-width: 100vw;
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  outline: none;
  transition:
    background-color 0.3s,
    color 0.3s;

  .header {
    text-align: center;
    margin-bottom: 20px;

    h1 {
      margin: 0 0 15px 0;
      font-size: 3rem;
      font-weight: bold;
      color: var(--theme-modal-header);
      text-shadow: var(--theme-shadow-sm);
      transition: color 0.3s;
    }

    .controls {
      display: flex;
      gap: 15px;
      align-items: center;
      justify-content: center;
      margin-top: 10px;
      flex-wrap: wrap;

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--theme-sidebar-bg);
        padding: 0.75rem 1rem;
        border-radius: 12px;
        box-shadow: var(--theme-shadow-sm);
        color: var(--theme-sidebar-text);
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
          background: var(--theme-sidebar-bg-hover);
          color: var(--theme-sidebar-text-on-dark);
        }

        input[type='checkbox'] {
          accent-color: var(--theme-modal-header);
          width: 16px;
          height: 16px;
        }
      }

      .difficulty-control {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--theme-sidebar-bg);
        padding: 0.75rem 1rem;
        border-radius: 12px;
        box-shadow: var(--theme-shadow-sm);
        color: var(--theme-sidebar-text);
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
          background: var(--theme-sidebar-bg-hover);
          color: var(--theme-sidebar-text-on-dark);
        }

        select {
          background: var(--theme-bg-primary);
          color: var(--theme-text-primary);
          border: 1px solid var(--theme-modal-border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.9rem;
          cursor: pointer;

          &:focus {
            outline: 2px solid var(--theme-modal-header);
            outline-offset: 2px;
          }
        }
      }

      button {
        color: var(--theme-button-primary-text);
        padding: 0.75rem 1rem;
        background: var(--theme-button-primary-bg);
        border: 2px solid var(--theme-button-primary-border);
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--theme-shadow-sm);

        &:hover {
          background: var(--theme-button-primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--theme-shadow-md);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }
  }

  .game-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .grid {
    display: grid;
    grid-template-rows: repeat(9, 50px);
    border: 3px solid var(--theme-canvas-border);
    border-radius: 12px;
    overflow: hidden;
    user-select: none;
    background: var(--theme-sodoku-bg);
    box-shadow: var(--theme-shadow-lg);
    transition: all 0.3s;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(9, 50px);
  }

  .cell {
    width: 50px;
    height: 50px;
    border-right: 1px solid var(--theme-sudoku-border);
    border-bottom: 1px solid var(--theme-sudoku-border);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--theme-text-primary);
    background: var(--theme-sudoku-bg);
    transition: all 0.15s ease;
    position: relative;

    // Subgrid (3x3) thick borders
    &.box-right {
      border-right: 2px solid var(--theme-sudoku-border);
    }
    &.box-bottom {
      border-bottom: 2px solid var(--theme-sudoku-border);
    }

    // Remove border on last column/row cells
    &:nth-child(9n) {
      border-right: none;
    }

    // States
    &.fixed {
      font-weight: bold;
      color: var(--theme-modal-header);
      cursor: default;
    }

    &.highlight {
      background-color: var(--theme-sidebar-bg);
      color: var(--theme-warning);
    }

    &.selected {
      background: var(--theme-canvas-grid);
      color: var(--theme-button-primary-text);
      border: 2px solid var(--theme-canvas-glow);
      transform: scale(0.95);
    }

    &.error {
      background: linear-gradient(
        135deg,
        var(--theme-button-decline-bg),
        var(--theme-button-decline-hover)
      );
      color: var(--theme-button-primary-text);
      animation: shake 0.3s ease-in-out;
    }

    &:hover:not(.selected):not(.fixed) {
      background-color: var(--theme-bg-elevated);
      transform: scale(1.05);
      box-shadow: var(--theme-shadow-sm);
    }

    &.same-row,
    &.same-column,
    &.same-box {
      background-color: var(--theme-modal-border);
    }

    .cell-value {
      z-index: 2;
    }

    .solution-hint {
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 0.7rem;
      font-weight: 400;
      color: var(--theme-warning);
      background: rgba(0, 0, 0, 0.7);
      border-radius: 3px;
      padding: 1px 3px;
      line-height: 1;
      z-index: 1;
      opacity: 0.8;
    }

    .annotations-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      width: 100%;
      height: 100%;
      padding: 2px;

      .annotation-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6rem;
        font-weight: 500;
        color: var(--theme-text-secondary);
        line-height: 1;
      }
    }
  }

  .numpad {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 450px;

    button {
      width: 44px;
      height: 50px;
      font-size: 1.2rem;
      font-weight: 600;
      background: var(--theme-sidebar-bg);
      color: var(--theme-sidebar-text);
      border: 2px solid var(--theme-sidebar-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: var(--theme-shadow-sm);

      &:hover {
        background: var(--theme-sidebar-bg-hover);
        color: var(--theme-sidebar-text-on-dark);
        transform: scale(1.05);
        box-shadow: var(--theme-shadow-md);
      }

      &:active {
        transform: scale(0.95);
      }

      &.clear-btn {
        background: var(--theme-button-decline-bg);
        color: var(--theme-button-primary-text);
        border: 2px solid var(--theme-button-decline-border);
        font-weight: bold;

        &:hover {
          background: var(--theme-button-decline-hover);
          color: var(--theme-button-primary-text);
        }
      }

      &.annotate-btn {
        font-size: 1.5rem;

        &.active {
          background: var(--theme-modal-header);
          color: var(--theme-button-primary-text);
          border: 2px solid var(--theme-modal-header);
          transform: scale(1.05);

          &:hover {
            background: var(--theme-modal-header);
            color: var(--theme-button-primary-text);
          }
        }
      }
    }
  }
}

// Shake animation for errors
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}
</style>
