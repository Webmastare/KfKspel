<template>
  <div class="stats-modal-overlay" @click="closeModal">
    <div class="stats-modal" @click.stop>
      <div class="stats-header">
        <h2>Production Statistics</h2>
        <button class="close-button" @click="closeModal">×</button>
      </div>

      <div class="stats-content">
        <!-- Time Scale Selector -->
        <div class="time-scale-selector">
          <label>Time Period:</label>
          <select v-model="selectedTimeScale" @change="updateDisplayData">
            <option v-for="(config, key) in timeScales" :key="key" :value="key">
              {{ config.label }}
            </option>
          </select>
        </div>

        <!-- View Type Selector -->
        <div class="view-type-selector">
          <label>Display Type:</label>
          <div class="radio-group">
            <label>
              <input type="radio" v-model="viewType" value="rate" @change="updateDisplayData" />
              Production Rate (items/sec)
            </label>
            <label>
              <input
                type="radio"
                v-model="viewType"
                value="cumulative"
                @change="updateDisplayData"
              />
              Cumulative Production
            </label>
          </div>
        </div>

        <!-- Production Type Toggle Buttons -->
        <div class="production-type-selector">
          <label>Show Production:</label>
          <div class="toggle-buttons">
            <button
              class="toggle-btn"
              :class="{ active: showRegularItems }"
              @click="toggleRegularItems"
            >
              <div class="selection-indicator" v-if="showRegularItems">✓</div>
              Normal Items
            </button>
            <button
              class="toggle-btn"
              :class="{ active: showBonusItems }"
              @click="toggleBonusItems"
            >
              <div class="selection-indicator" v-if="showBonusItems">✓</div>
              Bonus Items
            </button>
          </div>
        </div>

        <!-- Chart Container -->
        <div class="chart-container">
          <div ref="chartElement" class="chart"></div>
        </div>

        <!-- Enhanced Interactive Stats Display -->
        <div class="interactive-stats" v-if="availableItems && availableItems.length > 0">
          <h3>
            Production Data ({{ TIME_SCALES[selectedTimeScale]?.label || 'Unknown' }}) - Click to
            toggle chart display:
          </h3>
          <div class="stats-grid">
            <button
              v-for="item in availableItems"
              :key="item.key"
              :class="[
                'stat-item',
                'clickable',
                {
                  active: selectedItems.has(item.key),
                  'has-production': hasProduction(item.key),
                },
              ]"
              @click="toggleItem(item.key)"
            >
              <img :src="item.icon" :alt="item.name" class="stat-icon" />
              <div class="stat-details">
                <span class="stat-name">{{ item.name }}</span>
                <div class="stat-values">
                  <div class="stat-rate">
                    <span class="stat-label">Rate:</span>
                    <span class="stat-value">{{ getItemRate(item.key).toFixed(2) }} /min</span>
                  </div>
                  <div class="stat-cumulative">
                    <span class="stat-label">Total:</span>
                    <span class="stat-value"
                      >{{ getItemCumulative(item.key).toFixed(0) }} items</span
                    >
                  </div>
                </div>
              </div>
              <div class="selection-indicator" v-if="selectedItems.has(item.key)">✓</div>
            </button>
          </div>
          <p class="stats-help-text">
            💡 Click items above to show/hide them in the chart. Selected items:
            {{ selectedItems.size }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { ItemKey, ItemData } from '@/components/coffeequeen/types'
import type {
  StatsManager,
  ChartSeries,
  ChartDataPoint,
} from '@/composables/coffeequeen/statsTypes'
import { TIME_SCALES, ITEM_COLORS } from '@/composables/coffeequeen/statsTypes'
import { useProductionStats } from '@/composables/coffeequeen/statsManager'
import { ProductionChartRenderer } from '@/composables/coffeequeen/chartRenderer'

interface Props {
  itemData: Record<ItemKey, ItemData>
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Get stats manager
const {
  getProductionData,
  getBonusProductionData,
  getRegularProductionData,
  getCumulativeProduction,
  statsManager,
  getItemsPerMinute,
  getBonusItemsPerMinute,
  getRegularItemsPerMinute,
} = useProductionStats()

// Component state
const chartElement = ref<HTMLElement | null>(null)
const selectedTimeScale = ref<keyof StatsManager>('tenSeconds')
const viewType = ref<'rate' | 'cumulative'>('rate')
const showBonusItems = ref<boolean>(true)
const showRegularItems = ref<boolean>(true)
const selectedItems = ref<Set<ItemKey>>(new Set())
const isVisible = ref<boolean>(true)

// Chart renderer
let chartRenderer: ProductionChartRenderer | null = null

// Computed properties
const timeScales = computed(() => TIME_SCALES)

const availableItems = computed(() => {
  return Object.entries(props.itemData).map(([key, data]) => ({
    key: key as ItemKey,
    name: data.name,
    icon: data.icon,
  }))
})

const currentRates = computed(() => {
  // Use the appropriate getItemsPerMinute function based on toggle state
  const rates: Record<ItemKey, number> = {} as Record<ItemKey, number>

  // Calculate rates for all item types
  const itemKeys: ItemKey[] = [
    'rawCoffeeBeans',
    'roastedCoffeeBeans',
    'groundCoffee',
    'brewedCoffee',
    'espresso',
    'latte',
  ]

  for (const itemKey of itemKeys) {
    let rate = 0

    if (showRegularItems.value && showBonusItems.value) {
      // Show both regular and bonus items
      rate = getItemsPerMinute(itemKey, selectedTimeScale.value, true)
    } else if (showRegularItems.value && !showBonusItems.value) {
      // Show only regular items
      rate = getRegularItemsPerMinute(itemKey, selectedTimeScale.value)
    } else if (!showRegularItems.value && showBonusItems.value) {
      // Show only bonus items
      rate = getBonusItemsPerMinute(itemKey, selectedTimeScale.value)
    }
    // If neither is selected, rate stays 0

    rates[itemKey] = rate
  }

  return rates
})

// Helper functions
function getItemName(itemKey: ItemKey): string {
  return props.itemData[itemKey]?.name || itemKey
}

function getItemIcon(itemKey: ItemKey): string {
  return props.itemData[itemKey]?.icon || ''
}

function toggleItem(itemKey: ItemKey) {
  const newSet = new Set(selectedItems.value)
  if (newSet.has(itemKey)) {
    newSet.delete(itemKey)
  } else {
    newSet.add(itemKey)
  }
  selectedItems.value = newSet
  updateDisplayData()
}

// Enhanced helper functions for the new interactive stats display
function getItemRate(itemKey: ItemKey): number {
  if (showRegularItems.value && showBonusItems.value) {
    return getItemsPerMinute(itemKey, selectedTimeScale.value, true)
  } else if (showRegularItems.value && !showBonusItems.value) {
    return getRegularItemsPerMinute(itemKey, selectedTimeScale.value)
  } else if (!showRegularItems.value && showBonusItems.value) {
    return getBonusItemsPerMinute(itemKey, selectedTimeScale.value)
  }
  return 0
}

function getItemCumulative(itemKey: ItemKey): number {
  // Get cumulative production for the selected time scale
  const buckets = statsManager.value[selectedTimeScale.value] as any[]
  if (!buckets || buckets.length === 0) return 0

  let total = 0
  for (const bucket of buckets) {
    if (bucket) {
      let regularItems = 0
      let bonusItems = 0

      if (bucket.items && bucket.items[itemKey]) {
        regularItems = bucket.items[itemKey]
      }

      if (bucket.bonusItems && bucket.bonusItems[itemKey]) {
        bonusItems = bucket.bonusItems[itemKey]
      }

      // Add items based on toggle state
      if (showRegularItems.value) {
        total += regularItems
      }
      if (showBonusItems.value) {
        total += bonusItems
      }
    }
  }
  return total
}

function hasProduction(itemKey: ItemKey): boolean {
  return getItemRate(itemKey) > 0 || getItemCumulative(itemKey) > 0
}

// Production type toggle functions
function toggleRegularItems() {
  showRegularItems.value = !showRegularItems.value
  updateDisplayData()
}

function toggleBonusItems() {
  showBonusItems.value = !showBonusItems.value
  updateDisplayData()
}

function closeModal() {
  isVisible.value = false // Stop chart updates
  emit('close')
}

// Data update functions
function updateDisplayData() {
  nextTick(() => {
    renderChart()
  })
}

function renderChart() {
  if (!chartElement.value || !isVisible.value) return

  if (selectedItems.value.size === 0) {
    // Clear and show message
    if (chartRenderer) {
      chartRenderer.clear()
    }
    chartElement.value.innerHTML =
      '<div class="no-data-message">Please select items to display</div>'
    return
  }

  // Initialize chart renderer if not exists
  if (!chartRenderer) {
    chartRenderer = new ProductionChartRenderer(chartElement.value, {
      width: chartElement.value.clientWidth || 800,
      height: 400,
      showBonusItems: showBonusItems.value,
    })
  }

  // Update config
  chartRenderer.updateConfig({
    showBonusItems: showBonusItems.value,
  })

  // Get production data based on toggle state and convert to chart series
  let data: ChartDataPoint[][]

  if (showRegularItems.value && showBonusItems.value) {
    // Show both regular and bonus items
    data = getProductionData(selectedTimeScale.value, Array.from(selectedItems.value), true)
  } else if (showRegularItems.value && !showBonusItems.value) {
    // Show only regular items
    data = getRegularProductionData(selectedTimeScale.value, Array.from(selectedItems.value))
  } else if (!showRegularItems.value && showBonusItems.value) {
    // Show only bonus items
    data = getBonusProductionData(selectedTimeScale.value, Array.from(selectedItems.value))
  } else {
    // Neither selected - show empty data
    data = Array.from(selectedItems.value).map(() => [])
  }

  const chartSeries = createChartSeries(data)

  // Get current time scale config
  const currentTimeScale = TIME_SCALES[selectedTimeScale.value]

  // Render appropriate chart type
  if (viewType.value === 'cumulative') {
    chartRenderer.renderCumulativeChart(chartSeries, currentTimeScale)
  } else {
    chartRenderer.renderRateChart(chartSeries, currentTimeScale)
  }
}

function createChartSeries(data: ChartDataPoint[][]): ChartSeries[] {
  // Get the array of selected items
  const selectedItemsArray = Array.from(selectedItems.value)

  // Convert the data array into chart series
  const series: ChartSeries[] = selectedItemsArray
    .map((itemKey, index) => {
      const seriesData = data[index] || [] // Get data for this item

      return {
        itemKey,
        name: getItemName(itemKey),
        icon: getItemIcon(itemKey),
        color: ITEM_COLORS[itemKey] || '#999',
        data: seriesData, // Already in the correct ChartDataPoint format
        visible: selectedItems.value.has(itemKey),
      }
    })
    .filter((series) => series.data.length > 0) // Only include series with data

  return series
}

// Initialize component
function initializeComponent() {
  // Set modal as visible when initializing
  isVisible.value = true

  // Select all available items by default
  selectedItems.value = new Set(Object.keys(props.itemData) as ItemKey[])
  updateDisplayData()
}

onMounted(() => {
  initializeComponent()

  // Periodic chart updates (max 2 times per second) only when modal is visible
  let chartUpdateInterval: ReturnType<typeof setInterval> | null = null

  const startChartUpdates = () => {
    if (chartUpdateInterval) return // Already running

    // Immediate update when starting
    renderChart()

    // Start periodic updates (500ms = 2 times per second)
    chartUpdateInterval = setInterval(() => {
      if (isVisible.value) {
        renderChart()
      }
    }, 500)
  }

  const stopChartUpdates = () => {
    if (chartUpdateInterval) {
      clearInterval(chartUpdateInterval)
      chartUpdateInterval = null
    }
  }

  // Start chart updates immediately since modal is opening
  startChartUpdates()

  // Watch for visibility changes to control updates
  watch(isVisible, (visible) => {
    if (visible) {
      startChartUpdates()
    } else {
      stopChartUpdates()
    }
  })

  // Watch for changes in user selections - immediate updates when visible
  watch([selectedItems, selectedTimeScale, viewType, showRegularItems, showBonusItems], () => {
    if (isVisible.value) {
      renderChart()
    }
  })

  // Clean up interval on unmount
  onUnmounted(() => {
    stopChartUpdates()
    // Clean up chart renderer
    if (chartRenderer) {
      chartRenderer.clear()
      chartRenderer = null
    }
  })
})
</script>

<style scoped>
.stats-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 1000;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: clamp(10px, 2vh, 20px);
  box-sizing: border-box;
}

.stats-modal {
  background: var(--coffee-bg-primary);
  border: 2px solid var(--coffee-border-primary);
  border-radius: 12px;
  width: min(90%, calc(100vw - 20px));
  max-width: 1200px;
  height: auto;
  max-height: calc(100vh - 40px);
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  margin: auto 0;

  @media (max-width: 768px) {
    width: 100%;
    max-width: 100vw;
    border-radius: 8px;
    margin-top: 0;
  }
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(15px, 3vh, 20px);
  border-bottom: 1px solid var(--coffee-border-secondary);
  background: var(--coffee-bg-secondary);
  border-radius: 10px 10px 0 0;
  flex-shrink: 0;

  @media (max-width: 768px) {
    border-radius: 6px 6px 0 0;
  }
}

.stats-header h2 {
  margin: 0;
  font-size: clamp(1.2rem, 3.5vw, 1.5rem);
  color: var(--coffee-text-secondary);
}

.close-button {
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
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.stats-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-scale-selector,
.view-type-selector,
.bonus-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-scale-selector select {
  padding: 8px 12px;
  border-radius: 5px;
  border: 2px solid var(--coffee-border-secondary);
  background: var(--coffee-bg-secondary);
  color: var(--coffee-text-primary);
  font-size: 14px;
}

.radio-group {
  display: flex;
  gap: 15px;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.item-selector h3 {
  margin: 0 0 10px 0;
  color: var(--coffee-text-secondary);
}

.item-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.item-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border: 2px solid var(--coffee-border-secondary);
  border-radius: 8px;
  background: var(--coffee-bg-secondary);
  color: var(--coffee-text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.item-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.item-button.active {
  background: var(--coffee-button-bg);
  border-color: var(--coffee-button-border);
  color: var(--coffee-button-text);
}

.item-icon {
  width: 24px;
  height: 24px;
}

.chart-container {
  flex: 1;
  min-height: 400px;
  max-height: 500px;
  background: var(--coffee-bg-secondary);
  border: 2px solid var(--coffee-border-secondary);
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart {
  width: 100%;
  height: 100%;
  min-height: 350px;
}

.no-data-message {
  text-align: center;
  color: var(--coffee-text-secondary);
  font-style: italic;
  font-size: 16px;
}

.current-stats h3 {
  margin: 0 0 15px 0;
  color: var(--coffee-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--coffee-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--coffee-border-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.stat-item:hover {
  background: var(--coffee-bg-primary);
  border-color: var(--coffee-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.stat-item.selected {
  background: var(--coffee-accent);
  border-color: var(--coffee-accent);
  color: var(--coffee-bg-primary);
}

.stat-item.selected .stat-name,
.stat-item.selected .stat-value {
  color: var(--coffee-bg-primary);
}

.stat-icon {
  width: 32px;
  height: 32px;
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-name {
  font-weight: bold;
  color: var(--coffee-text-secondary);
}

.stat-value {
  font-size: 14px;
  color: var(--coffee-text-primary);
}

.bonus-rate {
  color: var(--coffee-text-secondary);
  font-size: 12px;
  margin-left: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .stats-modal {
    width: 95%;
    height: 95%;
  }

  .item-buttons {
    justify-content: center;
  }

  .radio-group {
    flex-direction: column;
    gap: 8px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.debug-controls {
  margin: 10px 0;
  padding: 10px 0;
  border-top: 1px solid var(--coffee-border-secondary);
}

.debug-button {
  background: var(--coffee-accent);
  color: var(--coffee-bg-primary);
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.debug-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Production Type Selector Styles */
.production-type-selector {
  margin: 15px 0;
  padding: 15px;
  background: var(--coffee-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--coffee-border-secondary);
}

.production-type-selector label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: var(--coffee-text-secondary);
}

.toggle-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.toggle-btn {
  padding: 8px 16px;
  border: 2px solid var(--coffee-border-secondary);
  background: var(--coffee-bg-primary);
  color: var(--coffee-text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  user-select: none;
}

.toggle-btn:hover {
  border-color: var(--coffee-accent);
  background: var(--coffee-bg-secondary);
  transform: translateY(-1px);
}

.toggle-btn.active {
  background: var(--coffee-accent);
  border-color: var(--coffee-accent);
  color: var(--coffee-bg-primary);
  box-shadow: 0 2px 8px rgba(139, 69, 19, 0.3);
}

.toggle-btn.active:hover {
  background: var(--coffee-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.4);
}
</style>
