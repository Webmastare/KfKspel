const SUFFIXES = ["", "k", "M", "B", "T", "Qa", "Qi"];

function trimTrailingZeros(value: string): string {
    return value.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/g, "");
}

/**
 * Formats large numbers in a compact, readable way.
 * Examples: 1000 -> 1k, 1500 -> 1.5k, 2500000 -> 2.5M
 */
export function formatCompactNumber(value: number, maxDecimals = 3): string {
    if (!Number.isFinite(value)) return "0";

    const sign = value < 0 ? "-" : "";
    const absValue = Math.abs(value);

    if (absValue < 1000) {
        return `${sign}${trimTrailingZeros(absValue.toFixed(maxDecimals))}`;
    }

    let suffixIndex = 0;
    let scaledValue = absValue;

    while (scaledValue >= 1000 && suffixIndex < SUFFIXES.length - 1) {
        scaledValue /= 1000;
        suffixIndex++;
    }

    const formattedValue = trimTrailingZeros(scaledValue.toFixed(maxDecimals));
    return `${sign}${formattedValue}${SUFFIXES[suffixIndex]}`;
}

/**
 * Formats a duration (seconds) as d/h/m/s.
 */
export function formatDuration(secondsInput: number): string {
    const seconds = Math.max(0, Math.floor(secondsInput));
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    const formatted: string[] = [];
    if (days > 0) formatted.push(`${days}d`);
    if (hrs > 0) formatted.push(`${hrs % 24}h`);
    if (mins > 0) formatted.push(`${mins % 60}m`);
    formatted.push(`${seconds % 60}s`);

    return formatted.join(" ");
}

/**
 * Formats a duration (milliseconds) as d/h/m/s.
 */
export function formatDurationMs(ms: number): string {
    return formatDuration(Math.floor(ms / 1000));
}
