<template>
  <div
    class="cell"
    :class="{
      revealed: isRevealed,
      flagged: isFlagged,
      mine: isMine && isRevealed
    }"
    @click="revealCell"
    @contextmenu.prevent="toggleFlag"
  >
    <span v-if="isRevealed && !isMine">{{ adjacentMines > 0 ? adjacentMines : '' }}</span>
    <span v-if="isFlagged">🚩</span>
    <span v-if="isRevealed && isMine">💣</span>
  </div>
</template>

<script>
export default {
  props: {
    isRevealed: {
      type: Boolean,
      required: true
    },
    isFlagged: {
      type: Boolean,
      required: true
    },
    isMine: {
      type: Boolean,
      required: true
    },
    adjacentMines: {
      type: Number,
      required: true
    }
  },
  methods: {
    revealCell() {
      this.$emit('reveal');
    },
    toggleFlag() {
      this.$emit('toggle-flag');
    }
  }
};
</script>

<style scoped>
.cell {
  width: 30px;
  height: 30px;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
}
.cell.revealed {
  background-color: #e0e0e0;
}
.cell.flagged {
  background-color: #ffcc00;
}
.cell.mine {
  background-color: #ff6666;
}
</style>