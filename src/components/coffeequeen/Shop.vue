<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Upgrades Shop</h2>
      <button class="top-close-button" @click="emitClose">×</button>

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
        <button
          class="tab-button"
          :class="{ active: activeTab === 'salesManagers' }"
          @click="activeTab = 'salesManagers'"
        >
          Sales Managers
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
              <span>${{ formatCompactNumber(upgrade.cost) }}</span>
            </div>
            <button
              class="shop-button"
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
              <span>${{ formatCompactNumber(upgrade.cost) }}</span>
            </div>
            <button
              class="shop-button"
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

      <!-- Sales Managers Tab -->
      <div v-if="activeTab === 'salesManagers'" class="shop-items">
        <div
          v-for="itemKey in availableSalesManagerItems"
          :key="itemKey"
          class="shop-item sales-manager-item"
          :class="{
            'has-manager': getSalesManagerLevel(itemKey) > 0,
            expanded: expandedSalesManagers.has(itemKey),
          }"
        >
          <!-- Collapsed Row -->
          <div class="manager-row" @click="toggleSalesManagerExpansion(itemKey)">
            <img :src="getItemIcon(itemKey)" :alt="getItemName(itemKey)" class="item-icon" />
            <div class="item-info">
              <h3>{{ getItemName(itemKey) }} Sales Manager</h3>
              <span class="level-display">Level {{ getSalesManagerLevel(itemKey) }}</span>
            </div>
            <div class="expand-indicator">
              <span class="arrow" :class="{ expanded: expandedSalesManagers.has(itemKey) }">
                ▼
              </span>
            </div>
          </div>

          <!-- Expanded Content -->
          <div v-if="expandedSalesManagers.has(itemKey)" class="expanded-content">
            <!-- Current Level Display -->
            <div class="current-level-section">
              <h4>Current Level</h4>
              <div v-if="getSalesManagerLevel(itemKey) === 0" class="level-info no-manager">
                <div class="level-details">
                  <p class="level-name">No Sales Manager</p>
                  <p class="level-description">
                    Purchase a sales manager to automate buying and selling
                  </p>
                </div>
              </div>
              <div v-else class="level-info current">
                <div class="level-details">
                  <p class="level-name">{{ getCurrentLevelConfig(itemKey)?.name || 'Unknown' }}</p>
                  <p class="level-description">
                    {{ getCurrentLevelConfig(itemKey)?.description || '' }}
                  </p>
                  <div class="level-features">
                    <span v-if="getCurrentLevelConfig(itemKey)?.features.canSell">✓ Auto-Sell</span>
                    <span v-if="getCurrentLevelConfig(itemKey)?.features.canBuy">✓ Auto-Buy</span>
                    <span v-if="getCurrentLevelConfig(itemKey)?.features.canSetThresholds"
                      >✓ Custom Thresholds</span
                    >
                    <span v-if="getCurrentLevelConfig(itemKey)?.features.offlineWork"
                      >✓ Offline Work</span
                    >
                  </div>
                  <div class="level-stats">
                    <span
                      >Rate:
                      {{
                        getCurrentLevelConfig(itemKey)?.sellRate === -1
                          ? 'Unlimited'
                          : (getCurrentLevelConfig(itemKey)?.sellRate || 0) + '/s'
                      }}</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Next Level Available -->
            <div v-if="getNextAvailableLevel(itemKey)" class="next-level-section">
              <h4>Next Upgrade</h4>
              <div class="level-info next">
                <div class="level-details">
                  <p class="level-name">{{ getNextAvailableLevel(itemKey)?.name }}</p>
                  <p class="level-description">{{ getNextAvailableLevel(itemKey)?.description }}</p>
                  <div class="level-features">
                    <span v-if="getNextAvailableLevel(itemKey)?.features.canSell">✓ Auto-Sell</span>
                    <span v-if="getNextAvailableLevel(itemKey)?.features.canBuy">✓ Auto-Buy</span>
                    <span v-if="getNextAvailableLevel(itemKey)?.features.canSetThresholds"
                      >✓ Custom Thresholds</span
                    >
                    <span v-if="getNextAvailableLevel(itemKey)?.features.offlineWork"
                      >✓ Offline Work</span
                    >
                  </div>
                  <div class="level-stats">
                    <span
                      >Rate:
                      {{
                        getNextAvailableLevel(itemKey)?.sellRate === -1
                          ? 'Unlimited'
                          : (getNextAvailableLevel(itemKey)?.sellRate || 0) + '/s'
                      }}</span
                    >
                    <span>Required Level: {{ getNextAvailableLevel(itemKey)?.levelRequired }}</span>
                  </div>
                </div>
                <div class="upgrade-actions">
                  <div class="price-display">
                    <span
                      >${{
                        formatCompactNumber(
                          getUpgradeCost(itemKey, getNextAvailableLevel(itemKey)!.level),
                        )
                      }}</span
                    >
                  </div>
                  <button
                    class="shop-button"
                    @click.stop="
                      emitBuySalesManager(itemKey, getNextAvailableLevel(itemKey)!.level)
                    "
                    :disabled="!canUpgradeToLevel(itemKey, getNextAvailableLevel(itemKey)!.level)"
                  >
                    {{
                      canUpgradeToLevel(itemKey, getNextAvailableLevel(itemKey)!.level)
                        ? 'Upgrade'
                        : 'Locked'
                    }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Max Level Reached -->
            <div
              v-else-if="getSalesManagerLevel(itemKey) === salesManagerLevels.length"
              class="max-level-section"
            >
              <div class="max-level-badge">✓ Maximum Level Reached</div>
            </div>
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
  ItemKey,
  SalesManager,
} from '@/components/coffeequeen/types'
import {
  getAvailableUpgrades,
  getAvailableInventoryUpgrades,
  salesManagerLevels,
  getAvailableSalesManagerItems,
  getSalesManagerUpgradeCost,
} from '@/components/coffeequeen/data-upgrades'
import { machineDataList } from '@/components/coffeequeen/data-machines'
import { itemDataList } from '@/components/coffeequeen/data-items'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  userMoney: number
  userLevel: number
  upgrades: UserUpgrades
}

