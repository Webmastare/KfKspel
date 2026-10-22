<template>
  <div class="femelva-container">
    <div class="header">
      <h1>FemElva</h1>
      <form class="controls" @submit.prevent="newGame(seedInput)">
        <label class="seed-field">
          <strong>Seed</strong>
          <input v-model.trim="seedInput" type="text" maxlength="20" placeholder="t.ex. kfk42" />
        </label>
        <button type="submit" :disabled="!seedInput">Spela</button>
        <button type="button" title="Slumpa en ny seed" @click="newGame(randomSeed())">
          🎲 Ny
        </button>
      </form>
      <div class="controls">
        <button
          v-for="d in DIFFICULTIES"
          :key="d.id"
          class="difficulty-btn"
          :class="{ active: d.id === difficulty }"
          @click="setDifficulty(d.id)"
        >
          {{ d.name }}
        </button>
        <label class="unique-toggle" :class="{ disabled: difficulty === 'free' }">
          <input
            type="checkbox"
            :checked="unique"
            :disabled="difficulty === 'free'"
            @change="setUnique(($event.target as HTMLInputElement).checked)"
          />
          Unik lösning
        </label>
      </div>
      <div class="controls">
        <span class="timer">⏱ {{ timeText }}</span>
        <button :disabled="!canTransformSelected" @click="transformSelected('rotate')">
          ↻ Rotera
        </button>
        <button :disabled="!canTransformSelected" @click="transformSelected('mirror')">
          ⇋ Spegla
        </button>
        <button :disabled="!generated || solved || hintPending" @click="giveHint">💡 Tips</button>
        <button :disabled="!generated" @click="restart">Börja om</button>
      </div>
      <p class="info">
        <template v-if="generated">
          Seed <strong>{{ seed }}</strong> · {{ loosePieceCount }} bitar att lägga ·
          {{ uniqueText }}
        </template>
        <template v-else>Genererar…</template>
      </p>
      <!-- Always rendered so the board doesn't jump when a message appears -->
      <p class="message" :class="{ empty: !message }" aria-live="polite">{{ message }}</p>
    </div>

    <div class="board-wrapper">
      <svg
        ref="svgRef"
        class="board-svg"
        :viewBox="`0 0 ${layout.viewW} ${layout.viewH}`"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @contextmenu.prevent
      >
        <defs>
          <filter id="kul-lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity="0.45" />
          </filter>
          <!-- Outline around the whole silhouette of the selected piece -->
          <filter id="kul-select" x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="grown" />
            <feFlood flood-color="#22c55e" />
            <feComposite in2="grown" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="kul-hole" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stop-color="#050505" />
            <stop offset="100%" stop-color="#1c1c1c" />
          </radialGradient>
        </defs>

        <rect
          class="tray-bg"
          :x="layout.trayX"
          :y="layout.trayY"
          :width="layout.trayCols * SLOT_W"
          :height="layout.trayRows * SLOT_H"
          rx="18"
        />

        <rect
          class="board-frame"
          :x="layout.frameX"
          :y="layout.frameY"
          :width="FRAME_W"
          :height="FRAME_H"
          rx="24"
        />
        <circle
          v-for="hole in holes"
          :key="hole.key"
          :cx="hole.x"
          :cy="hole.y"
          :r="CELL * 0.4"
          fill="url(#kul-hole)"
        />

        <circle
          v-for="(ghost, i) in ghostCells"
          :key="`ghost-${i}`"
          class="ghost"
          :cx="ghost.x"
          :cy="ghost.y"
          :r="CELL * 0.4"
          :fill="ghost.color"
        />

        <PuzzlePiece
          v-for="piece in renderOrder"
          :key="piece.id"
          :def="PIECE_BY_ID[piece.id]!"
          :cells="pieceCells(piece)"
          :x="viewOf(piece).x"
          :y="viewOf(piece).y"
          :scale="viewOf(piece).scale"
          :cell-size="CELL"
          :dragging="drag?.id === piece.id && drag.moved"
          :selected="selectedId === piece.id && !piece.locked"
          :locked="piece.locked"
          :shaking="shakingId === piece.id"
          @pointerdown="onPiecePointerDown(piece, $event)"
          @contextmenu.prevent="onPieceContextMenu(piece, $event)"
        />
      </svg>

      <div v-if="generating" class="win-overlay">
        <div class="win-card">Genererar pussel…</div>
      </div>
      <div v-else-if="solved" class="win-overlay">
        <div class="win-card">
          <h2>🎉 Löst!</h2>
          <p>
            Tid: {{ timeText }}
            <template v-if="hintsUsed > 0"> · {{ hintsUsed }} tips</template>
          </p>
          <div class="win-actions">
            <button @click="restart">Spela igen</button>
            <button @click="newGame(randomSeed())">🎲 Nytt pussel</button>
          </div>
        </div>
      </div>
    </div>

    <details class="game-help">
      <summary>Hur funkar spelet?</summary>
      <div class="help-content">
        <p>
          Fyll hela brädet (5 × 11) med alla bitar. Bitarna med en mörk prick sitter fast och är
          en del av startpositionen.
        </p>
        <ul>
          <li>Dra en bit till brädet. Släpper du den där den inte får plats åker den tillbaka.</li>
          <li>Klicka/tryck på en bit för att rotera den.</li>
          <li>Högerklicka eller använd <strong>⇋ Spegla</strong> för att spegla den.</li>
          <li>Tangentbord: <strong>R</strong> roterar och <strong>F</strong> speglar vald bit, även medan du drar.</li>
          <li><strong>💡 Tips</strong> lägger ut nästa bit åt dig, eller plockar bort en bit som ligger fel.</li>
        </ul>
        <h4>Seed och svårighet</h4>
        <p>
          Seeden bestämmer hur det lösta brädet ser ut. Svårigheten bestämmer hur många bitar du
          själv ska lägga ut – samma seed ger alltså samma lösning på alla nivåer. Med
          <strong>Unik lösning</strong> väljs startbitarna så att det bara finns en lösning. Dela
          länken så får andra samma pussel.
        </p>
      </div>
    </details>

    <AdvancedPanel :generated="generated" :pieces="pieces" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PuzzlePiece from '@/components/femelva/PuzzlePiece.vue'
