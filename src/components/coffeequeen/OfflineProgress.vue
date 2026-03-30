<template>
  <div class="offline-progress-overlay" @click.self="$emit('close')">
    <div class="offline-progress-modal">
      <h2>Welcome Back!</h2>
      <p>You were away for {{ formatTime(offlineTime) }}.</p>
      <p>While you were away, your machines produced:</p>
      <div v-if="Object.keys(summary).length > 0" class="production-summary">
        <ul>
          <li v-for="(item, key) in detailedSummary" :key="key" class="production-item">
            <img :src="item.icon" :alt="item.name" class="item-icon" />
            <div class="item-production">
              <div
                class="item-main"
                @click="toggleExpanded(key as string)"
                :class="{ expandable: hasBreakdown(item) }"
              >
                <span class="item-info"> {{ item.name }}: {{ formatNetChange(item) }} </span>
                <span
                  v-if="hasBreakdown(item)"
                  class="expand-arrow"
                  :class="{ expanded: expandedItems.has(key as string) }"
                >
                  ▼
                </span>
              </div>

              <!-- Expandable breakdown section -->
              <div
                v-if="expandedItems.has(key as string) && hasBreakdown(item)"
                class="breakdown-section"
              >
                <!-- Production Section -->
                <div v-if="hasProduction(item)" class="breakdown-group">
                  <div class="breakdown-divider">Production</div>
                  <div v-if="getBaseProduction(item) > 0" class="breakdown-item production">
                    <span class="breakdown-label">Produced:</span>
                    <span class="breakdown-value"
                      >+{{ getBaseProduction(item).toLocaleString() }}</span
                    >
                  </div>
                  <div v-if="item.bonusAmount > 0" class="breakdown-item bonus">
                    <span class="breakdown-label">Bonus:</span>
                    <span class="breakdown-value">+{{ item.bonusAmount.toLocaleString() }}</span>
                  </div>
                  <div v-if="getTotalProduction(item) > 0" class="breakdown-item production-total">
                    <span class="breakdown-label">Total Items:</span>
                    <span class="breakdown-value"
                      >+{{ getTotalProduction(item).toLocaleString() }}</span
                    >
                  </div>
                </div>

                <!-- Manager Section -->
                <div v-if="hasManagerActivity(item)" class="breakdown-group">
                  <div class="breakdown-divider">Sales Manager</div>
                  <div
                    v-if="item.itemsBought && item.itemsBought > 0"
                    class="breakdown-item bought"
                  >
                    <span class="breakdown-label">Bought by Manager:</span>
                    <span class="breakdown-value"
                      >+{{ item.itemsBought.toLocaleString() }} ({{
                        formatMoney(item.itemsBought * getItemBuyPrice(key as string))
                      }})</span
                    >
                  </div>
                  <div v-if="item.itemsSold && item.itemsSold > 0" class="breakdown-item sold">
                    <span class="breakdown-label">Sold by Manager:</span>
                    <span class="breakdown-value"
                      >-{{ item.itemsSold.toLocaleString() }} ({{
                        formatMoney(item.itemsSold * getItemSellPrice(key as string))
                      }})</span
                    >
                  </div>
                  <div class="breakdown-item net">
                    <span class="breakdown-label">Net Manager Activity:</span>
                    <span class="breakdown-value" :class="getManagerNetClass(item)">{{
                      formatManagerNet(item, key as string)
                    }}</span>
                  </div>
                </div>

                <!-- Capacity Loss Section -->
                <div
                  v-if="item.itemsLostToCapacity && item.itemsLostToCapacity > 0"
                  class="breakdown-group"
                >
                  <div class="breakdown-divider">Capacity Issues</div>
                  <div class="breakdown-item lost">
                    <span class="breakdown-label">Lost to Capacity:</span>
                    <span class="breakdown-value"
                      >{{ item.itemsLostToCapacity.toLocaleString() }} items</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div v-else>
        <p>No new items were produced while you were away.</p>
      </div>
      <p>
        You gained <strong>{{ experience.toLocaleString() }}</strong> experience!
      </p>
      <div v-if="totalMoneyChange !== 0" class="money-summary">
        <p class="money-change" :class="totalMoneyChange > 0 ? 'positive' : 'negative'">
          Sales Manager Total: <strong>{{ formatMoneyChange(totalMoneyChange) }}</strong>
        </p>
      </div>
      <button @click="$emit('close')">Got it!</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { OfflineProductionSummary, ItemData, ItemKey } from '@/components/coffeequeen/types'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  offlineTime: number
  summary: OfflineProductionSummary
  experience: number
  itemData: Record<ItemKey, ItemData>
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Reactive state for tracking expanded items
const expandedItems = ref<Set<string>>(new Set())

