<template>
  <div :class="['kana-game', { 'dark-mode': themeStore.isDarkMode }]">
    <header class="kana-game__header">
      <h1>Kana Drill</h1>
      <div class="mode-switch toggle-group">
        <button :class="{ active: gameMode === 'single' }" @click="setMode('single')">
          Single
        </button>
        <button :class="{ active: gameMode === 'storm' }" @click="setMode('storm')">Storm</button>
        <button :class="{ active: gameMode === 'timed' }" @click="setMode('timed')">Timed</button>
      </div>
    </header>

    <section class="run-summary panel">
      <h2>Current Run</h2>
      <div class="run-summary__grid">
        <div class="run-card">
          <span>Score</span>
          <strong>{{ gameState.score }}</strong>
        </div>
        <div class="run-card" v-if="gameMode === 'storm' || gameMode === 'timed'">
          <span>Lives</span>
          <strong>{{ gameState.lives }}</strong>
        </div>
        <div class="run-card" v-if="gameMode === 'storm'">
          <span>Storm Level</span>
          <strong>{{ gameState.stormLevel }}</strong>
        </div>
        <div class="run-card">
          <span>Errors</span>
          <strong>{{ gameState.errors }}</strong>
        </div>
        <div class="run-card" v-if="gameMode === 'timed'">
          <span>Time Left</span>
          <strong>{{ timedTimeLeftDisplay }}s</strong>
        </div>
      </div>
    </section>

    <div class="kana-game__layout">
      <aside class="kana-game__settings panel">
        <h2>Settings</h2>

        <div class="setting-group" v-if="gameMode === 'storm' || gameMode === 'timed'">
          <label>Base Difficulty: {{ baseDifficulty }}</label>
          <input type="range" v-model.number="baseDifficulty" min="1" max="10" step="1" />
        </div>

        <div class="setting-group kana-selection">
          <label>Kana Selection</label>

          <div class="selection-summary">
            <span>H: {{ selectedHiragana.length }}/{{ kanaGroups.length }}</span>
            <span>K: {{ selectedKatakana.length }}/{{ kanaGroups.length }}</span>
            <span>Total: {{ activeWords.length }}</span>
          </div>

          <div class="preset-actions">
            <button class="btn-small" @click="applySelectionPreset('starter')">Starter</button>
            <button class="btn-small" @click="applySelectionPreset('core')">Core</button>
            <button class="btn-small" @click="applySelectionPreset('extra')">Extra</button>
            <button class="btn-small" @click="applySelectionPreset('all')">All</button>
            <button class="btn-small" @click="applySelectionPreset('clear')">Clear</button>
          </div>

          <details class="kana-picker">
            <summary>
              Hiragana Sets
              <span>{{ selectedHiragana.length }}/{{ kanaGroups.length }}</span>
            </summary>
            <div class="picker-actions">
              <button class="btn-small" @click="selectAll('hiragana', true)">All</button>
              <button class="btn-small" @click="selectCore('hiragana')">Core</button>
              <button class="btn-small" @click="selectAll('hiragana', false)">None</button>
            </div>
            <div class="picker-grid">
              <button
                v-for="group in kanaGroups"
                :key="'h-' + group.id"
                class="set-chip"
                :class="{ active: isGroupSelected('hiragana', group.id) }"
                @click="toggleGroupSelection('hiragana', group.id)"
              >
                {{ group.label }}
              </button>
            </div>
          </details>

          <details class="kana-picker">
            <summary>
              Katakana Sets
              <span>{{ selectedKatakana.length }}/{{ kanaGroups.length }}</span>
            </summary>
            <div class="picker-actions">
              <button class="btn-small" @click="selectAll('katakana', true)">All</button>
              <button class="btn-small" @click="selectCore('katakana')">Core</button>
              <button class="btn-small" @click="selectAll('katakana', false)">None</button>
            </div>
            <div class="picker-grid">
              <button
                v-for="group in kanaGroups"
                :key="'k-' + group.id"
                class="set-chip"
                :class="{ active: isGroupSelected('katakana', group.id) }"
                @click="toggleGroupSelection('katakana', group.id)"
              >
                {{ group.label }}
              </button>
            </div>
          </details>
        </div>
      </aside>

      <main class="kana-game__main panel">
        <div v-if="gameMode === 'timed'" class="timer-hud">
          <div class="timer-hud__meta">
            <span>Time to answer</span>
            <strong>{{ timedTimeLeftDisplay }}s</strong>
          </div>
          <div class="timer-hud__bar">
            <div class="timer-hud__fill" :style="{ width: `${timedTimeLeftPercent}%` }"></div>
          </div>
        </div>

        <div class="canvas-container" ref="canvasContainer">
          <canvas ref="gameCanvas"></canvas>

          <div v-if="gameState.isGameOver || !gameState.isPlaying" class="overlay">
            <h2 v-if="gameState.isGameOver" class="game-over">GAME OVER</h2>
            <h2 v-else>Ready to practice?</h2>
            <p v-if="gameState.isGameOver">Score: {{ gameState.score }}</p>
            <button class="start-btn" @click="startGame" :disabled="activeWords.length === 0">
              {{ activeWords.length === 0 ? 'Select Kana to Start' : 'Start Game' }}
            </button>
          </div>
        </div>

        <div class="input-container">
          <input
            ref="inputField"
            v-model="currentInput"
            @input="checkInput"
            @keyup.enter="forceCheck"
            type="text"
            placeholder="Type romaji here..."
            :disabled="!gameState.isPlaying || gameState.isGameOver"
            autocomplete="off"
          />
        </div>
      </main>

      <aside class="kana-game__stats panel">
        <h2>Lifetime Stats</h2>
        <div class="stat-row">
          <span>Top Score (Single):</span> <strong>{{ savedStats.topScoreSingle }}</strong>
        </div>
        <div class="stat-row">
          <span>Top Score (Storm):</span> <strong>{{ savedStats.topScoreStorm }}</strong>
        </div>
        <div class="stat-row">
          <span>Top Score (Timed):</span> <strong>{{ savedStats.topScoreTimed }}</strong>
        </div>
        <div class="stat-row">
          <span>Top Storm Level:</span> <strong>{{ savedStats.topStormLevel }}</strong>
        </div>
        <div class="stat-row">
          <span>Total Correct:</span> <strong>{{ savedStats.totalGuesses }}</strong>
        </div>

        <h3 class="mt-4">Top 5 Best Kana</h3>
        <ul class="top-kana-list">
          <li v-for="(count, kana) in topFiveKana" :key="kana">
            <span>{{ kana }}</span> <span class="badge">{{ count }}</span>
          </li>
          <li v-if="Object.keys(topFiveKana).length === 0" class="empty-msg">No data yet.</li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

