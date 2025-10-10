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
export async function handleGameReset() {
  try {
    const supabase = createServiceClient();

    console.log("Starting game reset (clear players and re-populate)");

    // Fetch active board to get size
    // Initialize/reset the board with the new shrink model
    const nextShrinkTime = new Date();
    nextShrinkTime.setDate(nextShrinkTime.getDate() + 1); // Next shrink in 24 hours

    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        size: { rows: 50, columns: 50 },
        has_shrunked: { row: 0, column: 0 },
        to_shrink: { row: 0, column: 0 },
        next_shrink: nextShrinkTime.toISOString(),
        upgrades: [],
        logs: [],
        last_update: new Date().toISOString(),
      })
      .eq("active_board", true)
      .select()
      .single();

    if (boardError || !boardData) {
      console.error("Error fetching active board for reset:", boardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        boardError?.message || "Active board not found",
      );
    }
    const boardSize = boardData.size;

    // Empty the players table first
    const { error: deleteError } = await supabase
      .from("KfKbandvagn")
      .delete()
      .in("taken_tank", [true, false]); // Delete all rows;

    if (deleteError) {
      console.error("Error deleting players during reset:", deleteError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        deleteError.message,
      );
    }

    // Build free spaces array for the board
    const freeSpaces: Array<[number, number]> = [];
    for (let r = 0; r < boardSize.rows; r++) {
      for (let c = 0; c < boardSize.columns; c++) {
        freeSpaces.push([r, c]);
      }
    }

    // Decide how many placeholder users to create (roughly 1 per 10 cells)
    const numUsers = Math.floor(freeSpaces.length / 10) || 1;

    // Create entries with default values
    const entries = Array.from({ length: numUsers }, () => ({
      playerID: "No-player",
      tokens: 0,
      color: `#${
        Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
      }`,
      position: { column: 0, row: 0 },
      lives: 3,
      range: 2,
      taken_tank: false,
    } as Partial<Player>));

    // Assign random distinct positions
    for (const entry of entries) {
      const spliceIndex = Math.floor(Math.random() * freeSpaces.length);
      const pos = freeSpaces.splice(spliceIndex, 1) as Array<[number, number]>;
      if (pos && pos[0]) {
        entry.position = {
          column: pos[0][1],
          row: pos[0][0],
        } as unknown as Player["position"];
      }
    }

    console.log("Creating players", entries.length);
    const { data: inserted, error: insertError } = await supabase
      .from("KfKbandvagn")
      .insert(entries)
      .select("*");

    if (insertError) {
      console.error("Error inserting placeholder players:", insertError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        insertError.message,
      );
    }

    // Reset board state and add reset log
    const resetTimestamp = new Date().toISOString();
    const resetLogEntry: GameLog = {
      playerID: "ADMIN",
      action: "game_reset",
      timestamp: resetTimestamp,
      details: { resetBy: "admin", createdPlayers: (inserted || []).length },
    };

    const { error: resetBoardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        // Keep has_shrunked/to_shrink/next_shrink set above; just write the reset log
        logs: [resetLogEntry],
        last_update: resetTimestamp,
      })
      .eq("active_board", true);

    if (resetBoardError) {
      console.error("Error resetting board state:", resetBoardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        resetBoardError.message,
      );
    }

    console.log(
      "Game reset completed, players created:",
      (inserted || []).length,
    );
    return createSuccessResponse(
      { createdPlayers: (inserted || []).length },
      "Game reset and placeholder players created",
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
export async function handleAdminStats() {
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
    const totalDeadPlayers = (allPlayers as Player[])?.filter((p) =>
      p.lives <= 0
    ).length;

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
        totalDeadPlayers: totalDeadPlayers || 0,
        available: ((allPlayers as Player[])?.length || 0) -
          activePlayers.length,
      },
      board: {
        size: boardData?.size,
        has_shrunked: boardData?.has_shrunked || { row: 0, column: 0 },
        to_shrink: boardData?.to_shrink || { row: 0, column: 0 },
        next_shrink: boardData?.next_shrink || null,
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