// Function to toggle item expansion
const toggleExpanded = (key: string) => {
  if (expandedItems.value.has(key)) {
    expandedItems.value.delete(key)
  } else {
    expandedItems.value.add(key)
  }
}

// Function to check if an item has breakdown details
const hasBreakdown = (item: any) => {
  return (
    hasProduction(item) ||
    hasManagerActivity(item) ||
    (item.itemsLostToCapacity && item.itemsLostToCapacity > 0)
  )
}

// Function to check if item has sales manager activity
const hasManagerActivity = (item: any) => {
  return (item.itemsSold && item.itemsSold > 0) || (item.itemsBought && item.itemsBought > 0)
}

// Function to check if item has production activity
const hasProduction = (item: any) => {
  return (item.amount && item.amount > 0) || (item.bonusAmount && item.bonusAmount > 0)
}

// Function to get base production (excluding bonus)
const getBaseProduction = (item: any) => {
  return (item.amount || 0) - (item.bonusAmount || 0)
}

// Function to get total production (including bonus)
const getTotalProduction = (item: any) => {
  return item.amount || 0
}

// Function to format net inventory change
const formatNetChange = (item: any) => {
  const produced = item.amount || 0
  const bonus = item.bonusAmount || 0
  const sold = item.itemsSold || 0
  const bought = item.itemsBought || 0

  const netChange = produced + bought - sold

  if (netChange > 0) {
    return `+${netChange.toLocaleString()}`
  } else if (netChange < 0) {
    return `${netChange.toLocaleString()}`
  } else {
    return '±0'
  }
}

// Function to format money values
const formatMoney = (amount: number) => {
  return `$${formatCompactNumber(amount)}`
}

// Function to format money change with sign
const formatMoneyChange = (amount: number) => {
  if (amount > 0) {
    return `+${formatMoney(amount)}`
  } else {
    return formatMoney(amount)
  }
}

// Computed property for total money change from sales managers
const totalMoneyChange = computed(() => {
  let total = 0

  for (const key in props.summary) {
    const item = props.summary[key]
    if (item) {
      const sold = item.itemsSold || 0
      const bought = item.itemsBought || 0

      const earnedFromSales = sold * getItemSellPrice(key)
      const spentOnPurchases = bought * getItemBuyPrice(key)

      total += earnedFromSales - spentOnPurchases
    }
  }

  return total
})

// Function to get item sell price
const getItemSellPrice = (itemKey: string) => {
  const item = props.itemData[itemKey as ItemKey]
  return item ? item.basePrice * item.sellMultiplier : 0
}

// Function to get item buy price
const getItemBuyPrice = (itemKey: string) => {
  const item = props.itemData[itemKey as ItemKey]
  return item ? item.cost : 0
}

// Function to format manager net activity
const formatManagerNet = (item: any, itemKey: string) => {
  const sold = item.itemsSold || 0
  const bought = item.itemsBought || 0
  const netItems = bought - sold

  const earnedFromSales = sold * getItemSellPrice(itemKey)
  const spentOnPurchases = bought * getItemBuyPrice(itemKey)
  const netMoney = earnedFromSales - spentOnPurchases

  if (netItems === 0 && netMoney === 0) return '±0'

  const itemText = netItems > 0 ? `+${netItems}` : `${netItems}`
  const moneyText = netMoney > 0 ? `+${formatMoney(netMoney)}` : `${formatMoney(netMoney)}`

  return `${itemText} items, ${moneyText}`
}

// Function to get CSS class for manager net activity
const getManagerNetClass = (item: any) => {
  const sold = item.itemsSold || 0
  const bought = item.itemsBought || 0
  const netItems = bought - sold

  if (netItems > 0) return 'positive'
  if (netItems < 0) return 'negative'
  return 'neutral'
}