// --- Types & Data ---
type GameMode = 'single' | 'storm' | 'timed'

interface KanaGroup {
  id: string
  label: string
  h: string[] // Hiragana
  k: string[] // Katakana
}

interface ThemePalette {
  canvasBg: string
  canvasHint: string
  canvasHintDanger: string
  canvasTextOnNode: string
}

// Grouped Kana dictionary
const kanaGroups: KanaGroup[] = [
  {
    id: 'vowels',
    label: 'A I U E O',
    h: ['あ', 'い', 'う', 'え', 'お'],
    k: ['ア', 'イ', 'ウ', 'エ', 'オ'],
  },
  { id: 'k', label: 'K Set', h: ['か', 'き', 'く', 'け', 'こ'], k: ['カ', 'キ', 'ク', 'ケ', 'コ'] },
  { id: 's', label: 'S Set', h: ['さ', 'し', 'す', 'せ', 'そ'], k: ['サ', 'シ', 'ス', 'セ', 'ソ'] },
  { id: 't', label: 'T Set', h: ['た', 'ち', 'つ', 'て', 'と'], k: ['タ', 'チ', 'ツ', 'テ', 'ト'] },
  { id: 'n', label: 'N Set', h: ['な', 'に', 'ぬ', 'ね', 'の'], k: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'] },
  { id: 'h', label: 'H Set', h: ['は', 'ひ', 'ふ', 'へ', 'ほ'], k: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'] },
  { id: 'm', label: 'M Set', h: ['ま', 'み', 'む', 'め', 'も'], k: ['マ', 'ミ', 'ム', 'メ', 'モ'] },
  { id: 'y', label: 'Y Set', h: ['や', 'ゆ', 'よ'], k: ['ヤ', 'ユ', 'ヨ'] },
  { id: 'r', label: 'R Set', h: ['ら', 'り', 'る', 'れ', 'ろ'], k: ['ラ', 'リ', 'ル', 'レ', 'ロ'] },
  { id: 'w', label: 'W / N', h: ['わ', 'を', 'ん'], k: ['ワ', 'ヲ', 'ン'] },
  {
    id: 'g',
    label: 'G (Daku)',
    h: ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
    k: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  },
  {
    id: 'z',
    label: 'Z (Daku)',
    h: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
    k: ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  },
  {
    id: 'd',
    label: 'D (Daku)',
    h: ['だ', 'ぢ', 'づ', 'で', 'ど'],
    k: ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
  },
  {
    id: 'b',
    label: 'B (Daku)',
    h: ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
    k: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  },
  {
    id: 'p',
    label: 'P (Han)',
    h: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
    k: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  },
]

const romajiMap: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  が: 'ga',
  き: 'ki',
  ぎ: 'gi',
  く: 'ku',
  ぐ: 'gu',
  け: 'ke',
  げ: 'ge',
  こ: 'ko',
  ご: 'go',
  さ: 'sa',
  ざ: 'za',
  し: 'shi',
  じ: 'ji',
  す: 'su',
  ず: 'zu',
  せ: 'se',
  ぜ: 'ze',
  そ: 'so',
  ぞ: 'zo',
  た: 'ta',
  だ: 'da',
  ち: 'chi',
  ぢ: 'ji',
  つ: 'tsu',
  づ: 'zu',
  て: 'te',
  で: 'de',
  と: 'to',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ば: 'ba',
  ぱ: 'pa',
  ひ: 'hi',
  び: 'bi',
  ぴ: 'pi',
  ふ: 'fu',
  ぶ: 'bu',
  ぷ: 'pu',
  へ: 'he',
  べ: 'be',
  ぺ: 'pe',
  ほ: 'ho',
  ぼ: 'bo',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'wo',
  ん: 'n',
  ア: 'a',
  イ: 'i',
  ウ: 'u',
  エ: 'e',
  オ: 'o',
  カ: 'ka',
  ガ: 'ga',
  キ: 'ki',
  ギ: 'gi',
  ク: 'ku',
  グ: 'gu',
  ケ: 'ke',
  ゲ: 'ge',
  コ: 'ko',
  ゴ: 'go',
  サ: 'sa',
  ザ: 'za',
  シ: 'shi',
  ジ: 'ji',
  ス: 'su',
  ズ: 'zu',
  セ: 'se',
  ゼ: 'ze',
  ソ: 'so',
  ゾ: 'zo',
  タ: 'ta',
  ダ: 'da',
  チ: 'chi',
  ヂ: 'ji',
  ツ: 'tsu',
  ヅ: 'zu',
  テ: 'te',
  デ: 'de',
  ト: 'to',
  ド: 'do',
  ナ: 'na',
  ニ: 'ni',
  ヌ: 'nu',
  ネ: 'ne',
  ノ: 'no',
  ハ: 'ha',
  バ: 'ba',
  パ: 'pa',
  ヒ: 'hi',
  ビ: 'bi',
  ピ: 'pi',
  フ: 'fu',
  ブ: 'bu',
  プ: 'pu',
  ヘ: 'he',
  ベ: 'be',
  ペ: 'pe',
  ホ: 'ho',
  ボ: 'bo',
  ポ: 'po',
  マ: 'ma',
  ミ: 'mi',
  ム: 'mu',
  メ: 'me',
  モ: 'mo',
  ヤ: 'ya',
  ユ: 'yu',
  ヨ: 'yo',
  ラ: 'ra',
  リ: 'ri',
  ル: 'ru',
  レ: 're',
  ロ: 'ro',
  ワ: 'wa',
  ヲ: 'wo',
  ン: 'n',
}

// --- Reactive State ---
const gameMode = ref<GameMode>('storm')
const baseDifficulty = ref(3)
const currentInput = ref('')
const inputField = ref<HTMLInputElement | null>(null)

const selectedHiragana = ref<string[]>(['vowels', 'k'])
const selectedKatakana = ref<string[]>([])
const themeStore = useThemeStore()

const gameState = reactive({
  isPlaying: false,
  isGameOver: false,
  score: 0,
  lives: 3,
  stormLevel: 1,
  errors: 0,
})

// Local Storage State
const savedStats = reactive({
  totalGuesses: 0,
  topScoreSingle: 0,
  topScoreStorm: 0,
  topScoreTimed: 0,
  topStormLevel: 0,
  charStats: {} as Record<string, number>,
})

const timedTimeLeft = ref(5)
const timedCurrentLimit = ref(5)
const timedMinLimit = 1.2
const timedDecreasePerCorrect = 0.15

const palette = ref<ThemePalette>({
  canvasBg: '#f8fafc',
  canvasHint: '#64748b',
  canvasHintDanger: '#ef4444',
  canvasTextOnNode: '#ffffff',
})

// --- Canvas Entities (Non-reactive for performance) ---
class KanaNode {
  word: string
  x: number
  y: number
  speed: number
  color: string
  errors: number = 0

  constructor(word: string, x: number, y: number, speed: number) {
    this.word = word
    this.x = x
    this.y = y
    this.speed = speed
    const hue = Math.floor(Math.random() * 360)
    this.color = `hsl(${hue}, 70%, 45%)` // Better color generation
  }
}

let activeNodes: KanaNode[] = []
let animationFrameId: number | null = null
let framesToNextSpawn = 0
let lastFrameTimestamp = 0

// --- Canvas Refs ---
const gameCanvas = ref<HTMLCanvasElement | null>(null)
const canvasContainer = ref<HTMLDivElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let logicalWidth = 800
let logicalHeight = 400

// --- Computed ---
const activeWords = computed(() => {
  let words: string[] = []
  kanaGroups.forEach((g) => {
    if (selectedHiragana.value.includes(g.id)) words.push(...g.h)
    if (selectedKatakana.value.includes(g.id)) words.push(...g.k)
  })
  return words
})

const topFiveKana = computed(() => {
  return Object.entries(savedStats.charStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
})

const coreIds = ['vowels', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w']
const extraIds = ['g', 'z', 'd', 'b', 'p']

const timedTimeLeftDisplay = computed(() => Math.max(0, timedTimeLeft.value).toFixed(1))
const timedTimeLeftPercent = computed(() => {
  if (timedCurrentLimit.value <= 0) return 0
  return Math.max(0, Math.min(100, (timedTimeLeft.value / timedCurrentLimit.value) * 100))
})

// --- Methods ---
const selectAll = (type: 'hiragana' | 'katakana', select: boolean) => {
  const ids = kanaGroups.map((g) => g.id)
  if (type === 'hiragana') selectedHiragana.value = select ? ids : []
  else selectedKatakana.value = select ? ids : []
}

const applySelectionPreset = (preset: 'starter' | 'core' | 'extra' | 'all' | 'clear') => {
  const allIds = kanaGroups.map((group) => group.id)
  const starterIds = ['vowels', 'k', 's']

  if (preset === 'starter') {
    selectedHiragana.value = [...starterIds]
    selectedKatakana.value = []
    return
  }

  if (preset === 'core') {
    selectedHiragana.value = [...coreIds]
    selectedKatakana.value = [...coreIds]
    return
  }

  if (preset === 'extra') {
    selectedHiragana.value = [...extraIds]
    selectedKatakana.value = [...extraIds]
    return
  }

  if (preset === 'all') {
    selectedHiragana.value = [...allIds]
    selectedKatakana.value = [...allIds]
    return
  }

  selectedHiragana.value = []
  selectedKatakana.value = []
}

const selectCore = (type: 'hiragana' | 'katakana') => {
  if (type === 'hiragana') {
    selectedHiragana.value = [...coreIds]
    return
  }

  selectedKatakana.value = [...coreIds]
}

const isGroupSelected = (type: 'hiragana' | 'katakana', groupId: string) => {
  return type === 'hiragana'
    ? selectedHiragana.value.includes(groupId)
    : selectedKatakana.value.includes(groupId)
}

const toggleGroupSelection = (type: 'hiragana' | 'katakana', groupId: string) => {
  const selected = type === 'hiragana' ? selectedHiragana.value : selectedKatakana.value
  const updated = selected.includes(groupId)
    ? selected.filter((id) => id !== groupId)
    : [...selected, groupId]

  if (type === 'hiragana') selectedHiragana.value = updated
  else selectedKatakana.value = updated
}

const setMode = (mode: GameMode) => {
  gameMode.value = mode
  if (gameState.isPlaying) endGame()
}

const loadLocalStorage = () => {
  const data = localStorage.getItem('kanaStats')
  if (data) {
    Object.assign(savedStats, JSON.parse(data))
  }
}

const saveLocalStorage = () => {
  localStorage.setItem('kanaStats', JSON.stringify(savedStats))
}

const getStormLevelForScore = (score: number) => baseDifficulty.value + Math.floor(score / 5)
const getTimedStartLimit = () => Math.max(2.2, 6 - baseDifficulty.value * 0.35)

const resetTimedLimit = () => {
  timedCurrentLimit.value = getTimedStartLimit()
  timedTimeLeft.value = timedCurrentLimit.value
}

const tightenTimedLimit = () => {
  timedCurrentLimit.value = Math.max(
    timedMinLimit,
    timedCurrentLimit.value - timedDecreasePerCorrect,
  )
  timedTimeLeft.value = timedCurrentLimit.value
}

const initCanvas = () => {
  if (!gameCanvas.value || !canvasContainer.value) return
  const canvas = gameCanvas.value
  ctx = canvas.getContext('2d')

  // High DPI (Device Pixel Ratio) Scaling
  const dpr = window.devicePixelRatio || 1
  const rect = canvasContainer.value.getBoundingClientRect()

  logicalWidth = rect.width
  logicalHeight = Math.max(260, Math.min(420, rect.width * 0.56))

  canvas.width = logicalWidth * dpr
  canvas.height = logicalHeight * dpr
  canvas.style.width = `${logicalWidth}px`
  canvas.style.height = `${logicalHeight}px`

  ctx?.scale(dpr, dpr)
}

const updateThemePalette = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const styles = window.getComputedStyle(document.documentElement)
  const readVar = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim()
    return value || fallback
  }

  palette.value = {
    canvasBg: readVar('--theme-bg-tertiary', '#f8fafc'),
    canvasHint: readVar('--theme-text-secondary', '#64748b'),
    canvasHintDanger: readVar('--theme-error', '#ef4444'),
    canvasTextOnNode: readVar('--theme-text-on-dark', '#ffffff'),
  }
}

const spawnNode = () => {
  if (activeWords.value.length === 0) return
  const word = activeWords.value[Math.floor(Math.random() * activeWords.value.length)]
  if (!word) return
  const nodeSize = 40

  if (gameMode.value === 'single' || gameMode.value === 'timed') {
    activeNodes = [new KanaNode(word, logicalWidth / 2, logicalHeight / 2 + 15, 0)]
  } else {
    // Better difficulty scaling: Linear addition rather than exponential multiplier
    const speedMultiplier = getStormLevelForScore(gameState.score) * 0.45 + gameState.score * 0.03
    const speed = Math.random() * 1.5 + speedMultiplier
    const yPos = Math.random() * (logicalHeight - nodeSize * 2) + nodeSize
    activeNodes.push(new KanaNode(word, -20, yPos, speed))
  }
}

const checkInput = () => {
  const input = currentInput.value.toLowerCase().trim()
  if (!input) return

  const matchIndex = activeNodes.findIndex((node) => romajiMap[node.word] === input)

  if (matchIndex !== -1) {
    // Correct
    const matchedNode = activeNodes[matchIndex]
    if (!matchedNode) return
    const matchedWord = matchedNode.word
    activeNodes.splice(matchIndex, 1)

    gameState.score++
    savedStats.totalGuesses++
    savedStats.charStats[matchedWord] = (savedStats.charStats[matchedWord] || 0) + 1
    saveLocalStorage()

    currentInput.value = ''

    if (gameMode.value === 'single') {
      spawnNode()
    }

    if (gameMode.value === 'timed') {
      tightenTimedLimit()
      spawnNode()
    }
  } else {
    // If the input length matches or exceeds possible valid romaji but didn't match, count error
    // Simple heuristic: if it's 3 chars long and no match, it's an error.
    if (
      input.length >= 3 ||
      Object.values(romajiMap).filter((v) => v.startsWith(input)).length === 0
    ) {
      registerError()
    }
  }
}

const forceCheck = () => {
  if (currentInput.value) registerError()
}

const registerError = () => {
  gameState.errors++
  currentInput.value = ''

  if (gameMode.value === 'single' && activeNodes.length > 0) {
    const firstNode = activeNodes[0]
    if (!firstNode) return
    firstNode.errors++
    if (firstNode.errors >= 3) {
      endGame()
    }
  }

  if (gameMode.value === 'timed') {
    gameState.lives--
    if (gameState.lives <= 0) {
      endGame()
      return
    }

    timedTimeLeft.value = timedCurrentLimit.value
    spawnNode()
  }
}

const startGame = () => {
  if (activeWords.value.length === 0) return

  gameState.isPlaying = true
  gameState.isGameOver = false
  gameState.score = 0
  gameState.lives = 3
  gameState.stormLevel = baseDifficulty.value
  gameState.errors = 0
  activeNodes = []
  currentInput.value = ''
  framesToNextSpawn = 0
  lastFrameTimestamp = 0

  if (gameMode.value === 'timed') {
    resetTimedLimit()
  }

  initCanvas()
  spawnNode()

  setTimeout(() => inputField.value?.focus(), 50)

  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
  gameLoop()
}

const endGame = () => {
  gameState.isPlaying = false
  gameState.isGameOver = true

  // Update Top Scores
  if (gameMode.value === 'single' && gameState.score > savedStats.topScoreSingle) {
    savedStats.topScoreSingle = gameState.score
  }
  if (gameMode.value === 'storm' && gameState.score > savedStats.topScoreStorm) {
    savedStats.topScoreStorm = gameState.score
  }
  if (gameMode.value === 'timed' && gameState.score > savedStats.topScoreTimed) {
    savedStats.topScoreTimed = gameState.score
  }
  if (gameMode.value === 'storm' && gameState.stormLevel > savedStats.topStormLevel) {
    savedStats.topStormLevel = gameState.stormLevel
  }
  saveLocalStorage()
}

const updateLogic = (deltaSeconds: number) => {
  if (!gameState.isPlaying) return

  if (gameMode.value === 'storm') {
    gameState.stormLevel = getStormLevelForScore(gameState.score)
    const frameScale = deltaSeconds * 60

    for (let i = activeNodes.length - 1; i >= 0; i--) {
      const node = activeNodes[i]
      if (!node) continue
      node.x += node.speed * frameScale // Move right

      // Node left screen
      if (node.x > logicalWidth + 50) {
        activeNodes.splice(i, 1)
        gameState.lives--
        if (gameState.lives <= 0) {
          endGame()
        }
      }
    }

    framesToNextSpawn -= frameScale
    if (framesToNextSpawn <= 0) {
      spawnNode()
      // Spawn rate based on difficulty but capped
      const baseFrames = 120
      framesToNextSpawn = Math.max(30, baseFrames - baseDifficulty.value * 5 - gameState.score * 2)
    }
  }

  if (gameMode.value === 'timed') {
    timedTimeLeft.value = Math.max(0, timedTimeLeft.value - deltaSeconds)
    if (timedTimeLeft.value <= 0) {
      registerError()
    }
  }
}

const drawCanvas = () => {
  if (!ctx || !gameCanvas.value) return

  // Clear Background
  ctx.fillStyle = palette.value.canvasBg
  ctx.fillRect(0, 0, logicalWidth, logicalHeight)

  // Draw Nodes
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  activeNodes.forEach((node) => {
    // Draw Box
    const size = gameMode.value === 'single' ? 80 : 50
    ctx!.fillStyle = node.color
    ctx!.beginPath()
    ctx!.roundRect(node.x - size / 2, node.y - size / 2, size, size, 8)
    ctx!.fill()

    // Draw Kana
    ctx!.fillStyle = palette.value.canvasTextOnNode
    ctx!.font = `bold ${size * 0.6}px 'Courier New', monospace`
    ctx!.fillText(node.word, node.x, node.y)

    // Hints (Errors in single, position in storm)
    if (gameMode.value === 'single' && node.errors > 0) {
      ctx!.fillStyle = palette.value.canvasHint
      ctx!.font = `16px sans-serif`
      ctx!.fillText(`${3 - node.errors} tries left`, node.x, node.y + size / 2 + 20)

      if (node.errors >= 2) {
        ctx!.fillStyle = palette.value.canvasHintDanger
        ctx!.fillText(`Hint: ${romajiMap[node.word]}`, node.x, node.y + size / 2 + 40)
      }
    } else if (gameMode.value === 'storm' && node.x > logicalWidth * 0.7) {
      // Show romaji hint when getting close to dying
      ctx!.fillStyle = palette.value.canvasHint
      ctx!.font = `14px sans-serif`
      ctx!.fillText(romajiMap[node.word] ?? '', node.x, node.y + size / 2 + 15)
    }
  })
}

const gameLoop = (timestamp: number = performance.now()) => {
  const deltaSeconds = lastFrameTimestamp === 0 ? 1 / 60 : (timestamp - lastFrameTimestamp) / 1000
  lastFrameTimestamp = timestamp

  updateLogic(deltaSeconds)
  drawCanvas()
  if (gameState.isPlaying) {
    animationFrameId = requestAnimationFrame(gameLoop)
  }
}

// --- Lifecycles ---
onMounted(() => {
  themeStore.init()
  updateThemePalette()
  loadLocalStorage()
  window.addEventListener('resize', initCanvas)
  initCanvas()
  drawCanvas() // Initial draw
})

onUnmounted(() => {
  window.removeEventListener('resize', initCanvas)
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
})

watch(
  () => themeStore.isDarkMode,
  () => {
    updateThemePalette()
    drawCanvas()
  },
)

// Watch for window resizes affecting canvas
watch(
  () => [gameMode.value, selectedHiragana.value, selectedKatakana.value],
  () => {
    if (gameState.isPlaying) endGame()
  },
)

watch(baseDifficulty, () => {
  if (gameMode.value === 'storm' && !gameState.isPlaying) {
    gameState.stormLevel = baseDifficulty.value
  }

  if (gameMode.value === 'timed' && !gameState.isPlaying) {
    resetTimedLimit()
  }
})
</script>

<style scoped lang="scss">
.kana-game {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-primary);
  min-height: calc(100vh - 56px);
  padding: clamp(1rem, 3vw, 2rem);
  box-sizing: border-box;

  &__header {
    text-align: center;
    margin: 0 auto 1rem;
    max-width: 1400px;
    h1 {
      margin: 0;
      font-size: 2.5rem;
      color: var(--theme-text-accent);
    }
    p {
      margin: 0;
      color: var(--theme-text-secondary);
    }
  }

  &__layout {
    display: grid;
    grid-template-columns: minmax(0, 280px) minmax(0, 1fr) minmax(0, 280px);
    grid-template-areas: 'settings main stats';
    gap: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;

    @media (max-width: 1200px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        'settings main'
        'stats stats';
    }

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
      grid-template-areas:
        'settings'
        'main'
        'stats';
    }
  }

  &__settings {
    grid-area: settings;
  }

  &__main {
    grid-area: main;
    min-width: 0;
  }

  &__stats {
    grid-area: stats;
    min-width: 0;
  }
}

