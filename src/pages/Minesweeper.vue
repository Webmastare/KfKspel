<template>
  <div :class="['app', { 'dark-mode': themeStore.isDarkMode }]">
    <h1 class="game-header">Minesweeper</h1>

    <!-- ─────── Settings & Actions ─────── -->
    <div class="game-settings">
      <div class="settings-grid">
        <div class="setting-item">
          <label for="difficulty-select" class="form-label">Svårighetsgrad</label>
          <select
            id="difficulty-select"
            v-model="selectedDifficulty"
            @change="onDifficultyChange"
            class="form-select"
          >
            <option v-for="d in difficulties" :key="d.id" :value="d.id">
              {{ d.label }}
            </option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <transition name="fade">
        <div v-if="selectedDifficulty === 'custom'" class="custom-settings">
          <label>
            Width
            <input type="number" v-model.number="customW" :min="MIN_SIZE" :max="MAX_SIZE" />
          </label>
          <label>
            Height
            <input type="number" v-model.number="customH" :min="MIN_SIZE" :max="MAX_SIZE" />
          </label>
          <label>
            Mines
            <input type="number" v-model.number="customM" :min="1" :max="customW * customH - 1" />
          </label>
          <button class="btn" @click.prevent="createCustom">Skapa</button>
        </div>
      </transition>

      <div class="actions" :style="{ display: 'flex', gap: '8px' }">
        <button class="btn" :disabled="gameStatus === -1" @click="resetGame">🔄 Restart</button>
        <button class="btn seed" @click="generateSeed">🎲 New seed</button>
      </div>

      <div class="seed-input">
        <div>
          <label for="seed-input">Seed:</label>
          <input v-model="seedInput" type="text" />
        </div>
        <div :style="{ display: 'flex', gap: '8px' }">
          <button class="btn" @click.prevent="applySeed">Använd</button>
          <div class="copy-seed">
            <div v-if="showCopied" class="copied-popup">Seed kopierad!</div>
            <button class="btn" @click.prevent="copySeed">Kopiera</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─────── Stats ─────── -->
    <section class="stats">
      <p>Time: {{ time.toFixed(2) }}s</p>
      <p>Mines: {{ minesLeft }}</p>
      <div class="progress">
        <span>Cleared</span>
        <div class="bar">
          <div
            class="bar__inner"
            :class="{ cleared: clearedPercent === 100 }"
            :style="{ width: clearedPercent + '%' }"
          ></div>
        </div>
      </div>
    </section>

    <!-- ─────── Canvas ─────── -->
    <div class="canvas-wrapper">
      <canvas ref="canvas" @mousedown="onPointer" @contextmenu.prevent />
      <transition name="fade">
        <div v-if="gameStatus === 1" class="overlay win">
          <span>🎉 Enkel Vinst!</span>
          <button class="btn" @click="resetGame">Spela igen</button>
        </div>
      </transition>
      <transition name="fade">
        <div v-if="gameStatus === 2" class="overlay lose">
          <span>💥 Du förlorade!</span>
          <button class="btn" @click="resetGame">Spela igen</button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useThemeStore } from '@/stores/theme'

// Global theme store
const themeStore = useThemeStore()

// Number of additional nodes to reveal on the first click
const FIRST_CLICK_REVEAL_COUNT = 12

// ───── Constants ─────
const MIN_SIZE = 4
const MAX_SIZE = 61
const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const difficulties = [
  { id: 'very easy', label: 'Väldigt Lätt', cfg: [9, 9, 1] },
  { id: 'easy', label: 'Lätt', cfg: [9, 9, 10] },
  { id: 'medium', label: 'Medel', cfg: [16, 16, 40] },
  { id: 'hard', label: 'Svår', cfg: [30, 16, 99] },
  { id: 'extreme', label: 'Extrem', cfg: [40, 30, 200] },
]

function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

// Base‑62 helpers
const to62 = (n) => {
  let s = ''
  do {
    s = chars[n % 62] + s
    n = Math.floor(n / 62)
  } while (n)
  return s
}
const from62 = (s) => [...s].reduce((a, c) => a * 62 + chars.indexOf(c), 0)

// ───── Utility Classes ─────
class Node {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.isMine = false
    this.isMarked = false
    this.isShown = false
    this.neighbors = []
  }
}

