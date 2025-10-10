import { supabase } from "@/utils/supabase";
import type { Player } from "@/composables/kfkbandvagn/player";
import type { GameBoard } from "@/composables/kfkbandvagn/board";

export type GameStateClientResponse = {
    playerData: Player[];
    boardData: GameBoard | null;
};

// Status used by UI indicator (repurposed from "realtime")
export type RealtimeStatus =
    | "disconnected" // polling stopped or page hidden
    | "connecting" // starting polling
    | "connected" // actively polling (last tick ok)
    | "error"; // last tick failed
/**
 * Fetch game state from client side
 */
export async function fetchGameStateClient(): Promise<GameStateClientResponse> {
    const [players, board] = await Promise.all([
        fetchAllPlayers(),
        fetchActiveBoard(),
    ]);
    return {
        playerData: players,
        boardData: board,
    };
}

export async function fetchAllPlayers(): Promise<Player[]> {
    const { data, error } = await supabase
        .from("KfKbandvagn")
        .select(
            "playerID, taken_tank, uuid, tokens, position, lives, range, color",
        );
    if (error) throw error;
    return (data || []) as Player[];
}

export async function fetchActiveBoard(): Promise<GameBoard | null> {
    const { data, error } = await supabase
        .from("KfKbandvagnBoard")
        .select("*")
        .eq("active_board", true)
        .maybeSingle();
    if (error) throw error;
    return (data || null) as GameBoard | null;
}

// Lightweight function to check only the last_update timestamp
export async function fetchLastUpdate(): Promise<string | null> {
    const { data, error } = await supabase
        .from("KfKbandvagnBoard")
        .select("last_update")
        .eq("active_board", true)
        .maybeSingle();
    if (error) throw error;
    return data?.last_update || null;
}

// --- Visibility-aware polling implementation ---
let pollIntervalId: number | null = null;
let visibilityHandler: ((this: Document, ev: Event) => any) | null = null;
let lastUpdateTimestamp: string | null = null;

export function startPolling(options: {
    intervalMs?: number; // default 1000
    onStatusChange?: (status: RealtimeStatus) => void;
    onBoardUpdate: (board: GameBoard) => void;
    onPlayersUpdate?: (players: Player[]) => void;
}) {
    const {
        intervalMs = 1000,
        onStatusChange,
        onBoardUpdate,
        onPlayersUpdate,
    } = options;

    stopPolling(); // ensure clean start

    const isVisible = () =>
        typeof document !== "undefined" ? !document.hidden : true;

    const tick = async () => {
        try {
            if (!isVisible()) {
                // Pause while hidden
                onStatusChange?.("disconnected");
                return;
            }
            onStatusChange?.("connected");

            // First, check if there are any updates by comparing timestamps
            const currentLastUpdate = await fetchLastUpdate();

            // If no changes detected and this isn't the first run, skip the expensive fetch
            if (
                currentLastUpdate && currentLastUpdate === lastUpdateTimestamp
            ) {
                console.log("No data changes detected, skipping full fetch");
                return;
            }

            console.log(
                `Data changed: ${lastUpdateTimestamp} -> ${currentLastUpdate}. Fetching full data...`,
            );

            // Update detected, fetch full data
            lastUpdateTimestamp = currentLastUpdate;

            const [board, players] = await Promise.all([
                fetchActiveBoard(),
                onPlayersUpdate ? fetchAllPlayers() : Promise.resolve(null),
            ]);

            if (!board) return;

            // Always forward board updates so timers like next_shrink stay fresh
            onBoardUpdate(board);

            // Update players if callback provided
            if (onPlayersUpdate && players) {
                onPlayersUpdate(players);
            }
        } catch (err) {
            console.error("Polling tick failed:", err);
            onStatusChange?.("error");
        }
    };

    const startInterval = () => {
        if (pollIntervalId) return;
        onStatusChange?.("connecting");
        // run immediately to reduce perceived latency
        void tick();
        pollIntervalId = window.setInterval(tick, Math.max(250, intervalMs));
    };

    const stopInterval = () => {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
    };

    // Visibility management
    if (typeof document !== "undefined") {
        visibilityHandler = () => {
            if (document.hidden) {
                console.log("Page hidden, pausing polling");
                stopInterval();
                onStatusChange?.("disconnected");
            } else {
                console.log("Page visible, resuming polling");
                startInterval();
            }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
    }

    // Start now if visible
    if (isVisible()) startInterval();

    // Return stopper
    return stopPolling;
}

export function stopPolling() {
    if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
    }
    if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
        visibilityHandler = null;
    }
    lastUpdateTimestamp = null;
}

// Force next poll to fetch full data (useful for debugging or manual refresh)
export function forceFullRefresh() {
    lastUpdateTimestamp = null;
}
