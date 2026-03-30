<template>
  <div class="game-overlay">
    <div class="stats-container">
      <div class="money">Money: ${{ formatCompactNumber(user.money) }}</div>
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
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

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
  min-height: clamp(60px, 10vh, 80px);
  height: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(8px, 2vh, 20px);
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  z-index: 100;

  // Support for safe areas on mobile devices
  padding-bottom: max(clamp(8px, 2vh, 20px), env(safe-area-inset-bottom));

  // Ensure overlay stays at bottom even during scrolling
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.stats-container {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0; // Allow container to shrink
}

.money {
  color: var(--coffee-text-primary);
  font-size: clamp(14px, 3vw, 20px);
  font-weight: bold;
  margin-right: clamp(15px, 3vw, 30px);
  white-space: nowrap;
}

.inventory {
  display: flex;
  gap: clamp(8px, 2vw, 20px);
  overflow-x: auto;
  flex: 1;
  max-width: calc(100% - 120px); // Space for level container

  // Hide scrollbar but keep functionality
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.inventory-item {
  display: flex;
  align-items: center;
  gap: clamp(3px, 1vw, 5px);
  white-space: nowrap;
  flex-shrink: 0;
  font-size: clamp(12px, 2.5vw, 16px);
}

.item-icon {
  width: clamp(18px, 4vw, 24px);
  height: clamp(18px, 4vw, 24px);
  flex-shrink: 0;
}

.level-container {
  position: relative;
  width: clamp(50px, 8vw, 70px);
  height: clamp(50px, 8vw, 70px);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
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
  font-size: clamp(18px, 4vw, 32px);
  font-weight: bold;
  z-index: 1;
}

// Responsive adjustments
@media (max-width: 768px) {
  .game-overlay {
    flex-direction: row;
    align-items: stretch;
    padding: clamp(5px, 1.5vh, 15px);
  }

  .stats-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    flex: 1;
  }

  .inventory {
    max-width: 100%;
    margin-top: 5px;
  }

  .money {
    margin-right: 0;
    margin-bottom: 5px;
  }
}

@media (max-width: 480px) {
  .inventory-item {
    font-size: 12px;
  }

  .money {
    font-size: 16px;
  }

  .level-container {
    width: 45px;
    height: 45px;
  }
}
</style>