class Sweeper {
  constructor() {
    this.rows = 9
    this.columns = 9
    this.mines = 10
    this.blockSize = 24
    this.grid = []
    this.seed = Math.floor(Math.random() * 238000)
    this.placedMines = 0
    this.showedNodes = 0
    this.nodesToReveal = []
    this.gameStatus = -1 // -1 idle, 0 playing, 1 win, 2 lose
    this.showMines = false
    this.time = 0

    this.revealVersion = 0
  }

  initGrid() {
    this.grid = []
    for (let r = 0; r < this.rows; r++) {
      this.grid.push([])
      for (let c = 0; c < this.columns; c++) {
        this.grid[r].push(new Node(c, r))
      }
    }
    // link neighbours
    const dirs = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
    ]
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const nbs = []
        for (const [dx, dy] of dirs) {
          const nx = c + dx
          const ny = r + dy
          if (nx >= 0 && nx < this.columns && ny >= 0 && ny < this.rows) {
            nbs.push(this.grid[ny][nx])
          }
        }
        this.grid[r][c].neighbors = nbs
      }
    }
  }

  prng(seed) {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  plantMines(safeNode = null) {
    let empties = this.grid.flat().filter((n) => n !== safeNode && !n.isShown)
    this.placedMines = 0
    while (this.placedMines < this.mines) {
      const idx = Math.floor(this.prng(this.seed + this.placedMines) * empties.length)
      const node = empties[idx]
      node.isMine = true
      empties.splice(idx, 1)
      this.placedMines++
    }
  }
  revealNode(node) {
    if (node.isShown || node.isMine) return
    node.isShown = true
    this.showedNodes++
    const minesAround = node.neighbors.filter((n) => n.isMine).length
    if (minesAround === 0) {
      for (const n of node.neighbors) {
        if (this.nodesToReveal.includes(n) || n.isShown || n.isMine) continue
        this.nodesToReveal.push(n)
      }
    }
  }

  async revealRecursive(node = null) {
    // Either add the node passed as an argument or update the nodesToReveal before calling the function
    const currentVersion = this.revealVersion
    if (node) this.nodesToReveal.push(node)
    let i = 0
    while (this.nodesToReveal.length) {
      // ABORT if version changed (board was reset)
      if (this.revealVersion !== currentVersion) {
        this.nodesToReveal = []
        return
      }
      const node = this.nodesToReveal.shift()

      //await waitForMs(100/this.nodesToReveal.length)
      if (i % 5 === 0) {
        await waitForMs(20)
        await nextTick()
        draw()
      }
      this.revealNode(node)
      i++
    }
  }
  /**
   * Reveal a number of non-mine nodes nearest to the given node.
   */
  async revealFirstClick(node, count = FIRST_CLICK_REVEAL_COUNT) {
    const candidates = this.grid.flat().filter((n) => !n.isMine && !n.isShown)
    candidates.sort((a, b) => {
      const da = Math.abs(a.x - node.x) + Math.abs(a.y - node.y)
      const db = Math.abs(b.x - node.x) + Math.abs(b.y - node.y)
      return da - db
    })
    this.nodesToReveal.push(...candidates.slice(0, count))
    await this.revealRecursive()
  }

  async act(node, button) {
    if (this.gameStatus === 2 || this.gameStatus === 1) return
    if (button === 0) {
      if (this.gameStatus === -1) {
        this.gameStatus = 0
        // ensure clicked cell is safe and replace mine if needed
        if (node.isMine) {
          node.isMine = false
          this.plantMines(node)
        }
        // reveal the clicked cell and surrounding nodes
        await this.revealFirstClick(node)
        this.checkWin()
        return
      }
      if (!node.isMarked) {
        if (node.isMine) {
          this.explode(node)
        } else {
          await this.revealRecursive(node)
          this.checkWin()
        }
      }
    } else if (button === 2) {
      if (!node.isShown) node.isMarked = !node.isMarked
    }
  }

  explode(hitNode) {
    this.gameStatus = 2
    this.showMines = true
    const mines = this.grid.flat().filter((n) => n.isMine)
    mines.sort(() => Math.random() - 0.5)
    mines.forEach((m, i) => {
      setTimeout(() => {
        m.isShown = true
      }, i * 50)
    })
  }

  checkWin() {
    const cells = this.rows * this.columns
    if (cells - this.showedNodes === this.mines) {
      this.gameStatus = 1
      this.showMines = true
      console.log('You win!')
      shootConfetti()
    }
    console.log(`Cleared: ${this.showedNodes}/${cells - this.mines}`)
  }
}

