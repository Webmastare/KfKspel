// Manager statistics manager for tracking sales manager performance

import { ref } from "vue";
import type { ItemKey, SalesManager } from "@/components/coffeequeen/types";
import type { ManagerChartDataPoint } from "./managerStatsTypes";
import { MANAGER_TIME_SCALES } from "./managerStatsTypes";

// Manager stats recording functions
let gameStartTime = Date.now();

// Initialize timeseries for a sales manager
export function initializeManagerTimeseries(manager: SalesManager): void {
  // Always initialize (removing the incorrect condition)
  const now = Date.now();

  manager.statistics.timeseries = {
    oneMinute: [],
    oneHour: [],
    currentBucketIndex: {
      oneMinute: 0,
      oneHour: 0,
    },
    gameTimeMs: now,
  };

  // Initialize buckets for both time scales
  const oneMinuteConfig = MANAGER_TIME_SCALES.oneMinute;
  const oneHourConfig = MANAGER_TIME_SCALES.oneHour;

  if (oneMinuteConfig) {
    for (let i = 0; i < oneMinuteConfig.bucketCount; i++) {
      manager.statistics.timeseries.oneMinute.push({
        timestamp: now -
          (oneMinuteConfig.bucketCount - 1 - i) *
            oneMinuteConfig.bucketDuration * 1000,
        itemsSold: 0,
        itemsBought: 0,
        cashGenerated: 0,
        cashSpent: 0,
      });
    }
    // Set the current index to the last (newest) bucket
    manager.statistics.timeseries.currentBucketIndex.oneMinute =
      oneMinuteConfig.bucketCount - 1;
  }

  if (oneHourConfig) {
    for (let i = 0; i < oneHourConfig.bucketCount; i++) {
      manager.statistics.timeseries.oneHour.push({
        timestamp: now -
          (oneHourConfig.bucketCount - 1 - i) * oneHourConfig.bucketDuration *
            1000,
        itemsSold: 0,
        itemsBought: 0,
        cashGenerated: 0,
        cashSpent: 0,
      });
    }
    // Set the current index to the last (newest) bucket
    manager.statistics.timeseries.currentBucketIndex.oneHour =
      oneHourConfig.bucketCount - 1;
  }
}

// Record a sell action for a manager
export function recordManagerSellAction(
  manager: SalesManager,
  itemsSold: number,
  cashGenerated: number,
): void {
  if (!manager.statistics.timeseries) {
    initializeManagerTimeseries(manager);
  }

  const timeseries = manager.statistics.timeseries!;
  const now = Date.now();

  // Update buckets for both time scales
  timeseries.currentBucketIndex.oneMinute = updateManagerBucket(
    timeseries.oneMinute,
    timeseries.currentBucketIndex.oneMinute,
    now,
    1000,
    { itemsSold, cashGenerated, itemsBought: 0, cashSpent: 0 },
  );

  timeseries.currentBucketIndex.oneHour = updateManagerBucket(
    timeseries.oneHour,
    timeseries.currentBucketIndex.oneHour,
    now,
    60000,
    { itemsSold, cashGenerated, itemsBought: 0, cashSpent: 0 },
  );

  timeseries.gameTimeMs = now;
}

// Record a buy action for a manager
export function recordManagerBuyAction(
  manager: SalesManager,
  itemsBought: number,
  cashSpent: number,
): void {
  if (!manager.statistics.timeseries) {
    initializeManagerTimeseries(manager);
  }

  const timeseries = manager.statistics.timeseries!;
  const now = Date.now();

  // Update buckets for both time scales
  timeseries.currentBucketIndex.oneMinute = updateManagerBucket(
    timeseries.oneMinute,
    timeseries.currentBucketIndex.oneMinute,
    now,
    1000,
    { itemsSold: 0, cashGenerated: 0, itemsBought, cashSpent },
  );

  timeseries.currentBucketIndex.oneHour = updateManagerBucket(
    timeseries.oneHour,
    timeseries.currentBucketIndex.oneHour,
    now,
    60000,
    { itemsSold: 0, cashGenerated: 0, itemsBought, cashSpent },
  );

  timeseries.gameTimeMs = now;
}

