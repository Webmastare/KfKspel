<template>
  <div id="app-container">
    <h1 class="game-header">Ordhjälpen</h1>
    <p class="tagline">Hitta ord till korsord, Alfapet och Bananagrams</p>

    <!-- Mode switcher -->
    <div class="mode-switcher">
      <button
        v-for="m in modes"
        :key="m.value"
        :class="['mode-btn', { active: mode === m.value }]"
        @click="selectMode(m.value)"
      >
        {{ m.label }}
      </button>
    </div>

    <section class="search-card">
      <div class="search-input-wrap" :class="{ invalid: !!result.error }">
        <input
          id="ordhjalp-query"
          ref="queryInput"
          v-model="query"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :aria-label="currentMode.label"
          :placeholder="currentMode.placeholder"
        />
        <button v-if="query" class="clear-btn" aria-label="Rensa" @click="clearQuery">✕</button>
      </div>

      <div class="symbol-bar">
        <button
          v-for="s in currentMode.symbols"
          :key="s.label"
          class="symbol-btn"
          :class="{ letter: s.isLetter }"
          :title="s.title"
          @click="insertAtCursor(s.insert, s.caretBack ?? 0)"
        >
          {{ s.label }}
        </button>
      </div>

      <p v-if="result.error" class="query-error">{{ result.error }}</p>
      <div v-else-if="previewTiles.length" class="query-preview" aria-hidden="true">
        <span v-for="(tile, i) in previewTiles" :key="i" class="preview-tile" :class="tile.kind">{{
          tile.text
        }}</span>
      </div>

      <p class="mode-hint">{{ currentMode.hint }}</p>

      <!-- Pattern cheat sheet -->
      <div v-if="mode === 'pattern'" class="cheat-sheet">
        <button
          v-for="row in patternSymbols"
          :key="row.symbol"
          class="cheat-row"
          :title="`Infoga ${row.symbol}`"
          @click="insertAtCursor(row.insert, row.caretBack ?? 0)"
        >
          <code>{{ row.symbol }}</code>
          <span>{{ row.meaning }}</span>
        </button>
      </div>

      <div class="filters">
        <div class="filter-group">
          <span class="filter-label">Längd</span>
          <div class="length-chips">
            <button
              :class="['length-chip', { active: selectedLength === null }]"
              @click="selectedLength = null"
            >
              Alla
            </button>
            <button
              v-for="len in wordLengths"
              :key="len"
              :class="['length-chip', { active: selectedLength === len }]"
              :disabled="!result.idle && !lengthCounts.get(len)"
              @click="selectedLength = selectedLength === len ? null : len"
            >
              {{ len }}
              <small v-if="!result.idle">{{ lengthCounts.get(len) ?? 0 }}</small>
            </button>
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="ordhjalp-exclude">Utan bokstäverna</label>
          <input
            id="ordhjalp-exclude"
            v-model="exclude"
            class="exclude-input"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="t.ex. eo"
          />
        </div>
      </div>
    </section>

    <section class="results">
      <div v-if="loading" class="checking-spinner">
        <div class="spinner"></div>
        <span class="checking-text">Laddar ordlistan...</span>
      </div>
      <p v-else-if="loadError" class="query-error">{{ loadError }}</p>
      <div v-else-if="result.idle" class="empty-state">
        Skriv något ovan för att söka bland {{ words.length.toLocaleString('sv-SE') }} ord.
      </div>
      <template v-else-if="!result.error">
        <div class="result-header">
          <h2 class="result-summary">
            <template v-if="shownHits.length">
              {{ shownHits.length.toLocaleString('sv-SE') }} ord hittades
            </template>
            <template v-else>Inga ord matchade</template>
          </h2>
          <div v-if="shownHits.length" class="legend">
            <span
              ><i class="mini-tile fixed"></i
              >{{ mode === 'tiles' ? 'din bricka' : 'din bokstav' }}</span
            >
            <span v-if="mode === 'pattern' && usesClass"
              ><i class="mini-tile class"></i>bokstavsgrupp</span
            >
            <span v-if="mode === 'tiles' && hasBlanks"
              ><i class="mini-tile blank"></i>blank bricka</span
            >
            <span v-if="mode === 'tiles' && usesAllTiles"
              ><i class="legend-all-tiles"></i>använder alla brickor</span
            >
          </div>
        </div>
        <p v-if="shownHits.length" class="copy-hint">Klicka på ett ord för att kopiera det.</p>

        <div v-for="group in groups" :key="group.length" class="result-group">
          <h3 class="group-title">
            {{ group.length }} bokstäver
            <span class="group-count">{{ group.hits.length }}</span>
          </h3>
          <div class="word-list">
            <button
              v-for="hit in visibleHits(group)"
              :key="hit.word"
              class="word-chip"
              :class="{ 'all-tiles': mode === 'tiles' && hit.word.length === tileCount }"
              :title="`Kopiera ${hit.word}`"
              :aria-label="hit.word"
              @click="copyWord(hit.word)"
            >
              <span v-for="(ch, i) in hit.word" :key="i" class="mini-tile" :class="hit.marks[i]">{{
                ch
              }}</span>
            </button>
          </div>
          <button
            v-if="group.hits.length > GROUP_LIMIT && !expandedGroups.has(group.length)"
            class="show-more-btn"
            @click="expandedGroups.add(group.length)"
          >
            Visa alla {{ group.hits.length }}
          </button>
        </div>
      </template>
    </section>

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  lettersOnly,
  normalizeQuery,
  parsePattern,
  parseRack,
  rackSize,
  searchWords,
  type SearchHit,
  type SearchMode,
} from '@/composables/ordel/wordSearch'