interface Emits {
  (e: 'buy-upgrade', upgradeId: string): void
  (e: 'buy-sales-manager', itemKey: ItemKey, level: number): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Active tab state
const activeTab = ref<'managers' | 'inventory' | 'salesManagers'>('managers')

// Sales manager expansion state
const expandedSalesManagers = ref<Set<ItemKey>>(new Set())

const toggleSalesManagerExpansion = (itemKey: ItemKey) => {
  if (expandedSalesManagers.value.has(itemKey)) {
    expandedSalesManagers.value.delete(itemKey)
  } else {
    expandedSalesManagers.value.add(itemKey)
  }
}

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

// Sales Manager functions
const availableSalesManagerItems = computed(() => {
  return getAvailableSalesManagerItems()
})

const getSalesManagerLevel = (itemKey: ItemKey): number => {
  return props.upgrades.salesManagers?.[itemKey]?.level || 0
}

const getItemName = (itemKey: ItemKey): string => {
  return itemDataList[itemKey]?.name || itemKey
}

const getItemIcon = (itemKey: ItemKey): string => {
  return itemDataList[itemKey]?.icon || ''
}

const getCurrentLevelConfig = (itemKey: ItemKey) => {
  const level = getSalesManagerLevel(itemKey)
  return salesManagerLevels.find((config) => config.level === level)
}

const getNextAvailableLevel = (itemKey: ItemKey) => {
  const currentLevel = getSalesManagerLevel(itemKey)
  return salesManagerLevels.find((config) => config.level === currentLevel + 1)
}

const canUpgradeToLevel = (itemKey: ItemKey, level: number): boolean => {
  const currentLevel = getSalesManagerLevel(itemKey)
  const cost = getUpgradeCost(itemKey, level)
  const levelConfig = salesManagerLevels.find((l) => l.level === level)

  return (
    currentLevel < level &&
    props.userMoney >= cost &&
    props.userLevel >= (levelConfig?.levelRequired || 999)
  )
}

const getUpgradeCost = (itemKey: ItemKey, targetLevel: number): number => {
  const currentLevel = getSalesManagerLevel(itemKey)
  return getSalesManagerUpgradeCost(currentLevel, targetLevel)
}

const emitBuySalesManager = (itemKey: ItemKey, level: number): void => {
  emit('buy-sales-manager', itemKey, level)
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
  align-items: flex-start;
  z-index: 200;
  font-family: 'Courier New', Courier, monospace;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: clamp(10px, 3vh, 20px);
  box-sizing: border-box;
}

.shop-modal {
  position: relative;
  padding: clamp(15px, 3vh, 20px);
  border-radius: 20px;
  width: min(600px, calc(100vw - 20px));
  max-height: 80vh;
  overflow-y: auto;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin: auto 0;

  // Custom scrollbar for modal content
  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.168);
    border-radius: 4px;
    margin-top: 5vh;
    margin-bottom: 5vh;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--coffee-border-secondary);
    border-radius: 4px;
  }
}

