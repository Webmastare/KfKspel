<template>
  <g
    class="piece"
    :class="{ dragging, locked, selected }"
    :style="{ transform: `translate(${x}px, ${y}px) scale(${scale})` }"
    :filter="dragging ? 'url(#kul-lift)' : selected ? 'url(#kul-select)' : 'none'"
  >
    <defs>
      <radialGradient :id="gradId" cx="0.38" cy="0.32" r="0.72">
        <stop offset="0%" :stop-color="shade(def.color, 0.5)" />
        <stop offset="45%" :stop-color="def.color" />
        <stop offset="100%" :stop-color="shade(def.color, -0.4)" />
      </radialGradient>
    </defs>
    <g :class="{ shake: shaking }">
      <rect
        v-for="[a, b] in pairs"
        :key="`${a}-${b}`"
        class="connector"
        :x="-cellSize / 2"
        :y="-connectorWidth / 2"
        :width="cellSize"
        :height="connectorWidth"
        :fill="shade(def.color, -0.12)"
        :style="{ transform: connectorTransform(a, b) }"
      />
      <g
        v-for="(cell, i) in cells"
        :key="i"
        class="ball"
        :style="{ transform: `translate(${center(cell).x}px, ${center(cell).y}px)` }"
      >
        <circle class="ball-body" :r="ballRadius" :fill="`url(#${gradId})`" />
        <ellipse
          class="gloss"
          :cx="-ballRadius * 0.32"
          :cy="-ballRadius * 0.4"
          :rx="ballRadius * 0.28"
          :ry="ballRadius * 0.18"
        />
        <circle v-if="locked" class="pin" :r="ballRadius * 0.16" />
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { adjacentPairs, type Cell, type PieceDef } from '@/composables/femelva/pieces'

const props = defineProps<{
  def: PieceDef
  cells: Cell[] // oriented cells, same order as def.cells
  x: number
  y: number
  scale: number
  cellSize: number
  dragging: boolean
  selected: boolean
  locked: boolean
  shaking: boolean
}>()

const gradId = computed(() => `kul-grad-${props.def.id}`)
const ballRadius = computed(() => props.cellSize * 0.44)
const connectorWidth = computed(() => props.cellSize * 0.36)
// Adjacency is unchanged by rotation/mirroring, so it can be computed from the base shape
const pairs = computed(() => adjacentPairs(props.def.cells))

function center(cell: Cell) {
  return { x: (cell[1] + 0.5) * props.cellSize, y: (cell[0] + 0.5) * props.cellSize }
}

function connectorTransform(a: number, b: number) {
  const ca = props.cells[a]!
  const cb = props.cells[b]!
  const mx = ((ca[1] + cb[1]) / 2 + 0.5) * props.cellSize
  const my = ((ca[0] + cb[0]) / 2 + 0.5) * props.cellSize
  const vertical = ca[1] === cb[1]
  return `translate(${mx}px, ${my}px) rotate(${vertical ? 90 : 0}deg)`
}

// Lightens (amount > 0) or darkens (amount < 0) a hex color
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const target = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  const mix = (v: number) => Math.round(v + (target - v) * p)
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}
</script>

<style scoped lang="scss">
.piece {
  cursor: grab;
  transform-origin: 0 0;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);

  &.dragging {
    cursor: grabbing;
    transition: none;
  }

  &.locked {
    cursor: default;
  }
}

.ball,
.connector {
  transform-origin: 0 0;
  transition: transform 0.2s ease;
}

.gloss {
  fill: rgba(255, 255, 255, 0.55);
  pointer-events: none;
}

.pin {
  fill: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.shake {
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  75% {
    transform: translateX(6px);
  }
}
</style>
