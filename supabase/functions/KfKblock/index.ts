// The main entry point for the Supabase Edge Function that handles
// the KfKblock score database interactions.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "https://deno.land/x/hono/mod.ts";

const app = new Hono();

// Initialize Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.37.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const _anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

app.get("/kfkblock-scores", async (_req: Request) => {
  // Get data from Supabase table
  const { data, error } = await supabase
    .from("KfKblockScores")
    .select("playerID, Score");

  if (error) {
    console.error("Error fetching KfKblock scores:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch scores" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

app.post("/kfkblock-scores", async (req: Request) => {
  try {
    // Parse request body
    const reqBody = await req.json();
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
      return new Response(
        JSON.stringify({
          message: "Fusk detekterat, inte tillagd",
          cheat: true,
        }),
        { status: 418, headers: { "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({ error: "Failed to insert score" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error parsing request body:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
