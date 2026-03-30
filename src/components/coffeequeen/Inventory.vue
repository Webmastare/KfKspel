<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Inventory</h2>
      <button class="top-close-button" @click="emitClose">×</button>

      <div class="multi-action">
        <p>Buy/Sell</p>
        <div class="multi-action-controls">
          <button @click="changeMultiAction">
            {{ getMultiActionDisplay() }}
          </button>
          <input
            v-if="props.multiAction === 'Custom%'"
            v-model.number="localPercentage"
            @input="updateCustomPercentage"
            type="number"
            min="1"
            max="100"
            class="percentage-input"
            placeholder="25"
          />
        </div>
      </div>
      <div class="shop-items">
        <div v-for="(item, key) in inventory" :key="key" class="shop-item">
          <img :src="item.icon" :alt="item.name" class="item-icon" />
          <div class="item-details">
            <h3>{{ item.name }}</h3>
            <p>
              Amount: {{ item.amount }}/{{ item.capacity }} || Buy: ${{
                formatCompactNumber(item.cost)
              }}
              | Sell: ${{ formatCompactNumber(getSellPrice(item)) }}
            </p>

            <!-- Manager Status Indicator -->
            <div v-if="hasManager(key)" class="manager-status">
              Manager L{{ getManagerLevel(key) }}
              <button
                @click="showManagerStats(key)"
                class="stats-button"
                title="View manager statistics"
              >
                📊
              </button>
            </div>

            <!-- Manager Settings (only shown if manager is owned) -->
            <div v-if="hasManager(key)" class="manager-settings">
              <div class="thresholds-row">
                <!-- Sell Threshold (always shown for level 1+, editable for level 2+) -->
                <div class="threshold-group">
                  <button
                    class="threshold-toggle"
                    :class="{
                      disabled: !canAdjustSellThreshold(key),
                      active: getSellEnabled(key),
                    }"
                    :disabled="!canAdjustSellThreshold(key)"
                    @click="toggleSellEnabled(key)"
                    :title="canAdjustSellThreshold(key) ? 'Toggle auto-sell' : 'Level 2+ required'"
                  >
                    Sell:
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    :value="getPendingSellThreshold(key) || ''"
                    :disabled="!canAdjustSellThreshold(key)"
                    :class="{ disabled: !canAdjustSellThreshold(key) }"
                    @input="
                      (e) => updatePendingSellThreshold(key, (e.target as HTMLInputElement).value)
                    "
                    @blur="(e) => validateSellThresholdInput(key, e)"
                    class="threshold-input"
                    placeholder="80"
                  />%
                  <span v-if="!canAdjustSellThreshold(key)" class="setting-note">(L2+)</span>
                </div>

                <!-- Buy Threshold (only shown for level 3+) -->
                <div v-if="getManagerLevel(key) >= 3" class="threshold-group">
                  <button
                    class="threshold-toggle"
                    :class="{
                      active: getBuyEnabled(key),
                    }"
                    @click="toggleBuyEnabled(key)"
                    title="Toggle auto-buy"
                  >
                    Buy:
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="1"
                    :value="getPendingBuyThreshold(key) || ''"
                    :disabled="!canAdjustBuyThreshold(key)"
                    @input="
                      (e) => updatePendingBuyThreshold(key, (e.target as HTMLInputElement).value)
                    "
                    @blur="(e) => validateBuyThresholdInput(key, e)"
                    class="threshold-input"
                    placeholder="10"
                  />%
                </div>
              </div>

              <!-- Save Button (only show if there are pending changes) -->
              <button
                v-if="hasPendingChanges(key)"
                @click="saveManagerSettings(key)"
                class="save-settings-btn"
              >
                Save Settings
              </button>
            </div>

            <div class="item-actions">
              <div class="action-group">
                <button @click="emitBuy(key)" :disabled="!canAffordQuantity(key)">
                  Buy {{ getBuyQuantity(key) }}x
                </button>
                <p class="price-display">Cost: ${{ formatCompactNumber(getBuyPrice(key)) }}</p>
              </div>
              <div class="action-group">
                <button @click="emitSell(key)" :disabled="!canSellQuantity(key)">
                  Sell {{ getSellQuantity(key) }}x
                </button>
                <p class="price-display">Value: ${{ formatCompactNumber(getSellValue(key)) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button class="close-button" @click="emitClose">Close</button>
    </div>

    <!-- Manager Statistics Modal -->
    <ManagerStats
      v-if="showStatsFor && getManagerForItem(showStatsFor) && itemData"
      :sales-manager="getManagerForItem(showStatsFor)!"
      :item-data="itemData"
      @close="showStatsFor = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  InventoryItem,
  MultiActionValue,
  SalesManager,
  ItemKey,
  ItemData,
} from '@/components/coffeequeen/types'
import ManagerStats from './ManagerStats.vue'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  inventory: Record<string, InventoryItem>
  userMoney: number
  multiAction: MultiActionValue
  customPercentage: number
  salesManagers?: Record<string, SalesManager> | null
  itemData: Record<string, ItemData>
}

