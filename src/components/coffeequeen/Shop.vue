<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Upgrades Shop</h2>

      <!-- Category Tabs -->
      <div class="category-tabs">
        <button
          class="tab-button"
          :class="{ active: activeTab === 'managers' }"
          @click="activeTab = 'managers'"
        >
          Automation Managers
        </button>
        <button
          class="tab-button"
          :class="{ active: activeTab === 'inventory' }"
          @click="activeTab = 'inventory'"
        >
          Storage Upgrades
        </button>
      </div>

      <!-- Manager Upgrades Tab -->
      <div v-if="activeTab === 'managers'" class="shop-items">
        <div
          v-for="upgrade in availableManagerUpgrades"
          :key="upgrade.id"
          class="shop-item"
          :class="{ purchased: isManagerUpgradePurchased(upgrade.id) }"
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
              :disabled="!canAffordManagerUpgrade(upgrade) || isManagerUpgradePurchased(upgrade.id)"
            >
              {{ isManagerUpgradePurchased(upgrade.id) ? 'Purchased' : 'Buy Manager' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Inventory Upgrades Tab -->
      <div v-if="activeTab === 'inventory'" class="shop-items">
        <div
          v-for="upgrade in availableInventoryUpgrades"
          :key="upgrade.id"
          class="shop-item"
          :class="{ purchased: isInventoryUpgradePurchased(upgrade.id) }"
        >
          <div class="upgrade-details">
            <div class="upgrade-header">
              <h3>{{ upgrade.name }}</h3>
              <span class="level-requirement">Level {{ upgrade.levelRequired }}</span>
            </div>
            <p class="description">{{ upgrade.description }}</p>
            <p class="multiplier-info">Multiplier: {{ upgrade.multiplier }}x</p>
          </div>

          <div class="upgrade-actions">
            <div class="price-display">
              <span>${{ upgrade.cost.toLocaleString() }}</span>
            </div>
            <button
              @click="emitBuyUpgrade(upgrade.id)"
              :disabled="
                !canAffordInventoryUpgrade(upgrade) || isInventoryUpgradePurchased(upgrade.id)
              "
            >
              {{ isInventoryUpgradePurchased(upgrade.id) ? 'Purchased' : 'Buy Upgrade' }}
            </button>
          </div>
        </div>
      </div>

      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  ManagerUpgrade,
  InventoryUpgrade,
  UserUpgrades,
  MachineKey,
} from '@/components/coffeequeen/types'
import {
  getAvailableUpgrades,
  getAvailableInventoryUpgrades,
} from '@/components/coffeequeen/data-upgrades'
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

// Active tab state
const activeTab = ref<'managers' | 'inventory'>('managers')

// Manager upgrades
const availableManagerUpgrades = computed(() => {
  return getAvailableUpgrades()
})

const canAffordManagerUpgrade = (upgrade: ManagerUpgrade): boolean => {
  return props.userMoney >= upgrade.cost && props.userLevel >= upgrade.levelRequired
}

const isManagerUpgradePurchased = (upgradeId: string): boolean => {
  return props.upgrades.managers[upgradeId] || false
}

// Inventory upgrades
const availableInventoryUpgrades = computed(() => {
  return getAvailableInventoryUpgrades()
})

const canAffordInventoryUpgrade = (upgrade: InventoryUpgrade): boolean => {
  return props.userMoney >= upgrade.cost && props.userLevel >= upgrade.levelRequired
}

const isInventoryUpgradePurchased = (upgradeId: string): boolean => {
  return props.upgrades.inventory?.[upgradeId] || false
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

.category-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
}

.tab-button {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid var(--coffee-border-primary);
  background: var(--coffee-button-bg);
  color: var(--coffee-button-text);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--coffee-button-hover);
    transform: translateY(-1px);
  }

  &.active {
    background: var(--coffee-accent);
    color: var(--coffee-text-light);
    border-color: var(--coffee-accent);
  }
}

.multiplier-info {
  color: var(--coffee-text-secondary);
  font-style: italic;
  font-size: 0.9rem;
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