// Helper function to update a bucket array
function updateManagerBucket(
  buckets: any[],
  currentIndex: number,
  currentTime: number,
  bucketDurationMs: number,
  data: {
    itemsSold: number;
    itemsBought: number;
    cashGenerated: number;
    cashSpent: number;
  },
): number {
  // Validate current index
  if (currentIndex < 0 || currentIndex >= buckets.length) {
    currentIndex = buckets.length - 1; // Default to last bucket
  }

  const currentBucket = buckets[currentIndex];
  if (!currentBucket) return currentIndex;

  // Check if we need to advance to next bucket based on time
  const timeSinceCurrentBucket = currentTime - currentBucket.timestamp;

  if (timeSinceCurrentBucket >= bucketDurationMs) {
    // Calculate how many buckets we need to advance
    const bucketsToAdvance = Math.min(
      Math.floor(timeSinceCurrentBucket / bucketDurationMs),
      buckets.length,
    );

    // Advance buckets and clear them
    for (let i = 0; i < bucketsToAdvance; i++) {
      currentIndex = (currentIndex + 1) % buckets.length;

      // Set the new bucket with proper timestamp
      buckets[currentIndex] = {
        timestamp: currentBucket.timestamp + (i + 1) * bucketDurationMs,
        itemsSold: 0,
        itemsBought: 0,
        cashGenerated: 0,
        cashSpent: 0,
      };
    }
  }

  // Add data to current bucket
  const targetBucket = buckets[currentIndex];
  if (targetBucket) {
    targetBucket.itemsSold += data.itemsSold;
    targetBucket.itemsBought += data.itemsBought;
    targetBucket.cashGenerated += data.cashGenerated;
    targetBucket.cashSpent += data.cashSpent;
  }

  return currentIndex;
}

// Get chart data for a manager's performance
export function getManagerChartData(
  manager: SalesManager,
  timeScale: "oneMinute" | "oneHour",
  chartType: "items" | "cash",
): ManagerChartDataPoint[] {
  if (!manager.statistics.timeseries) {
    return [];
  }

  const buckets = manager.statistics.timeseries[timeScale];
  const timeScaleConfig = MANAGER_TIME_SCALES[timeScale];

  if (!timeScaleConfig) {
    return [];
  }

  // Convert buckets to data points with proper rate calculation
  const dataPoints = buckets.map((bucket, index) => {
    let itemsPerMinute = 0;
    let netItems = 0;
    let cashPerMinute = 0;
    let netCash = 0;

    if (chartType === "items") {
      // For items, show net flow (sold - bought) per minute
      netItems = bucket.itemsSold - bucket.itemsBought;
      itemsPerMinute = (netItems * 60) / timeScaleConfig.bucketDuration;
    } else {
      // For cash, show net flow (generated - spent) per minute
      netCash = bucket.cashGenerated - bucket.cashSpent;
      cashPerMinute = (netCash * 60) / timeScaleConfig.bucketDuration;
    }

    return {
      bucketIndex: index,
      timestamp: bucket.timestamp,
      itemsPerMinute,
      cashPerMinute,
      items: netItems,
      cash: netCash,
    };
  });

  // Sort by timestamp to ensure chronological order (fixes circular buffer display issue)
  return dataPoints
    .filter((point) => point.timestamp > 0) // Filter out invalid timestamps
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Get summary statistics for a manager over a time period
export function getManagerSummaryStats(
  manager: SalesManager,
  timeScale: "oneMinute" | "oneHour",
): {
  totalItemsSold: number;
  totalItemsBought: number;
  totalCashGenerated: number;
  totalCashSpent: number;
  netItems: number;
  netCash: number;
} {
  if (!manager.statistics.timeseries) {
    return {
      totalItemsSold: 0,
      totalItemsBought: 0,
      totalCashGenerated: 0,
      totalCashSpent: 0,
      netItems: 0,
      netCash: 0,
    };
  }

  const buckets = manager.statistics.timeseries[timeScale];

  let totalItemsSold = 0;
  let totalItemsBought = 0;
  let totalCashGenerated = 0;
  let totalCashSpent = 0;

  for (const bucket of buckets) {
    totalItemsSold += bucket.itemsSold;
    totalItemsBought += bucket.itemsBought;
    totalCashGenerated += bucket.cashGenerated;
    totalCashSpent += bucket.cashSpent;
  }

  return {
    totalItemsSold,
    totalItemsBought,
    totalCashGenerated,
    totalCashSpent,
    netItems: totalItemsSold - totalItemsBought,
    netCash: totalCashGenerated - totalCashSpent,
  };
}