.mode-switch {
  margin: 1rem auto 0;
}

.panel {
  background: var(--theme-sidebar-bg);
  color: var(--theme-sidebar-text);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--theme-border-light);
  box-shadow: var(--theme-shadow-sm);
  min-width: 0;
  overflow: hidden;

  h2 {
    margin-top: 0;
    font-size: 1.25rem;
    border-bottom: 2px solid var(--theme-border-light);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
}

.setting-group {
  margin-bottom: 1.5rem;

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  input[type='range'] {
    width: 100%;
  }
}

.toggle-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  button {
    flex: 1;
    min-width: 150px;
    padding: 1rem 0.65rem;
    border: 1px solid var(--theme-border-light);
    background: var(--theme-bg-elevated);
    color: var(--theme-sidebar-value);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border-color: var(--theme-button-primary-border);
    }
  }
}

.run-summary {
  max-width: 1400px;
  margin: 0 auto 1.5rem;

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
  }
}

.run-card {
  background: var(--theme-bg-elevated);
  border: 1px solid var(--theme-border-light);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  span {
    color: var(--theme-text-secondary);
    font-size: 0.85rem;
  }

  strong {
    color: var(--theme-sidebar-value);
    font-size: 1.25rem;
  }
}

.timer-hud {
  margin-bottom: 0.9rem;

  &__meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
    color: var(--theme-sidebar-text);

    strong {
      color: var(--theme-sidebar-value);
      font-size: 1.1rem;
      min-width: 56px;
      text-align: right;
    }
  }

  &__bar {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: var(--theme-bg-elevated);
    border: 1px solid var(--theme-border-light);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    background: var(--theme-button-primary-bg);
    transition: width 0.08s linear;
  }
}

