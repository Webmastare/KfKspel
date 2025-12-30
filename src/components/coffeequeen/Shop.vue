<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Automation Managers</h2>

      <div class="shop-items">
        <div
          v-for="upgrade in availableUpgrades"
          :key="upgrade.id"
          class="shop-item"
          :class="{ purchased: isUpgradePurchased(upgrade.id) }"
        >
          <div class="upgrade-details">
            <div class="upgrade-header">
              <h3>{{ upgrade.name }}</h3>
              <span class="level-requirement">Level {{ upgrade.levelRequired }}</span>
            </div>
            <p class="description">{{ upgrade.description }}</p>
            <p class="machine-name">For: {{ getMachineName(upgrade.machineKey) }}</p>
          </div>

          <div class="upgrade-actions">
            <div class="price-display">
              <span>${{ upgrade.cost.toLocaleString() }}</span>
            </div>
            <button
              @click="emitBuyUpgrade(upgrade.id)"
              :disabled="!canAffordUpgrade(upgrade) || isUpgradePurchased(upgrade.id)"
            >
              {{ isUpgradePurchased(upgrade.id) ? 'Purchased' : 'Buy Manager' }}
            </button>
          </div>
        </div>
      </div>

      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ManagerUpgrade, UserUpgrades, MachineKey } from '@/components/coffeequeen/types'
import { getAvailableUpgrades } from '@/components/coffeequeen/data-upgrades'
import { machineDataList } from '@/components/coffeequeen/data-machines'

interface Props {
  userMoney: number
  userLevel: number
  upgrades: UserUpgrades
}

interface Emits {
  (e: 'buy-upgrade', upgradeId: string): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const availableUpgrades = computed(() => {
  return getAvailableUpgrades()
})

const canAffordUpgrade = (upgrade: ManagerUpgrade): boolean => {
  return props.userMoney >= upgrade.cost && props.userLevel >= upgrade.levelRequired
}

const isUpgradePurchased = (upgradeId: string): boolean => {
  return props.upgrades.managers[upgradeId] || false
}

const getMachineName = (machineKey: MachineKey): string => {
  return machineDataList[machineKey]?.name || machineKey
}

const emitBuyUpgrade = (upgradeId: string): void => {
  emit('buy-upgrade', upgradeId)
}

const emitClose = (): void => {
  emit('close')
}
</script>

<style scoped lang="scss">
.shop-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  font-family: 'Courier New', Courier, monospace;
  background: rgba(0, 0, 0, 0.7);
}

.shop-modal {
  position: relative;
  padding: 20px;
  border-radius: 10px;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

h2 {
  text-align: center;
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--coffee-text-secondary);
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.shop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  border-radius: 8px;
  background: var(--coffee-bg-secondary);
  border: 1px solid var(--coffee-border-primary);
  transition: all 0.3s ease;

  &:hover:not(.purchased) {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  &.purchased {
    opacity: 0.6;
    background: var(--coffee-bg-primary);
  }
}

.upgrade-details {
  flex: 1;
  margin-right: 15px;
}

.upgrade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  h3 {
    margin: 0;
    font-size: 16px;
    color: var(--coffee-text-primary);
  }

  .level-requirement {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
  }
}

.description {
  margin: 5px 0;
  font-size: 13px;
  color: var(--coffee-text-secondary);
  line-height: 1.4;
}

.machine-name {
  margin: 5px 0 0 0;
  font-size: 12px;
  font-style: italic;
  color: var(--coffee-text-primary);
  opacity: 0.8;
}

.upgrade-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.price-display {
  font-size: 14px;
  font-weight: bold;
  color: var(--coffee-text-secondary);
}

button {
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  font-size: 13px;
  background-color: #4caf50;
  color: white;
  border: 2px solid #45a049;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background-color: #45a049;
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background-color: #a0a0a0;
    border-color: #666;
    cursor: not-allowed;
  }
}

.close-button {
  display: block;
  margin: 20px auto 0;
  background-color: #f44336;
  border-color: #d32f2f;

  &:hover:not(:disabled) {
    background-color: #d32f2f;
  }
}
</style>
