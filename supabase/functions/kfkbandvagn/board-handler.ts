/**
 * Board management handlers for KfKbandvagn
 * Handles board shrinking and token distribution (called by cron jobs)
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";
import type { GameLog, Player } from "./types.ts";

// Handle board shrinking (called by cron job)
export async function handleBoardShrink() {
  try {
    const supabase = createServiceClient();

    console.log("Starting board shrink process");

    // Get current board data for active board
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

    const boardSize = boardData.size;
    const hasShrunked = boardData.has_shrunked || { row: 0, column: 0 };
    const toShrink = boardData.to_shrink || { row: 0, column: 0 };
    const nextHasShrunked = {
      row: Math.min(
        boardSize.rows,
        (hasShrunked.row || 0) + (toShrink.row || 0),
      ),
      column: Math.min(
        boardSize.columns,
        (hasShrunked.column || 0) + (toShrink.column || 0),
      ),
    };

    // Calculate effective board size after applying shrink on both sides
    const effectiveRows = Math.max(1, boardSize.rows - nextHasShrunked.row * 2);
    const effectiveCols = Math.max(
      1,
      boardSize.columns - nextHasShrunked.column * 2,
    );

    console.log(
      `Shrinking board from ${boardSize.rows}x${boardSize.columns} to ${effectiveRows}x${effectiveCols}`,
    );

    // Update board shrink level with active board flag
    const nextShrinkTime = new Date();
    nextShrinkTime.setDate(nextShrinkTime.getDate() + 1); // Next shrink in 24 hours

    // Decide next to_shrink plan (default 1 per side, but clamp to keep at least 1x1 playable)
    const maxNextRowShrinkPerSide = Math.max(
      0,
      Math.floor((boardSize.rows - nextHasShrunked.row * 2 - 1) / 2),
    );
    const maxNextColShrinkPerSide = Math.max(
      0,
      Math.floor((boardSize.columns - nextHasShrunked.column * 2 - 1) / 2),
    );
    const plannedToShrink = {
      row: Math.min(1, maxNextRowShrinkPerSide),
      column: Math.min(1, maxNextColShrinkPerSide),
    };

    const { error: updateBoardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        has_shrunked: nextHasShrunked,
        to_shrink: plannedToShrink,
        next_shrink: nextShrinkTime.toISOString(),
      })
      .eq("active_board", true);

    if (updateBoardError) {
      console.error("Error updating board:", updateBoardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        updateBoardError.message,
      );
    }

    // Get all active players
    const { data: players, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("*")
      .eq("taken_tank", true);

    if (playersError) {
      console.error("Error fetching players:", playersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playersError.message,
      );
    }

    // Check which players are now out of bounds and need to be moved
    const playersToUpdate: Player[] = [];

    for (const player of (players as Player[]) || []) {
      const { position } = player;

      // Check if player is outside new bounds
      if (
        position.row < nextHasShrunked.row ||
        position.row >= boardSize.rows - nextHasShrunked.row ||
        position.column < nextHasShrunked.column ||
        position.column >= boardSize.columns - nextHasShrunked.column
      ) {
        // Move player to nearest safe position and reduce lives by 1
        const newPosition = {
          row: Math.max(
            nextHasShrunked.row,
            Math.min(position.row, boardSize.rows - nextHasShrunked.row - 1),
          ),
          column: Math.max(
            nextHasShrunked.column,
            Math.min(
              position.column,
              boardSize.columns - nextHasShrunked.column - 1,
            ),
          ),
        };

        const newLives = Math.max(0, player.lives - 1);

        playersToUpdate.push({
          ...player,
          position: newPosition,
          lives: newLives,
        });

        console.log(
          `Moving player ${player.playerID} from (${position.row},${position.column}) to (${newPosition.row},${newPosition.column}), lives: ${player.lives} -> ${newLives}`,
        );
      }
    }

    // Update affected players using batch upsert instead of individual updates
    if (playersToUpdate.length > 0) {
      // Prepare the batch update data
      const batchUpdateData = playersToUpdate.map((player) => ({
        uuid: player.uuid,
        position: player.position,
        lives: player.lives,
        // Include other required fields to avoid issues
        user_id: player.user_id,
        playerID: player.playerID,
        tokens: player.tokens,
        range: player.range,
        color: player.color,
        taken_tank: player.taken_tank,
        created_date: player.created_date,
        last_login_date: player.last_login_date,
      }));

      // Perform batch update using upsert
      const { error: batchUpdateError } = await supabase
        .from("KfKbandvagn")
        .upsert(batchUpdateData, {
          onConflict: "uuid",
          ignoreDuplicates: false,
        });

      if (batchUpdateError) {
        console.error(
          "Error in batch update of affected players:",
          batchUpdateError,
        );
        return createErrorResponse(
          ERROR_CODES.INTERNAL_ERROR,
          "Failed to update affected players during board shrink",
        );
      }

      console.log(
        `Batch updated ${playersToUpdate.length} players affected by board shrink`,
      );
    }

    // Add log entry about board shrink
    const logTimestamp = new Date().toISOString();
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "board_shrink",
      timestamp: logTimestamp,
      details: {
        has_shrunked: nextHasShrunked,
        to_shrink_applied: toShrink,
        effectiveSize: { rows: effectiveRows, cols: effectiveCols },
        playersAffected: playersToUpdate.length,
      },
    };

    // Update logs and last_update timestamp
    const currentLogs = boardData.logs || [];
    let updatedLogs = [...currentLogs, logEntry];
    if (updatedLogs.length > 100) {
      updatedLogs = updatedLogs.slice(-100);
    }

    const { error: logError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        logs: updatedLogs,
        last_update: logTimestamp,
      })
      .eq("active_board", true);

    if (logError) {
      console.error("Error updating logs:", logError);
      // Don't fail the whole operation for log errors
    }

    console.log(
      `Board shrink completed. Affected ${playersToUpdate.length} players`,
    );

    return createSuccessResponse({
      has_shrunked: nextHasShrunked,
      effectiveSize: { rows: effectiveRows, cols: effectiveCols },
      playersAffected: playersToUpdate.length,
      next_shrink: nextShrinkTime.toISOString(),
    }, "Board shrink completed successfully");
  } catch (error) {
    console.error("Error in handleBoardShrink:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Board shrink failed",
    );
  }
}

// Handle token distribution to all players (called by cron job)
export async function handleTokenDistribution(tokenAmount: number) {
  try {
    const supabase = createServiceClient();

    console.log("Starting token distribution");

    // Get all active players with their current token counts
    const { data: activePlayers, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("uuid, tokens");

    // All tanks are given tokens for now, taken or not
    //.eq("taken_tank", true);

    if (playersError) {
      console.error("Error fetching active players:", playersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playersError.message,
      );
    }

    if (!activePlayers || activePlayers.length === 0) {
      console.log("No active players found to update");
      return createSuccessResponse(
        { playersUpdated: 0 },
        "No active players to distribute tokens to",
      );
    }

    // Prepare batch update data - increment each player's tokens by 1
    const updateData = activePlayers.map((player) => ({
      uuid: player.uuid,
      tokens: player.tokens + tokenAmount,
    }));

    // Use upsert with the uuid array to do a batch update
    const { error: batchUpdateError } = await supabase
      .from("KfKbandvagn")
      .upsert(updateData, {
        onConflict: "uuid",
        ignoreDuplicates: false,
      });

    if (batchUpdateError) {
      console.error("Error in batch token update:", batchUpdateError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        batchUpdateError.message,
      );
    }

    const playersUpdated = activePlayers.length;

    // Add log entry about token distribution
    const logTimestamp = new Date().toISOString();
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "token_distribution",
      timestamp: logTimestamp,
      details: {
        playersUpdated: playersUpdated,
        tokensPerPlayer: tokenAmount,
      },
    };

    // Update logs and last_update timestamp
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("logs")
      .eq("active_board", true)
      .single();

    if (!boardError && boardData) {
      const currentLogs = boardData.logs || [];
      let updatedLogs = [...currentLogs, logEntry];
      if (updatedLogs.length > 100) {
        updatedLogs = updatedLogs.slice(-100);
      }

      const { error: logError } = await supabase
        .from("KfKbandvagnBoard")
        .update({
          logs: updatedLogs,
          last_update: logTimestamp,
        })
        .eq("active_board", true);

      if (logError) {
        console.error("Error updating logs:", logError);
        // Don't fail the whole operation for log errors
      }
    }

    console.log(
      `Token distribution completed. Updated ${playersUpdated} players`,
    );

    return createSuccessResponse({
      playersUpdated: playersUpdated,
      tokensDistributed: playersUpdated,
    }, "Token distribution completed successfully");
  } catch (error) {
    console.error("Error in handleTokenDistribution:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Token distribution failed",
    );
  }
}

// Handle item spawning (called by cron job at random intervals)
export async function handleItemsSpawn() {
  try {
    const supabase = createServiceClient();

    console.log("Starting item spawn process");

    // Get board data and players
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

    const { data: players, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("position, lives")
      .eq("taken_tank", true)
      .gt("lives", 0); // Only living players

    if (playersError) {
      console.error("Error fetching players:", playersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playersError.message,
      );
    }

    // Calculate playable bounds using the new shrink model
    const boardSize = boardData.size;
    const hasShrunked = boardData.has_shrunked || { row: 0, column: 0 };
    // Playable area is from [hasShrunked.row, rows - hasShrunked.row - 1] and same for columns
    const playableTop = hasShrunked.row;
    const playableBottom = Math.max(
      hasShrunked.row,
      boardSize.rows - hasShrunked.row - 1,
    );
    const playableLeft = hasShrunked.column;
    const playableRight = Math.max(
      hasShrunked.column,
      boardSize.columns - hasShrunked.column - 1,
    );

    // Find occupied positions
    const occupiedPositions =
      (players as { position: { row: number; column: number } }[])
        ?.map((p) => p.position) || [];

    // Generate available positions for heart spawn
    const availablePositions = [];
    for (let row = playableTop; row <= playableBottom; row++) {
      for (let col = playableLeft; col <= playableRight; col++) {
        const isOccupied = occupiedPositions.some((pos) =>
          pos.row === row && pos.column === col
        );
        if (!isOccupied) {
          availablePositions.push({ row, column: col });
        }
      }
    }

    if (availablePositions.length === 0) {
      console.log("No available positions for spawning items");
      return createSuccessResponse(
        { itemsSpawned: 0 },
        "No available positions for spawning items",
      );
    }
  } catch (error) {
    console.error("Error in handleItemsSpawn:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Items spawn failed",
    );
  }
}
