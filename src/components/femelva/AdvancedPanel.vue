<template>
  <details class="advanced" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary>Avancerat – lösningar och guide <span class="spoiler">(spoilers!)</span></summary>

    <div v-if="generated" class="advanced-content">
      <section>
        <h3>Lösningen</h3>
        <p class="muted">Brädet som seeden genererade.</p>
        <div class="main-solution">
          <SolutionBoard :board="generated.solution" />
        </div>
      </section>

      <section>
        <h3>Antal lösningar</h3>
        <div class="mode-toggle">
          <label>
            <input v-model="mode" type="radio" value="start" />
            Från startpositionen
          </label>
          <label>
            <input v-model="mode" type="radio" value="current" />
            Från ditt nuvarande bräde
          </label>
        </div>
        <SolutionStats
          v-if="search"
          :state="search"
          @stop="stopSearch"
          @search-again="searchAgain"
        />

        <div v-if="search && search.solutions.length > 0" class="solution-grid">
          <button
            v-for="(board, i) in search.solutions"
            :key="i"
            class="solution-card"
            :class="{ active: guideBoard === board }"
            :title="'Följ den här lösningen i guiden'"
            @click="selectGuideBoard(board)"
          >
            <SolutionBoard :board="board" />
            <span>Lösning {{ i + 1 }}</span>
          </button>
        </div>
        <p v-if="search && search.count > search.solutions.length" class="muted">
          Visar de {{ search.solutions.length }} första. Klicka på en lösning för att följa den i
          guiden.
        </p>
      </section>

      <section>
        <h3>Guide</h3>
        <p class="muted">
          Arbeta från vänster till höger: fyll alltid det tomma hålet längst till vänster (uppifrån
          och ner) först. Då finns det oftast bara ett par bitar som passar.
        </p>
        <div class="main-solution">
          <SolutionBoard
            :board="guideSolution"
            :visible="guideVisible"
            :highlight="guideOrder[step - 1] ?? null"
          />
        </div>
        <p class="step-text">{{ stepText }}</p>
        <div class="step-controls">
          <button :disabled="step === 0" @click="step = 0">⏮</button>
          <button :disabled="step === 0" @click="step--">◀ Föregående</button>
          <span class="step-count">{{ step }} / {{ guideOrder.length }}</span>
          <button :disabled="step === guideOrder.length" @click="step++">Nästa ▶</button>
          <button :disabled="step === guideOrder.length" @click="step = guideOrder.length">
            ⏭
          </button>
        </div>
      </section>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import SolutionBoard from '@/components/femelva/SolutionBoard.vue'
import SolutionStats, { type SearchState } from '@/components/femelva/SolutionStats.vue'
import {
  buildOccupancy,
  createPieceStates,
  type Occupancy,
  type PieceState,
} from '@/composables/femelva/board'
import type { GeneratedPuzzle } from '@/composables/femelva/generator'
import { PIECE_BY_ID } from '@/composables/femelva/pieces'
import { placementOrder } from '@/composables/femelva/solver'
import { CancelledError, SolverChannel } from '@/composables/femelva/solverClient'

const props = defineProps<{
  generated: GeneratedPuzzle | null
  pieces: PieceState[]
}>()

const COUNT_TIME_MS = 60000
const SHOWN_SOLUTIONS = 10

const channel = new SolverChannel()
const open = ref(false)
const mode = ref<'start' | 'current'>('start')
const search = ref<SearchState | null>(null)
const guideBoard = ref<Occupancy | null>(null)
const step = ref(0)
let lastKey = ''
let debounce: number | null = null
let noTimeLimitOnce = false

// Pieces the player has to place, in the order the guide places them
const guideSolution = computed(() => guideBoard.value ?? props.generated?.solution ?? [])
const lockedIds = computed(() => props.generated?.puzzle.locked.map((l) => l.pieceId) ?? [])
const guideOrder = computed(() => {
  const loose = props.pieces.filter((p) => !p.locked).map((p) => p.id)
  return placementOrder(guideSolution.value, loose)
})
const guideVisible = computed(() => [...lockedIds.value, ...guideOrder.value.slice(0, step.value)])

const stepText = computed(() => {
  const total = guideOrder.value.length
  if (step.value === 0) return `Startposition – ${total} bitar ska läggas ut.`
  const name = PIECE_BY_ID[guideOrder.value[step.value - 1]!]!.name
  return `Steg ${step.value} av ${total}: lägg den ${name} biten.`
})

function selectGuideBoard(board: Occupancy) {
  guideBoard.value = board
  step.value = 0
}