// Function to format time in a human-readable way
const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)

  const formatted = []
  if (days > 0) formatted.push(`${days}d`)
  if (hrs > 0) formatted.push(`${hrs % 24}h`)
  if (mins > 0) formatted.push(`${mins % 60}m`)
  formatted.push(`${seconds % 60}s`)
  return formatted.join(' ')
}

const detailedSummary = computed(() => {
  const details: Record<string, any> = {}

  console.log('🔍 OfflineProgress raw summary:', props.summary)

  for (const key in props.summary) {
    const itemInfo = props.itemData[key as ItemKey]
    const summaryItem = props.summary[key]

    if (summaryItem && itemInfo) {
      details[key] = {
        ...summaryItem, // This should include itemsLostToCapacity
        name: itemInfo.name,
        icon: itemInfo.icon,
      }

      console.log(`🎯 Created detail for ${key}:`, details[key])
    }
  }

  return details
})

onMounted(() => {
  console.log(Object.keys(props.summary).length, 'items produced while offline')
  // Ensure the summary is computed correctly on mount
  if (Object.keys(detailedSummary.value).length === 0) {
    console.warn('No items produced while offline.')
  }
})
</script>

<style scoped lang="scss">
.offline-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: clamp(10px, 3vh, 20px);
  box-sizing: border-box;
}

