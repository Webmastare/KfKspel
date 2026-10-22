// generator.ts
// seed -> random full board -> seeded order in which pieces are taken off the board.
// The difficulty decides how many pieces are taken off, so a harder level with the same
// seed has the same solution with fewer pieces given.

import { buildOccupancy, type Occupancy, type Puzzle } from './board'
import { BOARD_COLS, BOARD_ROWS, PIECES, type Cell } from './pieces'
import { solve } from './solver'

export type DifficultyId = 'easy' | 'medium' | 'hard' | 'expert' | 'free'

export interface Difficulty {
  id: DifficultyId
  name: string
  loosePieces: number // pieces the player has to place
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: 'Lätt', loosePieces: 4 },
  { id: 'medium', name: 'Medel', loosePieces: 6 },
  { id: 'hard', name: 'Svår', loosePieces: 8 },
  { id: 'expert', name: 'Expert', loosePieces: 9 },
  { id: 'free', name: 'Fri lek', loosePieces: PIECES.length },
]

export interface GeneratedPuzzle {
  puzzle: Puzzle
  solution: Occupancy
  // false if `unique` was requested but no more pieces could be removed while keeping
  // a single solution, so fewer pieces are loose than the difficulty asks for
  reachedTarget: boolean
}

// Stop proving uniqueness after this long and treat the removal as not unique
const UNIQUE_CHECK_MS = 3000

// Unique puzzles with many loose pieces are rare: search this many removal sets per
// board, and try this many boards, before settling for the best one found
const CHECKS_PER_BOARD = 400
const MAX_BOARDS = 25

export function generatePuzzle(
  seed: string,
  difficultyId: DifficultyId,
  unique: boolean,
): GeneratedPuzzle {
  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[0]!
  const target = difficulty.loosePieces
  const random = mulberry32(hashSeed(seed))
  // A board with every piece loose can never be unique
  const needsUnique = unique && target < PIECES.length

  let best: { solution: Occupancy; loose: string[] } | null = null
  for (let attempt = 0; attempt < (needsUnique ? MAX_BOARDS : 1); attempt++) {
    const solution = randomSolution(random)
    const removalOrder = shuffled(
      PIECES.map((p) => p.id),
      random,
    )
    const loose = needsUnique
      ? findUniqueRemoval(solution, removalOrder, target)
      : removalOrder.slice(0, target)
    if (!best || loose.length > best.loose.length) best = { solution, loose }
    if (loose.length === target) break
  }
  const { solution, loose } = best!

  const puzzle: Puzzle = {
    id: `${seed}-${difficulty.id}-${unique ? 'u' : 'n'}`,
    name: difficulty.name,
    locked: PIECES.filter((p) => !loose.includes(p.id)).map((p) => ({
      pieceId: p.id,
      cells: cellsOf(solution, p.id),
    })),
  }
  return { puzzle, solution, reachedTarget: loose.length === target }
}

function randomSolution(random: () => number): Occupancy {
  const pieceIds = PIECES.map((p) => p.id)
  return solve(buildOccupancy([]), pieceIds, { limit: 1, keep: 1, random }).solutions[0]!
}

/**
 * Depth-first search for `target` pieces that can be removed while the solution stays
 * unique. Removing fewer pieces from a unique set is always unique too, so only unique
 * sets are extended. Returns the largest set found within the check budget.
 */
function findUniqueRemoval(solution: Occupancy, order: string[], target: number): string[] {
  let best: string[] = []
  let checks = 0
  const extend = (loose: string[], from: number): boolean => {
    if (loose.length > best.length) best = loose
    if (loose.length === target) return true
    for (let i = from; i < order.length; i++) {
      if (checks++ >= CHECKS_PER_BOARD) return false
      const next = [...loose, order[i]!]
      if (isUnique(solution, next) && extend(next, i + 1)) return true
    }
    return false
  }
  extend([], 0)
  return best
}

function shuffled<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function isUnique(solution: Occupancy, loose: string[]) {
  const start = solution.map((row) => row.map((id) => (id && !loose.includes(id) ? id : null)))
  const result = solve(start, loose, { limit: 2, timeLimitMs: UNIQUE_CHECK_MS })
  return result.exhausted && result.count === 1
}

export function cellsOf(board: Occupancy, id: string): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) if (board[r]![c] === id) cells.push([r, c])
  }
  return cells
}

export function randomSeed() {
  return Math.floor(Math.random() * 36 ** 5)
    .toString(36)
    .padStart(5, '0')
}

// FNV-1a, turns any seed string into a 32-bit number
function hashSeed(seed: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
