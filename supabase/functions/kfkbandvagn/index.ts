/**
 * Main entry point for KfKbandvagn Edge Functions
 * Handles routing for all game-related API endpoints
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createApp } from "../_shared/app.ts";
import { Context } from "hono";
import { validateUserSession } from "../_shared/auth.ts";
import { createErrorResponse } from "../_shared/validation.ts";
import { ERROR_CODES } from "./types.ts";

// Import all handlers
import { handleCreatePlayer, handleLogin } from "./auth-handler.ts";
import { handleGetGameState, handleGetGameStats } from "./game-state.ts";
import { handleGameAction } from "./game-actions.ts";
import { handleBoardShrink, handleTokenDistribution } from "./board-handler.ts";
import { handleAdminStats, handleGameReset } from "./admin-tools.ts";

const functionName = "kfkbandvagn";
const app = createApp(`/${functionName}`);

app.get("/", (c: Context) => {
  const response = new Response(
    JSON.stringify({
      success: true,
      message: "KfKbandvagn API is running",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  c.res = response;
  return c.res;
});

// Public authentication endpoints (no auth required)
app.post("/auth/create", async (c: Context) => {
  const reqBody = await c.req.json();
  const response = await handleCreatePlayer(reqBody);
  if (!response || response.error) {
    console.error("Error creating player:", response);
    const errorResponse = createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      "Failed to create player",
    );
    return c.json(errorResponse, 500);
  }

  // Determine proper status code based on error code if present
  const respObj: Record<string, unknown> = response as Record<string, unknown>;
  const isError = ("success" in respObj && respObj.success === false) ||
    ("error" in respObj && typeof respObj.error === "object" &&
      respObj.error !== null);
  if (isError) {
    const err = (respObj.error ?? {}) as { code?: string };
    const code = typeof err.code === "string" ? err.code : undefined;
    const status = code === ERROR_CODES.PLAYER_ALREADY_EXISTS
      ? 409
      : code === ERROR_CODES.NO_FREE_TANKS
      ? 409
      : code === ERROR_CODES.VALIDATION_ERROR
      ? 400
      : 500;
    return c.json(response, status);
  }

  return c.json(response, 201);
});

app.post("/auth/login", async (c: Context) => {
  const reqBody = await c.req.json();
  const response = await handleLogin(reqBody);
  // If error, map to status codes
  const respLogin: Record<string, unknown> = response as Record<
    string,
    unknown
  >;
  const isLoginError =
    ("success" in respLogin && respLogin.success === false) ||
    ("error" in respLogin && typeof respLogin.error === "object" &&
      respLogin.error !== null);
  if (isLoginError) {
    const err = (respLogin.error ?? {}) as { code?: string };
    const code = typeof err.code === "string" ? err.code : undefined;
    const status = code === ERROR_CODES.NO_PLAYER_FOUND
      ? 404
      : code === ERROR_CODES.MULTIPLE_PLAYERS_FOUND
      ? 409
      : code === ERROR_CODES.VALIDATION_ERROR
      ? 400
      : 500;
    return c.json(response, status);
  }
  return c.json(response, 200);
});

// Protected game endpoints (require authentication)
app.get("/game/state", async (c: Context) => {
  const authHeader = c.req.header("Authorization");
  const user = await validateUserSession(authHeader);
  if (!user) {
    const response = createErrorResponse(
      ERROR_CODES.INVALID_SESSION,
      "Invalid or expired session",
    );
    return c.json(response, 401);
  }
  const response = await handleGetGameState();
  console.log("Successfully retrieved game state");
  return c.json(response, 200);
});

app.get("/game/stats", async (c: Context) => {
  const authHeader = c.req.header("Authorization");
  const user = await validateUserSession(authHeader);
  if (!user) {
    const response = createErrorResponse(
      ERROR_CODES.INVALID_SESSION,
      "Invalid or expired session",
    );
    return c.json(response, 401);
  }
  const response = await handleGetGameStats();
  return c.json(response, 200);
});

app.post("/game/action", async (c: Context) => {
  const reqBody = await c.req.json();
  const authHeader = c.req.header("Authorization");
  const user = await validateUserSession(authHeader);
  if (!user) {
    const response = createErrorResponse(
      ERROR_CODES.INVALID_SESSION,
      "Invalid or expired session",
    );
    return c.json(response, 401);
  }
  const response = await handleGameAction(reqBody);
  return c.json(response, 200);
});

// Automated/cron endpoints (for system use) Change to patch or put?
app.post("/system/shrink", async (c: Context) => {
  // In production, we'd want to validate this is coming from a trusted source
  const response = await handleBoardShrink();
  return c.json(response, 200);
});

app.post("/system/distribute", async (c: Context) => {
  const response = await handleTokenDistribution();
  return c.json(response, 200);
});

// Admin endpoints (require admin privileges)
// Note: In production, you'd want proper admin authentication
app.post("/admin/reset", async (c: Context) => {
  // TODO: Add admin authentication check
  const response = await handleGameReset();
  return c.json(response, 200);
});

app.get("/admin/stats", async (c: Context) => {
  // TODO: Add admin authentication check
  const response = await handleAdminStats();
  return c.json(response, 200);
});

// 404 for undefined routes
app.all("*", (c: Context) => {
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  console.warn(`Unhandled route: ${method} ${path}`);
  // Return JSON 404 response
  return c.json({
    success: false,
    error: "NOT_FOUND",
    message: `Endpoint ${method} ${path} not found`,
    timestamp: new Date().toISOString(),
  }, 404);
});

// Export for Deno Deploy
Deno.serve(app.fetch);
