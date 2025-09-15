/**
 * Admin tools for KfKbandvagn
 * Handles admin-only functions for game management
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";
import type { GameLog, Player } from "./types.ts";

// Reset the entire game state (admin only)
export async function handleGameReset(): Promise<Response> {
  try {
    const supabase = createServiceClient();

    console.log("Starting game reset");

    // Reset all players to not taken
    const { error: resetPlayersError } = await supabase
      .from("KfKbandvagn")
      .update({
        taken_tank: false,
        user_id: null,
        playerID: "No-player",
        tokens: 100,
        lives: 3,
        range: 2,
        color: "#FFFFFF",
        created_date: null,
        last_login_date: null,
      });

    if (resetPlayersError) {
      console.error("Error resetting players:", resetPlayersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        resetPlayersError.message,
      );
    }

    // Reset board state
    const resetLogEntry: GameLog = {
      playerID: "ADMIN",
      action: "game_reset",
      timestamp: new Date().toISOString(),
      details: { resetBy: "admin" },
    };

    const { error: resetBoardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        shrink: 0,
        logs: [resetLogEntry],
        next_shrink: null,
      })
      .eq("active_board", true);

    if (resetBoardError) {
      console.error("Error resetting board:", resetBoardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        resetBoardError.message,
      );
    }

    console.log("Game reset completed");
    return createSuccessResponse(
      { message: "Game reset successfully" },
      "All players and board state have been reset",
    );
  } catch (error) {
    console.error("Error in handleGameReset:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Game reset failed",
    );
  }
}

// Get detailed game statistics (admin only)
export async function handleAdminStats(): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Get all players
    const { data: allPlayers, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("*");

    if (playersError) {
      console.error("Error fetching players:", playersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playersError.message,
      );
    }

    // Get board data
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("*")
      .eq("active_board", true)
      .single();

    if (boardError) {
      console.error("Error fetching board data:", boardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        boardError.message,
      );
    }

    // Calculate detailed statistics
    const activePlayers = (allPlayers as Player[])?.filter((p) =>
      p.taken_tank
    ) || [];
    const alivePlayers = activePlayers.filter((p) => p.lives > 0);
    const deadPlayers = activePlayers.filter((p) => p.lives <= 0);

    const tokenStats = {
      total: activePlayers.reduce((sum, p) => sum + p.tokens, 0),
      average: activePlayers.length > 0
        ? activePlayers.reduce((sum, p) => sum + p.tokens, 0) /
          activePlayers.length
        : 0,
      min: activePlayers.length > 0
        ? Math.min(...activePlayers.map((p) => p.tokens))
        : 0,
      max: activePlayers.length > 0
        ? Math.max(...activePlayers.map((p) => p.tokens))
        : 0,
    };

    const lifeStats = {
      total: activePlayers.reduce((sum, p) => sum + p.lives, 0),
      average: activePlayers.length > 0
        ? activePlayers.reduce((sum, p) => sum + p.lives, 0) /
          activePlayers.length
        : 0,
      distribution: {
        alive: alivePlayers.length,
        dead: deadPlayers.length,
      },
    };

    const rangeStats = {
      average: activePlayers.length > 0
        ? activePlayers.reduce((sum, p) => sum + p.range, 0) /
          activePlayers.length
        : 0,
      min: activePlayers.length > 0
        ? Math.min(...activePlayers.map((p) => p.range))
        : 0,
      max: activePlayers.length > 0
        ? Math.max(...activePlayers.map((p) => p.range))
        : 0,
    };

    const recentActions = boardData?.logs?.slice(-20) || [];
    const actionCounts = recentActions.reduce(
      (counts: Record<string, number>, log: GameLog) => {
        counts[log.action] = (counts[log.action] || 0) + 1;
        return counts;
      },
      {},
    );

    const stats = {
      players: {
        total: (allPlayers as Player[])?.length || 0,
        active: activePlayers.length,
        alive: alivePlayers.length,
        dead: deadPlayers.length,
        available: ((allPlayers as Player[])?.length || 0) -
          activePlayers.length,
      },
      board: {
        size: boardData?.size,
        shrinkLevel: boardData?.shrink || 0,
        nextShrink: boardData?.next_shrink,
      },
      resources: {
        tokens: tokenStats,
        lives: lifeStats,
        range: rangeStats,
      },
      activity: {
        totalLogs: boardData?.logs?.length || 0,
        recentActions: actionCounts,
        lastActivity: recentActions.length > 0
          ? recentActions[recentActions.length - 1]?.timestamp
          : null,
      },
      topPlayers: activePlayers
        .sort((a, b) => (b.tokens + b.lives * 10) - (a.tokens + a.lives * 10))
        .slice(0, 10)
        .map((p) => ({
          playerID: p.playerID,
          tokens: p.tokens,
          lives: p.lives,
          range: p.range,
          score: p.tokens + p.lives * 10,
        })),
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error("Error in handleAdminStats:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error
        ? error.message
        : "Failed to fetch admin statistics",
    );
  }
}
