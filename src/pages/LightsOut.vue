<template>
  <div class="app-container">
    <h1>Lights Out</h1>
    <div class="settings">
      <div class="sub-setting">
        <span class="clicks">Klickar: {{ clicks }}</span>
        <span class="score">Poäng: {{ score }}</span>
        <span class="timeLeft">Tid kvar: {{ timeLeft }}</span>
        <span class="difficulty-indicator" :class="{ 'hard-mode': isHardMode }">
          {{ isHardMode ? '🔥 Hard' : 'Normal' }}
        </span>
      </div>
      <div class="sub-setting">
        <div class="seed-label">
          <label for="seedCode"><strong>Seed:</strong></label>
          <button @click="resetGame">Använd</button>
        </div>

        <input
          id="seedCode"
          type="text"
          :value="seedCode"
          @input="onSeedInput"
          placeholder="a1b"
          maxlength="3"
        />

        <button
          @click="restartLevel"
          class="restart-btn"
          title="Starta om nivån"
          aria-label="Starta om nivån"
        >
          ↻ Nivå
        </button>
        <button
          @click="resetGame"
          class="restart-btn entire-game-btn"
          title="Starta om spelet"
          aria-label="Starta om spelet"
        >
          ↻ Spel
        </button>
      </div>
    </div>
    <!-- Leaderboard Section (similar to Kfkblock) -->
    <div class="leaderboard-container">
      <button @click="toggleLeaderboard" class="leaderboard-toggle">
        <span>🏆 Topplista {{ isHardMode ? '(Hard Mode)' : '(Normal)' }}</span>
        <span class="toggle-icon" :class="{ expanded: showLeaderboard }">▼</span>
      </button>
      <div class="leaderboard-wrapper" :class="{ expanded: showLeaderboard }">
        <div class="leaderboard-content">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Spelare</th>
                <th>Poäng</th>
                <th>Klickar</th>
                <th>Seed</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in groupedScores" :key="group.seed">
                <!-- Seed breaker row -->
                <tr class="seed-row">
                  <td colspan="6">
                    <div class="seed-row__content">
                      <span class="seed-tag"
                        >Seed: <strong>{{ group.seed }}</strong></span
                      >
                      <span class="seed-meta"
                        >Bäst: <strong>{{ group.best.score }}</strong
                        >p • <strong>{{ group.best.clicks }}</strong> klickar</span
                      >
                      <button class="seed-row__btn" @click="useSeed(group.seed)">
                        Använd seed
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- Top 3 entries for the seed -->
                <tr
                  v-for="entry in group.entries"
                  :key="entry.key"
                  :class="['leaderboard-row', `rank-${entry.rank}`]"
                >
                  <td class="rank">{{ entry.rank }}</td>
                  <td>{{ entry.playerID }}</td>
                  <td>{{ entry.score }}</td>
                  <td>{{ entry.clicks }}</td>
                  <td class="col-seed">{{ group.seed }}</td>
                  <td class="col-date">{{ formatDate(entry.date) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="game-wrapper">
      <div
        class="game-container"
        :class="{ 'hard-mode': isHardMode }"
        :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }"
      >
        <Cell
          v-for="(cell, index) in gameBoard"
          :key="index"
          :isClicked="cell.isClicked"
          :state="cell.state"
          :isHardMode="isHardMode"
          @pressed="handleCellClick(index)"
        />
      </div>
    </div>

    <!-- Difficulty toggle -->
    <div class="difficulty-toggle">
      <button
        @click="toggleDifficulty"
        class="difficulty-btn"
        :class="{ 'hard-active': isHardMode }"
      >
        {{ isHardMode ? '🔥 Hard Mode' : 'Normal Mode' }}
      </button>
    </div>

    <!-- Save score modal -->
    <SaveLightsOutScore
      v-if="showSaveModal"
      :score="score"
      :clicks="clicks"
      :seed="seedCode"
      :difficulty="isHardMode ? 'h' : 'n'"
      :gameOver="gameOver"
      @close="showSaveModal = false"
      @saved="refreshLeaderboard"
    />

    <!-- Game help dropdown -->
    <details class="game-help">
      <summary class="help-label">
        <span>Hur funkar spelet?</span>
        <span class="toggle-icon">▼</span>
      </summary>
      <div class="help-wrapper">
        <div class="help-content">
          <h3>Målet</h3>
          <p>
            Släck alla lampor på brädet innan tiden (3:00) tar slut. Varje löst bräda ger poäng och
            nästa nivå blir lite svårare.
          </p>

          <h3>Så spelar du</h3>
          <ul>
            <li v-if="!isHardMode">
              Klicka på en ruta för att tända/släcka den och dess grannar (upp, ner, vänster,
              höger).
            </li>
            <li v-if="isHardMode">
              <strong>Hard Mode:</strong> Klicka på en ruta för att ändra tillstånd (av → gul → blå
              → av) på den och dess grannar. Alla lampor måste vara av för att vinna.
            </li>
            <li>Tiden börjar först när du gör ditt första klick.</li>
            <li>
              Du kan starta om nuvarande nivå (↻ Nivå) eller hela spelet (↻ Spel) när du vill.
            </li>
            <li>Växla mellan Normal och Hard Mode med knappen under spelet.</li>
          </ul>

          <h3>Seed & nivåer</h3>
          <p>
            Spelet använder en seed-kod (3 tecken: 0-9, a-z). Samma seed ger samma nivåer. Nivåerna
            skapas genom att spelet gör ett antal drag från ett tomt bräde, vilket gör att de alltid
            går att lösa.
          </p>

          <h3>Topplista</h3>
          <p>
            När tiden är slut kan du spara din poäng och tävla mot andra. Topplistan grupperar
            resultat per seed och jämför poäng och antal klick.
          </p>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Ref, watch } from 'vue'
