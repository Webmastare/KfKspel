/**
 * Utility functions for chart formatting and display
 */

/**
 * Format relative time for chart axis labels
 * @param secondsAgo Number of seconds ago
 * @param maxDuration Maximum duration for this time scale in seconds
 * @returns Formatted time string
 */
export function formatRelativeTime(secondsAgo: number, maxDuration: number): string {
  if (secondsAgo === 0) return 'Now'
  
  // For very short durations, show seconds
  if (maxDuration <= 60) {
    return secondsAgo === 1 ? '1s ago' : `${secondsAgo}s ago`
  }
  
  // For medium durations, show in minutes and seconds
  if (maxDuration <= 3600) {
    if (secondsAgo < 60) {
      return `${secondsAgo}s`
    } else {
      const minutes = Math.floor(secondsAgo / 60)
      const seconds = secondsAgo % 60
      return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`
    }
  }
  
  // For long durations, show in hours and minutes
  if (maxDuration <= 36000) {
    if (secondsAgo < 60) {
      return `${secondsAgo}s`
    } else if (secondsAgo < 3600) {
      const minutes = Math.floor(secondsAgo / 60)
      return `${minutes}m`
    } else {
      const hours = Math.floor(secondsAgo / 3600)
      const minutes = Math.floor((secondsAgo % 3600) / 60)
      return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`
    }
  }
  
  // For very long durations, show in days/hours
  if (secondsAgo < 3600) {
    const minutes = Math.floor(secondsAgo / 60)
    return `${minutes}m`
  } else if (secondsAgo < 86400) {
    const hours = Math.floor(secondsAgo / 3600)
    return `${hours}h`
  } else {
    const days = Math.floor(secondsAgo / 86400)
    const hours = Math.floor((secondsAgo % 86400) / 3600)
    return hours === 0 ? `${days}d` : `${days}d${hours}h`
  }
}