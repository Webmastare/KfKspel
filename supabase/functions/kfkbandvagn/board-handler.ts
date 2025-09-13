/**
 * Board management handlers for KfKbandvagn
 * Handles board shrinking and token distribution (called by cron jobs)
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "../_shared/types.ts";
import type { GameLog, Player } from "../_shared/types.ts";

// Handle board shrinking (called by cron job)
export async function handleBoardShrink(_request: Request): Promise<Response> {
  try {
    const supabase = createServiceClient();

    console.log("Starting board shrink process");

    // Get current board data
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("*")
      .eq("board_id", "f53")
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

    // Update board shrink level
    const nextShrinkTime = new Date();
    nextShrinkTime.setDate(nextShrinkTime.getDate() + 1); // Next shrink in 24 hours

    const { error: updateBoardError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        shrink: newShrink,
        next_shrink: nextShrinkTime.toISOString(),
      })
      .eq("board_id", "f53");

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

    // Update affected players
    const updatePromises = playersToUpdate.map((player) =>
      supabase
        .from("KfKbandvagn")
        .update({
          position: player.position,
          lives: player.lives,
        })
        .eq("uuid", player.uuid)
    );

    const updateResults = await Promise.all(updatePromises);

    // Check for update errors
    const updateErrors = updateResults.filter((result: { error: unknown }) =>
      result.error
    );
    if (updateErrors.length > 0) {
      console.error("Errors updating players:", updateErrors);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to update some players",
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
      .eq("board_id", "f53");

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
export async function handleTokenDistribution(
  _request: Request,
): Promise<Response> {
  try {
    const supabase = createServiceClient();

    console.log("Starting token distribution");

    // Get all active players
    const { data: players, error: playersError } = await supabase
      .from("KfKbandvagn")
      .select("uuid, playerID, tokens")
      .eq("taken_tank", true);

    if (playersError) {
      console.error("Error fetching players:", playersError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        playersError.message,
      );
    }

    if (!players || players.length === 0) {
      console.log("No active players found");
      return createSuccessResponse(
        { playersUpdated: 0 },
        "No active players to distribute tokens to",
      );
    }

    // Give each player 1 token
    const updatePromises = players.map((
      player: { uuid: string; tokens: number },
    ) =>
      supabase
        .from("KfKbandvagn")
        .update({ tokens: player.tokens + 1 })
        .eq("uuid", player.uuid)
    );

    const updateResults = await Promise.all(updatePromises);

    // Check for update errors
    const updateErrors = updateResults.filter((result: { error: unknown }) =>
      result.error
    );
    if (updateErrors.length > 0) {
      console.error("Errors updating player tokens:", updateErrors);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to update some player tokens",
      );
    }

    // Add log entry about token distribution
    const logEntry: GameLog = {
      playerID: "SYSTEM",
      action: "token_distribution",
      timestamp: new Date().toISOString(),
      details: {
        playersUpdated: players.length,
        tokensDistributed: players.length,
      },
    };

    // Update logs
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("logs")
      .eq("board_id", "f53")
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
        .eq("board_id", "f53");

      if (logError) {
        console.error("Error updating logs:", logError);
        // Don't fail the whole operation for log errors
      }
    }

    console.log(
      `Token distribution completed. Updated ${players.length} players`,
    );

    return createSuccessResponse({
      playersUpdated: players.length,
      tokensDistributed: players.length,
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
export async function handleHeartSpawn(_request: Request): Promise<Response> {
  try {
    const supabase = createServiceClient();

    console.log("Starting heart spawn process");

    // Get board data and players
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("*")
      .eq("board_id", "f53")
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
      let i = 0; i < Math.min(heartsToSpawn, availablePositions.length); i++
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
      .eq("board_id", "f53");

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
