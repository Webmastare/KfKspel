// sudokuLogic.ts

export type Board = number[][];

// Constants
const GRID_SIZE = 9;
const BOX_SIZE = 3;

/**
 * Checks if placing a number at board[row][col] is valid
 */
export function isValid(
    board: Board,
    row: number,
    col: number,
    num: number,
): boolean {
    // Validate bounds
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return false;
    }

    // Check Row
    for (let x = 0; x < GRID_SIZE; x++) {
        if (board[row]?.[x] === num && x !== col) return false;
    }

    // Check Col
    for (let x = 0; x < GRID_SIZE; x++) {
        if (board[x]?.[col] === num && x !== row) return false;
    }

    // Check 3x3 Box
    const startRow = row - (row % BOX_SIZE);
    const startCol = col - (col % BOX_SIZE);
    for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
            if (board[i + startRow]?.[j + startCol] === num) return false;
        }
    }

    return true;
}

/**
 * Solves the board using backtracking.
 * Returns true if solvable, false otherwise.
 * Modifies the board in-place.
 */
export function solveBoard(board: Board): boolean {
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = board[row]?.[col];
            if (cell === 0) {
                for (let num = 1; num <= 9; num++) {
                    if (isValid(board, row, col, num)) {
                        const targetRow = board[row];
                        if (targetRow) {
                            targetRow[col] = num;
                            if (solveBoard(board)) return true;
                            targetRow[col] = 0; // Backtrack
                        }
                    }
                }
                return false; // No valid number found
            }
        }
    }
    return true; // Filled completely
}

/**
 * Counts solutions to check uniqueness.
 * Optimization: Stops counting if it finds more than 1 solution.
 */
function countSolutions(board: Board): number {
    let count = 0;

    function helper(currentBoard: Board): void {
        if (count > 1) return; // Stop early if not unique

        let row = -1;
        let col = -1;
        let isEmpty = false;

        // Find empty cell
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (currentBoard[i]?.[j] === 0) {
                    row = i;
                    col = j;
                    isEmpty = true;
                    break;
                }
            }
            if (isEmpty) break;
        }

        if (!isEmpty) {
            count++;
            return;
        }

        for (let num = 1; num <= 9; num++) {
            if (isValid(currentBoard, row, col, num)) {
                const targetRow = currentBoard[row];
                if (targetRow) {
                    targetRow[col] = num;
                    helper(currentBoard);
                    targetRow[col] = 0;
                }
            }
        }
    }

    // Clone board to avoid mutation during check
    const clone = board.map((row) => [...row]);
    helper(clone);
    return count;
}

/**
 * Generates a new Sudoku puzzle.
 * 1. Fills diagonal boxes (independent).
 * 2. Solves to get a full board.
 * 3. Removes numbers while maintaining uniqueness.
 */
export function generateSudoku(
    difficultyPoints = 40,
): { full: Board; puzzle: Board } {
    const board: Board = Array.from(
        { length: GRID_SIZE },
        () => Array(GRID_SIZE).fill(0),
    );

    // 1. Fill Diagonal 3x3 Boxes (safe to randomize)
    for (let i = 0; i < GRID_SIZE; i = i + BOX_SIZE) {
        fillBox(board, i, i);
    }

    // 2. Solve the rest to get a complete valid board
    solveBoard(board);

    // Copy full board for the solution
    const fullBoard = board.map((row) => [...row]);

    // 3. Remove digits to create puzzle
    // Precompute all available cell positions
    const availableCells: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            availableCells.push({ row: r, col: c });
        }
    }

    let removedCount = 0;
    while (availableCells.length > 0 && removedCount < difficultyPoints) {
        // Get next cell to try
        const randomIndex = Math.floor(Math.random() * availableCells.length);
        const cellPos = availableCells.splice(randomIndex, 1)[0]; // Remove from available

        const { row, col } = cellPos!;

        const targetRow = board[row];
        if (targetRow && targetRow[col] !== 0) {
            const backup = targetRow[col];
            if (backup !== undefined) {
                targetRow[col] = 0;

                // copy board for uniqueness check
                const checkBoard = board.map((r) => [...r]);

                // If multiple solutions exist, put it back (uniqueness constraint)
                if (countSolutions(checkBoard) !== 1) {
                    targetRow[col] = backup;
                } else {
                    removedCount++;
                }
            }
        }
        // Always remove this cell from future consideration regardless of outcome
    }

    return { full: fullBoard, puzzle: board };
}

function fillBox(board: Board, row: number, col: number) {
    let num: number;
    for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
            do {
                num = Math.floor(Math.random() * 9) + 1;
            } while (!isSafeInBox(board, row, col, num));
            const targetRow = board[row + i];
            if (targetRow) {
                targetRow[col + j] = num;
            }
        }
    }
}

function isSafeInBox(
    board: Board,
    rowStart: number,
    colStart: number,
    num: number,
) {
    for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
            if (board[rowStart + i]?.[colStart + j] === num) return false;
        }
    }
    return true;
}