h2 {
  text-align: center;
  margin-top: 0;
  margin-bottom: clamp(15px, 3vh, 20px);
  color: var(--coffee-text-secondary);
  font-size: clamp(1.2rem, 4vw, 1.5rem);
}

.category-tabs {
  display: flex;
  gap: clamp(5px, 2vw, 10px);
  margin-bottom: clamp(15px, 3vh, 20px);
  justify-content: center;
  flex-wrap: wrap;
}

.tab-button {
  padding: clamp(8px, 2vw, 10px) clamp(12px, 3vw, 20px);
  border-radius: 8px;
  border: 1px solid var(--coffee-border-primary);
  background: var(--coffee-button-bg);
  color: var(--coffee-button-text);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: clamp(12px, 2.5vw, 14px);
  white-space: nowrap;
  min-height: 44px; // Touch target minimum
  padding: 10px;

  &:hover {
    background: #45a049;
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
  gap: clamp(10px, 2vh, 15px);
  margin-bottom: clamp(15px, 3vh, 20px);
}

.shop-item {
  display: flex;
  align-items: stretch;
  padding: clamp(10px, 2.5vh, 15px);
  border-radius: 8px;
  background: var(--coffee-bg-secondary);
  border: 1px solid var(--coffee-border-primary);
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }

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

  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 0;
  }
}

.upgrade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: clamp(14px, 3vw, 16px);
    color: var(--coffee-text-primary);
  }

  .level-requirement {
    font-size: clamp(10px, 2vw, 12px);
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    white-space: nowrap;
  }
}

.description {
  margin: 5px 0;
  font-size: clamp(11px, 2.2vw, 13px);
  color: var(--coffee-text-secondary);
  line-height: 1.4;
}

.machine-name {
  margin: 5px 0 0 0;
  font-size: clamp(10px, 2vw, 12px);
  font-style: italic;
  color: var(--coffee-text-primary);
  opacity: 0.8;
}

.upgrade-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: center;

  @media (max-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    min-width: auto;
    width: 100%;
  }
}

.price-display {
  font-size: clamp(12px, 2.5vw, 14px);
  font-weight: bold;
  color: var(--coffee-text-secondary);
}

.shop-button {
  padding: clamp(6px, 1.5vh, 8px) clamp(12px, 3vw, 16px);
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  font-size: clamp(11px, 2.2vw, 13px);
  background-color: #4caf50;
  color: white;
  border: 2px solid #45a049;
  transition: all 0.3s ease;
  min-height: 44px; // Touch target minimum
  white-space: nowrap;

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

// Sales Manager specific styles
.sales-manager-item {
  flex-direction: column;
  min-height: auto;
  padding: 0;

  &.has-manager {
    border-color: var(--coffee-accent-primary);
    background-color: rgba(137, 67, 40, 0.1);
  }

  &.expanded {
    border-color: var(--coffee-accent-secondary);
  }
}

.manager-row {
  display: flex;
  align-items: center;
  padding: 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 10px;
  width: 100%;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .item-icon {
    width: 40px;
    height: 40px;
    margin-right: 15px;
    border-radius: 6px;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      color: var(--coffee-text-secondary);
    }

    .level-display {
      font-size: 12px;
      color: var(--coffee-text-primary);
      opacity: 0.8;

      &::before {
        content: 'Currently: ';
        opacity: 0.7;
      }
    }
  }

  .expand-indicator {
    .arrow {
      font-size: 12px;
      color: var(--coffee-text-secondary);
      transition: transform 0.3s ease;

      &.expanded {
        transform: rotate(180deg);
      }
    }
  }
}

.expanded-content {
  padding: 15px;
  margin-top: 0;
  border-top: 1px solid var(--coffee-border-primary);
  animation: slideDown 0.3s ease-out;
  width: 100%;
}

