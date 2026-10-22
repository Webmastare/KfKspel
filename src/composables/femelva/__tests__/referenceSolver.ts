// referenceSolver.ts
// The original, straightforward solver. The fast solver must give the same counts and
// find solutions in the same order, which keeps seeds producing the same boards.

import type { Occupancy } from '../board'
import { BOARD_COLS, BOARD_ROWS, PIECE_BY_ID } from '../pieces'
import { pieceVariants } from '../solver'

const CELL_COUNT = BOARD_ROWS * BOARD_COLS

const SCAN_ORDER: number[] = []
for (let c = 0; c < BOARD_COLS; c++) {
  for (let r = 0; r < BOARD_ROWS; r++) SCAN_ORDER.push(r * BOARD_COLS + c)
}

export function referenceSolve(
  start: Occupancy,
  pieceIds: string[],
  options: { limit?: number; keep?: number; random?: () => number } = {},
) {
  const limit = options.limit ?? Infinity
  const keep = options.keep ?? 0
  const ids = [...pieceIds]
  if (options.random) shuffle(ids, options.random)
  const variants = ids.map((id) => {
    const list = [...pieceVariants(id)]
    if (options.random) shuffle(list, options.random)
    return list
  })

  const grid = new Int8Array(CELL_COUNT)
  let emptyCells = 0
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (start[r]![c] !== null) grid[r * BOARD_COLS + c] = -1
      else emptyCells++
    }
  }
  const pieceCells = ids.reduce((sum, id) => sum + PIECE_BY_ID[id]!.cells.length, 0)
  const result = { count: 0, exhausted: true, solutions: [] as Occupancy[] }
  if (pieceCells !== emptyCells) return result
  const used = new Uint8Array(ids.length)

  const fits = (variant: [number, number][], r0: number, c0: number) =>
    variant.every(([dr, dc]) => {
      const r = r0 + dr
      const c = c0 + dc
      return r >= 0 && r < BOARD_ROWS && c < BOARD_COLS && grid[r * BOARD_COLS + c] === 0
    })

  const search = (scanFrom: number): boolean => {
    let pos = scanFrom
    while (pos < CELL_COUNT && grid[SCAN_ORDER[pos]!] !== 0) pos++
    if (pos === CELL_COUNT) {
      result.count++
      if (result.solutions.length < keep) {
        result.solutions.push(
          start.map((row, r) =>
            row.map((id, c) => {
              const v = grid[r * BOARD_COLS + c]!
              return v > 0 ? ids[v - 1]! : id
            }),
          ),
        )
      }
      return result.count >= limit
    }
    const cell = SCAN_ORDER[pos]!
    const r0 = Math.floor(cell / BOARD_COLS)
    const c0 = cell % BOARD_COLS
    for (let p = 0; p < ids.length; p++) {
      if (used[p]) continue
      for (const variant of variants[p]!) {
        if (!fits(variant, r0, c0)) continue
        for (const [dr, dc] of variant) grid[(r0 + dr) * BOARD_COLS + c0 + dc] = p + 1
        used[p] = 1
        const stop = search(pos + 1)
        used[p] = 0
        for (const [dr, dc] of variant) grid[(r0 + dr) * BOARD_COLS + c0 + dc] = 0
        if (stop) return true
      }
    }
    return false
  }

  result.exhausted = !search(0)
  return result
}

function shuffle<T>(list: T[], random: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
}
