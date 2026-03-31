import type { SpeedupBufferState } from "./types";

export const DEFAULT_SPEEDUP_BUFFER_MAX_SECONDS = 30 * 60;
export const DEFAULT_SPEEDUP_BUFFER_ONLINE_REFILL_INTERVAL_SECONDS = 5;
export const DEFAULT_SPEEDUP_BUFFER_OFFLINE_REFILL_INTERVAL_SECONDS = 20;
export const DEFAULT_SPEEDUP_BUFFER_CONSUME_SECONDS = 5 * 60;

export function createDefaultSpeedupBufferState(): SpeedupBufferState {
    return {
        currentSeconds: DEFAULT_SPEEDUP_BUFFER_MAX_SECONDS,
        maxSeconds: DEFAULT_SPEEDUP_BUFFER_MAX_SECONDS,
        onlineRefillIntervalSeconds:
            DEFAULT_SPEEDUP_BUFFER_ONLINE_REFILL_INTERVAL_SECONDS,
        offlineRefillIntervalSeconds:
            DEFAULT_SPEEDUP_BUFFER_OFFLINE_REFILL_INTERVAL_SECONDS,
    };
}

export function clampSpeedupBuffer(
    state: SpeedupBufferState,
): SpeedupBufferState {
    const maxSeconds = Math.max(
        0,
        state.maxSeconds || DEFAULT_SPEEDUP_BUFFER_MAX_SECONDS,
    );
    const onlineRefillIntervalSeconds = Math.max(
        0.1,
        state.onlineRefillIntervalSeconds ||
            DEFAULT_SPEEDUP_BUFFER_ONLINE_REFILL_INTERVAL_SECONDS,
    );
    const offlineRefillIntervalSeconds = Math.max(
        0.1,
        state.offlineRefillIntervalSeconds ||
            DEFAULT_SPEEDUP_BUFFER_OFFLINE_REFILL_INTERVAL_SECONDS,
    );

    return {
        currentSeconds: Math.max(
            0,
            Math.min(maxSeconds, state.currentSeconds || 0),
        ),
        maxSeconds,
        onlineRefillIntervalSeconds,
        offlineRefillIntervalSeconds,
    };
}

export function refillSpeedupBuffer(
    state: SpeedupBufferState,
    elapsedSeconds: number,
    refillIntervalSeconds: number,
): { nextState: SpeedupBufferState; addedSeconds: number } {
    if (
        elapsedSeconds <= 0 || refillIntervalSeconds <= 0 ||
        state.currentSeconds >= state.maxSeconds
    ) {
        return { nextState: state, addedSeconds: 0 };
    }

    const potentialAdded = elapsedSeconds / refillIntervalSeconds;
    const actualAdded = Math.min(
        potentialAdded,
        state.maxSeconds - state.currentSeconds,
    );

    return {
        nextState: {
            ...state,
            currentSeconds: state.currentSeconds + actualAdded,
        },
        addedSeconds: actualAdded,
    };
}