import Cell from '@/components/lightsOut/Cell.vue'
import SaveLightsOutScore from '@/components/lightsOut/SaveLightsOutScore.vue'
import {
  getTopLightsOutScores,
  type LightsOutScoreRow,
} from '@/components/lightsOut/lightsoutScores'

interface Cell {
  isClicked: boolean
  state: number // 0, 1, 2 for hard mode (0 = off, 1 = on/color1, 2 = color2)
}

const gameBoard: Ref<Cell[]> = ref([])
const columns = ref(5)
const rows = ref(5)
// 3-char base36 seed code (0-9, a-z), used to derive numeric seed for board generation
const seedCode = ref<string>('000')
const currentSeed = ref<number>(0)

// Score and time
const clicks = ref(0)
const score = ref(0) // Boards Cleared
// Starting with 3:00 on the clock, countdown starts on first click
const TOTAL_TIME_MS = 3 * 60 * 1000
const remainingTimeMs = ref<number>(TOTAL_TIME_MS)
const timerId = ref<number | null>(null)
const gameOver = ref(false)
const showLeaderboard = ref(false)
const leaderboard = ref<LightsOutScoreRow[]>([])
const showSaveModal = ref(false)
const isHardMode = ref(false)

const timeLeft = computed(() => {
  const total = Math.max(0, remainingTimeMs.value)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
})

function startTimer() {
  if (timerId.value !== null || gameOver.value) return
  const endAt = Date.now() + remainingTimeMs.value
  timerId.value = window.setInterval(() => {
    const msLeft = endAt - Date.now()
    remainingTimeMs.value = msLeft > 0 ? msLeft : 0
    if (msLeft <= 0) {
      stopTimer()
      gameOver.value = true
    }
  }, 250)
}

function stopTimer() {
  if (timerId.value !== null) {
    window.clearInterval(timerId.value)
    timerId.value = null
  }
}

// Base-36 helpers (0-9, a-z)
const SEED_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'
function toBase36(n: number, width = 3): string {
  n = Math.max(0, Math.floor(n)) % Math.pow(36, width)
  let s = ''
  do {
    s = SEED_CHARS[n % 36] + s
    n = Math.floor(n / 36)
  } while (n > 0)
  return s.padStart(width, '0')
}
function fromBase36(s: string): number {
  s = (s || '').toLowerCase().slice(0, 3)
  let n = 0
  for (const c of s) {
    const idx = SEED_CHARS.indexOf(c)
    if (idx < 0) return 0
    n = n * 36 + idx
  }
  return n
}
function sanitizeSeedInput(v: string): string {
  return (v || '')
    .toLowerCase()
    .replace(/[^0-9a-z]/g, '')
    .slice(0, 3)
}
function onSeedInput(e: Event) {
  const t = e.target as HTMLInputElement
  seedCode.value = sanitizeSeedInput(t.value)
}