interface SymbolButton {
  label: string
  insert: string
  title: string
  caretBack?: number
  isLetter?: boolean
}

interface ModeConfig {
  value: SearchMode
  label: string
  placeholder: string
  hint: string
  symbols: SymbolButton[]
}

interface PreviewTile {
  kind: 'letter' | 'blank' | 'single' | 'any' | 'class' | 'anchor'
  text: string
}

interface ResultGroup {
  length: number
  hits: SearchHit[]
}

const GROUP_LIMIT = 60

const swedishLetters: SymbolButton[] = ['å', 'ä', 'ö'].map((l) => ({
  label: l.toUpperCase(),
  insert: l,
  title: `Skriv ${l}`,
  isLetter: true,
}))

const patternSymbols = [
  { symbol: '^', insert: '^', meaning: 'Ordet börjar här' },
  { symbol: '$', insert: '$', meaning: 'Ordet slutar här' },
  { symbol: '*', insert: '*', meaning: 'Valfritt antal bokstäver (även inga)' },
  { symbol: '?', insert: '?', meaning: 'Exakt en valfri bokstav' },
  { symbol: '[ab]', insert: '[]', caretBack: 1, meaning: 'En av bokstäverna a eller b' },
  {
    symbol: '[!ab]',
    insert: '[!]',
    caretBack: 1,
    meaning: 'Vilken bokstav som helst utom a och b',
  },
]

const modes: ModeConfig[] = [
  {
    value: 'contains',
    label: 'Innehåller',
    placeholder: 't.ex. ex',
    hint: 'Ordet ska innehålla alla bokstäver, var som helst och i valfri ordning. Skriv en bokstav två gånger om den ska finnas minst två gånger.',
    symbols: swedishLetters,
  },
  {
    value: 'pattern',
    label: 'Mönster',
    placeholder: 't.ex. ^e*x*',
    hint: 'Utan ^ och $ får mönstret finnas var som helst i ordet. Bra för korsord: ^?a??e$ betyder fem bokstäver med a som andra och e som sista.',
    symbols: [
      { label: '^', insert: '^', title: 'Börjar med' },
      { label: '*', insert: '*', title: 'Valfritt antal bokstäver' },
      { label: '?', insert: '?', title: 'En bokstav' },
      { label: '[ ]', insert: '[]', caretBack: 1, title: 'En av bokstäverna' },
      { label: '$', insert: '$', title: 'Slutar med' },
      ...swedishLetters,
    ],
  },
  {
    value: 'tiles',
    label: 'Mina brickor',
    placeholder: 't.ex. spelakt?',
    hint: 'Skriv bokstäverna du har. Du får ord som går att lägga med dem, längst först. ? eller * är en blank bricka som kan vara vilken bokstav som helst.',
    symbols: [{ label: '?', insert: '?', title: 'Blank bricka' }, ...swedishLetters],
  },
]

const route = useRoute()
const router = useRouter()

const words = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')

const mode = ref<SearchMode>('contains')
const query = ref('')
const exclude = ref('')
const selectedLength = ref<number | null>(null)
const expandedGroups = ref(new Set<number>())

const queryInput = ref<HTMLInputElement | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const collator = new Intl.Collator('sv-SE')

const currentMode = computed(() => modes.find((m) => m.value === mode.value) ?? modes[0]!)

