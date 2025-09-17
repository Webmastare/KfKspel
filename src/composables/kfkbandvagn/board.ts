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
    shrink: number; // Current shrink level
    upgrades?: [];
    time_to_shrink?: string; // Timestamp for next shrink
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
    const effectiveRows = board.rows - board.shrink;
    const effectiveCols = board.cols - board.shrink;

    return (
        position.row >= 0 &&
        position.row < effectiveRows &&
        position.column >= 0 &&
        position.column < effectiveCols
    );
}

/**
 * Get the current playable board dimensions
 */
export function getPlayableBoardSize(
    board: GameBoard,
): { rows: number; cols: number } {
    return {
        rows: Math.max(1, board.rows - board.shrink),
        cols: Math.max(1, board.cols - board.shrink),
    };
}

/**
 * Get all positions that will be affected by the next board shrink
 */
export function getPositionsToShrink(board: GameBoard): Position[] {
    const currentSize = getPlayableBoardSize(board);
    const newRows = Math.max(1, currentSize.rows - 1);
    const newCols = Math.max(1, currentSize.cols - 1);

    const positions: Position[] = [];

    // Add positions that will be out of bounds after shrink
    for (let row = 0; row < currentSize.rows; row++) {
        for (let col = 0; col < currentSize.cols; col++) {
            if (row >= newRows || col >= newCols) {
                positions.push({ row, column: col });
            }
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
