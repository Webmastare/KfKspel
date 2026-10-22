<template>
  <div class="stats-card" :class="tone">
    <div class="top-row">
      <span class="status-chip">
        <span class="dot" />
        {{ statusText }}
      </span>
      <span class="elapsed">{{ formatTime(state.elapsedMs) }}</span>
    </div>

    <div class="count-row">
      <span v-if="state.status === 'failed'" class="count-number">–</span>
      <template v-else>
        <span v-if="isLowerBound" class="count-prefix">minst</span>
        <span class="count-number">{{ format(state.count) }}</span>
      </template>
      <span class="count-label">{{ countLabel }}</span>
    </div>
    <p v-if="detailText" class="detail">{{ detailText }}</p>

    <div
      class="progress"
      :class="{ indeterminate: searching && state.covered === 0 }"
      role="progressbar"
      :aria-valuenow="Math.round(coveredPercent)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="progress-fill" :style="{ width: `${coveredPercent}%` }" />
    </div>
    <div class="progress-row">
      <span>{{ coveredText }}</span>
      <span v-if="state.timeLimitMs !== null && searching">
        tidsgräns {{ formatTime(state.timeLimitMs) }}
      </span>
    </div>

    <div v-if="searching || canSearchAgain" class="actions">
      <button v-if="searching" @click="emit('stop')">■ Stoppa</button>
      <button @click="emit('searchAgain')">↻ Sök igen utan tidsgräns</button>
    </div>

    <details v-if="searching || state.count > 1" class="search-info">
      <summary>Om sökningen</summary>
      <dl class="info-grid">
        <div>
          <dt>Söktid</dt>
          <dd>{{ formatTime(state.elapsedMs) }}</dd>
        </div>
        <div>
          <dt>Undersökta lägen</dt>
          <dd>{{ format(state.nodes) }}</dd>
        </div>
        <div>
          <dt>Hastighet</dt>
          <dd>{{ format(perSecond(state.nodes)) }} lägen/s</dd>
        </div>
        <div>
          <dt>Lösningar/s</dt>
          <dd>{{ format(perSecond(state.count)) }}</dd>
        </div>
        <div>
          <dt>Genomsökt</dt>
          <dd>≈ {{ coveredPercent.toFixed(coveredPercent < 10 ? 1 : 0) }} %</dd>
        </div>
        <div v-if="searching">
          <dt>Tid kvar</dt>
          <dd>{{ remainingText }}</dd>
        </div>
        <div>
          <dt>Bitar att lägga</dt>
          <dd>{{ state.pieceCount }}</dd>
        </div>
        <div>
          <dt>Tomma hål</dt>
          <dd>{{ state.emptyCells }}</dd>
        </div>
        <div>
          <dt>Gränser</dt>
          <dd>
            {{ state.timeLimitMs === null ? 'ingen tidsgräns' : formatTime(state.timeLimitMs) }}
          </dd>
        </div>
      </dl>
      <p class="method">
        Sökningen fyller alltid det tomma hålet längst till vänster med varje bit som passar, i alla
        vridningar, och backar när den kör fast. Hur stor del som är genomsökt uppskattas från de
        första valen i sökträdet, så siffran och tiden kvar kan hoppa.
      </p>
    </details>
  </div>
</template>

<script lang="ts">
import type { Occupancy } from '@/composables/femelva/board'

export type SearchStatus = 'searching' | 'exact' | 'timeout' | 'stopped' | 'failed'

export interface SearchState {
  status: SearchStatus
  count: number
  nodes: number
  elapsedMs: number
  covered: number // estimated share of the search tree done, 0–1
  solutions: Occupancy[]
  pieceCount: number
  emptyCells: number
  timeLimitMs: number | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  state: SearchState
}>()

const emit = defineEmits<{
  stop: []
  searchAgain: []
}>()

const format = (n: number) => Math.round(n).toLocaleString('sv-SE')

function formatTime(ms: number) {
  const s = ms / 1000
  if (s < 60) return `${s.toLocaleString('sv-SE', { maximumFractionDigits: s < 10 ? 1 : 0 })} s`
  const min = Math.floor(s / 60)
  return `${min} min ${Math.floor(s % 60)
    .toString()
    .padStart(2, '0')} s`
}