// ───── Reactive State ─────
const canvas = ref(null)
const ctx = ref(null)
const pixelRatio = Math.ceil(window.devicePixelRatio || 1)

const selectedDifficulty = ref('easy')
const seedInput = ref('')
const showCopied = ref(false)
const sweeper = reactive(new Sweeper())
let rafId = null
let lastTimestamp = performance.now()

// Custom board controls
const customW = ref(9)
const customH = ref(9)
const customM = ref(10)

// ───── Derived ─────
const minesLeft = computed(
  () => sweeper.mines - sweeper.grid.flat().filter((n) => n.isMarked).length,
)
const clearedPercent = computed(
  () => (100 * sweeper.showedNodes) / (sweeper.rows * sweeper.columns - sweeper.mines),
)
const time = computed(() => sweeper.time)
const gameStatus = computed(() => sweeper.gameStatus)

async function waitForMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Confetti logic
function shootConfetti() {
  // Simple confetti burst using canvas
  const W = canvas.value.width
  const H = canvas.value.height
  const ctx = canvas.value.getContext('2d')
  const confetti = Array.from({ length: 200 }, () => ({
    x: Math.random() * W,
    y: Math.random() * -H,
    r: 4 + Math.random() * 4,
    d: 8 + Math.random() * 8,
    color: `hsl(${Math.random() * 360},90%,60%)`,
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltAngleIncremental: Math.random() * 0.07 + 0.05,
  }))
  let angle = 0
  function drawConfetti() {
    angle += 0.01
    for (const c of confetti) {
      c.y += (Math.cos(angle + c.d) + 3 + c.r / 2) / 2
      c.x += Math.sin(angle + Math.random() * 0.2)
      c.tiltAngle += c.tiltAngleIncremental
      c.tilt = Math.sin(c.tiltAngle) * 15
      ctx.beginPath()
      ctx.lineWidth = c.r
      ctx.strokeStyle = c.color
      ctx.moveTo(c.x + c.tilt + c.r, c.y)
      ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r)
      ctx.stroke()
    }
    if (confetti.some((c) => c.y < H) && sweeper.gameStatus === 1) {
      requestAnimationFrame(draw)
      requestAnimationFrame(drawConfetti)
    }
  }
  drawConfetti()
}

// ───── Setup / Reset ─────
function applyDifficulty() {
  if (selectedDifficulty.value === 'custom') {
    sweeper.columns = customW.value
    sweeper.rows = customH.value
    sweeper.mines = customM.value
  } else {
    const cfg = difficulties.find((d) => d.id === selectedDifficulty.value).cfg
    ;[sweeper.columns, sweeper.rows, sweeper.mines] = cfg
    customW.value = sweeper.columns
    customH.value = sweeper.rows
    customM.value = sweeper.mines
  }
}

function resetGame() {
  sweeper.revealVersion++
  sweeper.time = 0
  seedInput.value = encodeSeed(customW.value, customH.value, customM.value)
  sweeper.gameStatus = -1
  sweeper.showMines = false
  sweeper.nodesToReveal = []
  sweeper.showedNodes = 0
  sweeper.placedMines = 0
  applyDifficulty()
  sweeper.initGrid()
  // initial mine placement before any click
  sweeper.plantMines()
  resize()
}

/* ─────────── Custom Controls Logic ─────────── */
function encodeSeed(w, h, m) {
  const header = chars[w] + chars[h] + to62(m).padStart(2, '0')
  const rand = to62(sweeper.seed).padStart(3, '0') //Math.random().toString(36).slice(2, 8); // 6‑char RNG seed
  return header + rand
}
function decodeSeed(s) {
  if (s.length < 5) throw new Error('Bad seed')
  let obj = {
    w: chars.indexOf(s[0]),
    h: chars.indexOf(s[1]),
    m: from62(s.slice(2, 4)),
    r: s.slice(4),
  }
  console.log(s)
  console.log(obj)
  return obj
}
function generateSeed() {
  sweeper.seed = Math.floor(Math.random() * 238000)
  seedInput.value = sweeper.seed
  resetGame()
}
function applySeed() {
  sweeper.revealVersion++
  const { w, h, m, r } = decodeSeed(seedInput.value)
  sweeper.columns = w
  sweeper.rows = h
  sweeper.mines = Math.min(m, w * h - 1)
  sweeper.seed = from62(r) || Math.floor(Math.random() * 238000) //parseInt(r, 36) || Math.floor(Math.random() * 238000);
  seedInput.value = encodeSeed(w, h, m)
  sweeper.time = 0
  sweeper.gameStatus = -1
  sweeper.showMines = false
  sweeper.showedNodes = 0
  sweeper.placedMines = 0
  sweeper.initGrid()
  sweeper.plantMines()
  resize()
}
function createCustom() {
  const w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, customW.value))
  const h = Math.max(MIN_SIZE, Math.min(MAX_SIZE, customH.value))
  const m = Math.max(1, Math.min(w * h - 1, customM.value))
  customW.value = w
  customH.value = h
  customM.value = m
  selectedDifficulty.value = 'custom'
  resetGame()
}
function copySeed() {
  navigator.clipboard.writeText(seedInput.value)
  showCopied.value = true
  setTimeout(() => {
    showCopied.value = false
  }, 1200) // Show for 1.2 seconds
}

