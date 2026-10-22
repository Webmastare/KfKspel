// board.ts

import {
  BOARD_COLS,
  BOARD_ROWS,
  PIECES,
  PIECE_BY_ID,
  findPlacement,
  orientCells,
  type Cell,
  type Orientation,
} from './pieces'

export interface Position {
  row: number
  col: number
}

export interface PieceState extends Orientation {
  id: string
  position: Position | null // null = in the tray
  locked: boolean // part of the starting position, cannot be moved
}

export interface Puzzle {
  id: string
  name: string
  locked: { pieceId: string; cells: Cell[] }[]
}

// Board grid of piece ids, null = empty
export type Occupancy = (string | null)[][]

export function pieceCells(piece: PieceState): Cell[] {
  return orientCells(PIECE_BY_ID[piece.id]!.cells, piece)
}

export function buildOccupancy(pieces: PieceState[], excludeId?: string): Occupancy {
  const grid: Occupancy = Array.from({ length: BOARD_ROWS }, () =>
    new Array<string | null>(BOARD_COLS).fill(null),
  )
  for (const piece of pieces) {
    if (!piece.position || piece.id === excludeId) continue
    for (const [r, c] of pieceCells(piece)) {
      grid[r + piece.position.row]![c + piece.position.col] = piece.id
    }
  }
  return grid
}

export function canPlace(occupancy: Occupancy, cells: Cell[], row: number, col: number): boolean {
  return cells.every(([r, c]) => {
    const rr = r + row
    const cc = c + col
    return (
      rr >= 0 && rr < BOARD_ROWS && cc >= 0 && cc < BOARD_COLS && occupancy[rr]![cc] === null
    )
  })
}

// Every piece placed means all 55 cells are covered, since placements never overlap
export function isSolved(pieces: PieceState[]): boolean {
  return pieces.every((p) => p.position !== null)
}

export function createPieceStates(puzzle: Puzzle): PieceState[] {
  return PIECES.map((def) => {
    const locked = puzzle.locked.find((l) => l.pieceId === def.id)
    const placement = locked ? findPlacement(def, locked.cells) : null
    if (!placement) {
      return { id: def.id, rotation: 0, flipped: false, position: null, locked: false }
    }
    return {
      id: def.id,
      rotation: placement.rotation,
      flipped: placement.flipped,
      position: { row: placement.row, col: placement.col },
      locked: true,
    }
  })
}