const perSecond = (n: number) =>
  props.state.elapsedMs > 0 ? (n * 1000) / props.state.elapsedMs : 0

const searching = computed(() => props.state.status === 'searching')
const isLowerBound = computed(() => ['timeout', 'stopped'].includes(props.state.status))
const canSearchAgain = computed(() => ['timeout', 'stopped'].includes(props.state.status))
const coveredPercent = computed(() => Math.min(100, props.state.covered * 100))

const tone = computed(() => {
  const { status, count } = props.state
  if (status === 'failed' || (status === 'exact' && count === 0)) return 'tone-bad'
  if (status === 'exact') return 'tone-good'
  if (status === 'searching') return 'tone-busy'
  return 'tone-partial'
})

const statusText = computed(() => {
  switch (props.state.status) {
    case 'searching':
      return 'Söker…'
    case 'exact':
      return 'Klar – exakt antal'
    case 'timeout':
      return 'Tidsgränsen nådd'
    case 'stopped':
      return 'Stoppad'
    case 'failed':
      return 'Fel'
  }
})

const countLabel = computed(() => {
  const { status, count } = props.state
  if (status === 'failed') return 'kunde inte räkna lösningar'
  if (status === 'searching')
    return count === 1 ? 'lösning hittad hittills' : 'lösningar hittade hittills'
  return count === 1 ? 'lösning' : 'lösningar'
})

const detailText = computed(() => {
  const { status, count } = props.state
  if (status !== 'exact') return ''
  if (count === 0) return 'Inga lösningar – någon bit ligger fel.'
  if (count === 1) return 'Unik lösning – det finns bara ett sätt att lägga bitarna.'
  return ''
})

const coveredText = computed(() => {
  const { status } = props.state
  if (status === 'exact') return 'Allt genomsökt'
  if (status === 'searching' && props.state.covered === 0) return 'Startar…'
  return `≈ ${coveredPercent.value.toFixed(coveredPercent.value < 10 ? 1 : 0)} % genomsökt`
})

const remainingText = computed(() => {
  const { covered, elapsedMs, timeLimitMs } = props.state
  if (covered < 0.01) return 'okänt'
  const remaining = (elapsedMs * (1 - covered)) / covered
  if (timeLimitMs !== null && elapsedMs + remaining > timeLimitMs) {
    return `≈ ${formatTime(remaining)} (hinner nog inte)`
  }
  return `≈ ${formatTime(remaining)}`
})
</script>

<style scoped lang="scss">
.stats-card {
  --accent: var(--theme-info);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.9rem 1rem;
  margin: 0.4rem 0 0.8rem;
  border-radius: 12px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-light);
  border-left: 4px solid var(--accent);

  &.tone-good {
    --accent: var(--theme-success);
  }
  &.tone-partial {
    --accent: var(--theme-warning);
  }
  &.tone-bad {
    --accent: var(--theme-error);
  }
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--accent);
  }

  .tone-busy & .dot {
    animation: pulse 1.1s ease-in-out infinite;
  }
}

.elapsed {
  font-variant-numeric: tabular-nums;
  color: var(--theme-text-tertiary);
  font-size: 0.85rem;
}

.count-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.count-prefix {
  color: var(--theme-text-secondary);
  font-weight: 600;
}

.count-number {
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--theme-text-primary);
}

.count-label {
  color: var(--theme-text-secondary);
}

.detail {
  margin: 0;
  font-weight: 600;
  color: var(--accent);
}

.progress {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--theme-bg-secondary);
  overflow: hidden;

  &.indeterminate .progress-fill {
    width: 30% !important;
    animation: slide 1.2s ease-in-out infinite;
  }
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s ease;
}

.progress-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--theme-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.actions button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 10px;
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: var(--theme-button-secondary-hover);
  }
}

.search-info {
  border-top: 1px solid var(--theme-border-light);
  padding-top: 0.45rem;

  summary {
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--theme-text-secondary);
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem 1rem;
  margin: 0.6rem 0;

  dt {
    font-size: 0.75rem;
    color: var(--theme-text-tertiary);
  }

  dd {
    margin: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.method {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--theme-text-tertiary);
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@keyframes slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(340%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-chip .dot,
  .progress .progress-fill {
    animation: none !important;
  }
}
</style>