// ───── Canvas & Rendering ─────
function resize() {
  if (!canvas.value) return
  const vw = window.innerWidth * 0.8
  const vh = window.innerHeight * 0.6
  const sizeW = vw / sweeper.columns
  const sizeH = vh / sweeper.rows
  sweeper.blockSize = Math.floor(Math.min(sizeW, sizeH))
  const cw = sweeper.blockSize * sweeper.columns
  const ch = sweeper.blockSize * sweeper.rows
  canvas.value.style.width = `${cw}px`
  canvas.value.style.height = `${ch}px`
  canvas.value.width = cw * pixelRatio
  canvas.value.height = ch * pixelRatio
}

function draw() {
  if (!ctx.value) return
  const { blockSize } = sweeper
  ctx.value.save()
  ctx.value.scale(pixelRatio, pixelRatio)
  ctx.value.fillStyle =
    getThemeColor('--theme-canvas-grid') || (themeStore.isDarkMode ? '#2e2e2e' : '#d5d5d5')
  ctx.value.fillRect(0, 0, canvas.value.width, canvas.value.height)

  ctx.value.font = `${Math.floor(blockSize / 1.6)}px Courier New`
  ctx.value.textAlign = 'center'
  ctx.value.textBaseline = 'middle'
  const colors = [
    '#000000',
    '#1414c8',
    '#14c828',
    '#c82832',
    '#b48228',
    '#aa28aa',
    '#28aaaa',
    '#000000',
    '#000000',
  ]
  for (let r = 0; r < sweeper.rows; r++) {
    for (let c = 0; c < sweeper.columns; c++) {
      const n = sweeper.grid[r][c]
      const x = c * blockSize
      const y = r * blockSize

      // tile background
      ctx.value.fillStyle =
        getThemeColor('--theme-canvas-bg') || (themeStore.isDarkMode ? '#4a4a4a' : '#eeeeee')
      ctx.value.fillRect(x + 1, y + 1, blockSize - 2, blockSize - 2)

      // revealed?
      if (n.isShown) {
        ctx.value.fillStyle =
          getThemeColor('--theme-mine-revealed') || (themeStore.isDarkMode ? '#9aa19a' : '#dfeae0')
        ctx.value.fillRect(x + 1, y + 1, blockSize - 2, blockSize - 2)
      }

      // mine or flag visuals
      if (n.isMarked) {
        ctx.value.fillStyle =
          getThemeColor('--theme-mine-flag') || (themeStore.isDarkMode ? '#9aa19a' : '#dfeae0')
        ctx.value.beginPath()
        ctx.value.arc(x + blockSize / 2, y + blockSize / 2, blockSize / 3, 0, Math.PI * 2)
        ctx.value.fill()
      }

      if (n.isMine && (sweeper.showMines || n.isShown)) {
        ctx.value.fillStyle = getThemeColor('--theme-mine-bg') || '#ff4d6d'
        ctx.value.beginPath()
        ctx.value.arc(x + blockSize / 2, y + blockSize / 2, blockSize / 3, 0, Math.PI * 2)
        ctx.value.fill()
      }

      // numbers
      if (n.isShown && !n.isMine) {
        const count = n.neighbors.filter((nb) => nb.isMine).length
        if (count > 0) {
          ctx.value.fillStyle = colors[count]
          ctx.value.fillText(count, x + blockSize / 2, y + blockSize / 2)
        }
      }
    }
  }
  ctx.value.restore()
}

