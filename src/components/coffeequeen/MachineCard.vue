<template>
  <div class="machine-card" :class="{ locked: !machine.isOwned }">
    <div v-if="machine.isOwned" class="machine-content">
      <span :class="['status', { 'status-active': machine.isActive }]">
        {{ machine.isActive ? 'Active' : 'Inactive' }}
      </span>
      <div class="stats-container" @mouseenter="showStats = true" @mouseleave="showStats = false">
        <button class="stats-button">Stats</button>
        <div class="stats-dropdown" :class="{ show: showStats }">
          <span>Production: {{ getMachineProductionRate() }} u/s</span>
          <span>Efficiency: {{ getMachineEfficiencyRate() }} u/s</span>
          <span>Items Produced: {{ machine.itemsProduced }}</span>
          <span>Bonus Items: {{ machine.bonusItems }}</span>
        </div>
      </div>

      <div class="machine-body">
        <img :src="machine.icon" :alt="machine.name" class="machine-icon" />

        <div class="machine-header">
          <span>{{ machine.name }}</span> <br />
          <p>Batch Size: {{ machine.batchSize }}</p>
        </div>

        <!-- Manual start button for manual machines -->
        <div v-if="machine.isManual" class="manual-start-container">
          <button
            @click="emitStart"
            :disabled="!canStart"
            class="manual-start-button"
            :class="{ 'button-pulse': canStart }"
          >
            {{ machine.isRunning ? 'Running...' : 'Start' }}
          </button>
        </div>

        <div class="progress-bars-container">
          <div class="progress-bar">
            <p>
              Progress: <span>{{ (calculateProductionTimeLeft() / 1000).toFixed(1) }}s</span>
            </p>
            <div
              class="progress-bar-fill"
              :class="{ 'high-speed': isHighSpeedMode }"
              :style="{ width: progressBarWidth }"
            ></div>
          </div>
          <div class="progress-bar">
            <p>Efficiency:</p>
            <div
              class="efficiency-bar-fill"
              :class="{ 'high-speed': isHighSpeedModeEfficiency }"
              :style="{ width: efficiencyProgressBarWidth }"
            ></div>
          </div>
        </div>

        <div class="upgrade-buttons">
          <div class="upgrade-button-container">
            <button @click="emitUpgrade('speed')" :disabled="!canAffordSpeedUpgrade">
              Speed: {{ machine.speedUpgrade }}
            </button>
            <div class="tooltip">
              <p>Cost: ${{ formatCompactNumber(machine.speedUpgradeCost) }}</p>
              <p>Current: {{ (machine.productionTime / 1000).toFixed(2) }}s</p>
              <p>Next: {{ (nextSpeedTime / 1000).toFixed(2) }}s</p>
            </div>
          </div>
          <div class="upgrade-button-container">
            <button @click="emitUpgrade('efficiency')" :disabled="!canAffordEfficiencyUpgrade">
              Efficiency: {{ machine.efficiencyUpgrade }}
            </button>
            <div class="tooltip">
              <p>Cost: ${{ formatCompactNumber(machine.efficiencyUpgradeCost) }}</p>
              <p>Current: {{ getEfficiency(false) }}</p>
              <p>Next: {{ getEfficiency(true) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="locked-overlay">
      <img :src="machine.icon" :alt="machine.name" class="machine-icon" />
      <div class="machine-header">
        <span>{{ machine.name }}</span>
        <p>Batch Size: {{ machine.batchSize }}</p>
      </div>
      <div class="buy-section">
        <p>Cost: ${{ formatCompactNumber(machine.cost) }}</p>
        <p>Requires Level: {{ machine.levelRequired }}</p>
        <button @click="emitBuy" :disabled="!canAffordMachine || !levelMet">
          <span v-if="!levelMet">Level {{ machine.levelRequired }} Required</span>
          <span v-else>Buy</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { UserMachine, MachineKey } from '@/components/coffeequeen/types'
import {
  calculateProductionTime,
  calculateEfficiencyBonus,
  calculateBatchSize,
} from '@/components/coffeequeen/coffee-upgrade-calculations'
import { machineDataList } from '@/components/coffeequeen/data-machines'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  machine: UserMachine
  userMoney: number
  userLevel: number
}

interface Emits {
  (e: 'upgrade-machine', payload: { machineKey: MachineKey; upgradeType: string }): void
  (e: 'buy-machine', machineKey: MachineKey): void
  (e: 'start-machine', machineKey: MachineKey): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showStats = ref<boolean>(false)

const progressBarWidth = computed(() => {
  if (!props.machine.isOwned) return '0%'

  // For very fast machines (< 0.1s), show continuous animation
  if (props.machine.productionTime < 100) return '100%'

  // Use the progressPercent directly - much simpler and more accurate!
  const progress = Math.max(0, Math.min(1, props.machine.progressPercent || 0))
  return `${progress * 100}%`
})

const calculateProductionTimeLeft = () => {
  if (!props.machine.isOwned) return 0

  const prodTime = props.machine.productionTime
  const progress = Math.max(0, Math.min(1, props.machine.progressPercent || 0))
  return prodTime * (1 - progress)
}

const efficiencyProgressBarWidth = computed(() => {
  if (!props.machine.isOwned) return '0%'
  if (
    props.machine.productionTime / calculateEfficiencyBonus(props.machine.efficiencyUpgrade) <
    100
  )
    return '100%'
  const progress = Math.max(0, Math.min(1, props.machine.efficiencyProgress))
  return `${progress * 100}%`
})

// Check if machine is in high-speed mode (< 0.1 seconds production time)
const isHighSpeedMode = computed(() => {
  return props.machine.isOwned && props.machine.productionTime < 100
})
const isHighSpeedModeEfficiency = computed(() => {
  return (
    props.machine.isOwned &&
    props.machine.productionTime / calculateEfficiencyBonus(props.machine.efficiencyUpgrade) < 100
  )
})

const nextSpeedTime = computed(() => {
  if (!props.machine.isOwned) return 0

  // Get the base production time from the machine config
  const machineConfig = machineDataList[props.machine.key as MachineKey]
  const baseProductionTime = machineConfig?.productionTime || props.machine.productionTime

  return calculateProductionTime(
    props.machine.baseBatchSize,
    props.machine.speedUpgrade + 1,
    baseProductionTime,
  )
})

const getEfficiency = (next: boolean): string => {
  if (!props.machine.isOwned) return '0%'
  const efficiencyLevel = props.machine.efficiencyUpgrade + (next ? 1 : 0)
  const efficiencyBonus = calculateEfficiencyBonus(efficiencyLevel)
  return (efficiencyBonus * 100).toFixed(1) + '%'
}

const getMachineProductionRate = () => {
  if (!props.machine.isOwned) return '0.00'
  const batchSize = props.machine.batchSize || 1
  let timeInSeconds = props.machine.productionTime / 1000 // Convert milliseconds to seconds
  return (batchSize / timeInSeconds).toFixed(2)
}

const getMachineEfficiencyRate = () => {
  if (!props.machine.isOwned) return '0.00'
  const batchSize =
    props.machine.batchSize ||
    calculateBatchSize(props.machine.baseBatchSize, props.machine.speedUpgrade)
  const prodRate = batchSize / (props.machine.productionTime / 1000) // Production rate in units per second
  const efficiencyBonus = calculateEfficiencyBonus(props.machine.efficiencyUpgrade)
  return (prodRate * efficiencyBonus).toFixed(2)
}

const canAffordSpeedUpgrade = computed(
  () => props.machine.isOwned && props.userMoney >= props.machine.speedUpgradeCost,
)
const canAffordEfficiencyUpgrade = computed(
  () => props.machine.isOwned && props.userMoney >= props.machine.efficiencyUpgradeCost,
)

// For buying the machine
const canAffordMachine = computed(() => props.userMoney >= props.machine.cost)
const levelMet = computed(() => props.userLevel >= props.machine.levelRequired)

// For manual start button
const canStart = computed(() => {
  return props.machine.isOwned && props.machine.isManual && !props.machine.isRunning
})

function emitUpgrade(type: string) {
  emit('upgrade-machine', { machineKey: props.machine.key as MachineKey, upgradeType: type })
}

function emitBuy() {
  emit('buy-machine', props.machine.key as MachineKey)
}

function emitStart() {
  emit('start-machine', props.machine.key as MachineKey)
}
</script>

<style scoped lang="scss">
.machine-card {
  background: var(--coffee-bg-card);
  border: 2px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  transition: all 0.3s ease;
  position: relative;
  width: clamp(180px, 25vw, 220px);
  min-height: clamp(200px, 30vh, 280px);
  border-radius: 8px;
  padding: clamp(8px, 2vw, 12px);
  font-family: 'Courier New', Courier, monospace;
  margin: clamp(5px, 1.5vw, 10px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.4);
  scroll-snap-align: start;
}

.machine-card.locked {
  background-color: #a0a0a0;
  border-color: #666;
  justify-content: center;
  align-items: center;
}

.machine-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.locked-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;

  .machine-icon {
    filter: grayscale(100%);
    opacity: 0.5;
    width: clamp(60px, 12vw, 80px);
    height: clamp(60px, 12vw, 80px);
    display: block;
    margin: 0 auto clamp(5px, 2vw, 10px);
  }

  .buy-section {
    margin-top: clamp(8px, 2vw, 10px);
    p {
      margin: -5px 0;
      font-size: clamp(11px, 2.2vw, 13px);
      font-weight: bold;
      color: white;
    }
    button {
      margin-top: 5px;
      padding: clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 10px);
      font-size: clamp(12px, 2.5vw, 14px);
      border-radius: 4px;
      cursor: pointer;
      background-color: #4caf50;
      color: white;
      border: 2px solid #45a049;
      min-height: 36px;
      width: 100%;

      &:hover {
        background-color: #45a049;
      }

      &:disabled {
        background-color: #a0a0a0;
        border-color: #666;
        cursor: not-allowed;
      }
    }
  }
}

