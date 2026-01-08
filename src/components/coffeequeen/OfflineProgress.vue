<template>
  <div class="offline-progress-overlay" @click.self="$emit('close')">
    <div class="offline-progress-modal">
      <h2>Welcome Back!</h2>
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
                <span class="item-info">
                  {{ item.name }}: +{{ item.amount.toLocaleString() }}
                </span>
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
                <div v-if="item.bonusAmount > 0" class="breakdown-item bonus">
                  <span class="breakdown-label">Bonus Items:</span>
                  <span class="breakdown-value"
                    >+{{ item.bonusAmount.toLocaleString() }} (no XP)</span
                  >
                </div>
                <div
                  v-if="item.itemsLostToCapacity && item.itemsLostToCapacity > 0"
                  class="breakdown-item lost"
                >
                  <span class="breakdown-label">Lost to Capacity:</span>
                  <span class="breakdown-value"
                    >{{ item.itemsLostToCapacity.toLocaleString() }} items</span
                  >
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
      <button @click="$emit('close')">Got it!</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { OfflineProductionSummary, ItemData, ItemKey } from '@/components/coffeequeen/types'

interface Props {
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
  return item.bonusAmount > 0 || (item.itemsLostToCapacity && item.itemsLostToCapacity > 0)
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
  align-items: center;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.7);
}

.offline-progress-modal {
  padding: 30px;
  border-radius: 15px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  font-family: 'Courier New', Courier, monospace;
  background: var(--coffee-bg-card);
  border: 1px solid var(--coffee-border-primary);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  h2 {
    margin-top: 0;
    font-size: 1.8rem;
    color: var(--coffee-text-secondary);
  }

  p {
    font-size: 1.1rem;
    margin: 15px 0;
  }

  .production-summary {
    ul {
      list-style: none;
      padding: 0;
      margin: 20px 0;
      text-align: left;

      .production-item {
        display: flex;
        align-items: flex-start;
        font-size: 1.2rem;
        margin-bottom: 15px;
        border-radius: 8px;
        padding: 8px;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .item-icon {
          width: 30px;
          height: 30px;
          margin-right: 15px;
          margin-top: 2px;
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
            padding-left: 12px;
            border-left: 2px solid var(--coffee-border-primary);
            animation: slideDown 0.3s ease-out;

            .breakdown-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.95rem;
              margin-bottom: 6px;
              padding: 4px 8px;
              border-radius: 4px;

              &.bonus {
                background-color: rgba(76, 175, 80, 0.1);
                border: 1px solid rgba(76, 175, 80, 0.3);
              }

              &.lost {
                background-color: rgba(244, 67, 54, 0.1);
                border: 1px solid rgba(244, 67, 54, 0.3);
              }

              .breakdown-label {
                font-weight: 500;
                color: var(--coffee-text-secondary);
              }

              .breakdown-value {
                font-weight: bold;

                .bonus & {
                  color: #4caf50;
                }

                .lost & {
                  color: #f44336;
                }
              }
            }
          }
        }
      }
    }
  }

  button {
    padding: 12px 25px;
    font-size: 1rem;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 10px;
    background: var(--coffee-button-bg);
    color: var(--coffee-button-text);
    border: 2px solid var(--coffee-button-border);
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
    max-height: 200px;
    transform: translateY(0);
  }
}
</style>
