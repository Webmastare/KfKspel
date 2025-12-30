<template>
  <div class="game-overlay">
    <div class="stats-container">
      <div class="money">Money: ${{ Math.floor(user.money) }}</div>
      <div class="inventory">
        <div v-for="item in inventory" :key="item.name" class="inventory-item">
          <img v-if="item.icon" :src="item.icon" :alt="item.name" class="item-icon" />
          <span>{{ item.amount }}</span>
        </div>
      </div>
    </div>
    <div class="level-container">
      <svg class="level-circle" viewBox="0 0 100 100">
        <circle class="bg" cx="50" cy="50" r="45"></circle>
        <circle
          class="progress"
          cx="50"
          cy="50"
          r="45"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="progressOffset"
        ></circle>
      </svg>
      <div class="level-text">{{ user.level }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User, InventoryItem } from '@/components/coffeequeen/types'

interface Props {
  user: User
  inventory: Record<string, InventoryItem>
}

const props = defineProps<Props>()

const circumference = 2 * Math.PI * 45 // 2 * pi * radius

const progressOffset = computed((): number => {
  const progress = props.user.experience / props.user.nextLevelExperience
  return circumference * (1 - progress)
})
</script>

<style scoped lang="scss">
.game-overlay {
  background: linear-gradient(180deg, var(--coffee-bg-secondary) 0%, var(--coffee-bg-primary) 100%);
  border-top: 2px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  transition: all 0.3s ease;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  z-index: 100;
}

.stats-container {
  display: flex;
  align-items: center;
}

.money {
  color: var(--coffee-text-primary);
  font-size: 20px;
  font-weight: bold;
  margin-right: 30px;
}

.inventory {
  display: flex;
  gap: 20px;
}

.inventory-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.item-icon {
  width: 24px;
  height: 24px;
}

.level-container {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.level-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);

  .bg {
    fill: none;
    stroke-width: 10;
    stroke: var(--coffee-border-secondary);
  }

  .progress {
    fill: none;
    stroke-width: 10;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.3s ease;
    stroke: #4caf50; // Keep green for progress
  }
}

.level-text {
  color: var(--coffee-text-primary);
  font-size: 32px;
  font-weight: bold;
  z-index: 1;
}
</style>