.current-level-section,
.next-level-section {
  margin-bottom: 20px;

  h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: var(--coffee-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.level-info {
  border: 1px solid var(--coffee-border-primary);
  border-radius: 8px;
  padding: 12px;

  &.no-manager {
    background-color: rgba(158, 158, 158, 0.1);
    border-color: #9e9e9e;
  }

  &.current {
    background-color: rgba(76, 175, 80, 0.1);
    border-color: #4caf50;
  }

  &.next {
    background-color: rgba(33, 150, 243, 0.1);
    border-color: #2196f3;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .level-details {
    flex: 1;

    .level-name {
      margin: 0 0 5px 0;
      font-size: 14px;
      font-weight: bold;
      color: var(--coffee-text-secondary);
    }

    .level-description {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: var(--coffee-text-primary);
      opacity: 0.9;
    }

    .level-features {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;

      span {
        background: var(--coffee-accent-secondary);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
      }
    }

    .level-stats {
      font-size: 11px;
      color: var(--coffee-text-secondary);
      display: flex;
      gap: 15px;

      span {
        opacity: 0.8;
      }
    }
  }

  .upgrade-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 120px;

    .price-display {
      font-size: 14px;
      font-weight: bold;
      color: var(--coffee-text-secondary);
    }

    button {
      min-width: 80px;
      font-size: 12px;
      padding: 8px 16px;
    }
  }
}

.max-level-section {
  text-align: center;

  .max-level-badge {
    background: linear-gradient(135deg, #ffd700, #ffa500);
    color: #333;
    padding: 12px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    display: inline-block;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}

.current-level {
  background: var(--coffee-accent-primary);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.manager-levels {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 15px;
}

.level-option {
  border: 1px solid var(--coffee-border-primary);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;

  &.owned {
    background-color: rgba(76, 175, 80, 0.1);
    border-color: #4caf50;
  }

  &.available {
    background-color: rgba(33, 150, 243, 0.1);
    border-color: #2196f3;
    cursor: pointer;

    &:hover {
      background-color: rgba(33, 150, 243, 0.2);
    }
  }

  &.locked {
    background-color: rgba(158, 158, 158, 0.1);
    border-color: #9e9e9e;
    opacity: 0.6;
  }
}

.level-info {
  flex: 1;

  h4 {
    margin: 0 0 5px 0;
    color: var(--coffee-text-secondary);
    font-size: 14px;
  }

  .level-description {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--coffee-text-primary);
    opacity: 0.9;
  }

  .level-features {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 5px;

    span {
      background: var(--coffee-accent-secondary);
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
    }
  }

  .level-stats {
    font-size: 11px;
    color: var(--coffee-text-secondary);
    display: flex;
    gap: 15px;

    span {
      opacity: 0.8;
    }
  }
}

.level-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 100px;

  .owned-badge {
    background: #4caf50;
    color: white;
    padding: 6px 12px;
    border-radius: 15px;
    font-size: 11px;
    font-weight: bold;
  }

  button {
    min-width: 80px;
    font-size: 11px;
    padding: 6px 12px;
  }
}

.top-close-button {
  position: absolute;
  top: 10px;
  right: 20px;
  background: none;
  border: none;
  color: var(--coffee-text-primary);
  font-size: clamp(1.5rem, 4vw, 2rem);
  cursor: pointer;
  padding: 0;
  width: clamp(25px, 6vw, 30px);
  height: clamp(25px, 6vw, 30px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.close-button {
  display: block;
  margin: clamp(15px, 3vh, 20px) auto 0;
  background-color: #f44336;
  border-color: #d32f2f;
  width: 100%;
  max-width: 200px;
  padding: clamp(10px, 2vh, 12px) clamp(16px, 4vw, 24px);

  &:hover:not(:disabled) {
    background-color: #d32f2f;
  }
}

// Mobile-specific adjustments
@media (max-width: 768px) {
  .shop-modal-overlay {
    align-items: flex-start;
    padding: 10px;
  }

  .shop-modal {
    max-width: 90vw;
  }

  .category-tabs {
    gap: 5px;

    .tab-button {
      flex: 1 1;
      max-width: 200px;
      font-size: 12px;
      padding: 8px 4px;
    }
  }

  .manager-row {
    padding: 12px;

    .item-icon {
      width: 32px;
      height: 32px;
      margin-right: 12px;
    }
  }

  .level-info {
    &.next {
      flex-direction: column;
      gap: 12px;
    }
  }

  .level-actions {
    min-width: auto;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .shop-modal {
    padding: 12px;
    border-radius: 10px;
  }

  h2 {
    font-size: 1.2rem;
  }

  .upgrade-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .category-tabs .tab-button {
    font-size: 11px;
    padding: 6px 3px;
  }
}
</style>
