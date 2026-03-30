<template>
  <div class="manager-stats-modal-overlay" @click="closeModal">
    <div class="manager-stats-modal" @click.stop>
      <div class="stats-header">
        <h2>{{ selectedManagerName }} Manager Statistics</h2>
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

        <!-- Chart Type Selector -->
        <div class="chart-type-selector">
          <label>Chart Type:</label>
          <div class="radio-group">
            <label>
              <input type="radio" v-model="chartType" value="items" @change="updateDisplayData" />
              Items Flow (sold - bought)
            </label>
            <label>
              <input type="radio" v-model="chartType" value="cash" @change="updateDisplayData" />
              Cash Flow (earned - spent)
            </label>
          </div>
        </div>

        <!-- Display Mode Selector -->
        <div class="display-mode-selector">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showNetValues" @change="updateDisplayData" />
            <span class="checkbox-text">
              Show net values instead of rates ({{
                chartType === 'items' ? 'items' : 'cash'
              }}
              instead of {{ chartType === 'items' ? 'items/min' : 'cash/min' }})
            </span>
          </label>
        </div>

        <!-- Chart Container -->
        <div class="chart-container">
          <div ref="chartElement" class="chart"></div>
        </div>

        <!-- Summary Statistics -->
        <div class="summary-stats" v-if="summaryStats">
          <h3>Summary for {{ timeScales[selectedTimeScale]?.label || 'Unknown' }}</h3>
          <div class="stats-grid">
            <div class="stat-card positive">
              <div class="stat-title">Items Sold</div>
              <div class="stat-value">{{ summaryStats.totalItemsSold }}</div>
            </div>
            <div class="stat-card negative">
              <div class="stat-title">Items Bought</div>
              <div class="stat-value">{{ summaryStats.totalItemsBought }}</div>
            </div>
            <div class="stat-card" :class="summaryStats.netItems >= 0 ? 'positive' : 'negative'">
              <div class="stat-title">Net Items</div>
              <div class="stat-value">
                {{ summaryStats.netItems >= 0 ? '+' : '' }}{{ summaryStats.netItems }}
              </div>
            </div>
            <div class="stat-card positive">
              <div class="stat-title">Cash Generated</div>
              <div class="stat-value">
                ${{ formatCompactNumber(summaryStats.totalCashGenerated) }}
              </div>
            </div>
            <div class="stat-card negative">
              <div class="stat-title">Cash Spent</div>
              <div class="stat-value">${{ formatCompactNumber(summaryStats.totalCashSpent) }}</div>
            </div>
            <div class="stat-card" :class="summaryStats.netCash >= 0 ? 'positive' : 'negative'">
              <div class="stat-title">Net Profit</div>
              <div class="stat-value">
                ${{ summaryStats.netCash >= 0 ? '+' : ''
                }}{{ formatCompactNumber(summaryStats.netCash) }}
              </div>
            </div>
          </div>
        </div>

        <!-- All-time Statistics -->
        <div class="all-time-stats">
          <h3>All-Time Statistics</h3>
          <div class="stats-grid">
            <div class="stat-card positive">
              <div class="stat-title">Total Items Sold</div>
              <div class="stat-value">{{ salesManager.statistics.totalItemsSold }}</div>
            </div>
            <div class="stat-card negative">
              <div class="stat-title">Total Items Bought</div>
              <div class="stat-value">{{ salesManager.statistics.totalItemsBought }}</div>
            </div>
            <div class="stat-card positive">
              <div class="stat-title">Total Cash Earned</div>
              <div class="stat-value">
                ${{ formatCompactNumber(salesManager.statistics.totalMoneyEarned) }}
              </div>
            </div>
            <div class="stat-card negative">
              <div class="stat-title">Total Cash Spent</div>
              <div class="stat-value">
                ${{ formatCompactNumber(salesManager.statistics.totalMoneySpent) }}
              </div>
            </div>
            <div class="stat-card" :class="netProfit >= 0 ? 'positive' : 'negative'">
              <div class="stat-title">Net All-Time Profit</div>
              <div class="stat-value">
                ${{ netProfit >= 0 ? '+' : '' }}{{ formatCompactNumber(netProfit) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { SalesManager, ItemData } from '@/components/coffeequeen/types'
import type { ManagerChartSeries } from '@/composables/coffeequeen/managerStatsTypes'
import {
  MANAGER_TIME_SCALES,
  MANAGER_CHART_COLORS,
} from '@/composables/coffeequeen/managerStatsTypes'
import {
  getManagerChartData,
  getManagerSummaryStats,
} from '@/composables/coffeequeen/managerStatsManager'
import { ManagerChartRenderer } from '@/composables/coffeequeen/managerChartRenderer'
import type { timeStamp } from 'console'
import { formatCompactNumber } from '@/components/coffeequeen/number-format'

interface Props {
  salesManager: SalesManager
  itemData: Record<string, ItemData>
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Component state
const chartElement = ref<HTMLElement | null>(null)
const selectedTimeScale = ref<'oneMinute' | 'oneHour'>('oneMinute')
const chartType = ref<'items' | 'cash'>('items')
const showNetValues = ref<boolean>(false)
const isVisible = ref<boolean>(true)

// Chart renderer
let chartRenderer: ManagerChartRenderer | null = null

// Computed properties
const timeScales = computed(() => MANAGER_TIME_SCALES)

const selectedManagerName = computed(() => {
  const itemData = props.itemData[props.salesManager.itemKey]
  return itemData ? itemData.name : props.salesManager.itemKey
})

const summaryStats = computed(() => {
  return getManagerSummaryStats(props.salesManager, selectedTimeScale.value)
})

const netProfit = computed(() => {
  return (
    props.salesManager.statistics.totalMoneyEarned - props.salesManager.statistics.totalMoneySpent
  )
})

// Helper functions
function closeModal() {
  isVisible.value = false
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

  // Initialize chart renderer if not exists
  if (!chartRenderer) {
    chartRenderer = new ManagerChartRenderer(chartElement.value, {
      width: chartElement.value.clientWidth || 800,
      height: 400,
    })
  }

  // Get chart data
  const chartData = getManagerChartData(
    props.salesManager,
    selectedTimeScale.value,
    chartType.value,
  )
  console.log('Rendering chart with data points:', chartData)

  if (chartData.length === 0) {
    // Clear and show message
    if (chartRenderer) {
      chartRenderer.clear()
    }
    chartElement.value.innerHTML =
      '<div class="no-data-message">No data available for the selected time period</div>'
    return
  }

  // Create chart series
  const series: ManagerChartSeries[] = [
    {
      name: chartType.value === 'items' ? 'Items Flow' : 'Cash Flow',
      color:
        chartType.value === 'items'
          ? chartData.some((d) => d.itemsPerMinute > 0)
            ? MANAGER_CHART_COLORS.itemsSold
            : MANAGER_CHART_COLORS.itemsBought
          : chartData.some((d) => d.cashPerMinute > 0)
            ? MANAGER_CHART_COLORS.cashGenerated
            : MANAGER_CHART_COLORS.cashSpent,
      data: chartData,
      visible: true,
    },
  ]

  // Get current time scale config
  const currentTimeScale = MANAGER_TIME_SCALES[selectedTimeScale.value]
  if (!currentTimeScale) return

  // Render chart
  chartRenderer.renderManagerChart(series, chartType.value, showNetValues.value)
}

// Initialize component
function initializeComponent() {
  isVisible.value = true
  updateDisplayData()
}

onMounted(() => {
  initializeComponent()

  // Periodic chart updates (every 2 seconds) only when modal is visible
  let chartUpdateInterval: ReturnType<typeof setInterval> | null = null

  const startChartUpdates = () => {
    if (chartUpdateInterval) return

    // Immediate update when starting
    renderChart()

    // Start periodic updates
    chartUpdateInterval = setInterval(() => {
      if (isVisible.value) {
        renderChart()
      }
    }, 2000)
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

  // Watch for changes in user selections
  watch([selectedTimeScale, chartType, showNetValues], () => {
    if (isVisible.value) {
      renderChart()
    }
  })

  // Clean up interval on unmount
  onUnmounted(() => {
    stopChartUpdates()
    if (chartRenderer) {
      chartRenderer.clear()
      chartRenderer = null
    }
  })
})
</script>

<style scoped>
.manager-stats-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.manager-stats-modal {
  background: var(--coffee-bg-primary);
  border: 2px solid var(--coffee-border-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  height: 85%;
  max-height: 700px;
  color: var(--coffee-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--coffee-border-secondary);
  background: var(--coffee-bg-secondary);
  border-radius: 10px 10px 0 0;
}

.stats-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--coffee-text-secondary);
}

.close-button {
  background: none;
  border: none;
  color: var(--coffee-text-primary);
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
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
.chart-type-selector,
.display-mode-selector {
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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.checkbox-label input[type='checkbox'] {
  margin: 0;
}

.checkbox-text {
  color: var(--coffee-text-primary);
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

.summary-stats,
.all-time-stats {
  margin: 20px 0;
}

.summary-stats h3,
.all-time-stats h3 {
  margin: 0 0 15px 0;
  color: var(--coffee-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-card {
  background: var(--coffee-bg-secondary);
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  border: 2px solid var(--coffee-border-secondary);
  transition: all 0.2s ease;
}

.stat-card.positive {
  border-color: #28a745;
}

.stat-card.negative {
  border-color: #dc3545;
}

.stat-title {
  font-size: 14px;
  color: var(--coffee-text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--coffee-text-primary);
}

.stat-card.positive .stat-value {
  color: #28a745;
}

.stat-card.negative .stat-value {
  color: #dc3545;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .manager-stats-modal {
    width: 95%;
    height: 95%;
  }

  .radio-group {
    flex-direction: column;
    gap: 8px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