import AdvancedPanel from '@/components/femelva/AdvancedPanel.vue'
import {
  BOARD_COLS,
  BOARD_ROWS,
  PIECES,
  PIECE_BY_ID,
  findPlacement,
  mirrored,
  rotated,
  type Cell,
} from '@/composables/femelva/pieces'
import {
  buildOccupancy,
  canPlace,
  createPieceStates,
  isSolved,
  pieceCells,
  type Occupancy,
  type PieceState,
  type Position,
} from '@/composables/femelva/board'
import {
  DIFFICULTIES,
  cellsOf,
  randomSeed,
  type DifficultyId,
  type GeneratedPuzzle,
} from '@/composables/femelva/generator'
import { placementOrder } from '@/composables/femelva/solver'
import { CancelledError, SolverChannel } from '@/composables/femelva/solverClient'

// Layout, in SVG user units
const CELL = 60
const FRAME_PAD = 18
const FRAME_W = BOARD_COLS * CELL + 2 * FRAME_PAD
const FRAME_H = BOARD_ROWS * CELL + 2 * FRAME_PAD
const TRAY_SCALE = 0.6
const SLOT_W = FRAME_W / 4
const SLOT_H = 150
const MARGIN = 10
const GAP = 20
const DRAG_THRESHOLD_PX = 6

interface Layout {
  viewW: number
  viewH: number
  frameX: number
  frameY: number
  trayX: number
  trayY: number
  trayCols: number
  trayRows: number
}

