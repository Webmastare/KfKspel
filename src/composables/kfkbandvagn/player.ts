/**
 * Player types and utilities for KfKbandvagn game
 */

// Core player position interface
export interface Position {
    row: number;
    column: number;
}

// Core player interface based on the game's data structure
export interface Player {
    uuid: string; // Supabase user ID
    playerID: string; // Display name/username
    position: Position; // Current position on the board
    lives: number; // Health/hearts (0 = dead)
    tokens: number; // Action points (Hp in Swedish)
    range: number; // Attack/interaction range
    taken_tank: boolean; // Whether the tank is taken
    color: string; // Player color (hex format)
}

// Type for player creation data
export interface PlayerCreationData {
    playerID: string;
    color: string;
}

// Type for player updates from API
export interface PlayerUpdate {
    uuid: string;
    lives?: number;
    tokens?: number;
    range?: number;
    position?: Position;
}

/**
 * Type guard for PlayerCreationData
 */
export function isPlayerCreationData(obj: unknown): obj is PlayerCreationData {
    if (!obj || typeof obj !== "object") return false;

    const data = obj as Record<string, unknown>;

    return (
        typeof data.playerID === "string" &&
        typeof data.color === "string" &&
        data.playerID.length > 0 &&
        /^#[0-9A-Fa-f]{6}$/.test(data.color)
    );
}

/**
 * Check if player is alive
 */
export function isPlayerAlive(player: Player): boolean {
    return player.lives > 0;
}

/**
 * Check if player has enough tokens for an action
 */
export function hasEnoughTokens(
    player: Player,
    requiredTokens: number,
): boolean {
    return player.tokens >= requiredTokens;
}

/**
 * Calculate distance between two positions
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
    return Math.max(
        Math.abs(pos1.row - pos2.row),
        Math.abs(pos1.column - pos2.column),
    );
}

/**
 * Check if target position is within player's range
 */
export function isWithinRange(
    player: Player,
    targetPosition: Position,
): boolean {
    return calculateDistance(player.position, targetPosition) <= player.range;
}

/**
 * Check if player is at a specific position
 */
export function isPlayerAtPosition(
    player: Player,
    position: Position,
): boolean {
    return player.position.row === position.row &&
        player.position.column === position.column;
}

/**
 * Get adjacent positions (for movement validation)
 */
export function getAdjacentPositions(position: Position): Position[] {
    return [
        { row: position.row - 1, column: position.column }, // up
        { row: position.row + 1, column: position.column }, // down
        { row: position.row, column: position.column - 1 }, // left
        { row: position.row, column: position.column + 1 }, // right
    ];
}

/**
 * Check if a position is adjacent to another position
 */
export function isAdjacent(pos1: Position, pos2: Position): boolean {
    const distance = calculateDistance(pos1, pos2);
    return distance === 1;
}
