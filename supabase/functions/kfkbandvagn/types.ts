/**
 * Shared TypeScript types for KfKbandvagn Edge Functions
 */

// Re-export client types for server use
export interface Position {
  row: number;
  column: number;
}

export interface Player {
  uuid: string;
  user_id: string;
  playerID: string;
  position: Position;
  lives: number;
  tokens: number;
  range: number;
  color: string;
  taken_tank: boolean;
  created_date?: string;
  last_login_date?: string;
}

export interface GameBoard {
  rows: number;
  cols: number;
  shrink: number;
  nextShrink?: string;
}

export interface GameLog {
  playerID: string;
  action: string;
  timestamp: string;
  moveDirection?: string;
  targetUUID?: string;
  details?: Record<string, unknown>;
}

export interface BoardData {
  size: {
    rows: number;
    columns: number;
  };
  shrink: number;
  upgrades?: Record<string, unknown>;
  logs: GameLog[];
}

// Action types
export type GameActionType = "move" | "shot" | "range" | "life";

export interface MoveDirection {
  row: number;
  col: number;
}

// API Request/Response types
export interface CreatePlayerRequest {
  user_id: string;
  playerID: string;
  color: string;
}

export interface LoginRequest {
  user_id: string;
}

export interface ActionRequest {
  tank_id: string;
  action: GameActionType;
  moveDirection?: MoveDirection;
  targetUUID?: string;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message?: string;
  };
}

// Database response types
export interface PlayerResponse {
  playerID: string;
  taken_tank: boolean;
  uuid: string;
  tokens: number;
  position: Position;
  lives: number;
  range: number;
  color: string;
}

export interface GameStateResponse {
  playerData: PlayerResponse[];
  boardData: BoardData;
}

export interface ActionResponse {
  updatedData: Player;
  shotData?: Player;
  updatedLogs: GameLog;
}

// Error codes matching the original API
export const ERROR_CODES = {
  NO_PLAYER_FOUND: "no_player_found",
  MULTIPLE_PLAYERS_FOUND: "multiple_players_found",
  MISSING_TOKENS: "missing_tokens",
  INVALID_ACTION: "invalid_action",
  USER_NOT_FOUND: "user_not_found",
  NO_TARGETED_USER: "no_targeted_user",
  PLAYER_ALREADY_DEAD: "player_already_dead",
  NOT_IN_RANGE: "not_in_range",
  NO_FREE_TANKS: "no_free_tanks",
  VALIDATION_ERROR: "validation_error",
  INVALID_SESSION: "invalid_session",
  INTERNAL_ERROR: "internal_error",
} as const;

// Token costs for actions
export const TOKEN_COSTS = {
  move: 1,
  shot: 1,
  range: 3,
  life: 3,
} as const;