.btn-small {
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
  border: 1px solid var(--theme-border-light);
  background: var(--theme-bg-elevated);
  color: var(--theme-text-primary);
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--theme-bg-tertiary);
  }
}

.preset-actions,
.picker-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.picker-actions {
  padding: 0 0.65rem;
}

.kana-selection {
  background: color-mix(in srgb, var(--theme-bg-elevated) 70%, transparent);
  border: 1px solid var(--theme-border-light);
  border-radius: 10px;
  padding: 0.75rem;
}

.selection-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 0.65rem;

  span {
    background: var(--theme-bg-elevated);
    border: 1px solid var(--theme-border-light);
    border-radius: 8px;
    padding: 0.35rem 0.45rem;
    font-size: 0.75rem;
    text-align: center;
    color: var(--theme-sidebar-value);
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

.kana-picker {
  border: 1px solid var(--theme-border-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-bg-elevated) 70%, transparent);
  margin-top: 0.6rem;

  summary {
    list-style: none;
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    cursor: pointer;
    padding: 0.55rem 0.7rem;
    font-size: 0.9rem;
    color: var(--theme-sidebar-value);

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: '▸';
      margin-right: 0.45rem;
      color: var(--theme-text-secondary);
      transition: transform 0.2s ease;
    }

    span {
      color: var(--theme-text-secondary);
      font-size: 0.8rem;
    }
  }

  &[open] summary::before {
    transform: rotate(90deg);
  }
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0 0.65rem 0.65rem;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
}

