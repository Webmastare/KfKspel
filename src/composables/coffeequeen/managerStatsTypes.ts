// TypeScript interfaces for Coffee Queen manager statistics - simplified version of production stats

import type { ItemKey } from "@/components/coffeequeen/types";

// Manager action bucket that tracks sells/buys in a time period
export interface ManagerActionBucket {
  timestamp: number; // Start time of this bucket (game time in ms)
  itemsSold: number; // Items sold in this bucket
  itemsBought: number; // Items bought in this bucket
  cashGenerated: number; // Cash earned from selling in this bucket
  cashSpent: number; // Cash spent on buying in this bucket
}
// Manager stats manager with two time scales
export interface ManagerStatsManager {
  oneMinute: ManagerActionBucket[]; // 60 buckets (1 minute, 1-second resolution)
  oneHour: ManagerActionBucket[]; // 60 buckets (1 hour, 1-minute resolution)
  currentBucketIndex: {
    oneMinute: number;
    oneHour: number;
  };
  gameTimeMs: number; // Current game time in milliseconds
}

// Chart data structures for manager stats
export interface ManagerChartDataPoint {
  bucketIndex: number; // Index in the bucket array
  timestamp: number; // Timestamp for this data point
  itemsPerMinute: number; // Items sold/bought per minute
  cashPerMinute: number; // Cash generated/spent per minute
  items: number; // Net items (sold - bought) for this bucket
  cash: number; // Net cash (generated - spent) for this bucket
}

export interface ManagerChartSeries {
  name: string;
  color: string;
  data: ManagerChartDataPoint[];
  visible: boolean;
}

export interface ManagerStatsDisplayOptions {
  timeScale: "oneMinute" | "oneHour"; // Which bucket array to use
  chartType: "items" | "cash"; // Show items or cash flow
}

interface ManagerTimeScaleConfig {
  label: string; // Display name (e.g., "1 minute", "1 hour")
  duration: number; // Total duration to show in seconds
  bucketDuration: number; // Duration of each bucket in seconds
  bucketCount: number; // Number of buckets to keep
}

// Manager time scale configurations (simplified)
export const MANAGER_TIME_SCALES: Record<string, ManagerTimeScaleConfig> = {
  oneMinute: {
    label: "1 minute",
    duration: 60,
    bucketDuration: 1, // 1 second resolution
    bucketCount: 60, // 60 buckets
  },
  oneHour: {
    label: "1 hour",
    duration: 3600,
    bucketDuration: 60, // 1 minute resolution
    bucketCount: 60, // 60 buckets
  },
};

// Color palette for manager charts
export const MANAGER_CHART_COLORS = {
  itemsSold: "#28a745", // Green for sales
  itemsBought: "#dc3545", // Red for purchases
  cashGenerated: "#ffc107", // Yellow/gold for money earned
  cashSpent: "#6c757d", // Gray for money spent
};
