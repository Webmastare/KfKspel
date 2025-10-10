/**
 * Game actions handlers for KfKbandvagn
 * Handles all game actions: move, shot, range, life
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  calculateDistance,
  createErrorResponse,
  createSuccessResponse,
  isPositionOccupied,
  validateActionRequest,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";
import type {
  ActionRequest,
  ActionResponse,
  GameLog,
  Player,
  Position,
} from "./types.ts";

// Add a log entry to the game board
async function addBandvagnLog(
  playerID: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<GameLog> {
  const supabase = createServiceClient();
  const todaysDate = new Date().toISOString();
  const newLog: GameLog = {
    timestamp: todaysDate,
    playerID: playerID,
    action: action,
    details: details,
  };

  try {
    // Fetch the current logs for the active board
    const { data, error: fetchError } = await supabase
      .from("KfKbandvagnBoard")
      .select("logs")
      .eq("active_board", true)
      .single();

    if (fetchError) {
      console.error("Error fetching logs:", fetchError);
      throw new Error("Failed to fetch logs");
    }

    const currentLogs = data.logs || [];

    // Add the new log and keep only latest 100 logs
    let updatedLogs = [...currentLogs, newLog];
    if (updatedLogs.length > 100) {
      updatedLogs = updatedLogs.slice(-100);
    }

    // Update the database with logs and last_update timestamp
    const { error: updateError } = await supabase
      .from("KfKbandvagnBoard")
      .update({
        logs: updatedLogs,
        last_update: todaysDate,
      })
      .eq("active_board", true);

    if (updateError) {
      console.error("Error updating logs:", updateError);
      throw new Error("Failed to update logs");
    }

    return newLog;
  } catch (err) {
    console.error("Unexpected error in addBandvagnLog:", err);
    throw err;
  }
}

// Handle game actions (equivalent to /doActionKfKbandvagn)
export async function handleGameAction(body: unknown, userId: string) {
  try {
    const actionData: ActionRequest = validateActionRequest(body);

    const supabase = createServiceClient();

    console.log("Action request:", actionData);

    // Fetch all current players
    const { data: currentData, error: fetchError } = await supabase
      .from("KfKbandvagn")
      .select("*");

    if (fetchError) {
      console.error("Error fetching players:", fetchError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        fetchError.message,
      );
    }

    // Find the current user by tank id
    const currentUser = currentData?.find((player: Player) =>
      player.uuid === actionData.tank_id
    );
    if (!currentUser) {
      return createErrorResponse(ERROR_CODES.USER_NOT_FOUND, "User not found");
    }
    // Verify the tank is still alive
    if (currentUser.lives <= 0) {
      return createErrorResponse(
        ERROR_CODES.PLAYER_ALREADY_DEAD,
        "Your tank is destroyed. You cannot perform actions.",
      );
    }

    // Verify the authenticated user owns this tank
    if (currentUser.user_id !== userId) {
      return createErrorResponse(
        ERROR_CODES.INVALID_SESSION,
        "You are not authorized to control this tank",
      );
    }

    let updateQuery: Partial<Player>;
    let detailsQuery: Record<string, unknown>;
    let shotData: Player | undefined;

    switch (actionData.action) {
      case "move": {
        if (!actionData.moveDirection) {
          return createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            "Move target position is required",
          );
        }

        const targetRow = actionData.moveDirection.row;
        const targetCol = actionData.moveDirection.col;
        const currentRow = currentUser.position.row;
        const currentCol = currentUser.position.column;

        // Calculate Manhattan distance and required tokens
        const distance = Math.abs(targetRow - currentRow) +
          Math.abs(targetCol - currentCol);
        const requiredTokens = Math.max(1, distance);

        // Check if user has enough tokens
        if (currentUser.tokens < requiredTokens) {
          return createErrorResponse(
            ERROR_CODES.MISSING_TOKENS,
            `Not enough tokens. Need ${requiredTokens}, have ${currentUser.tokens}`,
          );
        }

        // Check if target position is occupied
        const newPosition: Position = {
          row: targetRow,
          column: targetCol,
        };

        if (isPositionOccupied(newPosition, currentData as Player[])) {
          return createErrorResponse(
            ERROR_CODES.INVALID_ACTION,
            "Position is occupied",
          );
        }

        // Fetch board to validate playable bounds (cannot move into already-shrunk area)
        const { data: boardData, error: boardError } = await supabase
          .from("KfKbandvagnBoard")
          .select("size, has_shrunked")
          .eq("active_board", true)
          .single();

        if (boardError || !boardData) {
          console.error(
            "Error fetching board for move validation:",
            boardError,
          );
          return createErrorResponse(
            ERROR_CODES.INTERNAL_ERROR,
            "Failed to validate move against board",
          );
        }

        const totalRows = boardData.size?.rows ?? 0;
        const totalCols = boardData.size?.columns ?? 0;
        const hs = boardData.has_shrunked || { row: 0, column: 0 };
        // Playable inclusive bounds
        const minRow = hs.row;
        const maxRow = Math.max(hs.row, totalRows - hs.row - 1);
        const minCol = hs.column;
        const maxCol = Math.max(hs.column, totalCols - hs.column - 1);

        const inTotalBounds = targetRow >= 0 &&
          targetCol >= 0 &&
          targetRow < totalRows &&
          targetCol < totalCols;
        const inPlayable = targetRow >= minRow &&
          targetRow <= maxRow &&
          targetCol >= minCol &&
          targetCol <= maxCol;

        if (!inTotalBounds || !inPlayable) {
          return createErrorResponse(
            ERROR_CODES.INVALID_ACTION,
            "Target position is outside the playable area",
          );
        }

        updateQuery = {
          tokens: currentUser.tokens - requiredTokens,
          position: newPosition,
        };

        detailsQuery = {
          from: {
            row: currentRow,
            column: currentCol,
          },
          to: newPosition,
          distance: distance,
          cost: requiredTokens,
          before: {
            tokens: currentUser.tokens,
            position: currentUser.position,
          },
          after: {
            tokens: currentUser.tokens - requiredTokens,
            position: newPosition,
          },
        };
        break;
      }

      case "shot": {
        if (!actionData.targetUUID) {
          return createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            "Target UUID is required for shot",
          );
        }

        const shotTokenCost = 1;

        // Check if user has enough tokens for shooting
        if (currentUser.tokens < shotTokenCost) {
          return createErrorResponse(
            ERROR_CODES.MISSING_TOKENS,
            `Not enough tokens. Need ${shotTokenCost}, have ${currentUser.tokens}`,
          );
        }

        updateQuery = { tokens: currentUser.tokens - shotTokenCost };

        const targetUser = currentData?.find((player: Player) =>
          player.uuid === actionData.targetUUID
        );
        if (!targetUser) {
          return createErrorResponse(
            ERROR_CODES.NO_TARGETED_USER,
            "Target player not found",
          );
        }

        if (targetUser.lives <= 0) {
          return createErrorResponse(
            ERROR_CODES.PLAYER_ALREADY_DEAD,
            "Target player is already dead",
          );
        }

        // Check range
        const distanceToTarget = calculateDistance(
          currentUser.position,
          targetUser.position,
        );
        if (distanceToTarget > currentUser.range) {
          return createErrorResponse(
            ERROR_CODES.NOT_IN_RANGE,
            `Target is not in range. Distance: ${distanceToTarget}, Range: ${currentUser.range}`,
          );
        }

        // Update target player
        const shootQuery: Partial<Player> = {
          lives: targetUser.lives - 1,
        };

        // If target dies, give their tokens to the shooter
        if (targetUser.lives - 1 === 0) {
          shootQuery.tokens = 0;
          updateQuery.tokens = (updateQuery.tokens || currentUser.tokens) +
            targetUser.tokens;
        }

        const { data: updatedTargetData, error: shotError } = await supabase
          .from("KfKbandvagn")
          .update(shootQuery)
          .eq("uuid", actionData.targetUUID)
          .select(
            "playerID, uuid, tokens, position, lives, range, color, taken_tank",
          )
          .single();

        if (shotError) {
          console.error("Error updating target player:", shotError);
          return createErrorResponse(
            ERROR_CODES.INTERNAL_ERROR,
            shotError.message,
          );
        }

        shotData = updatedTargetData as Player;
        detailsQuery = {
          targetUser: targetUser.playerID,
          targetUUID: targetUser.uuid,
          targetUserLives: targetUser.lives - 1,
          before: {
            shooter: { tokens: currentUser.tokens },
            target: { lives: targetUser.lives, tokens: targetUser.tokens },
          },
          after: {
            shooter: { tokens: updateQuery.tokens },
            target: {
              lives: (shotData as Player).lives,
              tokens: (shotData as Player).tokens,
            },
          },
          cost: shotTokenCost,
        };

        console.log("Player shot:", shotData);
        break;
      }

      case "range": {
        const perCost = 3;
        const count = Math.max(1, Math.floor(actionData.count ?? 1));
        const totalCost = perCost * count;

        // Check if user has enough tokens
        if (currentUser.tokens < totalCost) {
          return createErrorResponse(
            ERROR_CODES.MISSING_TOKENS,
            `Not enough tokens. Need ${totalCost}, have ${currentUser.tokens}`,
          );
        }

        updateQuery = {
          tokens: currentUser.tokens - totalCost,
          range: currentUser.range + count,
        };

        detailsQuery = {
          before: { range: currentUser.range, tokens: currentUser.tokens },
          after: {
            range: (currentUser.range + count),
            tokens: (currentUser.tokens - totalCost),
          },
          count,
          cost: totalCost,
        };
        break;
      }

      case "life": {
        const perCost = 3;
        const count = Math.max(1, Math.floor(actionData.count ?? 1));
        const totalCost = perCost * count;

        // Check if user has enough tokens
        if (currentUser.tokens < totalCost) {
          return createErrorResponse(
            ERROR_CODES.MISSING_TOKENS,
            `Not enough tokens. Need ${totalCost}, have ${currentUser.tokens}`,
          );
        }

        updateQuery = {
          tokens: currentUser.tokens - totalCost,
          lives: currentUser.lives + count,
        };

        detailsQuery = {
          before: { lives: currentUser.lives, tokens: currentUser.tokens },
          after: {
            lives: (currentUser.lives + count),
            tokens: (currentUser.tokens - totalCost),
          },
          count,
          cost: totalCost,
        };
        break;
      }

      default: {
        return createErrorResponse(
          ERROR_CODES.INVALID_ACTION,
          "Unknown action",
        );
      }
    }

    // Update the current user
    const { data: updatedData, error: updateError } = await supabase
      .from("KfKbandvagn")
      .update(updateQuery)
      .eq("uuid", actionData.tank_id)
      .select(
        "playerID, uuid, tokens, position, lives, range, color, taken_tank",
      )
      .single();

    if (updateError) {
      console.error("Error updating player:", updateError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        updateError.message,
      );
    }

    // Add log entry
    const updatedLogs = await addBandvagnLog(
      currentUser.playerID,
      actionData.action,
      detailsQuery,
    );

    const response: ActionResponse = {
      updatedData: updatedData as Player,
      shotData,
      updatedLogs,
    };

    console.log("Action completed successfully");
    return createSuccessResponse(response);
  } catch (error) {
    console.error("Error in handleGameAction:", error);
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      error instanceof Error ? error.message : "Action validation failed",
    );
  }
}