function useSeed(seed: string) {
  seedCode.value = sanitizeSeedInput(seed)
  resetGame()
}

const numLitCells = computed(() => {
  return gameBoard.value.filter((cell: Cell) => cell.state > 0).length
})

const maxStates = computed(() => (isHardMode.value ? 3 : 2))

function toggleCell(row: number, col: number) {
  if (row < 0 || row >= rows.value || col < 0 || col >= columns.value) return

  const index = row * columns.value + col
  const cell = gameBoard.value[index]!

  // Cycle through states: 0 -> 1 -> 2 -> 0 (or 0 -> 1 -> 0 for normal mode)
  cell.state = (cell.state + 1) % maxStates.value
}

function handleCellClick(index: number) {
  if (gameOver.value) return
  // Start countdown on first user action
  if (timerId.value === null) startTimer()
  clicks.value++
  // Set all to clicked false then update new cell
  gameBoard.value.forEach((cell) => (cell.isClicked = false))
  gameBoard.value[index]!.isClicked = true
  clickCell(index)
  checkGameStatus()
}

function clickCell(index: number) {
  const row = Math.floor(index / columns.value)
  const col = index % columns.value

  const directions = [
    [0, 0], // self
    [0, 1], // right
    [0, -1], // left
    [1, 0], // down
    [-1, 0], // up
  ]

  for (const [dr, dc] of directions) {
    toggleCell(row + dr!, col + dc!)
  }
}

function checkGameStatus() {
  if (numLitCells.value <= 0) {
    score.value++
    // Board Empty generate next board
    nextLevel()
  }
}

async function nextLevel() {
  // Modify the seed in some way to create the following level
  currentSeed.value = currentSeed.value + 5
  console.log('Next Level Seed:', toBase36(currentSeed.value))
  gameBoard.value = Array.from({ length: rows.value * columns.value }, () => ({
    isClicked: false,
    state: 0,
  }))
  // Generate board by applying random clicks
  // Do x pseudorandom clicks where x is increaded by a higher score
  const numClicks = 3 + score.value * 2
  for (let i = 0; i < numClicks; i++) {
    const index = Math.floor(
      ((currentSeed.value + i) * Math.sqrt((i + 1) * 3)) % (columns.value * rows.value),
    )
    clickCell(index)
  }
}

function restartLevel() {
  // Restart current level with same seed i.e keep currentSeed
  gameBoard.value = Array.from({ length: rows.value * columns.value }, () => ({
    isClicked: false,
    state: 0,
  }))
  // Generate board by applying random clicks
  const numClicks = 3 + score.value * 2
  for (let i = 0; i < numClicks; i++) {
    const index = Math.floor(
      ((currentSeed.value + i) * Math.sqrt((i + 1) * 3)) % (columns.value * rows.value),
    )
    clickCell(index)
  }
}

function resetGame() {
  // Reset the seed to the original and reset all timers and such
  currentSeed.value = fromBase36(seedCode.value)
  // Timer resets but does not start until first click
  stopTimer()
  remainingTimeMs.value = TOTAL_TIME_MS
  gameOver.value = false
  score.value = 0
  clicks.value = 0
  showSaveModal.value = false
  nextLevel()
}

function toggleDifficulty() {
  isHardMode.value = !isHardMode.value
  // Reset the game when switching modes
  resetGame()
  // Refresh leaderboard to show scores for the new difficulty
  refreshLeaderboard()
}

onMounted(() => {
  // Initialize with a random 3-char base36 seed code
  const r = Math.floor(Math.random() * Math.pow(36, 3))
  seedCode.value = toBase36(r, 3)
  resetGame()
  refreshLeaderboard()
})

onUnmounted(() => {
  stopTimer()
})