.stats-container {
  position: absolute;
  top: clamp(3px, 1vw, 5px);
  right: clamp(3px, 1vw, 5px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(8px, 2vw, 10px);
  z-index: 10;

  .stats-button {
    padding: clamp(3px, 1vw, 5px) clamp(6px, 1.5vw, 10px);
    cursor: pointer;
    font-size: clamp(10px, 2vw, 12px);
    border-radius: 4px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);

    &:hover {
      filter: brightness(1.2);
    }
  }

  .stats-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    border-radius: 8px;
    padding: clamp(4px, 1vw, 6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: clamp(140px, 25vw, 170px);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.2s ease;
    z-index: 1000;
    background: var(--coffee-bg-card);
    border: 1px solid var(--coffee-border-primary);
    color: var(--coffee-text-primary);

    &.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    span {
      display: block;
      font-size: clamp(9px, 1.8vw, 11px);
      margin-bottom: 2px;
    }
  }
}

.status {
  position: absolute;
  top: clamp(3px, 1vw, 5px);
  left: clamp(3px, 1vw, 5px);
  font-size: clamp(8px, 1.5vw, 10px);
  font-weight: 900;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #d13232d5;
  color: white;
  z-index: 10;
}

.status-active {
  background-color: #37c737cd;
}

.machine-icon {
  width: clamp(60px, 12vw, 80px);
  height: clamp(60px, 12vw, 80px);
  display: block;
  margin: clamp(15px, 3vw, 20px) auto clamp(8px, 2vw, 10px);
}