const wordLengths = computed(() =>
  [...new Set(words.value.map((w) => w.length))].sort((a, b) => a - b),
)

const result = computed(() =>
  searchWords(words.value, {
    mode: mode.value,
    query: query.value,
    exclude: lettersOnly(exclude.value),
  }),
)

const lengthCounts = computed(() => {
  const counts = new Map<number, number>()
  for (const hit of result.value.hits)
    counts.set(hit.word.length, (counts.get(hit.word.length) ?? 0) + 1)
  return counts
})

const shownHits = computed(() =>
  selectedLength.value === null
    ? result.value.hits
    : result.value.hits.filter((h) => h.word.length === selectedLength.value),
)

const groups = computed<ResultGroup[]>(() => {
  const byLength = new Map<number, SearchHit[]>()
  for (const hit of shownHits.value) {
    const list = byLength.get(hit.word.length)
    if (list) list.push(hit)
    else byLength.set(hit.word.length, [hit])
  }
  // Tiles mode: longest words first, they score the most
  const direction = mode.value === 'tiles' ? -1 : 1
  return [...byLength.entries()]
    .sort(([a], [b]) => (a - b) * direction)
    .map(([length, hits]) => ({
      length,
      hits: hits.sort((a, b) => collator.compare(a.word, b.word)),
    }))
})

const tileCount = computed(() => rackSize(parseRack(query.value)))
const hasBlanks = computed(() => parseRack(query.value).blanks > 0)
const usesAllTiles = computed(() => shownHits.value.some((h) => h.word.length === tileCount.value))
const usesClass = computed(() =>
  parsePattern(query.value).tokens.some((t) => t.kind === 'class' && !t.negated),
)

const previewTiles = computed<PreviewTile[]>(() => {
  if (mode.value === 'contains') {
    return lettersOnly(query.value).map((l) => ({ kind: 'letter', text: l }))
  }
  if (mode.value === 'tiles') {
    return [...normalizeQuery(query.value)].flatMap((c): PreviewTile[] => {
      if (c === '?' || c === '*') return [{ kind: 'blank', text: '' }]
      return lettersOnly(c).length ? [{ kind: 'letter', text: c }] : []
    })
  }
  return parsePattern(query.value).tokens.map((t): PreviewTile => {
    switch (t.kind) {
      case 'start':
        return { kind: 'anchor', text: 'start' }
      case 'end':
        return { kind: 'anchor', text: 'slut' }
      case 'any':
        return { kind: 'any', text: '…' }
      case 'single':
        return { kind: 'single', text: '?' }
      case 'class':
        return { kind: 'class', text: (t.negated ? 'ej ' : '') + [...t.letters].join('/') }
      case 'letter':
        return { kind: 'letter', text: t.letter }
    }
  })
})

function visibleHits(group: ResultGroup): SearchHit[] {
  return expandedGroups.value.has(group.length) ? group.hits : group.hits.slice(0, GROUP_LIMIT)
}

function selectMode(next: SearchMode) {
  mode.value = next
  queryInput.value?.focus()
}

function clearQuery() {
  query.value = ''
  queryInput.value?.focus()
}

// Insert text where the caret is, so ^ * ? å ä ö are easy to reach on phones
async function insertAtCursor(text: string, caretBack: number) {
  const el = queryInput.value
  const start = el?.selectionStart ?? query.value.length
  const end = el?.selectionEnd ?? query.value.length
  query.value = query.value.slice(0, start) + text + query.value.slice(end)
  await nextTick()
  if (el) {
    const caret = start + text.length - caretBack
    el.focus()
    el.setSelectionRange(caret, caret)
  }
}

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1800)
}

async function copyWord(word: string) {
  try {
    await navigator.clipboard.writeText(word)
    showToast(`Kopierade "${word.toUpperCase()}"`)
  } catch {
    showToast('Kunde inte kopiera ordet')
  }
}

// --- Keep the search in the URL so it can be shared ---
function isMode(value: unknown): value is SearchMode {
  return modes.some((m) => m.value === value)
}

const initial = route.query
if (isMode(initial.mode)) mode.value = initial.mode
if (typeof initial.q === 'string') query.value = initial.q
if (typeof initial.utan === 'string') exclude.value = initial.utan
if (typeof initial.len === 'string' && Number(initial.len) > 0)
  selectedLength.value = Number(initial.len)

