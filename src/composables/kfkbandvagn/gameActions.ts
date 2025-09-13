/**
 * Game actions types and utilities for KfKbandvagn game
 */

import type { Player, Position } from "./player";

// Valid game action types
export type GameActionType = "move" | "shot" | "range" | "life";

// Movement directions
export type MoveDirection = "up" | "down" | "left" | "right";

// Action costs in tokens
export const ACTION_COSTS: Record<GameActionType, number> = {
    move: 1,
    shot: 1,
    range: 3,
    life: 3,
} as const;

// Game action interface for API requests
export interface GameAction {
    action: GameActionType;
    moveDirection?: MoveDirection;
    targetUUID?: string;
}

// Action result interface
export interface ActionResult {
    success: boolean;
    message?: string;
    playerUpdate?: Partial<Player>;
    targetUpdate?: Partial<Player>;
}

// Movement validation result
export interface MoveValidation {
    isValid: boolean;
    newPosition?: Position;
    reason?: string;
}

/**
 * Type guard for GameActionType
 */
export function isGameActionType(action: unknown): action is GameActionType {
    return typeof action === "string" &&
        ["move", "shot", "range", "life"].includes(action);
}

/**
 * Type guard for MoveDirection
 */
export function isMoveDirection(
    direction: unknown,
): direction is MoveDirection {
    return typeof direction === "string" &&
        ["up", "down", "left", "right"].includes(direction);
}

/**
 * Get the cost in tokens for a specific action
 */
export function getActionCost(action: GameActionType): number {
    return ACTION_COSTS[action];
}

/**
 * Calculate new position based on move direction
 */
export function calculateNewPosition(
    currentPosition: Position,
    direction: MoveDirection,
): Position {
    const newPosition = { ...currentPosition };

    switch (direction) {
        case "up":
            newPosition.row -= 1;
            break;
        case "down":
            newPosition.row += 1;
            break;
        case "left":
            newPosition.column -= 1;
            break;
        case "right":
            newPosition.column += 1;
            break;
    }

    return newPosition;
}

/**
 * Validate if a move is possible within board bounds
 */
export function validateMove(
    currentPosition: Position,
    direction: MoveDirection,
    boardRows: number,
    boardCols: number,
): MoveValidation {
    const newPosition = calculateNewPosition(currentPosition, direction);

    // Check board boundaries
    if (newPosition.row < 0) {
        return {
            isValid: false,
            reason: "Cannot move above board boundary",
        };
    }

    if (newPosition.row >= boardRows) {
        return {
            isValid: false,
            reason: "Cannot move below board boundary",
        };
    }

    if (newPosition.column < 0) {
        return {
            isValid: false,
            reason: "Cannot move left of board boundary",
        };
    }

    if (newPosition.column >= boardCols) {
        return {
            isValid: false,
            reason: "Cannot move right of board boundary",
        };
    }

    return {
        isValid: true,
        newPosition,
    };
}

/**
 * Check if a position is occupied by any player
 */
export function isPositionOccupied(
    position: Position,
    players: Player[],
): boolean {
    return players.some((player) =>
        player.position.row === position.row &&
        player.position.column === position.column &&
        player.lives > 0 // Only living players occupy spaces
    );
}

/**
 * Validate a complete move action
 */
export function validateMoveAction(
    player: Player,
    direction: MoveDirection,
    players: Player[],
    boardRows: number,
    boardCols: number,
): MoveValidation {
    // Check if player is alive
    if (player.lives <= 0) {
        return {
            isValid: false,
            reason: "Dead players cannot move",
        };
    }

    // Check if player has enough tokens
    if (player.tokens < ACTION_COSTS.move) {
        return {
            isValid: false,
            reason:
                `Not enough tokens. Need ${ACTION_COSTS.move}, have ${player.tokens}`,
        };
    }

    // Validate move within board bounds
    const moveValidation = validateMove(
        player.position,
        direction,
        boardRows,
        boardCols,
    );
    if (!moveValidation.isValid) {
        return moveValidation;
    }

    // Check if target position is occupied
    if (isPositionOccupied(moveValidation.newPosition!, players)) {
        return {
            isValid: false,
            reason: "Target position is occupied by another player",
        };
    }

    return moveValidation;
}

/**
 * Get all valid move directions for a player
 */
export function getValidMoveDirections(
    player: Player,
    players: Player[],
    boardRows: number,
    boardCols: number,
): MoveDirection[] {
    const directions: MoveDirection[] = ["up", "down", "left", "right"];

    return directions.filter((direction) => {
        const validation = validateMoveAction(
            player,
            direction,
            players,
            boardRows,
            boardCols,
        );
        return validation.isValid;
    });
}

/**
 * Find target player by UUID
 */
export function findTargetPlayer(
    targetUUID: string,
    players: Player[],
): Player | null {
    return players.find((player) => player.uuid === targetUUID) || null;
}

/**
 * Validate shot action
 */
export function validateShotAction(
    shooter: Player,
    targetUUID: string,
    players: Player[],
): { isValid: boolean; reason?: string; target?: Player } {
    // Check if shooter is alive
    if (shooter.lives <= 0) {
        return {
            isValid: false,
            reason: "Dead players cannot shoot",
        };
    }

    // Check if shooter has enough tokens
    if (shooter.tokens < ACTION_COSTS.shot) {
        return {
            isValid: false,
            reason:
                `Not enough tokens. Need ${ACTION_COSTS.shot}, have ${shooter.tokens}`,
        };
    }

    // Find target player
    const target = findTargetPlayer(targetUUID, players);
    if (!target) {
        return {
            isValid: false,
            reason: "Target player not found",
        };
    }

    // Check if target is alive
    if (target.lives <= 0) {
        return {
            isValid: false,
            reason: "Target player is already dead",
        };
    }

    // Check if target is within range
    const distance = Math.max(
        Math.abs(shooter.position.row - target.position.row),
        Math.abs(shooter.position.column - target.position.column),
    );

    if (distance > shooter.range) {
        return {
            isValid: false,
            reason:
                `Target is out of range. Distance: ${distance}, Range: ${shooter.range}`,
        };
    }

    // Cannot shoot yourself
    if (shooter.uuid === target.uuid) {
        return {
            isValid: false,
            reason: "Cannot shoot yourself",
        };
    }

    return {
        isValid: true,
        target,
    };
}

/**
 * Validate upgrade action (range or life)
 */
export function validateUpgradeAction(
    player: Player,
    upgradeType: "range" | "life",
): { isValid: boolean; reason?: string } {
    // Check if player is alive
    if (player.lives <= 0) {
        return {
            isValid: false,
            reason: "Dead players cannot upgrade",
        };
    }

    const cost = ACTION_COSTS[upgradeType];

    // Check if player has enough tokens
    if (player.tokens < cost) {
        return {
            isValid: false,
            reason: `Not enough tokens. Need ${cost}, have ${player.tokens}`,
        };
    }

    return {
        isValid: true,
    };
}