.machine-header {
  text-align: center;
  font-weight: bold;
  font-size: clamp(12px, 2.5vw, 14px);
  margin-top: clamp(-12px, -2.5vw, -15px);
  margin-bottom: clamp(4px, 1vw, 5px);
  p {
    margin: -5px 0;
    font-size: clamp(10px, 2vw, 12px);
  }
}

.progress-bar {
  background: var(--coffee-bg-secondary);
  border-color: var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  position: relative;
  width: 100%;
  height: clamp(10px, 2vh, 14px);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
  border: 1px solid;

  p {
    position: absolute;
    top: 50%;
    left: 5%;
    transform: translate(0%, -50%);
    display: inline-block;
    margin: 0;
    height: auto;
    font-size: clamp(8px, 1.5vw, 10px);
    font-weight: bold;
    z-index: 2;
    white-space: nowrap;

    @media (max-width: 480px) {
      font-size: 7px;
      left: 2%;
    }
  }
}

.progress-bars-container {
  margin-bottom: clamp(6px, 1.5vw, 8px);
}

.progress-bar-fill {
  height: 100%;
  background-color: #00ff00;
  position: relative;
  z-index: 1;

  &.high-speed {
    background: linear-gradient(
      45deg,
      #00ff00 25%,
      #00cc00 25%,
      #00cc00 50%,
      #00ff00 50%,
      #00ff00 75%,
      #00cc00 75%,
      #00cc00
    );
    background-size: 30px 30px;
    animation: diagonal-move 0.6s linear infinite;
    transition: none;
  }
}

