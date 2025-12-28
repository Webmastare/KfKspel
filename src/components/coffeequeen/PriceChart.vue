<template>
  <div class="price-chart-container">
    <svg width="140" height="80" viewBox="0 0 140 80" class="price-chart">
      <!-- Background -->
      <rect width="140" height="80" fill="#3a2f2a" stroke="#452f26" stroke-width="1" />

      <!-- Grid lines with Y-axis ticks -->
      <g v-if="yAxisTicks.length > 0">
        <line
          v-for="tick in yAxisTicks"
          :key="tick.value"
          x1="25"
          :y1="tick.y"
          x2="140"
          :y2="tick.y"
          stroke="#d5dfd6"
          stroke-width="0.5"
          opacity="0.3"
        />

        <!-- Y-axis labels -->
        <text
          v-for="tick in yAxisTicks"
          :key="'label-' + tick.value"
          x="3"
          :y="tick.y + 2"
          fill="#d5dfd6"
          font-family="Courier New, monospace"
          font-size="8"
          opacity="0.9"
        >
          ${{ tick.label }}
        </text>
      </g>

      <!-- Price line -->
      <polyline
        v-if="chartPoints.length > 1"
        :points="chartPoints"
        fill="none"
        stroke="#00df40"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Data points -->
      <circle
        v-for="(point, index) in parsedPoints"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        r="1"
        fill="#00df40"
        class="data-point"
        @mouseenter="showTooltip($event, point.value, index)"
        @mouseleave="hideTooltip"
      />

      <!-- Current price indicator -->
      <text
        v-if="lastPoint"
        :x="lastPoint.x + 8"
        :y="lastPoint.y + 3"
        text-anchor="start"
        fill="#00df00"
        font-family="Courier New, monospace"
        font-size="9"
        font-weight="bold"
      >
        ${{ currentPrice.toFixed(2) }}
      </text>
    </svg>

    <!-- Tooltip -->
    <div
      v-if="tooltip.show"
      class="tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div>Point {{ tooltip.index + 1 }}</div>
      <div>${{ tooltip.value }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  priceHistory: number[]
  currentPrice: number
}

interface TooltipState {
  show: boolean
  x: number
  y: number
  value: number
  index: number
}

interface ParsedPoint {
  x: number
  y: number
  value: number
}

interface AxisTick {
  value: number
  y: number
  label: string
}

const props = withDefaults(defineProps<Props>(), {
  priceHistory: () => [],
})

const tooltip = ref<TooltipState>({
  show: false,
  x: 0,
  y: 0,
  value: 0,
  index: 0,
})

const parsedPoints = computed((): ParsedPoint[] => {
  if (!props.priceHistory.length) return []

  const leftPadding = 25 // Space for Y-axis labels
  const rightPadding = 10
  const topPadding = 10
  const bottomPadding = 10

  const width = 140 - leftPadding - rightPadding
  const height = 80 - topPadding - bottomPadding

  const minPrice = Math.min(...props.priceHistory)
  const maxPrice = Math.max(...props.priceHistory)
  const priceRange = maxPrice - minPrice || 1 // Avoid division by zero

  return props.priceHistory.map((price, index) => {
    const x = leftPadding + (index / (props.priceHistory.length - 1)) * width
    const y = topPadding + height - ((price - minPrice) / priceRange) * height
    return { x, y, value: price }
  })
})

const chartPoints = computed((): string => {
  return parsedPoints.value.map((point) => `${point.x},${point.y}`).join(' ')
})

const yAxisTicks = computed((): AxisTick[] => {
  if (!props.priceHistory.length) return []

  const topPadding = 10
  const bottomPadding = 10
  const height = 80 - topPadding - bottomPadding

  const minPrice = Math.min(...props.priceHistory)
  const maxPrice = Math.max(...props.priceHistory)
  const priceRange = maxPrice - minPrice || 1

  // Create 4-5 evenly spaced ticks
  const numTicks = 4
  const ticks: AxisTick[] = []

  for (let i = 0; i <= numTicks; i++) {
    const ratio = i / numTicks
    const price = minPrice + priceRange * ratio
    const y = topPadding + height - ratio * height

    ticks.push({
      value: price,
      y: y,
      label: price.toFixed(2),
    })
  }

  return ticks.reverse() // Reverse so highest price is at top
})

const lastPoint = computed((): ParsedPoint | null => {
  const points = parsedPoints.value
  return points.length > 0 ? points[points.length - 1] || null : null
})

const showTooltip = (event: MouseEvent, value: number, index: number): void => {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltip.value = {
    show: true,
    x: rect.left + window.scrollX - 30,
    y: rect.top + window.scrollY - 35,
    value: value,
    index: index,
  }
}

const hideTooltip = (): void => {
  tooltip.value.show = false
}
</script>

<style scoped lang="scss">
.price-chart-container {
  position: relative;
  display: inline-block;
  margin-left: 10px;
}

.price-chart {
  border-radius: 4px;
  cursor: crosshair;

  .data-point {
    cursor: pointer;
    transition: r 0.2s;

    &:hover {
      r: 3;
    }
  }
}

.tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 10px;
  font-weight: bold;
  z-index: 1000;
  pointer-events: none;
  white-space: nowrap;

  div {
    margin: 0;
    line-height: 1.2;
  }
}
</style>
