// solver.ts
// Exact-cover backtracking: always fill the first empty cell (column by column, since the
// board is only 5 tall) with every remaining piece in every orientation that covers it.
//
// The board is a bitboard: bit `col * 5 + row`, so scan order is bit order and the first
// empty cell is the lowest zero bit. 55 bits don't fit in one int32, so columns 0–5 live
// in `lo` (bits 0–29) and columns 6–10 in `hi` (bits 0–24).

import { BOARD_COLS, BOARD_ROWS, PIECE_BY_ID, orientCells } from './pieces'
import type { Occupancy } from './board'

const CELL_COUNT = BOARD_ROWS * BOARD_COLS
const LO_BITS = 30
const LO_FULL = (1 << LO_BITS) - 1
const HI_FULL = (1 << (CELL_COUNT - LO_BITS)) - 1

const SCAN_ORDER: number[] = []
for (let c = 0; c < BOARD_COLS; c++) {
  for (let r = 0; r < BOARD_ROWS; r++) SCAN_ORDER.push(r * BOARD_COLS + c)
}

// Orthogonal neighbors of each bit, -1 where the board ends
const NEIGHBORS = new Int8Array(CELL_COUNT * 4).fill(-1)
for (let b = 0; b < CELL_COUNT; b++) {
  const r = b % BOARD_ROWS
  const c = Math.floor(b / BOARD_ROWS)
  const out = [
    r > 0 ? b - 1 : -1,
    r < BOARD_ROWS - 1 ? b + 1 : -1,
    c > 0 ? b - BOARD_ROWS : -1,
    c < BOARD_COLS - 1 ? b + BOARD_ROWS : -1,
  ]
  out.forEach((n, i) => (NEIGHBORS[b * 4 + i] = n))
}

const ctz = (x: number) => 31 - Math.clz32(x & -x)

// Offsets from the cell that comes first in scan order, so a variant can be dropped
// straight onto the first empty cell
type Variant = [dr: number, dc: number][]

const variantCache = new Map<string, Variant[]>()

export function pieceVariants(id: string): Variant[] {
  const cached = variantCache.get(id)
  if (cached) return cached
  const seen = new Set<string>()
  const variants: Variant[] = []
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const cells = [...orientCells(PIECE_BY_ID[id]!.cells, { rotation, flipped })].sort(
        (a, b) => a[1] - b[1] || a[0] - b[0],
      )
      const key = cells.map(([r, c]) => `${r},${c}`).join(';')
      if (seen.has(key)) continue
      seen.add(key)
      const [ar, ac] = cells[0]!
      variants.push(cells.map(([r, c]): [number, number] => [r - ar, c - ac]))
    }
  }
  variantCache.set(id, variants)
  return variants
}

// Every on-board placement of one piece, grouped by the bit of its first cell, in variant
// order. Placements for anchor `a` are indexes `start[a]` to `start[a + 1]`.
interface PlacementTable {
  start: Int32Array
  lo: Int32Array
  hi: Int32Array
  edgeLo: Int32Array // cells next to the placement, used to spot cut-off holes
  edgeHi: Int32Array
}

const tableCache = new Map<string, PlacementTable>()

function placementTable(variants: Variant[]): PlacementTable {
  const start = new Int32Array(CELL_COUNT + 1)
  const lo: number[] = []
  const hi: number[] = []
  const edgeLo: number[] = []
  const edgeHi: number[] = []
  for (let a = 0; a < CELL_COUNT; a++) {
    start[a] = lo.length
    const r0 = a % BOARD_ROWS
    const c0 = Math.floor(a / BOARD_ROWS)
    for (const variant of variants) {
      const bits = variant.map(([dr, dc]) => {
        const r = r0 + dr
        const c = c0 + dc
        return r < 0 || r >= BOARD_ROWS || c >= BOARD_COLS ? -1 : c * BOARD_ROWS + r
      })
      if (bits.includes(-1)) continue
      const edge = new Set<number>()
      for (const b of bits) {
        for (let i = 0; i < 4; i++) {
          const n = NEIGHBORS[b * 4 + i]!
          if (n >= 0 && !bits.includes(n)) edge.add(n)
        }
      }
      const [mLo, mHi] = toMask(bits)
      const [eLo, eHi] = toMask([...edge])
      lo.push(mLo)
      hi.push(mHi)
      edgeLo.push(eLo)
      edgeHi.push(eHi)
    }
  }
  start[CELL_COUNT] = lo.length
  return {
    start,
    lo: Int32Array.from(lo),
    hi: Int32Array.from(hi),
    edgeLo: Int32Array.from(edgeLo),
    edgeHi: Int32Array.from(edgeHi),
  }
}