.offline-progress-modal {
  padding: clamp(20px, 4vh, 30px);
  border-radius: 15px;
  text-align: center;
  max-width: min(450px, calc(100vw - 20px));
  width: 100%;
  font-family: 'Courier New', Courier, monospace;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin: auto 0;
  max-height: calc(100vh - 40px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--coffee-border-secondary);
    border-radius: 3px;
  }

  h2 {
    margin-top: 0;
    font-size: clamp(1.3rem, 4vw, 1.8rem);
    color: var(--coffee-text-secondary);
  }

  p {
    font-size: clamp(0.9rem, 2.5vw, 1.1rem);
    margin: clamp(10px, 2vh, 15px) 0;
    line-height: 1.4;
  }

  .production-summary {
    ul {
      list-style: none;
      padding: 0;
      margin: clamp(15px, 3vh, 20px) 0;
      text-align: left;

      .production-item {
        display: flex;
        align-items: flex-start;
        font-size: clamp(1rem, 2.5vw, 1.2rem);
        margin-bottom: clamp(10px, 2vh, 15px);
        border-radius: 8px;
        padding: clamp(6px, 1.5vh, 8px);
        transition: background-color 0.2s ease;

        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .item-icon {
          width: clamp(24px, 5vw, 30px);
          height: clamp(24px, 5vw, 30px);
          margin-right: clamp(10px, 3vw, 15px);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .item-production {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;

          .item-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: bold;
            padding: 4px 0;
            border-radius: 4px;
            transition: all 0.2s ease;
            gap: 8px;

            &.expandable {
              cursor: pointer;
              user-select: none;

              &:hover {
                background-color: rgba(255, 255, 255, 0.1);
                transform: translateY(-1px);
              }
            }

            .item-info {
              flex: 1;
              word-break: break-word;
            }

            .expand-arrow {
              font-size: clamp(0.7rem, 1.5vw, 0.8rem);
              color: var(--coffee-text-secondary);
              transition: transform 0.3s ease;
              margin-left: 8px;
              flex-shrink: 0;

              &.expanded {
                transform: rotate(180deg);
              }
            }
          }
        }
      }

      .item-info {
        flex: 1;
      }

      .expand-arrow {
        font-size: 0.8rem;
        color: var(--coffee-text-secondary);
        transition: transform 0.3s ease;
        margin-left: 10px;

        &.expanded {
          transform: rotate(180deg);
        }
      }
    }

    .breakdown-section {
      margin-top: 8px;
      padding-left: clamp(8px, 2vw, 12px);
      border-left: 2px solid var(--coffee-border-primary);
      animation: slideDown 0.3s ease-out;

      .breakdown-group {
        margin-bottom: clamp(8px, 2vh, 12px);

        &:last-child {
          margin-bottom: 0;
        }
      }

      .breakdown-divider {
        font-size: clamp(0.75rem, 1.8vw, 0.85rem);
        font-weight: 600;
        color: var(--coffee-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: clamp(4px, 1vh, 6px);
        padding-bottom: 2px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .breakdown-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: clamp(0.8rem, 2vw, 0.95rem);
        margin-bottom: clamp(4px, 1vh, 6px);
        padding: clamp(3px, 1vh, 4px) clamp(6px, 1.5vw, 8px);
        border-radius: 4px;
        flex-wrap: wrap;
        gap: 4px;

        @media (max-width: 480px) {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        &.bonus {
          background-color: rgba(76, 175, 80, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.3);
        }

        &.production {
          background-color: rgba(33, 150, 243, 0.1);
          border: 1px solid rgba(33, 150, 243, 0.3);
        }

        &.production-total {
          background-color: rgba(33, 150, 243, 0.2);
          border: 1px solid rgba(33, 150, 243, 0.4);
          font-weight: 600;
          margin-top: 4px;
        }

        &.sold {
          background-color: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
        }

        &.bought {
          background-color: rgba(156, 39, 176, 0.1);
          border: 1px solid rgba(156, 39, 176, 0.3);
        }

        &.lost {
          background-color: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
        }

        &.net {
          background-color: rgba(96, 125, 139, 0.1);
          border: 1px solid rgba(96, 125, 139, 0.3);
          font-weight: bold;
          margin-top: 4px;
        }

        .breakdown-label {
          font-weight: 500;
          color: var(--coffee-text-secondary);
          word-break: break-word;
        }

        .breakdown-value {
          font-weight: bold;
          text-align: right;
          word-break: break-word;

          @media (max-width: 480px) {
            text-align: left;
          }

          .bonus & {
            color: #4caf50;
          }

          .production & {
            color: #2196f3;
          }

          .production-total & {
            color: #1976d2;
            font-weight: 700;
          }

          .sold & {
            color: #ff9800;
          }

          .bought & {
            color: #9c27b0;
          }

          .lost & {
            color: #f44336;
          }

          .net & {
            color: var(--coffee-text-primary);

            &.positive {
              color: #4caf50;
            }

            &.negative {
              color: #f44336;
            }

            &.neutral {
              color: #9e9e9e;
            }
          }
        }
      }
    }
  }

  .money-summary {
    margin: clamp(12px, 2vh, 15px) 0;
    padding: clamp(10px, 2vh, 12px);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--coffee-border-primary);

    .money-change {
      margin: 0;
      font-size: clamp(0.9rem, 2.5vw, 1.1rem);
      font-weight: 500;
      word-break: break-word;

      &.positive {
        color: #4caf50;
      }

      &.negative {
        color: #f44336;
      }

      strong {
        font-size: clamp(1rem, 2.8vw, 1.2rem);
      }
    }
  }

  button {
    padding: clamp(10px, 2vh, 12px) clamp(20px, 4vw, 25px);
    font-size: clamp(0.9rem, 2.2vw, 1rem);
    border-radius: 8px;
    cursor: pointer;
    margin-top: clamp(8px, 2vh, 10px);
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
    min-height: 44px;
    width: 100%;
    max-width: 200px;
    transition: all 0.2s ease;

    &:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

// Mobile-specific responsive adjustments
@media (max-width: 768px) {
  .offline-progress-overlay {
    align-items: flex-start;
    padding: 10px;
  }

  .offline-progress-modal {
    max-width: 90vw;

    h2 {
      text-align: center;
    }
  }

  .production-summary ul {
    .production-item {
      .item-production .breakdown-section {
        padding-left: 8px;
      }
    }
  }
}

@media (max-width: 480px) {
  .offline-progress-modal {
    padding: 15px;
    border-radius: 8px;

    h2 {
      font-size: 1.3rem;
    }

    p {
      font-size: 0.9rem;
    }
  }

  .production-summary ul {
    .production-item {
      font-size: 1rem;
      margin-bottom: 12px;

      .item-icon {
        width: 24px;
        height: 24px;
        margin-right: 10px;
      }
    }
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
    max-height: 300px;
    transform: translateY(0);
  }
}
</style>
