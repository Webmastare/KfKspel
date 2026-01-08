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
import type { InventoryItem, MultiActionValue } from '@/components/coffeequeen/types'

interface Props {
  inventory: Record<string, InventoryItem>
  userMoney: number
  multiAction: MultiActionValue
  customPercentage: number
}

interface Emits {
  (e: 'buy-item', payload: { itemKey: string; quantity: number }): void
  (e: 'sell-item', payload: { itemKey: string; quantity: number }): void
  (e: 'close'): void
  (e: 'update-multi-action', value: MultiActionValue): void
  (e: 'update-custom-percentage', value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Create local custom percentage state since props is read-only
const localPercentage = ref(props.customPercentage /* initial */)

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
</style>