interface Emits {
  (e: 'buy-item', payload: { itemKey: string; quantity: number }): void
  (e: 'sell-item', payload: { itemKey: string; quantity: number }): void
  (e: 'close'): void
  (e: 'update-multi-action', value: MultiActionValue): void
  (e: 'update-custom-percentage', value: number): void
  (e: 'update-manager-settings', payload: { itemKey: string; settings: any }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Create local custom percentage state since props is read-only
const localPercentage = ref(props.customPercentage /* initial */)

// Manager stats modal state
const showStatsFor = ref<string | null>(null)

// Manager settings pending changes
const pendingManagerSettings = ref<
  Record<
    string,
    {
      sellThreshold: number | null
      buyThreshold: number | null
      autoSellEnabled?: boolean
      autoBuyEnabled?: boolean
    }
  >
>({})

watch(
  () => props.customPercentage,
  (v) => {
    localPercentage.value = v
  },
)

// Helper functions for calculating quantities and prices
const getBuyQuantity = (key: string): number => {
  const item = props.inventory[key]
  if (!item) return 0

  const maxAffordable = Math.floor(props.userMoney / item.cost)
  const availableCapacity = item.capacity - item.amount
  const maxPossible = Math.min(maxAffordable, availableCapacity)

  if (props.multiAction === 'Max') {
    return maxPossible
  } else if (props.multiAction === '10%') {
    return Math.floor(maxPossible * 0.1)
  } else if (props.multiAction === '50%') {
    return Math.floor(maxPossible * 0.5)
  } else if (props.multiAction === 'Custom%') {
    return Math.floor(maxPossible * (props.customPercentage / 100))
  }
  return Math.min(props.multiAction as number, maxPossible)
}

const getSellQuantity = (key: string): number => {
  const item = props.inventory[key]
  if (!item) return 0

  const available = item.amount

  if (props.multiAction === 'Max') {
    return available
  } else if (props.multiAction === '10%') {
    return Math.floor(available * 0.1)
  } else if (props.multiAction === '50%') {
    return Math.floor(available * 0.5)
  } else if (props.multiAction === 'Custom%') {
    return Math.floor(available * (props.customPercentage / 100))
  }
  return Math.min(props.multiAction as number, available)
}

const getBuyPrice = (key: string): number => {
  const item = props.inventory[key]
  if (!item) return 0

  return Math.round(getBuyQuantity(key) * item.cost * 100) / 100
}

const getSellPrice = (item: InventoryItem): number => {
  if (item.sellMultiplier) {
    return item.cost * item.sellMultiplier
  }
  return item.cost * 0.8 // Fallback to 80% if no sellMultiplier
}

const getSellValue = (key: string): number => {
  const item = props.inventory[key]
  if (!item) return 0

  const sellPrice = item.sellMultiplier ? item.cost * item.sellMultiplier : item.cost * 0.8
  return Math.round(getSellQuantity(key) * sellPrice * 100) / 100
}

const canAffordQuantity = (key: string): boolean => {
  const item = props.inventory[key]
  if (!item) return false

  const quantity = getBuyQuantity(key)
  return quantity > 0 && props.userMoney >= quantity * item.cost
}

const canSellQuantity = (key: string): boolean => {
  const item = props.inventory[key]
  return !!(item && item.amount > 0)
}

const multiActionOptions: MultiActionValue[] = [1, 10, '10%', '50%', 'Max'] // Removed 'Custom%' for now

const getMultiActionDisplay = (): string => {
  if (props.multiAction === 'Max') return 'Max'
  if (props.multiAction === '10%') return '10%'
  if (props.multiAction === '50%') return '50%'
  if (props.multiAction === 'Custom%') return `${props.customPercentage}%`
  return `${props.multiAction}x`
}

const changeMultiAction = (): void => {
  const currentIndex = multiActionOptions.indexOf(props.multiAction)
  const nextValue = multiActionOptions[currentIndex + 1] || multiActionOptions[0]
  emit('update-multi-action', nextValue as MultiActionValue)
  console.log(`Multi-action set to: ${nextValue}`)
}

const updateCustomPercentage = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const value = Math.max(1, Math.min(100, parseInt(target.value) || 25))
  emit('update-custom-percentage', value)
}

const emitBuy = (key: string): void => {
  const quantity = getBuyQuantity(key)
  if (canAffordQuantity(key)) {
    emit('buy-item', { itemKey: key, quantity })
  }
}

const emitSell = (key: string): void => {
  const quantity = getSellQuantity(key)
  if (canSellQuantity(key)) {
    emit('sell-item', { itemKey: key, quantity })
  }
}

const emitClose = (): void => {
  emit('close')
}

// Manager-related helper functions
const getManagerForItem = (itemKey: string): SalesManager | null => {
  return props.salesManagers?.[itemKey] || null
}

const hasManager = (itemKey: string): boolean => {
  const manager = getManagerForItem(itemKey)
  return manager ? manager.level > 0 : false
}

const getManagerLevel = (itemKey: string): number => {
  const manager = getManagerForItem(itemKey)
  return manager?.level || 0
}

const showManagerStats = (itemKey: string): void => {
  showStatsFor.value = itemKey
}

const canAdjustSellThreshold = (itemKey: string): boolean => {
  return getManagerLevel(itemKey) >= 2
}

const canAdjustBuyThreshold = (itemKey: string): boolean => {
  return getManagerLevel(itemKey) >= 3
}

const updateManagerSetting = (itemKey: string, settingKey: string, value: number): void => {
  const manager = getManagerForItem(itemKey)
  if (manager) {
    const newSettings = { ...manager.settings, [settingKey]: value }
    emit('update-manager-settings', { itemKey, settings: newSettings })
  }
}

// Pending manager settings functions
const initializePendingSettings = (itemKey: string): void => {
  if (!pendingManagerSettings.value[itemKey]) {
    const manager = getManagerForItem(itemKey)
    pendingManagerSettings.value[itemKey] = {
      sellThreshold: manager?.settings.sellThreshold || 80,
      buyThreshold: manager?.settings.buyThreshold || 10,
      autoSellEnabled: manager?.settings.autoSellEnabled ?? true,
      autoBuyEnabled: manager?.settings.autoBuyEnabled ?? false,
    }
  }
}

const getPendingSellThreshold = (itemKey: string): number | null => {
  initializePendingSettings(itemKey)
  return pendingManagerSettings.value[itemKey]!.sellThreshold
}

const getPendingBuyThreshold = (itemKey: string): number | null => {
  initializePendingSettings(itemKey)
  return pendingManagerSettings.value[itemKey]!.buyThreshold
}

const getSellEnabled = (itemKey: string): boolean => {
  initializePendingSettings(itemKey)
  return pendingManagerSettings.value[itemKey]!.autoSellEnabled ?? true
}

const getBuyEnabled = (itemKey: string): boolean => {
  initializePendingSettings(itemKey)
  return pendingManagerSettings.value[itemKey]!.autoBuyEnabled ?? false
}

const updatePendingSellThreshold = (itemKey: string, value: string): void => {
  initializePendingSettings(itemKey)
  const numValue = value === '' ? null : Number(value)
  pendingManagerSettings.value[itemKey]!.sellThreshold =
    numValue === null || isNaN(numValue) ? null : Math.max(0, Math.min(100, numValue))
}

const updatePendingBuyThreshold = (itemKey: string, value: string): void => {
  initializePendingSettings(itemKey)
  const numValue = value === '' ? null : Number(value)
  pendingManagerSettings.value[itemKey]!.buyThreshold =
    numValue === null || isNaN(numValue) ? null : Math.max(0, Math.min(90, numValue))
}

const validateSellThresholdInput = (itemKey: string, event: FocusEvent): void => {
  const input = event.target as HTMLInputElement
  if (input.value === '') {
    pendingManagerSettings.value[itemKey]!.sellThreshold = null
  } else {
    const value = Number(input.value)
    if (!isNaN(value)) {
      pendingManagerSettings.value[itemKey]!.sellThreshold = Math.max(0, Math.min(100, value))
    }
  }
}

const validateBuyThresholdInput = (itemKey: string, event: FocusEvent): void => {
  const input = event.target as HTMLInputElement
  if (input.value === '') {
    pendingManagerSettings.value[itemKey]!.buyThreshold = null
  } else {
    const value = Number(input.value)
    if (!isNaN(value)) {
      pendingManagerSettings.value[itemKey]!.buyThreshold = Math.max(0, Math.min(90, value))
    }
  }
}

const toggleSellEnabled = (itemKey: string): void => {
  if (!canAdjustSellThreshold(itemKey)) return
  initializePendingSettings(itemKey)
  pendingManagerSettings.value[itemKey]!.autoSellEnabled =
    !pendingManagerSettings.value[itemKey]!.autoSellEnabled
}

const toggleBuyEnabled = (itemKey: string): void => {
  initializePendingSettings(itemKey)
  pendingManagerSettings.value[itemKey]!.autoBuyEnabled =
    !pendingManagerSettings.value[itemKey]!.autoBuyEnabled
}

const hasPendingChanges = (itemKey: string): boolean => {
  const manager = getManagerForItem(itemKey)
  if (!manager || !pendingManagerSettings.value[itemKey]) return false

  const pending = pendingManagerSettings.value[itemKey]!
  const currentSell = manager.settings.sellThreshold || 80
  const currentBuy = manager.settings.buyThreshold || 10
  const currentAutoSell = manager.settings.autoSellEnabled ?? true
  const currentAutoBuy = manager.settings.autoBuyEnabled ?? false

  return (
    (pending.sellThreshold !== null && pending.sellThreshold !== currentSell) ||
    (pending.buyThreshold !== null && pending.buyThreshold !== currentBuy) ||
    pending.autoSellEnabled !== currentAutoSell ||
    pending.autoBuyEnabled !== currentAutoBuy
  )
}

const validateAndAdjustThresholds = (
  sellThreshold: number | null,
  buyThreshold: number | null,
): { sellThreshold: number; buyThreshold: number } => {
  // Use defaults if null
  let adjustedSell = sellThreshold ?? 80
  let adjustedBuy = buyThreshold ?? 10

  // Clamp values to valid ranges
  adjustedSell = Math.max(0, Math.min(100, adjustedSell))
  adjustedBuy = Math.max(0, Math.min(90, adjustedBuy))

  // Ensure sell threshold is higher than buy threshold (with at least 1% gap)
  if (adjustedSell <= adjustedBuy) {
    // If sell is too low, try to increase it
    if (adjustedBuy <= 100) {
      adjustedSell = adjustedBuy + 1
    } else {
      // If we can't increase sell, decrease buy
      adjustedBuy = Math.max(0, adjustedSell)
    }
  }

  return { sellThreshold: adjustedSell, buyThreshold: adjustedBuy }
}

const saveManagerSettings = (itemKey: string): void => {
  const manager = getManagerForItem(itemKey)
  if (!manager || !pendingManagerSettings.value[itemKey]) return

  const pending = pendingManagerSettings.value[itemKey]!
  const validated = validateAndAdjustThresholds(pending.sellThreshold, pending.buyThreshold)

  // Update the pending values with validated ones (in case they were adjusted)
  pendingManagerSettings.value[itemKey]! = {
    ...pending,
    sellThreshold: validated.sellThreshold,
    buyThreshold: validated.buyThreshold,
  }

  // Build new settings object
  const newSettings = { ...manager.settings }

  // Always save enable/disable states regardless of level
  if (pending.autoSellEnabled !== undefined) {
    newSettings.autoSellEnabled = pending.autoSellEnabled
  }
  if (pending.autoBuyEnabled !== undefined) {
    newSettings.autoBuyEnabled = pending.autoBuyEnabled
  }

  // Only save threshold settings that the manager level allows
  if (canAdjustSellThreshold(itemKey)) {
    newSettings.sellThreshold = validated.sellThreshold
  }

  if (canAdjustBuyThreshold(itemKey)) {
    newSettings.buyThreshold = validated.buyThreshold
  }

  emit('update-manager-settings', { itemKey, settings: newSettings })

  // Clear pending changes after successful save
  delete pendingManagerSettings.value[itemKey]
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
  border-radius: 10px;
  width: min(500px, calc(100vw - 20px));
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

.multi-action {
  /*position: absolute;
  top: clamp(15px, 3vh, 20px);
  left: clamp(15px, 3vh, 20px);*/
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 5px;
  text-align: center;
  z-index: 10;

  p {
    margin: 0;
    font-size: clamp(12px, 2.5vw, 14px);
    font-weight: bold;
  }

  .multi-action-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  button {
    padding: clamp(4px, 1vh, 6px) clamp(8px, 2vw, 10px);
    background-color: #bb5705;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
    min-width: 60px;
    min-height: 32px;
    font-size: clamp(11px, 2vw, 13px);

    &:hover {
      background-color: rgb(208, 114, 56);
    }
  }

  .percentage-input {
    width: clamp(45px, 10vw, 60px);
    padding: 4px;
    border: 2px solid #bb5705;
    border-radius: 4px;
    text-align: center;
    font-family: inherit;
    font-size: clamp(11px, 2vw, 12px);
    color: var(--coffee-text-primary);
    min-height: 24px;

    &:focus {
      outline: none;
      border-color: rgb(208, 114, 56);
    }

    /* Hide spinner arrows */
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &[type='number'] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
  }
}

h2 {
  text-align: center;
  margin-top: 0;
  font-size: clamp(1.2rem, 4vw, 1.5rem);
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2vh, 15px);
}

.shop-item {
  display: flex;
  align-items: flex-start;
  padding: clamp(8px, 2vh, 12px);
  border-radius: 8px;
  background: var(--coffee-bg-secondary);
  color: var(--coffee-text-primary);
  gap: clamp(8px, 2vw, 15px);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.item-icon {
  width: clamp(50px, 8vw, 60px);
  height: clamp(50px, 8vw, 60px);
  flex-shrink: 0;

  @media (max-width: 768px) {
    align-self: center;
  }
}

.item-details {
  flex-grow: 1;
  min-width: 0;

  h3 {
    margin: 0 0 -5px 0;
    font-size: clamp(14px, 3vw, 16px);
  }
  p {
    padding: 0;
    margin: 0 0 5px 0;
    font-size: clamp(10px, 2.2vw, 12px);
    word-break: break-word;
  }
}

.item-actions {
  display: flex;
  gap: clamp(8px, 2vw, 15px);
  flex-wrap: wrap;
  align-items: center;

  @media (max-width: 768px) {
    justify-content: center;
    width: 100%;
  }
}

.action-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.price-display {
  font-size: clamp(10px, 2vw, 12px);
  margin: 0;
  color: #f0f0f0;
  font-weight: bold;
}

button {
  padding: clamp(4px, 1vh, 6px) clamp(8px, 2vw, 12px);
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  background-color: #4caf50;
  color: white;
  border: 2px solid #45a049;
  min-height: 36px;
  font-size: clamp(11px, 2.2vw, 13px);
  white-space: nowrap;

  &:hover {
    background-color: #45a049;
  }

  &:active {
    background-color: #3d8b40;
  }

  &:disabled {
    background-color: #a0a0a0;
    border-color: #666;
    cursor: not-allowed;
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

  &:hover {
    background-color: #d32f2f;
  }
}

// Manager UI Styles
.manager-status {
  margin-top: 4px;
  font-size: clamp(0.7rem, 2vw, 0.8rem);
  color: #4caf50;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .stats-button {
    background: none;
    border: 1px solid rgba(76, 175, 80, 0.4);
    color: #4caf50;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: clamp(0.6rem, 1.5vw, 0.7rem);
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.8;
    min-height: 28px;

    &:hover {
      opacity: 1;
      background-color: rgba(76, 175, 80, 0.1);
      transform: translateY(-1px);
    }
  }
}

.manager-settings {
  margin-top: 6px;
  padding: clamp(4px, 1vh, 6px) clamp(6px, 1.5vw, 8px);
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border: 1px solid rgba(76, 175, 80, 0.2);

  .thresholds-row {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    margin-bottom: 6px;
    flex-wrap: wrap;

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
  }

  .threshold-group {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: clamp(0.75rem, 2vw, 0.85rem);

    @media (max-width: 480px) {
      justify-content: space-between;
    }

    .threshold-toggle {
      background-color: rgba(255, 255, 255, 0.1);
      color: var(--coffee-text-secondary);
      border: 1px solid var(--coffee-border-primary);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: clamp(0.7rem, 1.8vw, 0.8rem);
      cursor: pointer;
      transition: all 0.2s;
      min-width: 40px;
      min-height: 28px;

      &.active {
        background-color: rgba(76, 175, 80, 0.3);
        color: #4caf50;
        border-color: #4caf50;
      }

      &.disabled {
        background-color: rgba(255, 255, 255, 0.05);
        color: var(--coffee-text-secondary);
        cursor: not-allowed;
        opacity: 0.7;
      }

      &:hover:not(.disabled) {
        background-color: rgba(255, 255, 255, 0.15);
      }

      &:active:not(.disabled) {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }

    .threshold-input {
      width: clamp(35px, 8vw, 45px);
      padding: 2px 4px;
      border-radius: 3px;
      border: 1px solid var(--coffee-border-primary);
      background-color: var(--coffee-bg-card);
      color: var(--coffee-text-primary);
      font-size: clamp(0.7rem, 1.8vw, 0.8rem);
      text-align: center;
      min-height: 24px;

      &::placeholder {
        color: var(--coffee-text-secondary);
        opacity: 0.6;
      }

      &:focus {
        outline: none;
        border-color: #4caf50;
        box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.3);
      }

      &.disabled {
        background-color: rgba(255, 255, 255, 0.05);
        color: var(--coffee-text-secondary);
        cursor: not-allowed;
        opacity: 0.7;
      }
    }

    .setting-note {
      font-size: clamp(0.6rem, 1.5vw, 0.7rem);
      color: var(--coffee-text-secondary);
      font-style: italic;
      margin-left: 4px;
    }
  }

  .save-settings-btn {
    background-color: #4caf50;
    color: white;
    border: 1px solid #45a049;
    border-radius: 4px;
    padding: clamp(3px, 1vh, 6px) clamp(6px, 1.5vw, 8px);
    font-size: clamp(0.7rem, 1.8vw, 0.8rem);
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
    min-height: 32px;

    &:hover {
      background-color: #45a049;
    }

    &:active {
      background-color: #3d8b40;
    }
  }
}
</style>
