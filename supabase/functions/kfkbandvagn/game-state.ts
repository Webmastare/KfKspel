/**
 * Game state handlers for KfKbandvagn
 * Handles fetching player data and board state
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";
import type { BoardData, GameStateResponse, PlayerResponse } from "./types.ts";

// Handle getting game state (equivalent to /getKfKbandvagn)
export async function handleGetGameState() {
  try {
    const supabase = createServiceClient();

    console.log("Getting data from KfKbandvagn");

    // Fetch player data
    const { data: playerData, error: playerError } = await supabase
      .from("KfKbandvagn")
      .select(
        "playerID, taken_tank, uuid, tokens, position, lives, range, color",
      );

    if (playerError) {
      console.error("Error fetching player data:", playerError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playerError.message,
      );
    }

    // Fetch board data
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("size, shrink, upgrades, logs")
      .single();

    if (boardError) {
      console.error("Error fetching board data:", boardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        boardError.message,
      );
    }

    const response: GameStateResponse = {
      playerData: playerData as PlayerResponse[],
      boardData: boardData as BoardData,
    };

    console.log("Data sent");
    return createSuccessResponse(response);
  } catch (error) {
    console.error("Error in handleGetGameState:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Failed to fetch game state",
    );
  }
}

// Get specific player data by user ID
export async function handleGetPlayerState(
  request: Request,
) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "user_id parameter is required",
      );
    }

    const supabase = createServiceClient();

    const { data: playerData, error } = await supabase
      .from("KfKbandvagn")
      .select("user_id, playerID, uuid, tokens, position, lives, range, color")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching player:", error);
      return createErrorResponse(
        ERROR_CODES.NO_PLAYER_FOUND,
        "Player not found",
      );
    }

    if (!playerData) {
      return createErrorResponse(
        ERROR_CODES.NO_PLAYER_FOUND,
        "Player not found",
      );
    }

    return createSuccessResponse(playerData);
  } catch (error) {
    console.error("Error in handleGetPlayerState:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Failed to fetch player state",
    );
  }
}

// Get game statistics
export async function handleGetGameStats() {
  try {
    const supabase = createServiceClient();

    // Get player counts and statistics
    const { data: playerStats, error: playerError } = await supabase
      .from("KfKbandvagn")
      .select("taken_tank, lives, tokens, range")
      .eq("taken_tank", true);

    if (playerError) {
      console.error("Error fetching player stats:", playerError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playerError.message,
      );
    }

    // Get board info
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("size, shrink, logs")
      .single();

    if (boardError) {
      console.error("Error fetching board data:", boardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        boardError.message,
      );
    }

    // Calculate statistics
    const activePlayers = playerStats?.length || 0;
    const alivePlayers = playerStats?.filter((p: { lives: number }) =>
      p.lives > 0
    ).length || 0;
    const deadPlayers = activePlayers - alivePlayers;
    const totalTokens =
      playerStats?.reduce((sum: number, p: { tokens: number }) =>
        sum + (p.tokens || 0), 0) || 0;
    const avgTokens = activePlayers > 0 ? totalTokens / activePlayers : 0;
    const recentLogs = boardData?.logs?.slice(-10) || [];

    const stats = {
      players: {
        total: activePlayers,
        alive: alivePlayers,
        dead: deadPlayers,
      },
      board: {
        size: boardData?.size,
        shrink: boardData?.shrink,
      },
      economy: {
        totalTokens,
        averageTokens: Math.round(avgTokens * 100) / 100,
      },
      recentActivity: recentLogs,
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error("Error in handleGetGameStats:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error
        ? error.message
        : "Failed to fetch game statistics",
    );
  }
}