.selection-hint {
  margin: 0.55rem 0 0;
  font-size: 0.75rem;
  color: var(--theme-text-secondary);
}

.set-chip {
  border: 1px solid var(--theme-border-light);
  background: var(--theme-bg-elevated);
  color: var(--theme-sidebar-text);
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.85rem;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;

  &.active {
    background: var(--theme-button-primary-bg);
    color: var(--theme-button-primary-text);
    border-color: var(--theme-button-primary-border);
  }

  &:hover {
    transform: translateY(-1px);
  }
}

.kana-game__settings,
.kana-game__stats {
  max-height: fit-content;
}

.kana-game__stats {
  h3 {
    color: var(--theme-sidebar-value);
  }
}

/* Center Game Area */
.canvas-container {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--theme-border-light);
  background: var(--theme-bg-tertiary);

  canvas {
    display: block;
    width: 100%; /* Set by JS */
    /* Height handled by inline styles to respect DPR */
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--theme-sidebar-bg) 88%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    color: var(--theme-text-primary);

    .game-over {
      color: var(--theme-error);
      font-size: 2.5rem;
      margin-bottom: 0;
    }
    p {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
    }

    .start-btn {
      padding: 0.75rem 2rem;
      font-size: 1.25rem;
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border: 1px solid var(--theme-button-primary-border);
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: var(--theme-button-primary-hover);
      }
      &:disabled {
        background: var(--theme-button-secondary-bg);
        cursor: not-allowed;
      }
    }
  }
}

