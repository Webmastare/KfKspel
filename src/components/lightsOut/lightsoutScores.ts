import { supabase } from "@/utils/supabase";

export type LightsOutScoreRow = {
    playerID: string;
    score: number;
    clicks: number;
    seed: string;
    date: string;
    difficulty: string;
};

// Compute a simple anti-cheat key mirrored on the server
export function computeLightsOutKey(
    score: number,
    clicks: number,
    seedCode: string,
): number {
    const seedNum = fromBase36(seedCode);
    return score * 3 + clicks ** 2 + seedNum * 7 - 13;
}

export function fromBase36(s: string): number {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    s = (s || "").toLowerCase().slice(0, 3);
    let n = 0;
    for (const c of s) {
        const idx = chars.indexOf(c);
        if (idx < 0) return 0;
        n = n * 36 + idx;
    }
    return n;
}

export async function getTopLightsOutScores(
    difficulty: string = "n",
    limit = 300,
): Promise<LightsOutScoreRow[]> {
    const { data, error } = await supabase
        .from("lightout_scores")
        .select("playerID, score, clicks, seed, date, difficulty")
        .eq("difficulty", difficulty)
        .order("score", { ascending: false })
        .order("clicks", { ascending: true })
        .limit(limit);

    if (error) {
        console.error("Error fetching Lights Out scores:", error);
        return [];
    }
    return data as LightsOutScoreRow[];
}

export async function submitLightsOutScore(payload: {
    playerID: string;
    score: number;
    clicks: number;
    seed: string;
    difficulty: string;
}) {
    const body = {
        ...payload,
        key: computeLightsOutKey(payload.score, payload.clicks, payload.seed),
    };

    const { data, error } = await supabase.functions.invoke(
        "lightsout/submit",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
    );

    if (error) {
        console.error("Error submitting Lights Out score:", error);
        throw error;
    }
    return data;
}
