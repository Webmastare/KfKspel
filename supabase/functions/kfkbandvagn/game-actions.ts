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
  validateMoveDirection,
} from "../_shared/validation.ts";
import { ERROR_CODES, TOKEN_COSTS } from "./types.ts";
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

    // Update the database
    const { error: updateError } = await supabase
      .from("KfKbandvagnBoard")
      .update({ logs: updatedLogs })
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
export async function handleGameAction(request: Request) {
  try {
    const body = await request.json();
    const actionData: ActionRequest = validateActionRequest(body);

    const supabase = createServiceClient();
    const tokensNeeded = TOKEN_COSTS[actionData.action];

    console.log("Action request:", actionData);
    console.log("Tokens needed:", tokensNeeded);

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

    // Find the current user
    const currentUser = currentData?.find((player: Player) =>
      player.user_id === actionData.user_id
    );
    if (!currentUser) {
      return createErrorResponse(ERROR_CODES.USER_NOT_FOUND, "User not found");
    }

    // Check if user has enough tokens
    if (currentUser.tokens < tokensNeeded) {
      return createErrorResponse(
        ERROR_CODES.MISSING_TOKENS,
        "Not enough tokens",
      );
    }

    // Check if player is alive for most actions
    if (currentUser.lives <= 0 && actionData.action !== "life") {
      return createErrorResponse(
        ERROR_CODES.PLAYER_ALREADY_DEAD,
        "Dead players cannot perform this action",
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
            "Move direction is required",
          );
        }

        // Validate move direction
        if (!validateMoveDirection(actionData.moveDirection)) {
          return createErrorResponse(
            ERROR_CODES.INVALID_ACTION,
            "Invalid move direction",
          );
        }

        const newPosition: Position = {
          row: currentUser.position.row + actionData.moveDirection.row,
          column: currentUser.position.column + actionData.moveDirection.col,
        };

        // Check if new position is occupied
        if (isPositionOccupied(newPosition, currentData as Player[])) {
          return createErrorResponse(
            ERROR_CODES.INVALID_ACTION,
            "Position is occupied",
          );
        }

        // TODO: Add board boundary validation here when we have board size

        updateQuery = {
          tokens: currentUser.tokens - tokensNeeded,
          position: newPosition,
        };

        detailsQuery = {
          from: {
            row: currentUser.position.row,
            column: currentUser.position.column,
          },
          to: newPosition,
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

        updateQuery = { tokens: currentUser.tokens - tokensNeeded };

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
          .select("playerID, uuid, tokens, position, lives, range, color")
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
          targetUserLives: targetUser.lives - 1,
        };

        console.log("Player shot:", shotData);
        break;
      }

      case "range": {
        updateQuery = {
          tokens: currentUser.tokens - tokensNeeded,
          range: currentUser.range + 1,
        };

        detailsQuery = { range: updateQuery.range };
        break;
      }

      case "life": {
        updateQuery = {
          tokens: currentUser.tokens - tokensNeeded,
          lives: currentUser.lives + 1,
        };

        detailsQuery = { lives: updateQuery.lives };
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
      .eq("user_id", actionData.user_id)
      .select("user_id, playerID, uuid, tokens, position, lives, range, color")
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
