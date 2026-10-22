// pieces.ts

export type Cell = readonly [row: number, col: number]

export const BOARD_ROWS = 5
export const BOARD_COLS = 11

export interface PieceDef {
  id: string
  name: string // Swedish adjective, used as "den {name} biten"
  color: string
  // Normalized cells (min row/col = 0). The order is kept through every transform,
  // so cells[i] always refers to the same physical ball.
  cells: Cell[]
}

export interface Orientation {
  rotation: number // 0-3, quarter turns clockwise
  flipped: boolean // mirrored horizontally before rotating
}

// The 12 pieces of the 5x11 board, 55 cells in total
export const PIECES: PieceDef[] = [
  { id: 'pink', name: 'rosa', color: '#f25ec4', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: 'yellow', name: 'gula', color: '#ffc414', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 2]] },
  { id: 'orange', name: 'orange', color: '#ff7b1c', cells: [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: 'blue', name: 'mörkblå', color: '#1d3fc8', cells: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { id: 'red', name: 'röda', color: '#ee2b2b', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1]] },
  { id: 'teal', name: 'blågröna', color: '#1c9c84', cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
  { id: 'lime', name: 'limegröna', color: '#9fd21e', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]] },
  { id: 'sky', name: 'blå', color: '#2b9fe8', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: 'maroon', name: 'vinröda', color: '#a3122f', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: 'cyan', name: 'ljusblå', color: '#80d4f2', cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 'mint', name: 'mintgröna', color: '#7ee8c0', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2]] },
  { id: 'purple', name: 'lila', color: '#8a20c0', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
]

export const PIECE_BY_ID: Record<string, PieceDef> = Object.fromEntries(
  PIECES.map((p) => [p.id, p]),
)

/**
 * Applies flip, then rotation, and normalizes so min row/col = 0.
 */
export function orientCells(cells: Cell[], o: Orientation): Cell[] {
  let out = cells.map(([r, c]): Cell => [r, o.flipped ? -c : c])
  for (let i = 0; i < o.rotation; i++) {
    // Clockwise quarter turn in screen space (row down, col right)
    out = out.map(([r, c]): Cell => [c, -r])
  }
  const minR = Math.min(...out.map((c) => c[0]))
  const minC = Math.min(...out.map((c) => c[1]))
  return out.map(([r, c]): Cell => [r - minR, c - minC])
}

export function rotated(o: Orientation): Orientation {
  return { rotation: (o.rotation + 1) % 4, flipped: o.flipped }
}

/**
 * Mirrors horizontally on screen regardless of current rotation (F·R^k = R^-k·F).
 */
export function mirrored(o: Orientation): Orientation {
  return { rotation: (4 - o.rotation) % 4, flipped: !o.flipped }
}

const cellKey = (cells: Cell[]) =>
  cells
    .map(([r, c]) => r * 100 + c)
    .sort((a, b) => a - b)
    .join(',')

/**
 * Finds the orientation and position that puts a piece on the given absolute cells.
 * Used to turn solver/generator output (plain cell sets) into piece states.
 */
export function findPlacement(
  def: PieceDef,
  absCells: Cell[],
): (Orientation & { row: number; col: number }) | null {
  const row = Math.min(...absCells.map((c) => c[0]))
  const col = Math.min(...absCells.map((c) => c[1]))
  const target = cellKey(absCells.map(([r, c]): Cell => [r - row, c - col]))
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      if (cellKey(orientCells(def.cells, { rotation, flipped })) === target) {
        return { rotation, flipped, row, col }
      }
    }
  }
  return null
}

/**
 * Index pairs of orthogonally adjacent cells, used to draw the connectors between balls.
 */
export function adjacentPairs(cells: Cell[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]!
      const b = cells[j]!
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) pairs.push([i, j])
    }
  }
  return pairs
}
