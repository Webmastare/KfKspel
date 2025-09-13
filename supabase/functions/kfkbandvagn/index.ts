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
  c.res = response;
  return c.res;
});

app.post("/auth/login", async (c: Context) => {
  const reqBody = await c.req.json();
  const response = await handleLogin(reqBody);
  c.res = response;
  return c.res;
});

// Protected game endpoints (require authentication)
app.get("/game/state", async (c: Context) => {
  const reqBody = await c.req.json();
  const authHeader = c.req.header("Authorization");
  const user = await validateUserSession(authHeader);
  if (!user) {
    const response = createErrorResponse(
      ERROR_CODES.INVALID_SESSION,
      "Invalid or expired session",
    );
    return response;
  }
  const response = await handleGetGameState(reqBody);
  c.res = response;
  return c.res;
});

app.get("/game/stats", async (c: Context) => {
  const reqBody = await c.req.json();
  const authHeader = c.req.header("Authorization");
  const user = await validateUserSession(authHeader);
  if (!user) {
    const response = createErrorResponse(
      ERROR_CODES.INVALID_SESSION,
      "Invalid or expired session",
    );
    return response;
  }
  const response = await handleGetGameStats(reqBody);
  c.res = response;
  return c.res;
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
    return response;
  }
  const response = await handleGameAction(reqBody);
  c.res = response;
  return c.res;
});

// Automated/cron endpoints (for system use)
app.post("/system/shrink", async (c: Context) => {
  const reqBody = await c.req.json();
  // In production, we'd want to validate this is coming from a trusted source
  const response = await handleBoardShrink(reqBody);
  c.res = response;
  return c.res;
});

app.post("/system/distribute", async (c: Context) => {
  const reqBody = await c.req.json();
  const response = await handleTokenDistribution(reqBody);
  c.res = response;
  return c.res;
});

// Admin endpoints (require admin privileges)
// Note: In production, you'd want proper admin authentication
app.post("/admin/reset", async (c: Context) => {
  // TODO: Add admin authentication check
  const reqBody = await c.req.json();
  const response = await handleGameReset(reqBody);
  c.res = response;
  return c.res;
});

app.get("/admin/stats", async (c: Context) => {
  // TODO: Add admin authentication check
  const reqBody = await c.req.json();
  const response = await handleAdminStats(reqBody);
  c.res = response;
  return c.res;
});

// 404 for undefined routes
app.all("*", (c: Context) => {
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  console.warn(`Unhandled route: ${method} ${path}`);
  // Return JSON 404 response
  const response = new Response(
    JSON.stringify({
      success: false,
      error: "NOT_FOUND",
      message: `Endpoint ${method} ${path} not found`,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
  c.res = response;
  return c.res;
});

// Export for Deno Deploy
Deno.serve(app.fetch);