interface DragState {
  id: string
  pointerId: number
  ball: number // index of the grabbed ball
  startClientX: number
  startClientY: number
  pointerX: number
  pointerY: number
  offsetX: number // pointer minus grabbed ball center, at full scale
  offsetY: number
  lift: number // raise the piece above the finger on touch screens
  moved: boolean
}

type TransformKind = 'rotate' | 'mirror'

const route = useRoute()
const router = useRouter()
const generateChannel = new SolverChannel()
const hintChannel = new SolverChannel()

const svgRef = ref<SVGSVGElement | null>(null)
const seed = ref('')
const seedInput = ref('')
const difficulty = ref<DifficultyId>('medium')
const unique = ref(true)
const generated = ref<GeneratedPuzzle | null>(null)
const generating = ref(false)
const pieces = ref<PieceState[]>([])
const selectedId = ref<string | null>(null)
const shakingId = ref<string | null>(null)
const drag = ref<DragState | null>(null)
const isWide = ref(false)
const hintsUsed = ref(0)
const hintPending = ref(false)
const message = ref('')

const startedAt = ref<number | null>(null)
const now = ref(Date.now())
const finishedMs = ref<number | null>(null)
let timerId: number | null = null
let shakeTimeout: number | null = null
let messageTimeout: number | null = null

const solved = computed(() => pieces.value.length > 0 && isSolved(pieces.value))

const loosePieceCount = computed(() => PIECES.length - (generated.value?.puzzle.locked.length ?? 0))
const uniqueText = computed(() => {
  if (!generated.value) return ''
  if (difficulty.value === 'free' || !unique.value) return 'kan ha flera lösningar'
  if (!generated.value.reachedTarget) return 'unik lösning (färre lösa bitar än nivån, hittade ingen svårare)'
  return 'unik lösning'
})

// Each movable piece keeps a fixed tray slot; locked pieces take none
const traySlots = computed(() => {
  const slots = new Map<string, number>()
  pieces.value.filter((p) => !p.locked).forEach((p, i) => slots.set(p.id, i))
  return slots
})

// Tray to the right on wide screens, below the board otherwise
const layout = computed<Layout>(() => {
  const slotCount = Math.max(1, traySlots.value.size)
  if (isWide.value) {
    const trayCols = 3
    const trayRows = Math.ceil(slotCount / trayCols)
    const height = Math.max(FRAME_H, trayRows * SLOT_H)
    return {
      viewW: 2 * MARGIN + FRAME_W + GAP + trayCols * SLOT_W,
      viewH: 2 * MARGIN + height,
      frameX: MARGIN,
      frameY: MARGIN + (height - FRAME_H) / 2,
      trayX: MARGIN + FRAME_W + GAP,
      trayY: MARGIN,
      trayCols,
      trayRows,
    }
  }
  const trayCols = 4
  const trayRows = Math.ceil(slotCount / trayCols)
  return {
    viewW: 2 * MARGIN + FRAME_W,
    viewH: 2 * MARGIN + FRAME_H + GAP + trayRows * SLOT_H,
    frameX: MARGIN,
    frameY: MARGIN,
    trayX: MARGIN,
    trayY: MARGIN + FRAME_H + GAP,
    trayCols,
    trayRows,
  }
})

const boardX = computed(() => layout.value.frameX + FRAME_PAD)
const boardY = computed(() => layout.value.frameY + FRAME_PAD)

const holes = computed(() => {
  const out: { key: string; x: number; y: number }[] = []
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      out.push({
        key: `${r}-${c}`,
        x: boardX.value + (c + 0.5) * CELL,
        y: boardY.value + (r + 0.5) * CELL,
      })
    }
  }
  return out
})

// SVG has no z-index: board pieces first, then the tray, the dragged piece last
const renderOrder = computed(() => {
  const rank = (p: PieceState) => (drag.value?.id === p.id ? 2 : p.position ? 0 : 1)
  return [...pieces.value].sort((a, b) => rank(a) - rank(b))
})

