<template>
  <svg
    class="solution-board"
    :viewBox="`0 0 ${BOARD_COLS * S + 2 * PAD} ${BOARD_ROWS * S + 2 * PAD}`"
    role="img"
  >
    <rect
      :width="BOARD_COLS * S + 2 * PAD"
      :height="BOARD_ROWS * S + 2 * PAD"
      :rx="PAD * 1.5"
      fill="#161616"
    />
    <rect
      v-for="link in links"
      :key="link.key"
      :x="link.x"
      :y="link.y"
      :width="link.w"
      :height="link.h"
      :fill="link.color"
      :opacity="link.opacity"
    />
    <g v-for="cell in cells" :key="cell.key">
      <circle :cx="cell.x" :cy="cell.y" :r="S * 0.42" :fill="cell.color" :opacity="cell.opacity" />
      <ellipse
        v-if="cell.filled"
        :cx="cell.x - S * 0.13"
        :cy="cell.y - S * 0.16"
        :rx="S * 0.12"
        :ry="S * 0.08"
        fill="rgba(255, 255, 255, 0.5)"
        :opacity="cell.opacity"
      />
      <circle
        v-if="cell.id === highlight"
        :cx="cell.x"
        :cy="cell.y"
        :r="S * 0.46"
        fill="none"
        stroke="#22c55e"
        stroke-width="2"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Occupancy } from '@/composables/femelva/board'
import { BOARD_COLS, BOARD_ROWS, PIECE_BY_ID } from '@/composables/femelva/pieces'

const props = withDefaults(
  defineProps<{
    board: Occupancy
    visible?: string[] | null // only draw these pieces (null = all)
    highlight?: string | null // outline this piece and dim the rest
  }>(),
  { visible: null, highlight: null },
)

const S = 20
const PAD = 4
const HOLE = '#050505'

function shown(id: string | null): id is string {
  return id !== null && (props.visible === null || props.visible.includes(id))
}

function opacityOf(id: string) {
  return props.highlight && id !== props.highlight ? 0.45 : 1
}

const cells = computed(() =>
  props.board.flatMap((row, r) =>
    row.map((id, c) => {
      const filled = shown(id)
      return {
        key: `${r}-${c}`,
        id,
        filled,
        x: PAD + (c + 0.5) * S,
        y: PAD + (r + 0.5) * S,
        color: filled ? PIECE_BY_ID[id]!.color : HOLE,
        opacity: filled ? opacityOf(id) : 1,
      }
    }),
  ),
)

// Connectors between neighbouring cells of the same piece
const links = computed(() => {
  const out: {
    key: string
    x: number
    y: number
    w: number
    h: number
    color: string
    opacity: number
  }[] = []
  const t = S * 0.34
  props.board.forEach((row, r) =>
    row.forEach((id, c) => {
      if (!shown(id)) return
      const color = PIECE_BY_ID[id]!.color
      const cx = PAD + (c + 0.5) * S
      const cy = PAD + (r + 0.5) * S
      const opacity = opacityOf(id)
      if (row[c + 1] === id) {
        out.push({ key: `h${r}-${c}`, x: cx, y: cy - t / 2, w: S, h: t, color, opacity })
      }
      if (props.board[r + 1]?.[c] === id) {
        out.push({ key: `v${r}-${c}`, x: cx - t / 2, y: cy, w: t, h: S, color, opacity })
      }
    }),
  )
  return out
})
</script>

<style scoped>
.solution-board {
  display: block;
  width: 100%;
  height: auto;
}
</style>
