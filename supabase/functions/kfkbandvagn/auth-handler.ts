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
export async function handleCreatePlayer(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const createData: CreatePlayerRequest = validateCreatePlayerRequest(body);

    const supabase = createServiceClient();

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
      .select("user_id, playerID, uuid, tokens, position, lives, range, color")
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
export async function handleLogin(request: Request): Promise<Response> {
  try {
    const body = await request.json();
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

// Create new users for testing (equivalent to /createNewUsersKfKbandvagn)
export async function handleCreateTestUsers(
  _request: Request,
): Promise<Response> {
  try {
    const supabase = createServiceClient();

    // Get board data
    const { data: boardData, error: boardError } = await supabase
      .from("KfKbandvagnBoard")
      .select("size, shrink, upgrades")
      .single();

    if (boardError) {
      console.error("Error fetching board data:", boardError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        boardError.message,
      );
    }

    const boardSize = boardData.size;
    console.log("Board data:", boardData);

    // Generate free spaces
    const freeSpaces: [number, number][] = [];
    for (let r = 0; r < boardSize.rows; r++) {
      for (let c = 0; c < boardSize.columns; c++) {
        freeSpaces.push([r, c]);
      }
    }

    const numUsers = Math.floor(freeSpaces.length / 10);
    const entries = Array.from({ length: numUsers }, () => ({
      playerID: "No-player",
      tokens: 100,
      color: `#${
        Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
      }`,
      position: { column: 0, row: 0 },
      lives: 3,
      range: 2,
    }));

    // Assign random positions
    for (const entry of entries) {
      const posIndex = Math.floor(Math.random() * freeSpaces.length);
      const pos = freeSpaces.splice(posIndex, 1)[0];
      entry.position = { column: pos[1], row: pos[0] };
    }

    console.log("Creating players");

    const { data: _data, error } = await supabase
      .from("KfKbandvagn")
      .insert(entries);

    if (error) {
      console.error("Error creating test users:", error);
      return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, error.message);
    }

    console.log("Players created");
    return createSuccessResponse(
      entries,
      `Created ${entries.length} test players`,
    );
  } catch (error) {
    console.error("Error in handleCreateTestUsers:", error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Failed to create test users",
    );
  }
}