function bounds(cells: Cell[]) {
  return {
    rows: Math.max(...cells.map((c) => c[0])) + 1,
    cols: Math.max(...cells.map((c) => c[1])) + 1,
  }
}

function viewOf(piece: PieceState): { x: number; y: number; scale: number } {
  const cells = pieceCells(piece)
  const d = drag.value
  if (d && d.id === piece.id && d.moved) {
    const ball = cells[d.ball]!
    return {
      x: d.pointerX - d.offsetX - (ball[1] + 0.5) * CELL,
      y: d.pointerY - d.offsetY - d.lift - (ball[0] + 0.5) * CELL,
      scale: 1,
    }
  }
  if (piece.position) {
    return {
      x: boardX.value + piece.position.col * CELL,
      y: boardY.value + piece.position.row * CELL,
      scale: 1,
    }
  }
  const index = traySlots.value.get(piece.id) ?? 0
  const slotCol = index % layout.value.trayCols
  const slotRow = Math.floor(index / layout.value.trayCols)
  const { rows, cols } = bounds(cells)
  const size = CELL * TRAY_SCALE
  return {
    x: layout.value.trayX + slotCol * SLOT_W + (SLOT_W - cols * size) / 2,
    y: layout.value.trayY + slotRow * SLOT_H + (SLOT_H - rows * size) / 2,
    scale: TRAY_SCALE,
  }
}

// Board position the dragged piece would snap to, or null if it doesn't fit
const dropTarget = computed<Position | null>(() => {
  const d = drag.value
  if (!d || !d.moved) return null
  const piece = pieces.value.find((p) => p.id === d.id)
  if (!piece) return null
  const view = viewOf(piece)
  const row = Math.round((view.y - boardY.value) / CELL)
  const col = Math.round((view.x - boardX.value) / CELL)
  const occupancy = buildOccupancy(pieces.value, piece.id)
  return canPlace(occupancy, pieceCells(piece), row, col) ? { row, col } : null
})

const ghostCells = computed(() => {
  const target = dropTarget.value
  const piece = pieces.value.find((p) => p.id === drag.value?.id)
  if (!target || !piece) return []
  const color = PIECE_BY_ID[piece.id]!.color
  return pieceCells(piece).map(([r, c]) => ({
    x: boardX.value + (target.col + c + 0.5) * CELL,
    y: boardY.value + (target.row + r + 0.5) * CELL,
    color,
  }))
})

const selectedPiece = computed(() => pieces.value.find((p) => p.id === selectedId.value) ?? null)
const canTransformSelected = computed(
  () => !!selectedPiece.value && !selectedPiece.value.locked && !solved.value,
)

const timeText = computed(() => {
  const ms =
    finishedMs.value ?? (startedAt.value === null ? 0 : Math.max(0, now.value - startedAt.value))
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
})

function startTimer() {
  if (startedAt.value !== null) return
  startedAt.value = Date.now()
  now.value = startedAt.value
  timerId = window.setInterval(() => (now.value = Date.now()), 250)
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
}

async function newGame(nextSeed: string) {
  if (!nextSeed) return
  seed.value = nextSeed
  seedInput.value = nextSeed
  router.replace({
    query: { ...route.query, seed: nextSeed, d: difficulty.value, u: unique.value ? '1' : '0' },
  })
  generating.value = true
  try {
    generated.value = await generateChannel.generate(nextSeed, difficulty.value, unique.value)
    generating.value = false
    restart()
  } catch (err) {
    // A newer generation replaced this one and owns the loading state
    if (err instanceof CancelledError) return
    generating.value = false
    showMessage('Kunde inte generera pusslet.')
  }
}

function setDifficulty(id: DifficultyId) {
  difficulty.value = id
  newGame(seed.value)
}

function setUnique(value: boolean) {
  unique.value = value
  newGame(seed.value)
}

