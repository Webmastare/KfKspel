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

    const currentShrink = boardData.shrink || 0;
    const boardSize = boardData.size;
    const newShrink = currentShrink + 1;

    // Calculate effective board size after shrink
    const effectiveRows = Math.max(1, boardSize.rows - newShrink);
    const effectiveCols = Math.max(1, boardSize.columns - newShrink);

    console.log(
      `Shrinking board from ${boardSize.rows}x${boardSize.columns} to ${effectiveRows}x${effectiveCols}`,
    );

    // Update board shrink level with active board flag
    const nextShrinkTime = new Date();
    nextShrinkTime.setDate(nextShrinkTime.getDate() + 1); // Next shrink in 24 hours

    const { error: updateBoardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        shrink: newShrink,
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
      if (position.row >= effectiveRows || position.column >= effectiveCols) {
        // Move player to nearest safe position and reduce lives by 1
        const newPosition = {
          row: Math.max(0, Math.min(position.row, effectiveRows - 1)),
          column: Math.max(0, Math.min(position.column, effectiveCols - 1)),
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
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "board_shrink",
      timestamp: new Date().toISOString(),
      details: {
        newShrinkLevel: newShrink,
        effectiveSize: { rows: effectiveRows, cols: effectiveCols },
        playersAffected: playersToUpdate.length,
      },
    };

    // Update logs
    const currentLogs = boardData.logs || [];
    let updatedLogs = [...currentLogs, logEntry];
    if (updatedLogs.length > 100) {
      updatedLogs = updatedLogs.slice(-100);
    }

    const { error: logError } = await supabase
      .from("KfKbandvagnBoard")
      .update({ logs: updatedLogs })
      .eq("active_board", true);

    if (logError) {
      console.error("Error updating logs:", logError);
      // Don't fail the whole operation for log errors
    }

    console.log(
      `Board shrink completed. Affected ${playersToUpdate.length} players`,
    );

    return createSuccessResponse({
      shrinkLevel: newShrink,
      effectiveSize: { rows: effectiveRows, cols: effectiveCols },
      playersAffected: playersToUpdate.length,
      nextShrink: nextShrinkTime.toISOString(),
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
export async function handleTokenDistribution() {
  try {
    const supabase = createServiceClient();

    console.log("Starting token distribution");

    // Get all active players with their current token counts
    const { data: activePlayers, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("uuid, tokens")
      .eq("taken_tank", true);

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
      tokens: player.tokens + 1,
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
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "token_distribution",
      timestamp: new Date().toISOString(),
      details: {
        playersUpdated: playersUpdated,
        tokensPerPlayer: 1,
      },
    };

    // Update logs
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
        .update({ logs: updatedLogs })
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

// Handle heart spawning (called by cron job at random intervals)
export async function handleHeartSpawn() {
  try {
    const supabase = createServiceClient();

    console.log("Starting heart spawn process");

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

    // Calculate effective board size
    const boardSize = boardData.size;
    const shrink = boardData.shrink || 0;
    const effectiveRows = Math.max(1, boardSize.rows - shrink);
    const effectiveCols = Math.max(1, boardSize.columns - shrink);

    // Find occupied positions
    const occupiedPositions =
      (players as { position: { row: number; column: number } }[])
        ?.map((p) => p.position) || [];

    // Generate available positions for heart spawn
    const availablePositions = [];
    for (let row = 0; row < effectiveRows; row++) {
      for (let col = 0; col < effectiveCols; col++) {
        const isOccupied = occupiedPositions.some((pos) =>
          pos.row === row && pos.column === col
        );
        if (!isOccupied) {
          availablePositions.push({ row, column: col });
        }
      }
    }

    if (availablePositions.length === 0) {
      console.log("No available positions for heart spawn");
      return createSuccessResponse(
        { heartsSpawned: 0 },
        "No available positions for heart spawn",
      );
    }

    // Spawn 1-3 hearts randomly
    const heartsToSpawn = Math.floor(Math.random() * 3) + 1;
    const spawnedHearts = [];

    for (
      let i = 0;
      i < Math.min(heartsToSpawn, availablePositions.length);
      i++
    ) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      const position = availablePositions.splice(randomIndex, 1)[0];
      spawnedHearts.push(position);
    }

    // TODO: Store heart positions in database
    // For now, we'll just log the event

    // Add log entry about heart spawn
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "heart_spawn",
      timestamp: new Date().toISOString(),
      details: {
        heartsSpawned: spawnedHearts.length,
        positions: spawnedHearts,
      },
    };

    // Update logs
    const currentLogs = boardData.logs || [];
    let updatedLogs = [...currentLogs, logEntry];
    if (updatedLogs.length > 100) {
      updatedLogs = updatedLogs.slice(-100);
    }

    const { error: logError } = await supabase
      .from("KfKbandvagnBoard")
      .update({ logs: updatedLogs })
      .eq("active_board", true);

    if (logError) {
      console.error("Error updating logs:", logError);
      // Don't fail the whole operation for log errors
    }

    console.log(
      `Heart spawn completed. Spawned ${spawnedHearts.length} hearts`,
    );

    return createSuccessResponse({
      heartsSpawned: spawnedHearts.length,
      positions: spawnedHearts,
    }, "Heart spawn completed successfully");
  } catch (error) {
    console.error("Error in handleHeartSpawn:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Heart spawn failed",
    );
  }
}
