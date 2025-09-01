import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { createApp } from "../_shared/app.ts";

const functionName = "kfkblock";
const app = createApp(`/${functionName}`);

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const _anonKey = Deno.env.get("SB_ANON_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

app.get("/", (c: any) => {
  console.log("Root endpoint called");
  console.log("Request method:", c.req.method);
  console.log("Request URL:", c.req.url);
  console.log("Request path:", c.req.path);
  return c.json({ message: "KfKblock Edge Function is running!" });
});

app.get("/kfkblock-scores", async (c: any) => {
  console.log("Fetching KfKblock scores...");
  // Get data from Supabase table
  const { data, error } = await supabase
    .from("KfKblockScores")
    .select("playerID, Score");

  if (error) {
    console.error("Error fetching KfKblock scores:", error);
    return c.json({ error: "Failed to fetch scores" }, 500);
  }

  return c.json(data, 200);
});

app.post("/kfkblock-scores", async (c: any) => {
  try {
    // Parse request body
    const reqBody = await c.req.json();
    const {
      playerID = null,
      RealName = null,
      Score = null,
      Other = null,
      Key = "not yet set",
    } = reqBody;

    // Validate key
    const calcKey = Score + (Other["block"]) ** 2 +
      Other["levelClearedRows"] * 3 - 7;
    console.log(playerID, RealName, Score, Other);
    console.log("Key calc:", calcKey, "Key gotten:", Key);

    // Validate input
    if (calcKey !== Key && Key !== "not yet set") {
      console.log("Something is not right", playerID, RealName, Score, Other);
      console.log("Key calc:", calcKey, "Key gotten:", Key);
      return c.json({
        message: "Fusk detekterat, inte tillagd",
        cheat: true,
      }, 418);
    }

    // Insert data into Supabase table
    const { data, error } = await supabase
      .from("KfKblockScores") //KfKblockScores
      .insert([
        {
          playerID: playerID, // playerID: string
          RealName: RealName, // RealName: string
          Score: Score,
          Others: Other,
        }, // Score: integer
      ])
      .select("playerID, Score");

    if (error) {
      console.error("Error inserting KfKblock score:", error);
      return c.json({ error: "Failed to insert score" }, 500);
    }

    return c.json(data, 201);
  } catch (err) {
    console.error("Error parsing request body:", err);
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// Catch-all route for debugging
app.all("*", (c: any) => {
  console.log("Unmatched route called:");
  console.log("Method:", c.req.method);
  console.log("URL:", c.req.url);
  console.log("Path:", c.req.path);
  return c.json({
    error: "Route not found",
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
  }, 404);
});

// Export the Hono app as a Deno serve handler
Deno.serve(app.fetch);