.efficiency-bar-fill {
  height: 100%;
  background-color: #ffc107;
  position: relative;
  z-index: 1;

  &.high-speed {
    background: linear-gradient(
      45deg,
      #ffc107 25%,
      #ffb300 25%,
      #ffb300 50%,
      #ffc107 50%,
      #ffc107 75%,
      #ffb300 75%,
      #ffb300
    );
    background-size: 30px 30px;
    animation: diagonal-move 0.6s linear infinite;
    transition: none;
  }
}

@keyframes diagonal-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 30px 0px;
  }
}

.upgrade-buttons {
  display: flex;
  justify-content: space-between;
  gap: clamp(4px, 1vw, 8px);
  flex-wrap: wrap;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 4px;
  }
}

.upgrade-button-container {
  position: relative;
  flex: 1;
  min-width: clamp(60px, 15vw, 80px);

  button {
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    padding: clamp(3px, 1vw, 4px);
    font-size: clamp(9px, 1.8vw, 11px);
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    min-height: 32px;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: grayscale(50%);
    }
  }

  .tooltip {
    visibility: hidden;
    width: clamp(140px, 25vw, 160px);
    text-align: left;
    border-radius: 6px;
    padding: clamp(6px, 1.5vw, 8px);
    position: absolute;
    z-index: 10;
    bottom: 125%;
    left: 50%;
    margin-left: clamp(-70px, -12.5vw, -80px);
    opacity: 0;
    transition: opacity 0.3s;
    background: var(--coffee-bg-card);
    border: 1px solid var(--coffee-border-primary);
    color: var(--coffee-text-primary);

    p {
      margin: 2px 0;
      font-size: clamp(9px, 1.8vw, 11px);
    }
  }

  &:hover .tooltip {
    visibility: visible;
    opacity: 1;
  }
}

.manual-start-container {
  margin: clamp(6px, 1.5vw, 8px) 0;
  text-align: center;
}

.manual-start-button {
  background: var(--coffee-button-bg);
  color: var(--coffee-button-text);
  border: 2px solid var(--coffee-button-border);
  padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
  font-size: clamp(10px, 2vw, 12px);
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: clamp(60px, 15vw, 80px);
  min-height: 36px;

  &:hover:not(:disabled) {
    filter: brightness(1.2);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: grayscale(50%);
  }

  &.button-pulse {
    animation: pulse 2s infinite;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
}

// Mobile-specific adjustments
@media (max-width: 768px) {
  .machine-card {
    width: clamp(160px, 40vw, 180px);
  }

  .stats-dropdown {
    width: 120px;
    padding: 4px;

    span {
      font-size: 8px;
      line-height: 1.2;
    }
  }
}

@media (max-width: 480px) {
  .machine-card {
    width: 150px;
    min-height: 180px;
    padding: 8px;
  }

  .machine-icon {
    width: 50px;
    height: 50px;
    margin: 10px auto 5px;
  }

  .machine-header {
    font-size: 11px;

    p {
      font-size: 9px;
    }
  }

  .progress-bar {
    height: 10px;
  }
}
</style>
