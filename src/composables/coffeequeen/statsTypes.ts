// TypeScript interfaces for Coffee Queen production statistics - Factorio-style bucket system

import type { ItemKey } from '@/components/coffeequeen/types'

// Simple bucket that tracks items produced in a time period
export interface ProductionBucket {
  timestamp: number                    // Start time of this bucket (game time in ms)
  items: Record<ItemKey, number>      // Regular items produced in this bucket
  bonusItems: Record<ItemKey, number> // Bonus items produced in this bucket (from efficiency upgrades)
}

// Time scale configuration for different views
export interface TimeScaleConfig {
  label: string          // Display name (e.g., "10 seconds", "1 minute")
  duration: number       // Total duration to show in seconds
  bucketDuration: number // Duration of each bucket in seconds (always 1 second for now)
  bucketCount: number    // Number of buckets to keep
}

// Main stats manager with different time scales
export interface StatsManager {
  // Game time tracking
  gameTimeMs: number                  // Current game time in milliseconds
  currentBucketIndex: number          // Current position in the circular buffer
  
  // Factorio-style time scales (all use 1-second buckets)
  tenSeconds: ProductionBucket[]      // 10 buckets (10 seconds)
  oneMinute: ProductionBucket[]       // 60 buckets (1 minute)
  tenMinutes: ProductionBucket[]      // 600 buckets (10 minutes)
  oneHour: ProductionBucket[]         // 3600 buckets (1 hour)
  tenHours: ProductionBucket[]        // 36000 buckets (10 hours)
  hundredHours: ProductionBucket[]    // 360000 buckets (100 hours)
  allTime: ProductionBucket[]         // Unlimited buckets (all time)
  
  lastSaveTime: number               // Last time stats were saved to localStorage
}

// Chart data structures remain similar but simplified
export interface ChartDataPoint {
  bucketIndex: number    // Index in the bucket array
  timestamp: number      // Timestamp for this data point
  itemsPerMinute: number // Items produced per minute
}

export interface ChartSeries {
  itemKey: ItemKey
  name: string
  icon: string
  color: string
  data: ChartDataPoint[]
  visible: boolean
}

export interface StatsDisplayOptions {
  timeScale: keyof StatsManager     // Which bucket array to use
  viewType: 'rate' | 'cumulative'   // Show rate or accumulated totals
  selectedItems: Set<ItemKey>       // Which items to display
}

// Chart configuration for D3.js charts
export interface ChartConfig {
  width: number
  height: number
  showBonusItems?: boolean
}

// Factorio-style time scale configurations  
// OPTIMIZED: Variable bucket durations for different time scales
export const TIME_SCALES: Record<string, TimeScaleConfig> = {
  tenSeconds: {
    label: '10 seconds',
    duration: 10,
    bucketDuration: 1,        // 1 second resolution
    bucketCount: 11           // 10 buckets
  },
  oneMinute: {
    label: '1 minute', 
    duration: 60,
    bucketDuration: 2,        // 2 second resolution  
    bucketCount: 31           // 30 buckets (was 60)
  },
  tenMinutes: {
    label: '10 minutes',
    duration: 600,
    bucketDuration: 10,       // 10 second resolution
    bucketCount: 61           // 60 buckets (was 600)
  },
  oneHour: {
    label: '1 hour',
    duration: 3600,
    bucketDuration: 60,       // 1 minute resolution
    bucketCount: 61           // 60 buckets (was 3600)
  },
  tenHours: {
    label: '10 hours',
    duration: 36000,
    bucketDuration: 600,      // 10 minute resolution
    bucketCount: 61           // 60 buckets (was 36000)
  },
  hundredHours: {
    label: '100 hours',
    duration: 360000,
    bucketDuration: 6000,     // 100 minute (1.67 hour) resolution
    bucketCount: 61           // 60 buckets (was 360000)
  },
  allTime: {
    label: 'All time',
    duration: Infinity,
    bucketDuration: 3600,     // 1 hour resolution for all-time
    bucketCount: Infinity     // Grows as needed
  }
}

// Color palette for different items in charts
export const ITEM_COLORS: Record<ItemKey, string> = {
  rawCoffeeBeans: '#8B4513',       // Brown
  roastedCoffeeBeans: '#654321',   // Dark brown
  groundCoffee: '#3E2723',         // Very dark brown
  brewedCoffee: '#2E1919',         // Near black
  espresso: '#1A1A1A',             // Black
  latte: '#F5E6D3'                 // Cream
}