function toMask(bits: number[]): [lo: number, hi: number] {
  let lo = 0
  let hi = 0
  for (const b of bits) {
    if (b < LO_BITS) lo |= 1 << b
    else hi |= 1 << (b - LO_BITS)
  }
  return [lo, hi]
}

function cachedTable(id: string) {
  let table = tableCache.get(id)
  if (!table) {
    table = placementTable(pieceVariants(id))
    tableCache.set(id, table)
  }
  return table
}

export interface SolveOptions {
  limit?: number // stop after this many solutions
  keep?: number // how many solutions to return
  timeLimitMs?: number
  random?: () => number // shuffles the search order, used to generate random boards
  onProgress?: (progress: SolveProgress) => void
  progressIntervalMs?: number
  // Search only part of the tree, so several workers can split one search
  shard?: { index: number; count: number; depth: number }
}

export interface SolveResult {
  count: number
  exhausted: boolean // true if every possibility was searched, so count is exact
  solutions: Occupancy[]
  nodes: number // search positions visited
  elapsedMs: number
}

export interface SolveProgress {
  count: number
  nodes: number
  elapsedMs: number
  covered: number // rough estimate of how much of the search tree is done, 0–1
  newSolutions: Occupancy[] // kept solutions found since the previous report
}

// Branches at the top of the tree that the coverage estimate looks at
const COVERAGE_DEPTH = 6

/**
 * Fills the empty cells of `start` with the given pieces (each used exactly once).
 * Solutions are found in the same order as a plain cell-by-cell search would find them,
 * which keeps seeded boards stable.
 */
