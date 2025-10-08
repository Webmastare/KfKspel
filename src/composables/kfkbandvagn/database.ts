import { supabase } from "@/utils/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Player } from "@/composables/kfkbandvagn/player";
import type { GameBoard } from "@/composables/kfkbandvagn/board";

export type GameStateClientResponse = {
    playerData: Player[];
    boardData: GameBoard | null;
};

// Lightweight event de-dupe using commit timestamps per table
const lastCommit = {
    players: "" as string, // ISO commit timestamp string
    board: "" as string,
};

let playersChannel: RealtimeChannel | null = null;
let boardChannel: RealtimeChannel | null = null;

export type RealtimeStatus =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";
/**
 * Fetch game state from client side
 */
export async function fetchGameStateClient(): Promise<GameStateClientResponse> {
    // Fetch players
    const { data: players, error: playersError } = await supabase
        .from("KfKbandvagn")
        .select(
            "playerID, taken_tank, uuid, tokens, position, lives, range, color",
        );

    if (playersError) throw playersError;

    // Fetch the active board
    const { data: board, error: boardError } = await supabase
        .from("KfKbandvagnBoard")
        .select("*")
        .eq("active_board", true)
        .maybeSingle();

    if (boardError) throw boardError;

    return {
        playerData: (players || []) as Player[],
        boardData: (board || null) as GameBoard | null,
    };
}
/**
 * Unsubscribe from real-time updates
 */
export function unsubscribeRealtime() {
    if (playersChannel) {
        playersChannel.unsubscribe();
        playersChannel = null;
    }
    if (boardChannel) {
        boardChannel.unsubscribe();
        boardChannel = null;
    }
}

export function subscribeToBandvagn(options: {
    onStatusChange?: (status: RealtimeStatus) => void;
    onPlayerChange: (
        row: Player,
        type: "INSERT" | "UPDATE" | "DELETE",
    ) => void;
    onBoardChange: (
        row: GameBoard,
        type: "INSERT" | "UPDATE" | "DELETE",
    ) => void;
}) {
    const { onStatusChange, onPlayerChange, onBoardChange } = options;

    onStatusChange?.("connecting");

    // Players table changes
    playersChannel = supabase
        .channel("kfkbandvagn-players")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "KfKbandvagn" },
            (payload: any) => {
                console.log("Received RT update for players:", payload);
                // Deduplicate using commit timestamp monotonicity
                const ts = payload.commit_timestamp as string;
                if (lastCommit.players && ts <= lastCommit.players) return;
                lastCommit.players = ts;

                const type = payload.eventType as
                    | "INSERT"
                    | "UPDATE"
                    | "DELETE";
                const row =
                    (type === "DELETE" ? payload.old : payload.new) as Player;
                if (!row) return;
                onPlayerChange(row, type);
            },
        );

    // Board table changes (only the active board row should change)
    boardChannel = supabase
        .channel("kfkbandvagn-board")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "KfKbandvagnBoard" },
            (payload: any) => {
                console.log("Received RT update for board:", payload);
                const ts = payload.commit_timestamp as string;
                if (lastCommit.board && ts <= lastCommit.board) return;
                lastCommit.board = ts;

                const type = payload.eventType as
                    | "INSERT"
                    | "UPDATE"
                    | "DELETE";
                const row =
                    (type === "DELETE"
                        ? payload.old
                        : payload.new) as GameBoard;
                if (!row) return;
                // Only forward active board changes
                if (type !== "DELETE" && row.active_board === false) return;
                onBoardChange(row, type);
            },
        );

    // Subscribe and wire status callbacks
    playersChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") onStatusChange?.("connected");
        else if (status === "CHANNEL_ERROR") onStatusChange?.("error");
        else if (status === "CLOSED" || status === "TIMED_OUT") {
            onStatusChange?.("disconnected");
        }
    });

    boardChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") onStatusChange?.("connected");
        else if (status === "CHANNEL_ERROR") onStatusChange?.("error");
        else if (status === "CLOSED" || status === "TIMED_OUT") {
            onStatusChange?.("disconnected");
        }
    });

    return { playersChannel, boardChannel };
}