// Leaderboard helpers
// Group by seed -> take top 3 by (score desc, clicks asc) -> order seeds by their best
type GroupedEntry = LightsOutScoreRow & { rank: number; key: string }
type GroupedSeed = {
  seed: string
  entries: GroupedEntry[]
  best: { score: number; clicks: number }
}

const groupedScores = computed<GroupedSeed[]>(() => {
  const bySeed = new Map<string, LightsOutScoreRow[]>()
  for (const row of leaderboard.value) {
    if (!bySeed.has(row.seed)) bySeed.set(row.seed, [])
    bySeed.get(row.seed)!.push(row)
  }
  const groups: GroupedSeed[] = []
  for (const [seed, rows] of bySeed.entries()) {
    const sorted = [...rows].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.clicks - b.clicks
    })
    const top = sorted.slice(0, 3)
    const entries: GroupedEntry[] = top.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      key: `${r.playerID}-${r.date}-${idx}`,
    }))
    const best = top[0]
    if (best) {
      groups.push({ seed, entries, best: { score: best.score, clicks: best.clicks } })
    }
  }
  // Order seeds by best score desc, then clicks asc
  groups.sort((a, b) => {
    if (b.best.score !== a.best.score) return b.best.score - a.best.score
    return a.best.clicks - b.best.clicks
  })
  return groups
})
async function refreshLeaderboard() {
  leaderboard.value = await getTopLightsOutScores(isHardMode.value ? 'h' : 'n')
  console.log('Fetched leaderboard:', leaderboard.value)
}
function toggleLeaderboard() {
  showLeaderboard.value = !showLeaderboard.value
}
function formatDate(d: string) {
  try {
    const date = new Date(d)
    return date.toLocaleDateString()
  } catch {
    return d
  }
}

// Show save modal when time runs out
watch(gameOver, (isOver) => {
  if (isOver) {
    showSaveModal.value = true
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/generalGames';
@use '@/styles/theme.scss';

.app-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
  max-width: 100vw;
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  transition:
    background-color 0.3s,
    color 0.3s;

  h1 {
    text-align: center;
    margin-bottom: 10px;
    font-size: 3rem;
    font-weight: bold;
    color: var(--theme-modal-header);
    text-shadow: var(--theme-shadow-sm);
    transition: color 0.3s;
  }

  .settings {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 20px;
    background-color: var(--theme-sidebar-bg);
    padding: 15px 25px;
    border-radius: 12px;
    box-shadow: var(--theme-shadow-md);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--theme-sidebar-text);
    transition: background-color 0.3s;
    font-weight: bold;
    .sub-setting {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: row;
      gap: 15px;
    }

    .seed-label {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      button {
        padding: 6px 10px;
      }
    }

    input {
      @extend .form-input;
      width: 4.5rem;
      text-transform: lowercase;
      margin: 0;
    }
    button {
      @extend .button-base;
    }
    .restart-btn {
      @extend .button-base;
    }
    .entire-game-btn {
      background: var(--theme-button-danger-bg);
      color: white;
      &:hover {
        background: var(--theme-button-danger-hover);
      }
    }

    .difficulty-indicator {
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--theme-bg-secondary);
      color: var(--theme-text-secondary);
      font-size: 0.9rem;
      transition: all 0.3s ease;

      &.hard-mode {
        background: linear-gradient(135deg, #ff4444, #cc3333);
        color: white;
        box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
      }
    }
  }
}

/* Leaderboard styling adapted from kfkblock */
.leaderboard-container {
  width: min(900px, 92vw);
  margin: 0 auto;
}
.leaderboard-toggle {
  @extend .button-base;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.toggle-icon {
  transition: transform 0.25s ease;
}
.toggle-icon.expanded {
  transform: rotate(180deg);
}
.leaderboard-wrapper {
  max-height: 0;
  overflow: scroll;
  transition: max-height 0.3s ease;
  &.expanded {
    max-height: 420px;
  }
}
.leaderboard-content {
  background: var(--theme-sidebar-bg);
  border-radius: 10px;
  padding: 12px;
  margin-top: 8px;
  box-shadow: var(--theme-shadow-sm);
}
.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--theme-sidebar-text);
  th,
  td {
    padding: 8px 10px;
    text-align: left;
  }
  thead th {
    color: var(--theme-modal-header);
    font-weight: 700;
  }
  tbody tr {
    background: transparent;
  }
}