watch([mode, query, exclude, selectedLength], () => {
  const next: Record<string, string> = {}
  if (mode.value !== 'contains') next.mode = mode.value
  if (query.value) next.q = query.value
  if (exclude.value) next.utan = exclude.value
  if (selectedLength.value !== null) next.len = String(selectedLength.value)
  router.replace({ query: next })
})

watch([mode, query, exclude], () => expandedGroups.value.clear())

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}ordel/all-valid-words.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: { words: string[] } = await res.json()
    words.value = [...new Set(data.words.map(normalizeQuery))]
  } catch (e) {
    console.error('Failed to load words', e)
    loadError.value = 'Kunde inte ladda ordlistan. Försök igen senare.'
  } finally {
    loading.value = false
  }
  queryInput.value?.focus()
})
</script>

<style scoped lang="scss">
@use '@/styles/generalGames.scss';

$tile-correct: #538d4e;
$tile-present: #b59f3b;
$tile-absent: #3a3a3c;
$highlight: #ebd126;

#app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100%;
  padding: 20px 16px 60px;
  box-sizing: border-box;
}

.game-header {
  margin-bottom: 0;
  padding-bottom: 4px;
}

.tagline {
  margin: 0 0 20px;
  color: var(--theme-text-secondary);
  text-align: center;
}

.mode-switcher {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 8px;
  background: var(--theme-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--theme-button-primary-border);

  .mode-btn {
    @extend .button-base;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;

    &:not(.active) {
      background: var(--theme-bg-tertiary);
      color: var(--theme-text-primary);
      text-shadow: none;

      &:hover {
        background: var(--theme-button-secondary-hover);
        color: var(--theme-text-on-dark);
      }
    }

    &:hover {
      transform: translateY(-1px);
    }

    &.active {
      background: var(--theme-button-primary-bg);
      color: var(--theme-button-primary-text);
      border-color: $highlight;
      font-weight: 700;
    }
  }
}

.search-card {
  width: 100%;
  max-width: 720px;
  box-sizing: border-box;
  padding: 20px;
  background: var(--theme-bg-secondary);
  border: 2px solid var(--theme-button-primary-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.search-input-wrap {
  position: relative;

  input {
    width: 100%;
    box-sizing: border-box;
    padding: 14px 48px 14px 16px;
    font-size: 1.6rem;
    font-weight: bold;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    background: var(--theme-bg-primary);
    color: var(--theme-text-primary);
    border: 2px solid var(--theme-button-primary-border);
    border-radius: 6px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    &::placeholder {
      color: var(--theme-input-placeholder);
      text-transform: none;
      letter-spacing: normal;
      font-weight: 500;
      font-size: 1.1rem;
    }

    &:focus {
      outline: none;
      border-color: $tile-correct;
      box-shadow: 0 0 0 3px rgba(83, 141, 78, 0.25);
    }
  }

  &.invalid input {
    border-color: var(--theme-error);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  .clear-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: var(--theme-bg-tertiary);
    color: var(--theme-text-primary);
    font-size: 0.9rem;
    cursor: pointer;

    &:hover {
      background: var(--theme-button-secondary-hover);
      color: var(--theme-text-on-dark);
    }
  }
}

.symbol-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .symbol-btn {
    min-width: 44px;
    padding: 10px 8px;
    background: var(--theme-bg-tertiary);
    color: var(--theme-text-primary);
    border: 1px solid var(--theme-button-primary-border);
    border-radius: 5px;
    font-size: 1rem;
    font-weight: bold;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;

    &.letter {
      font-family: inherit;
    }

    &:hover {
      background: var(--theme-button-secondary-hover);
      color: var(--theme-text-on-dark);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.query-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;

  .preview-tile {
    min-width: 38px;
    height: 38px;
    padding: 0 6px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--theme-button-primary-border);
    border-radius: 4px;
    font-weight: bold;
    font-size: 1.2rem;
    text-transform: uppercase;
    background: var(--theme-bg-primary);
    animation: pop 0.15s ease-out;

    &.letter {
      background: $tile-correct;
      border-color: $tile-correct;
      color: white;
    }

    &.class {
      background: $tile-present;
      border-color: $tile-present;
      color: white;
      font-size: 0.9rem;
    }

    &.blank,
    &.single {
      border-style: dashed;
      color: var(--theme-text-tertiary);
    }

    &.any {
      min-width: 60px;
      border-style: dashed;
      color: var(--theme-text-tertiary);
    }

    &.anchor {
      min-width: 0;
      height: 26px;
      padding: 0 8px;
      border-radius: 13px;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      border-color: $highlight;
      color: var(--theme-text-secondary);
    }
  }
}

@keyframes pop {
  from {
    transform: scale(0.85);
  }
  to {
    transform: scale(1);
  }
}

.query-error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: var(--theme-error);
  font-weight: 600;
}

.mode-hint {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--theme-text-secondary);
}

