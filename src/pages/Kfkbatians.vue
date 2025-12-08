<template>
  <div>
    <p id="hej">din mamma</p>

    <h2 id="passians"><span>KfK</span><span id="beet">b</span><span>atiens</span></h2>

    <div id="gamecontainer">
      <canvas id="duken" width="800" height="500"></canvas>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

// Import and initialize the game when component mounts
onMounted(async () => {
  // Dynamically import the main game script
  await import('@/composables/Kfkbatians/main.js')
})

onUnmounted(() => {
  // Clean up any game intervals, event listeners, etc. if needed
  // This will depend on what's in your main.js file
})
</script>

<style scoped>
@import '@/composables/Kfkbatians/style.css';
</style>
