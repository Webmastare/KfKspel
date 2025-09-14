/**
 * Centralized API handler for KfKbandvagn game
 * Handles all HTTP requests with proper error handling and validation
 */

import { supabase } from "@/utils/supabase";
import type { Player, PlayerCreationData } from "./player";
import type { GameLog, GameState } from "./board";
import type { GameAction, GameActionType } from "./gameActions";

// Custom error class for API errors
export class BandvagnAPIError extends Error {
    code?: string | undefined;
    status?: number | undefined;

    constructor(message: string, code?: string, status?: number) {
        super(message);
        this.name = "BandvagnAPIError";
        this.code = code;
        this.status = status;
    }
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

// Specific API response types
export interface LoginResponse {
    user: {
        id: string;
        email: string;
    };
    session?: {
        access_token: string;
        refresh_token: string;
        expires_at: number;
    };
}

export interface PlayerCreationResponse {
    player: Player;
    created: boolean;
}

export interface BoardData {
    size: {
        rows: number;
        columns: number;
    };
    shrink: number;
    upgrades?: Record<string, unknown>;
    time_to_shrink?: string;
    logs: GameLog[];
}

export interface GameStateResponse {
    playerData: Player[];
    boardData: BoardData;
}

export interface ActionResponse {
    success: boolean;
    updatedPlayer: Player;
    affectedPlayers?: Player[];
    logs?: GameState["logs"];
}

// Request payload types
export interface LoginRequest {
    user_id: string;
}

export interface CreateAccountRequest {
    email: string;
    password: string;
    playerData: PlayerCreationData;
}

export interface CreatePlayerRequest {
    user_id: string;
    playerID: string;
    color: string;
}

export interface ActionRequest {
    user_id: string;
    action: GameActionType;
    moveDirection?: { row: number; col: number };
    targetUUID?: string;
}

// Known API error codes
export const API_ERROR_CODES = {
    // Player errors
    PLAYER_NOT_FOUND: "no_player_found",
    MULTIPLE_PLAYERS_FOUND: "multiple_players_found",
    PLAYER_ALREADY_EXISTS: "player_already_exists",
    INVALID_PLAYER_ID: "invalid_player_id",
    PLAYER_DEAD: "player-dead",
    PLAYER_ALREADY_DEAD: "player_already_dead",

    // Action errors
    INSUFFICIENT_TOKENS: "insufficient_tokens",
    INVALID_ACTION: "invalid_action",
    INVALID_MOVE: "invalid_move",
    POSITION_OCCUPIED: "position_occupied",
    OUT_OF_RANGE: "out_of_range",
    OUT_OF_BOUNDS: "out_of_bounds",

    // Game state errors
    GAME_NOT_FOUND: "game_not_found",
    BOARD_ERROR: "board_error",

    // General errors
    INTERNAL_ERROR: "internal_error",
    VALIDATION_ERROR: "validation_error",
    UNAUTHORIZED: "unauthorized",
    FORBIDDEN: "forbidden",
    RATE_LIMITED: "rate_limited",
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
    data: T,
    message = "Success",
): ApiResponse<T> {
    return {
        success: true,
        message,
        data,
    };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
): ApiResponse {
    const error: ApiError = {
        code,
        message,
    };

    if (details !== undefined) {
        error.details = details;
    }

    return {
        success: false,
        error,
    };
}

/**
 * Get user-friendly error message from API error code
 */
export function getErrorMessage(errorCode: ApiErrorCode): string {
    switch (errorCode) {
        case API_ERROR_CODES.PLAYER_NOT_FOUND:
            return "Spelare hittades inte";
        case API_ERROR_CODES.MULTIPLE_PLAYERS_FOUND:
            return "Flera spelare hittades med samma namn";
        case API_ERROR_CODES.PLAYER_ALREADY_EXISTS:
            return "Spelarnamnet används redan";
        case API_ERROR_CODES.INVALID_PLAYER_ID:
            return "Ogiltigt spelarnamn";
        case API_ERROR_CODES.PLAYER_DEAD:
            return "Du är död och kan inte utföra denna handling";
        case API_ERROR_CODES.PLAYER_ALREADY_DEAD:
            return "Målspelaren är redan död";
        case API_ERROR_CODES.INSUFFICIENT_TOKENS:
            return "Inte tillräckligt med handlingspoäng";
        case API_ERROR_CODES.INVALID_ACTION:
            return "Ogiltig handling";
        case API_ERROR_CODES.INVALID_MOVE:
            return "Ogiltigt drag";
        case API_ERROR_CODES.POSITION_OCCUPIED:
            return "Positionen är upptagen";
        case API_ERROR_CODES.OUT_OF_RANGE:
            return "Målet är utanför räckvidd";
        case API_ERROR_CODES.OUT_OF_BOUNDS:
            return "Utanför spelplanens gränser";
        case API_ERROR_CODES.GAME_NOT_FOUND:
            return "Spelet hittades inte";
        case API_ERROR_CODES.BOARD_ERROR:
            return "Fel med spelplanen";
        case API_ERROR_CODES.UNAUTHORIZED:
            return "Obehörig åtkomst";
        case API_ERROR_CODES.FORBIDDEN:
            return "Åtkomst nekad";
        case API_ERROR_CODES.RATE_LIMITED:
            return "För många förfrågningar, försök igen senare";
        case API_ERROR_CODES.VALIDATION_ERROR:
            return "Valideringsfel";
        case API_ERROR_CODES.INTERNAL_ERROR:
        default:
            return "Ett internt fel uppstod";
    }
}

/**
 * Extract error code from error response
 */
export function getErrorCode(error: unknown): ApiErrorCode {
    if (error && typeof error === "object" && "code" in error) {
        return (error as any).code as ApiErrorCode;
    }

    return API_ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Check if an error is a specific type
 */
export function isErrorCode(error: unknown, code: ApiErrorCode): boolean {
    return getErrorCode(error) === code;
}

/**
 * Validate request payload for creating a player
 */
export function validateCreatePlayerRequest(
    obj: unknown,
): obj is CreatePlayerRequest {
    if (!obj || typeof obj !== "object") return false;

    const request = obj as Record<string, unknown>;

    return !!(
        request.playerData &&
        typeof request.playerData === "object" &&
        typeof (request.playerData as any).playerID === "string" &&
        typeof (request.playerData as any).color === "string"
    );
}

/**
 * Validate request payload for game actions
 */
export function validateActionRequest(obj: unknown): obj is ActionRequest {
    if (!obj || typeof obj !== "object") return false;

    const request = obj as Record<string, unknown>;

    return (
        typeof request.user_id === "string" &&
        typeof request.action === "string" &&
        ["move", "shot", "range", "life"].includes(request.action as string)
    );
}

// Make authenticated request to Edge Functions
export async function makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    try {
        const invokeOptions: any = {
            method,
            headers,
        };

        // Only add body if it exists
        if (body) {
            invokeOptions.body = JSON.stringify(body);
        }

        const { data, error } = await supabase.functions.invoke(
            `kfkbandvagn${endpoint}`,
            invokeOptions,
        );

        if (error) {
            console.error("Edge Function error:", error);
            throw new BandvagnAPIError(
                error.message || "Request failed",
                error.name,
                error.status,
            );
        }

        // Handle API response format
        if (data && typeof data === "object") {
            // If response has success field and it's false, it's an error
            if ("success" in data && data.success === false) {
                const errorData = data as ApiResponse;
                throw new BandvagnAPIError(
                    errorData.error?.message || errorData.message ||
                        "Request failed",
                    errorData.error?.code,
                );
            }

            // Return the data field if it exists, otherwise return the whole response
            return ("data" in data ? data.data : data) as T;
        }

        return data as T;
    } catch (error) {
        if (error instanceof BandvagnAPIError) {
            throw error;
        }

        console.error("API request failed:", error);
        throw new BandvagnAPIError(
            error instanceof Error ? error.message : "Unknown API error",
        );
    }
}

// Helper to format error messages for user display
export function formatAPIError(error: unknown): string {
    if (error instanceof BandvagnAPIError) {
        // Map error codes to Swedish messages
        const errorMessages: Record<string, string> = {
            "no_player_found": "Ingen spelare hittades",
            "no_free_tanks": "Inga lediga tanks",
            "missing_tokens": "Inte nog med tokens",
            "invalid_action": "Ogiltigt drag",
            "not_in_range": "Inte inom räckvidd",
            "player_already_dead": "Spelaren är redan död",
            "invalid_session": "Session har gått ut, logga in igen",
            "validation_error": "Ogiltiga data",
            "internal_error": "Serverfel, försök igen",
        };

        return errorMessages[error.code || ""] || error.message ||
            "Ett fel uppstod";
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Ett oväntat fel uppstod";
}
