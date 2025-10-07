/**
 * Game board types, utilities and API calls for KfKbandvagn game
 */
import { type GameStateResponse, makeRequest } from "./apiHandler";
import type { Player, Position } from "./player";

// Game log interface
export interface GameLog {
    playerID: string;
    action: string;
    timestamp: string;
    moveDirection?: string;
    targetUUID?: string;
    details?: Record<string, unknown>;
}

// Game board interface
export interface GameBoard {
    size?: { rows: number; columns: number }; // Optional size object
    rows: number;
    cols: number;
    // How much has already been shrunk on each side (applied equally top/bottom and left/right)
    has_shrunked: { row: number; column: number };
    // How much will be shrunk on next shrink (per side)
    to_shrink: { row: number; column: number };
    upgrades?: [];
    next_shrink?: string; // ISO timestamp for next shrink
    logs: GameLog[];
}

// Board cell interface
export interface BoardCell {
    row: number;
    column: number;
    hasHeart: boolean; // Random hearts that appear
    isPlayable: boolean; // Whether the cell is still in bounds after shrinking
}

// Game state interface combining board and players
export interface GameState {
    board: GameBoard;
    logs: GameLog[];
    lastUpdate: string;
}

// Heart spawn information
export interface HeartSpawn {
    position: Position;
    spawnTime: string;
    claimed: boolean;
    claimedBy?: string;
}

/**
 * Check if a position is within the current playable board area
 */
export function isPositionInBounds(
    position: Position,
    board: GameBoard,
): boolean {
    const top = board.has_shrunked?.row || 0;
    const left = board.has_shrunked?.column || 0;
    const bottomBound = board.rows - top;
    const rightBound = board.cols - left;
    return (
        position.row >= top &&
        position.row < bottomBound &&
        position.column >= left &&
        position.column < rightBound
    );
}

/**
 * Get the current playable board dimensions
 */
export function getPlayableBoardSize(
    board: GameBoard,
): { rows: number; cols: number } {
    const hs = board.has_shrunked || { row: 0, column: 0 };
    return {
        rows: Math.max(1, board.rows - hs.row * 2),
        cols: Math.max(1, board.cols - hs.column * 2),
    };
}

/**
 * Get all positions that will be affected by the next board shrink
 */
export function getPositionsToShrink(board: GameBoard): Position[] {
    const hs = board.has_shrunked || { row: 0, column: 0 };
    const ts = board.to_shrink || { row: 0, column: 0 };
    const positions: Position[] = [];
    const topStart = hs.row;
    const topEnd = Math.min(board.rows, hs.row + ts.row) - 1;
    const bottomStart = Math.max(0, board.rows - (hs.row + ts.row));
    const bottomEnd = board.rows - hs.row - 1;
    const leftStart = hs.column;
    const leftEnd = Math.min(board.cols, hs.column + ts.column) - 1;
    const rightStart = Math.max(0, board.cols - (hs.column + ts.column));
    const rightEnd = board.cols - hs.column - 1;

    // Top band
    for (let r = topStart; r <= topEnd; r++) {
        for (let c = hs.column; c < board.cols - hs.column; c++) {
            positions.push({ row: r, column: c });
        }
    }
    // Bottom band
    for (let r = bottomStart; r <= bottomEnd; r++) {
        for (let c = hs.column; c < board.cols - hs.column; c++) {
            positions.push({ row: r, column: c });
        }
    }
    // Left band
    for (let c = leftStart; c <= leftEnd; c++) {
        for (let r = hs.row; r < board.rows - hs.row; r++) {
            positions.push({ row: r, column: c });
        }
    }
    // Right band
    for (let c = rightStart; c <= rightEnd; c++) {
        for (let r = hs.row; r < board.rows - hs.row; r++) {
            positions.push({ row: r, column: c });
        }
    }

    return positions;
}

/**
 * Find the nearest safe position (within board bounds) for a player
 */
export function findNearestSafePosition(
    position: Position,
    board: GameBoard,
): Position {
    const playableSize = getPlayableBoardSize(board);

    // Clamp position to valid bounds
    return {
        row: Math.max(0, Math.min(position.row, playableSize.rows - 1)),
        column: Math.max(0, Math.min(position.column, playableSize.cols - 1)),
    };
}

/**
 * Get all positions where hearts can spawn (not occupied by players)
 */
export function getHeartSpawnPositions(
    board: GameBoard,
    occupiedPositions: Position[],
): Position[] {
    const playableSize = getPlayableBoardSize(board);
    const availablePositions: Position[] = [];

    for (let row = 0; row < playableSize.rows; row++) {
        for (let col = 0; col < playableSize.cols; col++) {
            const position = { row, column: col };

            // Check if position is not occupied
            const isOccupied = occupiedPositions.some((occupied) =>
                occupied.row === position.row &&
                occupied.column === position.column
            );

            if (!isOccupied) {
                availablePositions.push(position);
            }
        }
    }

    return availablePositions;
}

/**
 * Generate a random position within the playable board area
 */
export function generateRandomPosition(board: GameBoard): Position {
    const playableSize = getPlayableBoardSize(board);

    return {
        row: Math.floor(Math.random() * playableSize.rows),
        column: Math.floor(Math.random() * playableSize.cols),
    };
}

/**
 * Sort game logs by timestamp (newest first)
 */
export function sortLogsByTimestamp(logs: GameLog[]): GameLog[] {
    return [...logs].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

/**
 * Filter logs by player ID
 */
export function filterLogsByPlayer(
    logs: GameLog[],
    playerID: string,
): GameLog[] {
    return logs.filter((log) => log.playerID === playerID);
}

/**
 * Filter logs by action type
 */
export function filterLogsByAction(logs: GameLog[], action: string): GameLog[] {
    return logs.filter((log) => log.action === action);
}

/**
 * Get recent logs (within last N hours)
 */
export function getRecentLogs(
    logs: GameLog[],
    hoursBack: number = 24,
): GameLog[] {
    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));

    return logs.filter((log) => {
        const logTime = new Date(log.timestamp);
        return logTime >= cutoffTime;
    });
}

// API related types and functions
/**
 * Get current game state (board data and player data)
 */
export async function getGameState(): Promise<GameStateResponse> {
    return makeRequest<GameStateResponse>(
        "/game/state",
        "GET",
        undefined,
    );
}

// Get game statistics
export async function getGameStats(): Promise<unknown> {
    return makeRequest<unknown>("/game/stats", "GET", undefined);
}
