import { supabase } from "@/utils/supabase";
import type { Player } from "@/composables/kfkbandvagn/player";
import type { GameBoard } from "@/composables/kfkbandvagn/board";

export type GameStateClientResponse = {
    playerData: Player[];
    boardData: GameBoard | null;
};

// Enhanced status for the new adaptive polling system
export type RealtimeStatus =
    | "disconnected" // polling stopped or page hidden
    | "connecting" // starting polling
    | "fast" // 1000ms interval (green)
    | "medium" // 3000ms interval (yellow-green to yellow)
    | "slow" // 10000ms interval (orange)
    | "error" // polling failed (red)
    | "inactive"; // page inactive/background (red)
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

// --- Adaptive polling implementation ---
let pollTimeoutId: number | null = null;
let visibilityHandler: ((this: Document, ev: Event) => any) | null = null;
let lastUpdateTimestamp: string | null = null;
let lastDatabaseUpdate: Date | null = null;
let lastUserInteraction: Date | null = null;
let currentRefreshRate: number = 1000;
let isInitialized = false;

// Enhanced polling options
export interface AdaptivePollingOptions {
    onStatusChange?: (status: RealtimeStatus, interval: number) => void;
    onBoardUpdate: (board: GameBoard) => void;
    onPlayersUpdate?: (players: Player[]) => void;
}

/** Calculate optimal polling interval based on database activity and user activity */
function calculateOptimalInterval(): number {
    const now = Date.now();

    // Database activity intervals
    let dbBasedInterval = 10000; // default: slow
    if (lastDatabaseUpdate) {
        const dbAge = now - lastDatabaseUpdate.getTime();
        if (dbAge < 10000) { // < 10 seconds
            dbBasedInterval = 1000;
        } else if (dbAge < 60000) { // 10-60 seconds
            dbBasedInterval = 3000;
        } else { // > 60 seconds
            dbBasedInterval = 10000;
        }
    }

    // User activity overrides
    if (lastUserInteraction) {
        const userIdleTime = now - lastUserInteraction.getTime();

        // Active viewing (panning/zooming) = 1000ms
        if (userIdleTime < 1000) {
            return 1000;
        }

        // Recently active (< 15 seconds) = use database-based interval but min 1000ms
        if (userIdleTime < 15000) {
            return Math.min(dbBasedInterval, 1000);
        }

        // Idle 15s-2min = 3000ms
        if (userIdleTime < 120000) {
            return 3000;
        }

        // Idle > 2min = 10000ms
        return 10000;
    }

    return dbBasedInterval;
}

// Get status based on current interval
function getStatusFromInterval(interval: number): RealtimeStatus {
    if (interval <= 1000) return "fast";
    if (interval <= 3000) return "medium";
    return "slow";
}

export function startPolling(options: AdaptivePollingOptions) {
    const {
        onStatusChange,
        onBoardUpdate,
        onPlayersUpdate,
    } = options;

    stopPolling(); // ensure clean start
    isInitialized = false;

    const isVisible = () =>
        typeof document !== "undefined" ? !document.hidden : true;

    const scheduleNextTick = (intervalMs: number) => {
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId);
        }

        currentRefreshRate = intervalMs;
        const status = getStatusFromInterval(intervalMs);
        onStatusChange?.(status, intervalMs);

        pollTimeoutId = window.setTimeout(tick, intervalMs);
    };

    const tick = async () => {
        try {
            if (!isVisible()) {
                // Page hidden, stop polling completely
                onStatusChange?.("inactive", 0);
                return;
            }

            // Check for database updates
            const currentLastUpdate = await fetchLastUpdate();

            // Update last database activity if there were changes
            if (
                currentLastUpdate && currentLastUpdate !== lastUpdateTimestamp
            ) {
                lastDatabaseUpdate = new Date();
                lastUpdateTimestamp = currentLastUpdate;

                console.log("Database update detected, fetching full data...");

                // Fetch full data when changes detected
                const [board, players] = await Promise.all([
                    fetchActiveBoard(),
                    onPlayersUpdate ? fetchAllPlayers() : Promise.resolve(null),
                ]);

                if (board) {
                    onBoardUpdate(board);
                }

                if (onPlayersUpdate && players) {
                    onPlayersUpdate(players);
                }
            } else {
                console.log(
                    "No database changes detected, timestamp check only",
                );
            }

            // Set initial database update time on first successful poll
            if (!isInitialized) {
                if (!lastDatabaseUpdate && currentLastUpdate) {
                    // If we have a timestamp but no recorded update time, assume it's recent
                    lastDatabaseUpdate = new Date();
                }
                isInitialized = true;
            }

            // Calculate next interval and schedule next tick
            const nextInterval = calculateOptimalInterval();
            scheduleNextTick(nextInterval);
        } catch (err) {
            console.error("Polling tick failed:", err);
            onStatusChange?.("error", currentRefreshRate);
            // Retry with current interval on error
            scheduleNextTick(currentRefreshRate);
        }
    };

    // Visibility management
    if (typeof document !== "undefined") {
        visibilityHandler = () => {
            if (document.hidden) {
                console.log("Page hidden, stopping polling");
                if (pollTimeoutId) {
                    clearTimeout(pollTimeoutId);
                    pollTimeoutId = null;
                }
                onStatusChange?.("inactive", 0);
            } else {
                console.log("Page visible, resuming with immediate update");
                // Immediate update when page becomes visible
                recordUserActivity();
                void tick();
            }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
    }

    // Start with immediate tick if visible
    if (isVisible()) {
        onStatusChange?.("connecting", 1000);
        recordUserActivity(); // Initial user activity
        void tick();
    }

    return stopPolling;
}

export function stopPolling() {
    if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
    }
    if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
        visibilityHandler = null;
    }
    lastUpdateTimestamp = null;
    lastDatabaseUpdate = null;
    lastUserInteraction = null;
    currentRefreshRate = 1000;
    isInitialized = false;
}

// Record user activity (call this from UI interactions)
export function recordUserActivity() {
    lastUserInteraction = new Date();
    console.log("User activity recorded");
}

// Trigger immediate poll after user action
export function triggerImmediatePoll() {
    recordUserActivity();
    // Force immediate poll by clearing current timeout and resetting timestamp
    if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
    }
    lastUpdateTimestamp = null; // Force data fetch on next tick
}

// Force next poll to fetch full data (useful for debugging or manual refresh)
export function forceFullRefresh() {
    lastUpdateTimestamp = null;
}

// Get current polling status info (for debugging/UI)
export function getPollingInfo() {
    return {
        lastDatabaseUpdate,
        lastUserInteraction,
        currentRefreshRate,
        isInitialized,
        isActive: pollTimeoutId !== null,
    };
}