.input-container {
  margin-top: 1.5rem;
  text-align: center;

  input {
    width: 100%;
    max-width: 420px;
    padding: 1rem;
    font-size: 1.5rem;
    text-align: center;
    border: 2px solid var(--theme-input-border);
    background: var(--theme-input-bg);
    color: var(--theme-input-text);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--theme-input-border-focus);
    }
    &:disabled {
      background: var(--theme-bg-elevated);
    }
  }
}

/* Stats Sidebar */
.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--theme-border-light);
  color: var(--theme-sidebar-text);

  span {
    min-width: 0;
  }

  strong {
    font-size: 1.1rem;
    color: var(--theme-sidebar-value);
    text-align: right;
  }
}

.mt-4 {
  margin-top: 1.5rem;
}

.top-kana-list {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: color-mix(in srgb, var(--theme-bg-elevated) 85%, transparent);
    margin-bottom: 0.5rem;
    border-radius: 6px;

    span:first-child {
      font-weight: bold;
      font-size: 1.2rem;
      color: var(--theme-sidebar-value);
    }

    .badge {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
      font-size: 0.85rem;
    }
  }

  .empty-msg {
    background: transparent;
    color: var(--theme-text-secondary);
    justify-content: center;
  }
}

hr {
  border: 0;
  border-top: 1px solid var(--theme-border-light);
}

@media (max-width: 640px) {
  .panel {
    padding: 1rem;
  }

  .kana-game__header h1 {
    font-size: 2rem;
  }

  .input-container input {
    font-size: 1.2rem;
    padding: 0.75rem;
  }
}
</style>