function restart() {
  if (!generated.value) return
  hintChannel.cancel()
  hintPending.value = false
  pieces.value = createPieceStates(generated.value.puzzle)
  selectedId.value = null
  drag.value = null
  hintsUsed.value = 0
  message.value = ''
  stopTimer()
  startedAt.value = null
  finishedMs.value = null
}

function showMessage(text: string) {
  message.value = text
  if (messageTimeout !== null) window.clearTimeout(messageTimeout)
  messageTimeout = window.setTimeout(() => (message.value = ''), 5000)
}

// Places the next piece of a solution reachable from the current board, or takes back a
// misplaced piece when the current board can't be completed
async function giveHint() {
  if (!generated.value || solved.value || hintPending.value) return
  const loose = pieces.value.filter((p) => !p.position).map((p) => p.id)
  hintPending.value = true
  try {
    const result = await hintChannel.solve(buildOccupancy(pieces.value), loose, {
      limit: 1,
      keep: 1,
      timeLimitMs: 4000,
    })
    const solution = result.solutions[0]
    if (solution) placeFromSolution(solution, loose)
    else if (result.exhausted) takeBackWrongPiece()
    else showMessage('Hittade inget tips i tid – prova att ta bort några bitar.')
  } catch (err) {
    if (!(err instanceof CancelledError)) showMessage('Något gick fel med tipset.')
  } finally {
    hintPending.value = false
  }
}

function placeFromSolution(solution: Occupancy, loose: string[]) {
  // Same order as the guide: the piece covering the leftmost empty cell
  const id = placementOrder(solution, loose)[0]
  const piece = pieces.value.find((p) => p.id === id)
  if (!id || !piece || piece.position) return
  const placement = findPlacement(PIECE_BY_ID[id]!, cellsOf(solution, id))
  if (!placement) return
  const cells = pieceCells({ ...piece, ...placement })
  // The board may have changed while the hint was computed
  if (!canPlace(buildOccupancy(pieces.value, id), cells, placement.row, placement.col)) return
  piece.rotation = placement.rotation
  piece.flipped = placement.flipped
  piece.position = { row: placement.row, col: placement.col }
  selectedId.value = id
  hintsUsed.value++
  startTimer()
  showMessage(`Tips: den ${PIECE_BY_ID[id]!.name} biten ska ligga här.`)
  checkSolved()
}

function takeBackWrongPiece() {
  const solution = generated.value!.solution
  const wrong = pieces.value.find(
    (p) =>
      !p.locked &&
      p.position &&
      !pieceCells(p).every(([r, c]) => solution[r + p.position!.row]![c + p.position!.col] === p.id),
  )
  if (!wrong) {
    showMessage('Det finns ingen lösning härifrån.')
    return
  }
  wrong.position = null
  shake(wrong.id)
  hintsUsed.value++
  showMessage(
    `Det finns ingen lösning härifrån – den ${PIECE_BY_ID[wrong.id]!.name} biten låg fel och är tillbaka i lådan.`,
  )
}

function checkSolved() {
  if (!solved.value || finishedMs.value !== null) return
  stopTimer()
  finishedMs.value = startedAt.value === null ? 0 : Date.now() - startedAt.value
  selectedId.value = null
}

