/**
 * Authentication handlers for KfKbandvagn
 * Handles player login and creation
 */

import { createServiceClient } from "../_shared/auth.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  validateCreatePlayerRequest,
  validateLoginRequest,
} from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";
import type { CreatePlayerRequest, LoginRequest } from "./types.ts";

// Handle player creation (equivalent to /createKfKbandvagn)
export async function handleCreatePlayer(body: unknown) {
  try {
    const createData: CreatePlayerRequest = validateCreatePlayerRequest(body);

    const supabase = createServiceClient();

    // Guard: prevent creating multiple tanks for the same user
    const { data: existingPlayers, error: existingErr } = await supabase
      .from("KfKbandvagn")
      .select("uuid, user_id, taken_tank")
      .eq("user_id", createData.user_id)
      .eq("taken_tank", true);

    if (existingErr) {
      console.error("Error checking existing players:", existingErr);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        existingErr.message,
      );
    }

    if (existingPlayers && existingPlayers.length > 0) {
      return createErrorResponse(
        ERROR_CODES.PLAYER_ALREADY_EXISTS,
        "User already has a tank",
      );
    }

    // Fetch all current players to find available tank
    const { data: currentData, error: selectError } = await supabase
      .from("KfKbandvagn")
      .select("*");

    if (selectError) {
      console.error("Error fetching players:", selectError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        selectError.message,
      );
    }

    // Find free wagons (tanks not taken)
    const freeWagons = currentData?.filter((player: { taken_tank: boolean }) =>
      !player.taken_tank
    ) || [];

    if (freeWagons.length <= 0) {
      return createErrorResponse(
        ERROR_CODES.NO_FREE_TANKS,
        "Inga lediga bandvagnar",
      );
    }

    const selectedPlayer = freeWagons[0];
    const todaysDate = new Date().toISOString();

    // Update the selected player with user data
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("KfKbandvagn")
      .update({
        user_id: createData.user_id,
        playerID: createData.playerID,
        color: createData.color,
        taken_tank: true,
        created_date: todaysDate,
        last_login_date: todaysDate,
      })
      .eq("uuid", selectedPlayer.uuid)
      .select("playerID, uuid, tokens, position, lives, range, color")
      .single();

    if (updateError) {
      console.error("Error updating player:", updateError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        updateError.message,
      );
    }

    console.log("Player created:", updatedPlayer);
    return createSuccessResponse(updatedPlayer, "Player created successfully");
  } catch (error) {
    console.error("Error in handleCreatePlayer:", error);
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      error instanceof Error ? error.message : "Validation failed",
    );
  }
}

// Handle player login (equivalent to /loginKfKbandvagn)
export async function handleLogin(body: unknown) {
  try {
    const loginData: LoginRequest = validateLoginRequest(body);

    const supabase = createServiceClient();
    const todaysDate = new Date().toISOString();

    // Update last login and fetch player data
    const { data: playerData, error } = await supabase
      .from("KfKbandvagn")
      .update({ last_login_date: todaysDate })
      .eq("user_id", loginData.user_id)
      .select("user_id, playerID, uuid, tokens, position, lives, range, color");

    if (error) {
      console.error("Error during login:", error);
      return createErrorResponse(
        ERROR_CODES.NO_PLAYER_FOUND,
        "Player not found",
      );
    }

    if (!playerData || playerData.length === 0) {
      return createErrorResponse(
        ERROR_CODES.NO_PLAYER_FOUND,
        "No player found for this user",
      );
    }

    if (playerData.length > 1) {
      console.error("Multiple players found for user:", loginData.user_id);
      return createErrorResponse(
        ERROR_CODES.MULTIPLE_PLAYERS_FOUND,
        "Multiple players found",
      );
    }

    const user = playerData[0];
    console.log("Player logged in:", user.playerID);
    return createSuccessResponse(user, "Player retrieved successfully");
  } catch (error) {
    console.error("Error in handleLogin:", error);
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      error instanceof Error ? error.message : "Validation failed",
    );
  }
}