/* Seed breaker row */
.seed-row td {
  padding: 0 !important;
}
.seed-row__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  margin: 6px 0 4px 0;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid var(--theme-border-light);
}
.seed-row__btn {
  @extend .button-base;
  padding: 6px 10px;
  font-size: 0.9rem;
}
.seed-tag {
  color: var(--theme-modal-header);
}
.seed-meta {
  color: var(--theme-text-secondary, #a9a9a9);
}

/* Subtle backgrounds for top 3 rows */
.leaderboard-row.rank-1 {
  background: rgba(255, 215, 0, 0.08);
  &.rank {
    color: #ffd700; /* Gold */
    font-weight: 700;
    text-shadow: 0 1px 6px rgba(255, 215, 0, 0.3);
  }
}
.leaderboard-row.rank-2 {
  background: rgba(192, 192, 192, 0.08);

  &.rank {
    color: #c0c0c0; /* Silver */
    font-weight: 700;
  }
}
.leaderboard-row.rank-3 {
  background: rgba(205, 127, 50, 0.08);
  &.rank {
    color: #cd7f32; /* Bronze */
    font-weight: 700;
  }
}

.game-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}
.game-container {
  /* Fit board within viewport while keeping it square */
  width: min(92vw, 60vh);
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: 1fr;
  gap: clamp(6px, 2vw, 16px);
  border: 3px solid transparent;
  border-radius: 8px;
  transition: border-color 0.3s ease;

  &.hard-mode {
    border-color: #ff4444;
    box-shadow: 0 0 15px rgba(255, 68, 68, 0.3);
  }
}

/* Difficulty toggle */
.difficulty-toggle {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.difficulty-btn {
  @extend .button-base;
  font-size: 1.1rem;
  padding: 10px 20px;
  transition: all 0.3s ease;

  &.hard-active {
    background: linear-gradient(135deg, #ff4444, #cc3333);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);

    &:hover {
      background: linear-gradient(135deg, #ff6666, #dd4444);
      transform: translateY(-2px);
    }
  }
}

/* Help dropdown */
.game-help {
  width: min(900px, 92vw);
  margin: 16px auto 0 auto;
  background: var(--theme-sidebar-bg);
  border-radius: 10px;
  box-shadow: var(--theme-shadow-sm);
  color: var(--theme-sidebar-text);
  padding: 0 15px;

  .help-label {
    cursor: pointer;
    padding: 12px 4px;
    font-weight: 700;
    color: var(--theme-modal-header);
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .help-label::-webkit-details-marker {
    display: none;
  }
  .toggle-icon {
    transition: transform 0.25s ease;
  }
  &[open] .toggle-icon {
    transform: rotate(180deg);
  }
  .help-wrapper {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }
  &[open] .help-wrapper {
    max-height: 600px; /* enough for content */
  }
  .help-content {
    padding: 4px 4px 10px 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
    h3 {
      margin: 8px 0 4px;
      font-size: 1.05rem;
      color: var(--theme-modal-header);
    }
    p {
      margin: 0 0 8px 0;
      line-height: 1.4;
    }
    ul {
      margin: 0 0 10px 18px;
      padding: 0;
      li {
        margin: 4px 0;
      }
    }
  }
  &[open] .help-content {
    opacity: 1;
    transition-delay: 0.05s;
  }
}

@media (max-width: 768px) {
  .app-container {
    h1 {
      font-size: 2.2rem;
    }
    .settings {
      flex-wrap: wrap;
      gap: 10px 14px;
      font-size: 1.05rem;
      justify-content: center;
      input {
        width: 4rem;
      }
    }
  }
  .leaderboard-content {
    padding: 8px;
  }
  .leaderboard-table th,
  .leaderboard-table td {
    padding: 6px 8px;
    font-size: 0.95rem;
  }
  /* Hide seed and date on small screens to save width */
  .leaderboard-table .col-seed,
  .leaderboard-table .col-date,
  .leaderboard-table th:nth-child(5),
  .leaderboard-table th:nth-child(6) {
    display: none;
  }
  .seed-row__content {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