export function solve(
  start: Occupancy,
  pieceIds: string[],
  options: SolveOptions = {},
): SolveResult {
  const limit = options.limit ?? Infinity
  const keep = options.keep ?? 0
  const startedAt = Date.now()
  const deadline = options.timeLimitMs === undefined ? Infinity : startedAt + options.timeLimitMs
  const progressInterval = options.progressIntervalMs ?? 100
  let nextReport = startedAt + progressInterval
  let reported = 0

  const ids = [...pieceIds]
  const random = options.random
  if (random) shuffle(ids, random)
  const tables = ids.map((id) => {
    if (!random) return cachedTable(id)
    const list = [...pieceVariants(id)]
    shuffle(list, random)
    return placementTable(list)
  })
  const sizes = ids.map((id) => PIECE_BY_ID[id]!.cells.length)

  let lo = 0
  let hi = 0
  let emptyCells = 0
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (start[r]![c] === null) emptyCells++
      else if (c * BOARD_ROWS + r < LO_BITS) lo |= 1 << (c * BOARD_ROWS + r)
      else hi |= 1 << (c * BOARD_ROWS + r - LO_BITS)
    }
  }

  const result: SolveResult = { count: 0, exhausted: true, solutions: [], nodes: 0, elapsedMs: 0 }
  if (sizes.reduce((a, b) => a + b, 0) !== emptyCells) return result

  // Each shard searches every `count`th subtree at `depth`. Solutions only exist once
  // every piece is placed, so with depth < piece count each one belongs to one shard.
  const shard = options.shard
  if (shard && ids.length === 0 && shard.index !== 0) return result
  const shardDepth = shard ? Math.min(shard.depth, ids.length - 1) : -1
  let subtree = 0

  const used = new Uint8Array(ids.length)
  let nodes = 0
  // Fitting placements per depth: piece index and placement index into its table
  const candPiece = ids.map(() => new Int8Array(ids.length * 8))
  const candIndex = ids.map(() => new Int32Array(ids.length * 8))
  const branch = new Int16Array(ids.length)
  const branches = new Int16Array(ids.length)
  // The placement chosen at each depth, to rebuild kept solutions
  const chosenPiece = new Int8Array(ids.length)
  const chosenLo = new Int32Array(ids.length)
  const chosenHi = new Int32Array(ids.length)

  const covered = (depth: number) => {
    let done = 0
    let share = 1
    for (let d = 0; d < Math.min(depth, COVERAGE_DEPTH); d++) {
      share /= branches[d]!
      done += branch[d]! * share
    }
    return done
  }

  const report = (now: number, depth: number) => {
    options.onProgress!({
      count: result.count,
      nodes,
      elapsedMs: now - startedAt,
      covered: covered(depth),
      newSolutions: result.solutions.slice(reported),
    })
    reported = result.solutions.length
    nextReport = now + progressInterval
  }

  const toOccupancy = (): Occupancy =>
    start.map((row, r) =>
      row.map((id, c) => {
        const b = c * BOARD_ROWS + r
        for (let d = 0; d < ids.length; d++) {
          const mask = b < LO_BITS ? chosenLo[d]! >>> b : chosenHi[d]! >>> (b - LO_BITS)
          if (mask & 1) return ids[chosenPiece[d]!]!
        }
        return id
      }),
    )

  // Stack for the hole size check
  const fillStack = new Int8Array(CELL_COUNT)

  // True if the empty region around bit `seed` has at least `min` cells. Stops counting
  // as soon as it does, so the common case is cheap.
  const regionAtLeast = (seed: number, min: number, fLo: number, fHi: number) => {
    let vLo = 0
    let vHi = 0
    if (seed < LO_BITS) vLo = 1 << seed
    else vHi = 1 << (seed - LO_BITS)
    let size = 1
    let top = 0
    fillStack[top++] = seed
    while (top > 0) {
      const b = fillStack[--top]!
      for (let i = b * 4; i < b * 4 + 4; i++) {
        const n = NEIGHBORS[i]!
        if (n < 0) continue
        if (n < LO_BITS) {
          const bit = 1 << n
          if ((fLo | vLo) & bit) continue
          vLo |= bit
        } else {
          const bit = 1 << (n - LO_BITS)
          if ((fHi | vHi) & bit) continue
          vHi |= bit
        }
        if (++size >= min) return true
        fillStack[top++] = n
      }
    }
    return false
  }

  // False if placing a piece leaves a hole too small for any remaining piece
  const leavesFillableHoles = (nLo: number, nHi: number, eLo: number, eHi: number, min: number) => {
    let openLo = eLo & ~nLo
    let openHi = eHi & ~nHi
    while (openLo !== 0) {
      const b = ctz(openLo)
      openLo &= openLo - 1
      if (!regionAtLeast(b, min, nLo, nHi)) return false
    }
    while (openHi !== 0) {
      const b = ctz(openHi)
      openHi &= openHi - 1
      if (!regionAtLeast(b + LO_BITS, min, nLo, nHi)) return false
    }
    return true
  }

  // Returns true when the search should stop
  const search = (depth: number): boolean => {
    let anchor: number
    let free = ~lo & LO_FULL
    if (free !== 0) anchor = ctz(free)
    else {
      free = ~hi & HI_FULL
      if (free === 0) {
        result.count++
        if (result.solutions.length < keep) result.solutions.push(toOccupancy())
        return result.count >= limit
      }
      anchor = ctz(free) + LO_BITS
    }
    if (++nodes % 4096 === 0) {
      const now = Date.now()
      if (now > deadline) return true
      if (options.onProgress && now >= nextReport) report(now, depth)
    }

    // Smallest piece left once this one is placed decides which holes are dead ends
    let min1 = CELL_COUNT
    let min2 = CELL_COUNT
    for (let p = 0; p < ids.length; p++) {
      if (used[p]) continue
      const size = sizes[p]!
      if (size < min1) {
        min2 = min1
        min1 = size
      } else if (size < min2) min2 = size
    }

    const pieces = candPiece[depth]!
    const indexes = candIndex[depth]!
    let n = 0
    for (let p = 0; p < ids.length; p++) {
      if (used[p]) continue
      const t = tables[p]!
      const min = sizes[p] === min1 ? min2 : min1
      for (let i = t.start[anchor]!; i < t.start[anchor + 1]!; i++) {
        const mLo = t.lo[i]!
        const mHi = t.hi[i]!
        if ((lo & mLo) | (hi & mHi)) continue
        if (!leavesFillableHoles(lo | mLo, hi | mHi, t.edgeLo[i]!, t.edgeHi[i]!, min)) continue
        pieces[n] = p
        indexes[n++] = i
      }
    }

    branches[depth] = n
    for (let k = 0; k < n; k++) {
      branch[depth] = k
      if (depth === shardDepth && subtree++ % shard!.count !== shard!.index) continue
      const p = pieces[k]!
      const t = tables[p]!
      const mLo = t.lo[indexes[k]!]!
      const mHi = t.hi[indexes[k]!]!
      chosenPiece[depth] = p
      chosenLo[depth] = mLo
      chosenHi[depth] = mHi
      lo |= mLo
      hi |= mHi
      used[p] = 1
      const stop = search(depth + 1)
      used[p] = 0
      lo &= ~mLo
      hi &= ~mHi
      if (stop) return true
    }
    return false
  }

  result.exhausted = !search(0)
  result.nodes = nodes
  result.elapsedMs = Date.now() - startedAt
  return result
}

function shuffle<T>(list: T[], random: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
}

/**
 * Sorts pieces by their first cell in scan order (left to right, column by column).
 * This is the order the solver fills the board in, so it makes a natural solving guide.
 */
export function placementOrder(board: Occupancy, pieceIds: string[]): string[] {
  const first = new Map<string, number>()
  SCAN_ORDER.forEach((cell, i) => {
    const id = board[Math.floor(cell / BOARD_COLS)]![cell % BOARD_COLS]
    if (id && !first.has(id)) first.set(id, i)
  })
  return [...pieceIds].sort((a, b) => (first.get(a) ?? 0) - (first.get(b) ?? 0))
}
