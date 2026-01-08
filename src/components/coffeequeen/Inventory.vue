<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Inventory</h2>
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
              Amount: {{ item.amount }}/{{ item.capacity }} || Buy: ${{ item.cost.toFixed(2) }} |
              Sell: ${{ getSellPrice(item) }}
            </p>

            <!-- Manager Status Indicator -->
            <div v-if="hasManager(key)" class="manager-status">
              Manager L{{ getManagerLevel(key) }}
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
                <p class="price-display">Cost: ${{ getBuyPrice(key).toFixed(2) }}</p>
              </div>
              <div class="action-group">
                <button @click="emitSell(key)" :disabled="!canSellQuantity(key)">
                  Sell {{ getSellQuantity(key) }}x
                </button>
                <p class="price-display">Value: ${{ getSellValue(key).toFixed(2) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  InventoryItem,
  MultiActionValue,
  SalesManager,
  ItemKey,
} from '@/components/coffeequeen/types'

interface Props {
  inventory: Record<string, InventoryItem>
  userMoney: number
  multiAction: MultiActionValue
  customPercentage: number
  salesManagers?: Record<string, SalesManager> | null
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

const getSellPrice = (item: InventoryItem): string => {
  if (item.sellMultiplier) {
    return (item.cost * item.sellMultiplier).toFixed(2)
  }
  return (item.cost * 0.8).toFixed(2) // Fallback to 80% if no sellMultiplier
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

const multiActionOptions: MultiActionValue[] = [1, 10, '10%', 'Custom%', 'Max']

const getMultiActionDisplay = (): string => {
  if (props.multiAction === 'Max') return 'Max'
  if (props.multiAction === '10%') return '10%'
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
  align-items: center;
  z-index: 200;
  font-family: 'Courier New', Courier, monospace;
  background: rgba(0, 0, 0, 0.7);
}

.shop-modal {
  position: relative;
  padding: 20px;
  border-radius: 10px;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.multi-action {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  text-align: center;

  p {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
  }

  .multi-action-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    padding: 5px 10px;
    background-color: #bb5705;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
    min-width: 60px;

    &:hover {
      background-color: rgb(208, 114, 56);
    }
  }

  .percentage-input {
    width: 50px;
    padding: 4px;
    border: 2px solid #bb5705;
    border-radius: 4px;
    text-align: center;
    font-family: inherit;
    font-size: 12px;
    color: var(--coffee-text-primary);

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
  margin-bottom: 20px;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.shop-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: var(--coffee-bg-secondary);
  color: var(--coffee-text-primary);
}

.item-icon {
  width: 60px;
  height: 60px;
  margin-right: 15px;
}

.item-details {
  flex-grow: 1;

  h3 {
    margin: 0 0 -5px 0;
  }
  p {
    padding: 0;
    margin: 0 0 5px 0;
    font-size: 12px;
  }
}

.item-actions {
  display: flex;
  gap: 15px;
}

.action-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.price-display {
  font-size: 12px;
  margin: 0;
  color: #f0f0f0;
  font-weight: bold;
}

button {
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  background-color: #4caf50;
  color: white;
  border: 2px solid #45a049;

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

.close-button {
  display: block;
  margin: 20px auto 0;
  background-color: #f44336;
  border-color: #d32f2f;

  &:hover {
    background-color: #d32f2f;
  }
}

// Manager UI Styles
.manager-status {
  margin-top: 4px;
  font-size: 0.8rem;
  color: #4caf50;
  font-weight: 600;
}

.manager-settings {
  margin-top: 6px;
  padding: 6px 8px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border: 1px solid rgba(76, 175, 80, 0.2);

  .thresholds-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }

  .threshold-group {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;

    .threshold-toggle {
      background-color: rgba(255, 255, 255, 0.1);
      color: var(--coffee-text-secondary);
      border: 1px solid var(--coffee-border-primary);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 40px;

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
      width: 45px;
      padding: 2px 4px;
      border-radius: 3px;
      border: 1px solid var(--coffee-border-primary);
      background-color: var(--coffee-bg-card);
      color: var(--coffee-text-primary);
      font-size: 0.8rem;
      text-align: center;

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
      font-size: 0.7rem;
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
    padding: 3px 8px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;

    &:hover {
      background-color: #45a049;
    }

    &:active {
      background-color: #3d8b40;
    }
  }
}
</style>
