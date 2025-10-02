// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { createApp } from "../_shared/app.ts";
import { Context } from "jsr:@hono/hono";

const functionName = "lightsout";
const app = createApp(`/${functionName}`);
const supabase = createServiceClient();

// Helpers
const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
function fromBase36(s: string): number {
  s = (s || "").toLowerCase().slice(0, 3);
  let n = 0;
  for (const c of s) {
    const idx = chars.indexOf(c);
    if (idx < 0) return 0;
    n = n * 36 + idx;
  }
  return n;
}
function computeKey(score: number, clicks: number, seedCode: string): number {
  const seedNum = fromBase36(seedCode);
  return score * 3 + clicks ** 2 + seedNum * 7 - 13;
}

app.get(
  "/",
  (c: Context) => c.json({ message: "LightsOut Edge Function is running!" }),
);

app.get("/scores", async (c: Context) => {
  const { data, error } = await supabase
    .from("lightout_scores")
    .select("playerID, score, clicks, seed, date, difficulty")
    .order("score", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: "Failed to fetch" }, 500);
  return c.json(data, 200);
});

app.post("/submit", async (c: Context) => {
  try {
    const body = await c.req.json();
    const { playerID, score, clicks, seed, difficulty, key } = body || {};
    console.log("Received score submission:", body);
    if (
      typeof playerID !== "string" ||
      typeof score !== "number" ||
      typeof clicks !== "number" ||
      typeof seed !== "string" ||
      typeof difficulty !== "string"
    ) {
      return c.json({ error: "Bad request" }, 400);
    }

    // Validate difficulty is either 'n' or 'h'
    if (difficulty !== "n" && difficulty !== "h") {
      return c.json({ error: "Invalid difficulty" }, 400);
    }

    const expected = computeKey(score, clicks, seed);
    if (key !== expected) {
      return c.json(
        { message: "Fusk detekterat, inte tillagd", cheat: true },
        418,
      );
    }

    const row = {
      playerID,
      score,
      clicks,
      seed,
      difficulty,
      date: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("lightout_scores").insert([row])
      .select();
    if (error) return c.json({ error: "Failed to insert" }, 500);
    return c.json(data, 201);
  } catch (_e) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

app.all(
  "*",
  (c) => c.json({ error: "Route not found", path: c.req.path }, 404),
);

Deno.serve(app.fetch);

/*
Local testing examples:
GET  http://127.0.0.1:54321/functions/v1/lightsout/scores
POST http://127.0.0.1:54321/functions/v1/lightsout/submit
*/
