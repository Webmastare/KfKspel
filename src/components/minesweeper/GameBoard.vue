<template>
  <div class="game-board">
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <Cell
        v-for="(cell, index) in cells"
        :key="index"
        :isRevealed="cell.revealed"
        :isFlagged="cell.flagged"
        :isMine="cell.mine"
        :adjacentMines="cell.adjacentMines"
        @reveal="revealCell(index)"
        @toggle-flag="toggleFlag(index)"
        />
    </div>
  </div>
</template>

<script>
import Cell from './Cell.vue';

export default {
  components: {
    Cell,
  },
  data() {
    return {
      rows: 10,
      columns: 10,
      mines: 20,
      cells: [],
    };
  },
  created() {
    this.initializeBoard();
  },
  methods: {
    initializeBoard() {
      this.cells = Array.from({ length: this.rows * this.columns }, () => ({
        revealed: false,
        flagged: false,
        mine: false,
        adjacentMines: 0,
      }));
      this.placeMines();
      this.calculateAdjacentMines();
    },
    placeMines() {
      let mineCount = 0;
      while (mineCount < this.mines) {
        const index = Math.floor(Math.random() * this.cells.length);
        if (!this.cells[index].mine) {
          this.cells[index].mine = true;
          mineCount++;
        }
      }
    },
    calculateAdjacentMines() {
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i].mine) {
          this.getAdjacentCells(i).forEach((adjIndex) => {
            this.cells[adjIndex].adjacentMines++;
          });
        }
      }
    },
    getAdjacentCells(index) {
      const adjacentIndices = [];
      const row = Math.floor(index / this.columns);
      const col = index % this.columns;

      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.columns && !(r === row && c === col)) {
            adjacentIndices.push(r * this.columns + c);
          }
        }
      }
      return adjacentIndices;
    },
    revealCell(index) {
      const cell = this.cells[index];
      if (cell.revealed || cell.flagged) return;

      cell.revealed = true;

      if (cell.mine) {
        alert('Game Over! You hit a mine!');
        this.initializeBoard();
      } else if (cell.adjacentMines === 0) {
        this.getAdjacentCells(index).forEach((adjIndex) => {
          this.revealCell(adjIndex);
        });
      }
    },
    toggleFlag(index) {
      const cell = this.cells[index];
      if (!cell.revealed) {
        cell.flagged = !cell.flagged;
      }
    },
  },
};
</script>

<style scoped>
.game-board {
  display: flex;
  justify-content: center;
  align-items: center;
}

.grid {
  display: grid;
  gap: 2px;
}

.grid > div {
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}
</style>