function countKey() {
  if (!props.generated) return ''
  const pieces =
    mode.value === 'current'
      ? props.pieces
          .map((p) => `${p.id}:${p.position?.row},${p.position?.col},${p.rotation},${p.flipped}`)
          .join('|')
      : ''
  return `${props.generated.puzzle.id}/${mode.value}/${pieces}`
}

function searchPieces(generated: GeneratedPuzzle) {
  return mode.value === 'start' ? createPieceStates(generated.puzzle) : props.pieces
}

function freshSearch(pieces: PieceState[], timeLimitMs: number | null): SearchState {
  return {
    status: 'searching',
    count: 0,
    nodes: 0,
    elapsedMs: 0,
    covered: 0,
    solutions: [],
    pieceCount: pieces.filter((p) => !p.position).length,
    emptyCells: buildOccupancy(pieces)
      .flat()
      .filter((id) => id === null).length,
    timeLimitMs,
  }
}

async function runCount() {
  debounce = null
  const generated = props.generated
  const key = countKey()
  if (!open.value || !generated || key === lastKey) return
  lastKey = key
  const pieces = searchPieces(generated)
  const timeLimitMs = noTimeLimitOnce ? null : COUNT_TIME_MS
  noTimeLimitOnce = false
  search.value = freshSearch(pieces, timeLimitMs)
  // Updates go to the state object of this run, so late messages from an old run are harmless
  const state = search.value
  try {
    const result = await channel.solve(
      buildOccupancy(pieces),
      pieces.filter((p) => !p.position).map((p) => p.id),
      {
        keep: SHOWN_SOLUTIONS,
        ...(timeLimitMs === null ? {} : { timeLimitMs }),
      },
      (progress) => {
        state.count = progress.count
        state.nodes = progress.nodes
        state.elapsedMs = progress.elapsedMs
        state.covered = progress.covered
        state.solutions.push(...progress.newSolutions)
      },
    )
    state.count = result.count
    state.nodes = result.nodes
    state.elapsedMs = result.elapsedMs
    if (result.exhausted) state.covered = 1
    // Keep the boards already shown so a selected one stays selected
    state.solutions.push(...result.solutions.slice(state.solutions.length))
    state.status = result.exhausted ? 'exact' : 'timeout'
  } catch (err) {
    // Cancelled: a newer count or the stop button owns the state now
    if (err instanceof CancelledError) return
    state.status = 'failed'
  }
}

function scheduleCount() {
  if (debounce !== null) window.clearTimeout(debounce)
  // Show the loading state right away so a stale count is never displayed
  if (open.value && props.generated && countKey() !== lastKey) {
    search.value = freshSearch(searchPieces(props.generated), COUNT_TIME_MS)
  }
  debounce = window.setTimeout(runCount, 200)
}

function stopSearch() {
  if (search.value?.status !== 'searching') return
  if (debounce !== null) window.clearTimeout(debounce)
  debounce = null
  channel.cancel()
  search.value.status = 'stopped'
}

function searchAgain() {
  noTimeLimitOnce = true
  lastKey = ''
  scheduleCount()
}

watch([open, mode, () => props.generated, countKey], scheduleCount, { immediate: true })

watch(
  () => props.generated,
  () => {
    guideBoard.value = null
    step.value = 0
  },
)

onUnmounted(() => {
  channel.cancel()
  if (debounce !== null) window.clearTimeout(debounce)
})
</script>

<style scoped lang="scss">
.advanced {
  width: min(700px, 100%);
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  border-radius: 12px;
  padding: 0.8rem 1rem;

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  .spoiler {
    font-weight: 400;
    color: var(--theme-text-tertiary);
  }
}

.advanced-content {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-top: 0.8rem;

  h3 {
    margin: 0 0 0.3rem;
    font-size: 1.1rem;
  }
}

.muted {
  margin: 0 0 0.6rem;
  color: var(--theme-text-tertiary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.main-solution {
  max-width: 440px;
}

.mode-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.4rem;

  label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }
}

.solution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}

.solution-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.35rem;
  border: 2px solid transparent;
  border-radius: 10px;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;

  &.active {
    border-color: #22c55e;
  }
}

.step-text {
  font-weight: 600;
  margin: 0.6rem 0;
}

.step-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;

  button {
    padding: 0.45rem 0.8rem;
    border: none;
    border-radius: 10px;
    background: var(--theme-button-secondary-bg);
    color: var(--theme-button-secondary-text);
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
}

.step-count {
  font-variant-numeric: tabular-nums;
  min-width: 3.5rem;
  text-align: center;
}
</style>