function loop(ts) {
  const dt = (ts - lastTimestamp) / 1000
  lastTimestamp = ts
  if (sweeper.gameStatus === 0) sweeper.time += dt
  draw()
  rafId = requestAnimationFrame(loop)
}

// ───── Events ─────
function onPointer(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const col = Math.floor(x * sweeper.columns)
  const row = Math.floor(y * sweeper.rows)
  const node = sweeper.grid[row][col]
  sweeper.act(node, e.button)
  e.preventDefault()
}

function onDifficultyChange() {
  if (selectedDifficulty.value !== 'custom') {
    applyDifficulty()
    resetGame()
  }
}

// ───── Lifecycle ─────
onMounted(() => {
  ctx.value = canvas.value.getContext('2d')
  applyDifficulty()
  resetGame()
  window.addEventListener('resize', resize)
  rafId = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(rafId)
})
</script>

<style lang="scss" scoped>
@use '@/styles/theme.scss';
@use '@/styles/generalGames.scss';

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  transition:
    background-color 0.3s,
    color 0.3s;
}

// Custom settings grid for minesweeper
.custom-settings {
  margin-top: 20px;
  padding: 20px;
  background: var(--theme-sidebar-bg);
  border-radius: 8px;
  border: 1px solid var(--theme-border-light);

  .custom-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
    align-items: end;
  }
}

/* ─────── Controls ─────── */
.settings {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  .difficulty {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.5rem 1rem;
    .radio {
      font-size: 0.9rem;
      color: var(--theme-text-primary);
      input {
        margin-right: 0.25rem;
        accent-color: var(--theme-modal-header);
      }
    }
  }
  .custom-settings {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.5rem 0;
    label {
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      color: var(--theme-text-primary);
      input {
        width: 4rem;
        border: none;
        border-block: 1px solid var(--theme-input-border);
        background: var(--theme-input-bg);
        color: var(--theme-input-text);
        padding: 0.2rem 0;
        font-size: 0.9rem;
        transition: border-color 0.3s;
        &:focus {
          outline: none;
          border-block: 1px solid var(--theme-modal-header);
        }
      }
    }
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  .seed-input {
    position: relative;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--theme-text-primary);
    input {
      width: 6rem;
      padding: 0.25rem 0.4rem;
      background: var(--theme-input-bg);
      color: var(--theme-input-text);
      border: 1px solid var(--theme-input-border);
      border-radius: 4px;
      transition: border-color 0.3s;
      &:focus {
        outline: none;
        border-color: var(--theme-modal-header);
      }
    }
    .copy-seed {
      position: relative;
      display: flex;
      justify-content: center;
      .copied-popup {
        position: absolute;
        width: 130%;
        background: var(--theme-modal-bg);
        color: var(--theme-modal-text);
        padding: 0.1em 0.4em;
        transform: translateY(-110%);
        text-align: center;
        border-radius: 6px;
        font-size: 10px;
        opacity: 0.95;
        z-index: 1000;
        pointer-events: none;
        transition: opacity 0.3s;
        box-shadow: var(--theme-shadow-sm);
      }
    }
  }
}

.btn {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 6px;
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  cursor: pointer;
  transition:
    transform 0.15s,
    filter 0.15s,
    background-color 0.3s;
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.15);
    background: var(--theme-button-primary-hover);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* ─────── Stats ─────── */
.stats {
  display: flex;
  gap: 1.5rem;
  margin: 0.75rem 0 1rem;
  align-items: center;
  flex-wrap: wrap;
  color: var(--theme-text-primary);
  .progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    .bar {
      width: 12rem;
      height: 10px;
      background: var(--theme-sidebar-bg);
      border-radius: 5px;
      overflow: hidden;
      &__inner {
        height: 100%;
        background: var(--theme-modal-header);
        border-radius: 5px 0 0 5px;
        transition: width 0.2s ease-out;
        &.cleared {
          background: var(--theme-button-success-bg) !important;
        }
      }
    }
  }
}

/* ─────── Canvas ─────── */
.canvas-wrapper {
  position: relative;
  canvas {
    touch-action: none;
    user-select: none;
    cursor: pointer;
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
  }

  .overlay {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 1rem 2rem;
    font-size: 1.5rem;
    border-radius: 8px;
    &.win {
      background: var(--theme-bg-overlay-success);
      color: var(--theme-button-primary-text);
    }
    &.lose {
      background: var(--theme-bg-overlay-danger);
      color: var(--theme-button-primary-text);
    }
  }
}
/* fade transition for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