.cheat-sheet {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 6px;

  .cheat-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--theme-bg-primary);
    color: var(--theme-text-primary);
    border: 1px solid var(--theme-border-light);
    border-radius: 6px;
    text-align: left;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.2s;

    &:hover {
      border-color: $tile-correct;
    }

    code {
      min-width: 48px;
      font-weight: bold;
      font-size: 1rem;
      color: $tile-correct;
    }
  }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  padding-top: 14px;
  border-top: 1px solid var(--theme-border-light);

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-tertiary);
  }

  .length-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .length-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 8px 12px;
    background: var(--theme-bg-tertiary);
    color: var(--theme-text-primary);
    border: 2px solid var(--theme-button-primary-border);
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;

    small {
      font-weight: 500;
      font-size: 0.7rem;
      opacity: 0.75;
    }

    &:hover:not(:disabled) {
      transform: translateY(-2px);
    }

    &.active {
      background: var(--theme-button-primary-bg);
      border-color: $highlight;
      color: white;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .exclude-input {
    width: 160px;
    padding: 9px 12px;
    font-size: 1rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: var(--theme-bg-primary);
    color: var(--theme-text-primary);
    border: 2px solid var(--theme-button-primary-border);
    border-radius: 5px;

    &::placeholder {
      text-transform: none;
      letter-spacing: normal;
      font-weight: normal;
      color: var(--theme-input-placeholder);
    }

    &:focus {
      outline: none;
      border-color: $tile-absent;
    }
  }
}

.results {
  width: 100%;
  max-width: 720px;
  margin-top: 24px;
}

.empty-state {
  padding: 30px 20px;
  text-align: center;
  color: var(--theme-text-secondary);
  border: 2px dashed var(--theme-button-primary-border);
  border-radius: 8px;
}

.result-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;

  .result-summary {
    margin: 0;
    font-size: 1.3rem;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--theme-text-secondary);

  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .mini-tile {
    width: 14px;
    height: 14px;
    min-width: 0;
  }

  .legend-all-tiles {
    width: 14px;
    height: 14px;
    border: 2px solid $highlight;
    border-radius: 4px;
    box-sizing: border-box;
  }
}

.copy-hint {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--theme-text-tertiary);
}

.result-group {
  margin-top: 20px;

  .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 1rem;
    color: var(--theme-text-secondary);

    .group-count {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--theme-bg-secondary);
      border: 1px solid var(--theme-button-primary-border);
      font-size: 0.75rem;
    }
  }
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.word-chip {
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  background: var(--theme-bg-secondary);
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--theme-button-primary-border);
    box-shadow: var(--theme-shadow-sm);
  }

  &:active {
    transform: translateY(0);
  }

  &.all-tiles {
    border-color: $highlight;
  }
}

.mini-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--theme-button-primary-border);
  border-radius: 3px;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-weight: bold;
  font-size: 0.95rem;
  text-transform: uppercase;

  &.fixed {
    background: $tile-correct;
    border-color: $tile-correct;
    color: white;
  }

  &.class {
    background: $tile-present;
    border-color: $tile-present;
    color: white;
  }

  &.blank {
    border-style: dashed;
    border-color: var(--theme-text-tertiary);
    color: var(--theme-text-tertiary);
  }
}

.show-more-btn {
  @extend .button-base;
  margin-top: 10px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.checking-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 15px 0;
  color: var(--theme-text-secondary);
  font-size: 0.9rem;

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #23641e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 6px;
  background: $tile-correct;
  color: white;
  font-weight: bold;
  box-shadow: var(--theme-shadow-md);
  z-index: 100;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (max-width: 768px) {
  .mode-switcher {
    gap: 4px;
    padding: 6px;

    .mode-btn {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
  }

  .search-card {
    padding: 14px;
  }

  .search-input-wrap input {
    font-size: 1.3rem;
  }

  .query-preview .preview-tile {
    min-width: 32px;
    height: 32px;
    font-size: 1rem;
  }

  .mini-tile {
    width: 22px;
    height: 24px;
    font-size: 0.8rem;
  }

  .word-list {
    gap: 6px;
  }
}
</style>