function toSvgPoint(e: MouseEvent) {
  const ctm = svgRef.value?.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

// Index of the ball closest to the pointer, plus the pointer offset from it at full scale
function grabInfo(piece: PieceState, e: MouseEvent) {
  const view = viewOf(piece)
  const p = toSvgPoint(e)
  const localX = (p.x - view.x) / view.scale
  const localY = (p.y - view.y) / view.scale
  let ball = 0
  let best = Infinity
  pieceCells(piece).forEach(([r, c], i) => {
    const dist = ((c + 0.5) * CELL - localX) ** 2 + ((r + 0.5) * CELL - localY) ** 2
    if (dist < best) {
      best = dist
      ball = i
    }
  })
  const cell = pieceCells(piece)[ball]!
  return {
    ball,
    pointer: p,
    offsetX: localX - (cell[1] + 0.5) * CELL,
    offsetY: localY - (cell[0] + 0.5) * CELL,
  }
}

function shake(id: string) {
  shakingId.value = id
  if (shakeTimeout !== null) window.clearTimeout(shakeTimeout)
  shakeTimeout = window.setTimeout(() => (shakingId.value = null), 300)
}

// Rotates/mirrors a piece around one of its balls. On the board it must still fit.
function transformPiece(piece: PieceState, kind: TransformKind, pivot?: number) {
  if (piece.locked || solved.value) return
  const next = kind === 'rotate' ? rotated(piece) : mirrored(piece)
  startTimer()
  if (!piece.position) {
    Object.assign(piece, next)
    return
  }
  const oldCells = pieceCells(piece)
  const newCells = pieceCells({ ...piece, ...next })
  const i = pivot ?? centralBall(oldCells)
  const row = piece.position.row + oldCells[i]![0] - newCells[i]![0]
  const col = piece.position.col + oldCells[i]![1] - newCells[i]![1]
  if (!canPlace(buildOccupancy(pieces.value, piece.id), newCells, row, col)) {
    shake(piece.id)
    return
  }
  Object.assign(piece, next, { position: { row, col } })
}

function centralBall(cells: Cell[]) {
  const { rows, cols } = bounds(cells)
  let best = 0
  let bestDist = Infinity
  cells.forEach(([r, c], i) => {
    const dist = (r + 0.5 - rows / 2) ** 2 + (c + 0.5 - cols / 2) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

function transformSelected(kind: TransformKind) {
  const piece = selectedPiece.value
  if (!piece) return
  const d = drag.value
  transformPiece(piece, kind, d && d.id === piece.id ? d.ball : undefined)
}

function onPiecePointerDown(piece: PieceState, e: PointerEvent) {
  if (e.button !== 0 || drag.value || solved.value) return
  selectedId.value = piece.id
  if (piece.locked) return
  e.preventDefault()
  const { ball, pointer, offsetX, offsetY } = grabInfo(piece, e)
  svgRef.value?.setPointerCapture(e.pointerId)
  drag.value = {
    id: piece.id,
    pointerId: e.pointerId,
    ball,
    startClientX: e.clientX,
    startClientY: e.clientY,
    pointerX: pointer.x,
    pointerY: pointer.y,
    offsetX,
    offsetY,
    lift: e.pointerType === 'touch' ? CELL * 0.8 : 0,
    moved: false,
  }
}

function onPointerMove(e: PointerEvent) {
  const d = drag.value
  if (!d || d.pointerId !== e.pointerId) return
  const p = toSvgPoint(e)
  d.pointerX = p.x
  d.pointerY = p.y
  if (!d.moved) {
    const dist = Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY)
    if (dist < DRAG_THRESHOLD_PX) return
    d.moved = true
    startTimer()
    // Lift it off the board so its own cells don't block the drop target
    const piece = pieces.value.find((x) => x.id === d.id)
    if (piece) piece.position = null
  }
}

function onPointerUp(e: PointerEvent) {
  const d = drag.value
  if (!d || d.pointerId !== e.pointerId) return
  const piece = pieces.value.find((p) => p.id === d.id)
  if (piece) {
    if (d.moved) {
      // Dropped where it doesn't fit: back to the tray
      piece.position = dropTarget.value
    } else {
      transformPiece(piece, 'rotate', d.ball)
    }
  }
  drag.value = null
  checkSolved()
}

function onPointerCancel(e: PointerEvent) {
  if (drag.value?.pointerId === e.pointerId) drag.value = null
}

function onPieceContextMenu(piece: PieceState, e: MouseEvent) {
  // Long-press on touch screens fires contextmenu mid-drag; ignore that
  if (drag.value) return
  selectedId.value = piece.id
  transformPiece(piece, 'mirror', grabInfo(piece, e).ball)
  checkSolved()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const key = e.key.toLowerCase()
  if (key === 'r') transformSelected('rotate')
  else if (key === 'f') transformSelected('mirror')
  else return
  checkSolved()
}

function updateWide() {
  isWide.value = window.innerWidth >= 900 && window.innerWidth > window.innerHeight * 1.3
}

onMounted(() => {
  // Shared links carry ?seed=...&d=...&u=...
  const { seed: querySeed, d, u } = route.query
  if (DIFFICULTIES.some((x) => x.id === d)) difficulty.value = d as DifficultyId
  unique.value = u !== '0'
  newGame(typeof querySeed === 'string' && querySeed ? querySeed.slice(0, 20) : randomSeed())
  updateWide()
  window.addEventListener('resize', updateWide)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  stopTimer()
  generateChannel.cancel()
  hintChannel.cancel()
  if (shakeTimeout !== null) window.clearTimeout(shakeTimeout)
  if (messageTimeout !== null) window.clearTimeout(messageTimeout)
  window.removeEventListener('resize', updateWide)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped lang="scss">
@use '@/styles/theme.scss';

.femelva-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  text-align: center;
  width: 100%;

  h1 {
    margin: 0 0 12px 0;
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: bold;
    color: var(--theme-modal-header);
    text-shadow: var(--theme-shadow-sm);
  }
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 10px;
}

button {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 12px;
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--theme-button-secondary-hover);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.seed-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  input {
    width: 9rem;
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    border: 2px solid var(--theme-input-border);
    background: var(--theme-input-bg);
    color: var(--theme-text-primary);
    font-family: monospace;
    font-size: 1rem;
  }
}

.unique-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-weight: 500;

  &.disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.info {
  margin: 10px 0 0;
  color: var(--theme-text-secondary);
  font-size: 0.95rem;
}

.message {
  margin: 6px auto 0;
  padding: 0.4rem 0.8rem;
  width: fit-content;
  max-width: 100%;
  border-radius: 10px;
  min-height: 2.2rem;
  background: var(--theme-bg-elevated);
  color: var(--theme-text-primary);
  font-weight: 500;

  &.empty {
    background: transparent;
  }
}

.win-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.difficulty-btn.active {
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
}

.timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: 12px;
  background: var(--theme-sidebar-bg);
  color: var(--theme-sidebar-text);
  box-shadow: var(--theme-shadow-sm);
}

.board-wrapper {
  position: relative;
  width: 100%;
  max-width: 1300px;
  display: flex;
  justify-content: center;
}

.board-svg {
  width: 100%;
  height: auto;
  max-height: calc(100vh - 14rem);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.board-frame {
  fill: #161616;
  stroke: #2c2c2c;
  stroke-width: 4;
}

.tray-bg {
  fill: var(--theme-bg-secondary);
  stroke: var(--theme-border-light);
  stroke-width: 2;
}

.ghost {
  opacity: 0.4;
  pointer-events: none;
}

.win-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.win-card {
  pointer-events: auto;
  padding: 1.5rem 2rem;
  border-radius: 18px;
  text-align: center;
  background: var(--theme-modal-bg);
  color: var(--theme-modal-text);
  border: 1px solid var(--theme-modal-border);
  box-shadow: 0 15px 35px var(--theme-modal-shadow);

  h2 {
    margin: 0 0 0.5rem;
    color: var(--theme-modal-header);
  }

  p {
    margin: 0 0 1rem;
  }
}

.game-help {
  width: min(700px, 100%);
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-light);
  border-radius: 12px;
  padding: 0.8rem 1rem;

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  .help-content {
    color: var(--theme-text-secondary);
    line-height: 1.5;

    ul {
      padding-left: 1.2rem;
    }
  }
}
</style>
