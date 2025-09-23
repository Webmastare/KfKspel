/**
 * Validation utilities for KfKbandvagn Edge Functions
 */

import type {
    ActionRequest,
    CreatePlayerRequest,
    GameActionType,
    LoginRequest,
    Player,
    Position,
} from "../kfkbandvagn/types.ts";

// Validation for creating a player
export function validateCreatePlayerRequest(
    body: unknown,
): CreatePlayerRequest {
    if (!body || typeof body !== "object") {
        throw new Error("Request body must be an object");
    }

    const data = body as Record<string, unknown>;

    if (typeof data.user_id !== "string" || !data.user_id.trim()) {
        throw new Error("user_id is required and must be a non-empty string");
    }

    if (typeof data.playerID !== "string" || !data.playerID.trim()) {
        throw new Error("playerID is required and must be a non-empty string");
    }

    if (typeof data.color !== "string" || !data.color.trim()) {
        throw new Error("color is required and must be a non-empty string");
    }

    // Validate color format (hex color)
    if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        throw new Error("color must be a valid hex color (e.g., #FF0000)");
    }

    return {
        user_id: data.user_id,
        playerID: data.playerID,
        color: data.color,
    };
}

// Validation for login request
export function validateLoginRequest(body: unknown): LoginRequest {
    if (!body || typeof body !== "object") {
        throw new Error("Request body must be an object");
    }

    const data = body as Record<string, unknown>;

    if (typeof data.user_id !== "string" || !data.user_id.trim()) {
        throw new Error("user_id is required and must be a non-empty string");
    }

    return {
        user_id: data.user_id,
    };
}

// Validation for game actions
export function validateActionRequest(body: unknown): ActionRequest {
    if (!body || typeof body !== "object") {
        throw new Error("Request body must be an object");
    }

    const data = body as Record<string, unknown>;

    if (typeof data.tank_id !== "string" || !data.tank_id.trim()) {
        throw new Error("tank_id is required and must be a non-empty string");
    }

    if (typeof data.action !== "string" || !data.action.trim()) {
        throw new Error("action is required and must be a non-empty string");
    }

    // Validate action type
    const validActions: GameActionType[] = ["move", "shot", "range", "life"];
    if (!validActions.includes(data.action as GameActionType)) {
        throw new Error(`action must be one of: ${validActions.join(", ")}`);
    }

    const result: ActionRequest = {
        tank_id: data.tank_id,
        action: data.action as GameActionType,
    };

    // Validate move target if action is move
    if (data.action === "move") {
        if (!data.moveDirection || typeof data.moveDirection !== "object") {
            throw new Error("moveDirection is required for move action");
        }

        const moveDir = data.moveDirection as Record<string, unknown>;

        if (
            typeof moveDir.row !== "number" || typeof moveDir.col !== "number"
        ) {
            throw new Error(
                "moveDirection must have numeric row and col properties",
            );
        }

        result.moveDirection = {
            row: moveDir.row,
            col: moveDir.col,
        };
    }

    // Validate target UUID if action is shot
    if (data.action === "shot") {
        if (typeof data.targetUUID !== "string" || !data.targetUUID.trim()) {
            throw new Error("targetUUID is required for shot action");
        }

        result.targetUUID = data.targetUUID;
    }

    return result;
}

// Validate position is within board bounds
export function validatePosition(
    position: Position,
    boardRows: number,
    boardCols: number,
): boolean {
    return (
        position.row >= 0 &&
        position.row < boardRows &&
        position.column >= 0 &&
        position.column < boardCols
    );
}

// Check if a position is occupied by any living player
export function isPositionOccupied(
    position: Position,
    players: Player[],
): boolean {
    return players.some((player) =>
        player.lives > 0 &&
        player.position.row === position.row &&
        player.position.column === position.column
    );
}

// Calculate distance between two positions (Chebyshev distance)
export function calculateDistance(pos1: Position, pos2: Position): number {
    return Math.max(
        Math.abs(pos1.row - pos2.row),
        Math.abs(pos1.column - pos2.column),
    );
}

// Validate if target is within shooting range
export function isWithinRange(
    shooterPos: Position,
    targetPos: Position,
    range: number,
): boolean {
    return calculateDistance(shooterPos, targetPos) <= range;
}

// Sanitize player ID (remove special characters, limit length)
export function sanitizePlayerID(playerID: string): string {
    return playerID
        .trim()
        .replace(/[^\w\s-_åäöÅÄÖ]/g, "") // Allow Swedish characters
        .substring(0, 20); // Limit length
}

// Generate error response
export function createErrorResponse(code: string, message?: string) {
    const response = { error: true, code, message: message || code };
    return response;
}

// Generate success response
export function createSuccessResponse<T>(data?: T, message?: string) {
    const response: Record<string, unknown> = {};

    if (message) response.message = message;
    if (data !== undefined) response.data = data;

    return response;
}
