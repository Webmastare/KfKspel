<template>
  <header class="minesweeper-header">
    <h1>Minesweeper</h1>
    <div class="game-info">
      <span class="timer">Time: {{ timer }}s</span>
      <span class="mines-remaining">Mines Remaining: {{ minesRemaining }}</span>
    </div>
  </header>
</template>

<script>
export default {
  name: 'MinesweeperHeader',
  props: {
    timer: {
      type: Number,
      required: true
    },
    minesRemaining: {
      type: Number,
      required: true
    }
  }
}
</script>

<style scoped>
.minesweeper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #f0f0f0;
  border-bottom: 2px solid #ccc;
}

.game-info {
  font-size: 1.2em;
}

.timer, .mines-remaining {
  margin-left: 20px;
}
</style>