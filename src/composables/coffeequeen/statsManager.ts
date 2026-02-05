// Factorio-style Production Statistics Manager for Coffee Queen
import { ref, computed } from 'vue'
import type { ItemKey } from '@/components/coffeequeen/types'
import type { 
  StatsManager, 
  ProductionBucket,
  ChartDataPoint,
} from './statsTypes'
import { TIME_SCALES } from './statsTypes'

// Utility function to format timestamp for logging
function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return 'none'
  const date = new Date(timestamp)
  const timeStr = date.toLocaleTimeString('sv-SE', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  })
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${timeStr}.${ms}`
}

// Create an empty production bucket
function createEmptyBucket(timestamp: number): ProductionBucket {
  return {
    timestamp,
    items: {} as Record<ItemKey, number>,
    bonusItems: {} as Record<ItemKey, number>
  }
}

// Global stats manager instance
const statsManager = ref<StatsManager>({
  gameTimeMs: Date.now(),
  currentBucketIndex: 0,
  tenSeconds: [],
  oneMinute: [],
  tenMinutes: [],
  oneHour: [],
  tenHours: [],
  hundredHours: [],
  allTime: [],
  lastSaveTime: Date.now()
})

// Reference to the user object for integrated saving
let userRef: any = null

export function setUserReference(user: any) {
  userRef = user
  console.log('🔗 User reference set in statsManager')
}

/**
 * Advance buckets when game time progresses 
 */
export function updateProductionBuckets(currentTimeMs: number) {
  const prevTime = statsManager.value.gameTimeMs
  const timeDiff = currentTimeMs - prevTime
  
  // Only update if at least 500ms have passed
  if (timeDiff < 500) return
  
  statsManager.value.gameTimeMs = currentTimeMs

  // Check which time scales need advancement based on their bucket durations
  const timeScales = ['tenSeconds', 'oneMinute', 'tenMinutes', 'oneHour', 'tenHours', 'hundredHours'] as const
  
  for (const timeScaleName of timeScales) {
    const config = TIME_SCALES[timeScaleName]
    if (!config) continue
    
    const bucketDurationMs = config.bucketDuration * 1000
    const prevBucketTimestamp = statsManager.value[timeScaleName][statsManager.value[timeScaleName].length - 1]?.timestamp || 0
    const prevBucketIndex = Math.floor(prevBucketTimestamp / bucketDurationMs)
    const newBucketIndex = Math.floor(currentTimeMs / bucketDurationMs)
    
    // Only advance this time scale if its bucket boundary was crossed
    if (newBucketIndex > prevBucketIndex) {
      advanceTimeScaleBuckets(timeScaleName, newBucketIndex, bucketDurationMs)
    }
  }
  
  // Handle all-time separately (1 hour buckets)
  const allTimeBucketDurationMs = 3600 * 1000 // 1 hour
  const prevAllTimeBucket = Math.floor(prevTime / allTimeBucketDurationMs)
  const newAllTimeBucket = Math.floor(currentTimeMs / allTimeBucketDurationMs)
  
  if (newAllTimeBucket > prevAllTimeBucket) {
    const bucketTimestamp = newAllTimeBucket * allTimeBucketDurationMs
    statsManager.value.allTime.push(createEmptyBucket(bucketTimestamp))
  }
}

/**
 * Advance buckets for a specific time scale
 */
function advanceTimeScaleBuckets(timeScaleName: keyof StatsManager, bucketIndex: number, bucketDurationMs: number) {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  const config = TIME_SCALES[timeScaleName]
  
  if (!config) return
  
  const bucketTimestamp = bucketIndex * bucketDurationMs
  
  // Check if we already have this bucket to prevent duplicates
  const lastBucket = buckets[buckets.length - 1]
  if (lastBucket && lastBucket.timestamp === bucketTimestamp) {
    return // Already have this bucket
  }
  
  // Add new bucket
  if (config.bucketCount === Infinity) {
    buckets.push(createEmptyBucket(bucketTimestamp))
  } else {
    // Maintain fixed size circular buffer more efficiently
    if (buckets.length >= config.bucketCount) {
      buckets.splice(0, buckets.length - config.bucketCount + 1)
    }
    buckets.push(createEmptyBucket(bucketTimestamp))
  }
}

/**
 * Record production event - add to appropriate buckets for all time scales
 * SUPER OPTIMIZED: Ensure current buckets exist before recording
 */
export function recordProduction(itemKey: ItemKey, amount: number) {
  const currentTime = statsManager.value.gameTimeMs
  
  // Ensure all time scales have current buckets before recording
  ensureCurrentBuckets(currentTime)
  
  // Use array for more efficient iteration
  const bucketArrays = [
    statsManager.value.tenSeconds,
    statsManager.value.oneMinute,
    statsManager.value.tenMinutes,
    statsManager.value.oneHour,
    statsManager.value.tenHours,
    statsManager.value.hundredHours,
    statsManager.value.allTime
  ]
  
  // Add to all time scales' current buckets efficiently
  for (const buckets of bucketArrays) {
    addToBucket(buckets, itemKey, amount)
  }

  // Debug logging (can be removed in production)
  // console.log(`📦 PRODUCTION: ${itemKey} +${amount}`)
}

/**
 * Record bonus production event from efficiency upgrades - add to appropriate buckets for all time scales
 * SUPER OPTIMIZED: Ensure current buckets exist before recording
 */
export function recordBonusProduction(itemKey: ItemKey, amount: number) {
  const currentTime = statsManager.value.gameTimeMs
  
  // Ensure all time scales have current buckets before recording
  ensureCurrentBuckets(currentTime)
  
  // Use array for more efficient iteration
  const bucketArrays = [
    statsManager.value.tenSeconds,
    statsManager.value.oneMinute,
    statsManager.value.tenMinutes,
    statsManager.value.oneHour,
    statsManager.value.tenHours,
    statsManager.value.hundredHours,
    statsManager.value.allTime
  ]
  
  // Add to all time scales' current buckets efficiently
  for (const buckets of bucketArrays) {
    addBonusItemsToBucket(buckets, itemKey, amount)
  }

  // Debug logging (can be removed in production)
  // console.log(`🌟 BONUS PRODUCTION: ${itemKey} +${amount}`)
}

/**
 * Ensure all time scales have appropriate current buckets for the given time
 */
function ensureCurrentBuckets(currentTimeMs: number) {
  const timeScales = ['tenSeconds', 'oneMinute', 'tenMinutes', 'oneHour', 'tenHours', 'hundredHours'] as const
  
  for (const timeScaleName of timeScales) {
    const config = TIME_SCALES[timeScaleName]
    if (!config) continue
    
    const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
    const bucketDurationMs = config.bucketDuration * 1000
    const expectedBucketIndex = Math.floor(currentTimeMs / bucketDurationMs)
    const expectedTimestamp = expectedBucketIndex * bucketDurationMs
    
    // Check if we have a current bucket for this time
    const lastBucket = buckets[buckets.length - 1]
    if (!lastBucket || lastBucket.timestamp !== expectedTimestamp) {
      // Add the missing current bucket
      if (config.bucketCount === Infinity) {
        buckets.push(createEmptyBucket(expectedTimestamp))
      } else {
        if (buckets.length >= config.bucketCount) {
          buckets.splice(0, buckets.length - config.bucketCount + 1)
        }
        buckets.push(createEmptyBucket(expectedTimestamp))
      }
    }
  }
  
  // Handle all-time separately
  const allTimeBucketDurationMs = 3600 * 1000 // 1 hour
  const expectedAllTimeIndex = Math.floor(currentTimeMs / allTimeBucketDurationMs)
  const expectedAllTimeTimestamp = expectedAllTimeIndex * allTimeBucketDurationMs
  
  const allTime = statsManager.value.allTime
  const lastAllTimeBucket = allTime[allTime.length - 1]
  if (!lastAllTimeBucket || lastAllTimeBucket.timestamp !== expectedAllTimeTimestamp) {
    allTime.push(createEmptyBucket(expectedAllTimeTimestamp))
  }
}

/**
 * Add regular items to the current (latest) bucket in an array
 */
function addToBucket(buckets: ProductionBucket[], itemKey: ItemKey, amount: number) {
  if (buckets.length === 0) return
  
  const currentBucket = buckets[buckets.length - 1] // Latest bucket
  if (!currentBucket) return // Safety check
  
  currentBucket.items[itemKey] = (currentBucket.items[itemKey] || 0) + amount
}

/**
 * Add bonus items to the current (latest) bucket in an array
 */
function addBonusItemsToBucket(buckets: ProductionBucket[], itemKey: ItemKey, amount: number) {
  if (buckets.length === 0) return
  
  const currentBucket = buckets[buckets.length - 1] // Latest bucket
  if (!currentBucket) return // Safety check
  
  currentBucket.bonusItems[itemKey] = (currentBucket.bonusItems[itemKey] || 0) + amount
}

/**
 * Get items per minute for a specific item over a time scale
 * SUPER OPTIMIZED: Account for variable bucket durations
 */
export function getItemsPerMinute(itemKey: ItemKey, timeScaleName: keyof StatsManager, includeBonus: boolean = true): number {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return 0
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  const config = TIME_SCALES[timeScaleName]
  
  if (!config || buckets.length === 0) return 0
  
  let total = 0
  const bucketsToCheck = Math.min(buckets.length, config.bucketCount, 60) // Cap at 60 for performance
  
  // Sum up items from recent buckets
  for (let i = Math.max(0, buckets.length - bucketsToCheck); i < buckets.length; i++) {
    const bucket = buckets[i]
    if (bucket?.items[itemKey]) {
      total += bucket.items[itemKey]
    }
    if (includeBonus && bucket?.bonusItems[itemKey]) {
      total += bucket.bonusItems[itemKey]
    }
  }
  
  // Convert to items per minute accounting for variable bucket duration
  const totalTimeSeconds = bucketsToCheck * config.bucketDuration
  return totalTimeSeconds === 0 ? 0 : (total / totalTimeSeconds) * 60
}

/**
 * Get bonus items per minute for a specific item over a time scale
 * SUPER OPTIMIZED: Account for variable bucket durations
 */
export function getBonusItemsPerMinute(itemKey: ItemKey, timeScaleName: keyof StatsManager): number {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return 0
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  const config = TIME_SCALES[timeScaleName]
  
  if (!config || buckets.length === 0) return 0
  
  let total = 0
  const bucketsToCheck = Math.min(buckets.length, config.bucketCount, 60) // Cap at 60 for performance
  
  // Sum up bonus items from recent buckets
  for (let i = Math.max(0, buckets.length - bucketsToCheck); i < buckets.length; i++) {
    const bucket = buckets[i]
    if (bucket?.bonusItems[itemKey]) {
      total += bucket.bonusItems[itemKey]
    }
  }
  
  // Convert to items per minute accounting for variable bucket duration
  const totalTimeSeconds = bucketsToCheck * config.bucketDuration
  return totalTimeSeconds === 0 ? 0 : (total / totalTimeSeconds) * 60
}

/**
 * Get regular items per minute for a specific item over a time scale (excluding bonus)
 * SUPER OPTIMIZED: Account for variable bucket durations
 */
export function getRegularItemsPerMinute(itemKey: ItemKey, timeScaleName: keyof StatsManager): number {
  return getItemsPerMinute(itemKey, timeScaleName, false)
}

/**
 * Get production data for charting
 * COMPLETE COVERAGE: Ensures every time bucket has a data point for perfect chart continuity
 */
export function getProductionData(timeScaleName: keyof StatsManager, itemKeys: ItemKey[], includeBonus: boolean = true): ChartDataPoint[][] {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return []
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  const config = TIME_SCALES[timeScaleName]
  
  if (!config || buckets.length === 0) return itemKeys.map(() => [])

  // Chart redraw debug logging (can be removed in production)
  // console.log(`📊 CHART REDRAW: ${timeScaleName} (${config.label})`)

  return itemKeys.map(itemKey => {
    const chartData: ChartDataPoint[] = []
    
    // Process ALL buckets to ensure complete data coverage
    // This prevents gaps and ensures every x-value (timestamp) has a corresponding y-value
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]
      if (!bucket) {
        // If bucket is missing, create a zero data point at the expected timestamp
        const expectedTimestamp = i * (config.bucketDuration * 1000)
        chartData.push({
          bucketIndex: i,
          timestamp: expectedTimestamp,
          itemsPerMinute: 0
        })
      } else {
        // Normal bucket processing
        const regularItems = bucket.items[itemKey] || 0
        const bonusItems = includeBonus ? (bucket.bonusItems[itemKey] || 0) : 0
        const totalItems = regularItems + bonusItems
        
        chartData.push({
          bucketIndex: i,
          timestamp: bucket.timestamp,
          itemsPerMinute: totalItems * (60 / (config.bucketDuration || 1)) // Scale to per-minute based on bucket duration
        })
      }
    }
    return chartData
  })
}

/**
 * Get bonus-only production data for charting
 * COMPLETE COVERAGE: Ensures every time bucket has a data point for perfect chart continuity
 */
export function getBonusProductionData(timeScaleName: keyof StatsManager, itemKeys: ItemKey[]): ChartDataPoint[][] {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return []
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  const config = TIME_SCALES[timeScaleName]
  
  if (!config || buckets.length === 0) return itemKeys.map(() => [])

  return itemKeys.map(itemKey => {
    const chartData: ChartDataPoint[] = []
    
    // Process ALL buckets to ensure complete data coverage
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]
      if (!bucket) {
        // If bucket is missing, create a zero data point at the expected timestamp
        const expectedTimestamp = i * (config.bucketDuration * 1000)
        chartData.push({
          bucketIndex: i,
          timestamp: expectedTimestamp,
          itemsPerMinute: 0
        })
      } else {
        // Only count bonus items
        const bonusItems = bucket.bonusItems[itemKey] || 0
        
        chartData.push({
          bucketIndex: i,
          timestamp: bucket.timestamp,
          itemsPerMinute: bonusItems * (60 / (config.bucketDuration || 1)) // Scale to per-minute based on bucket duration
        })
      }
    }
    return chartData
  })
}

/**
 * Get regular-only production data for charting (excluding bonus items)
 * COMPLETE COVERAGE: Ensures every time bucket has a data point for perfect chart continuity
 */
export function getRegularProductionData(timeScaleName: keyof StatsManager, itemKeys: ItemKey[]): ChartDataPoint[][] {
  return getProductionData(timeScaleName, itemKeys, false)
}
/**
 * Get cumulative production over time
 */
export function getCumulativeProduction(timeScaleName: keyof StatsManager, itemKeys: ItemKey[], includeBonus: boolean = true): ChartDataPoint[][] {
  if (timeScaleName === 'gameTimeMs' || timeScaleName === 'currentBucketIndex' || timeScaleName === 'lastSaveTime') return []
  
  const buckets = statsManager.value[timeScaleName] as ProductionBucket[]
  
  return itemKeys.map(itemKey => {
    const chartData: ChartDataPoint[] = []
    let cumulative = 0
    
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]
      if (!bucket) continue
      
      const regularItems = bucket.items[itemKey] || 0
      const bonusItems = includeBonus ? (bucket.bonusItems[itemKey] || 0) : 0
      cumulative += regularItems + bonusItems
      
      chartData.push({
        bucketIndex: i,
        timestamp: bucket.timestamp,
        itemsPerMinute: cumulative // For cumulative, this is total items
      })
    }
    
    return chartData
  })
}

/**
 * Normalize buckets to ensure there's a bucket at every expected interval
 * This fills in missing buckets with empty data to ensure smooth charts
 */
export function normalizeBucketsForAllTimeScales(currentGameTime: number = Date.now()) {
  // Debug logging (can be removed in production)
  // console.log('🔧 Normalizing buckets for all time scales...');
  
  const timeScales = ['tenSeconds', 'oneMinute', 'tenMinutes', 'oneHour', 'tenHours', 'hundredHours'] as const;
  
  for (const timeScaleName of timeScales) {
    const config = TIME_SCALES[timeScaleName];
    if (!config) continue;
    
    const buckets = statsManager.value[timeScaleName] as ProductionBucket[];
    const normalizedBuckets = normalizeBuckets(buckets, config, currentGameTime);
    
    // Update the stats manager with normalized buckets
    (statsManager.value[timeScaleName] as ProductionBucket[]) = normalizedBuckets;
    
    // console.log(`✅ Normalized ${timeScaleName}: ${buckets.length} → ${normalizedBuckets.length} buckets`);
  }
  
  // Handle all-time separately (unlimited buckets)
  const allTimeBuckets = statsManager.value.allTime;
  const allTimeConfig = TIME_SCALES.allTime;
  if (allTimeConfig) {
    const normalizedAllTime = normalizeBuckets(allTimeBuckets, allTimeConfig, currentGameTime);
    statsManager.value.allTime = normalizedAllTime;
    // console.log(`✅ Normalized allTime: ${allTimeBuckets.length} → ${normalizedAllTime.length} buckets`);
  }
}

/**
 * Normalize a single bucket array for a specific time scale
 */
function normalizeBuckets(
  existingBuckets: ProductionBucket[], 
  config: typeof TIME_SCALES[string], 
  currentGameTime: number
): ProductionBucket[] {
  if (existingBuckets.length === 0) {
    // If no buckets exist, create the expected number of empty buckets
    return createEmptyBucketSequence(config, currentGameTime);
  }
  
  const bucketDurationMs = config.bucketDuration * 1000;
  const normalizedBuckets: ProductionBucket[] = [];
  
  // Find the time range we need to cover
  const oldestBucket = existingBuckets[0];
  const newestBucket = existingBuckets[existingBuckets.length - 1];
  
  if (!oldestBucket || !newestBucket) {
    return createEmptyBucketSequence(config, currentGameTime);
  }
  
  // Calculate the expected bucket sequence
  const startTimestamp = oldestBucket.timestamp;
  const endTimestamp = Math.max(newestBucket.timestamp, currentGameTime);
  
  // Create a map of existing buckets for fast lookup
  const existingBucketMap = new Map<number, ProductionBucket>();
  for (const bucket of existingBuckets) {
    existingBucketMap.set(bucket.timestamp, bucket);
  }
  
  // Generate the complete sequence with missing buckets filled
  for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += bucketDurationMs) {
    const alignedTimestamp = Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
    
    const existingBucket = existingBucketMap.get(alignedTimestamp);
    if (existingBucket) {
      // Use existing bucket
      normalizedBuckets.push(existingBucket);
    } else {
      // Create empty bucket for missing interval
      normalizedBuckets.push(createEmptyBucket(alignedTimestamp));
    }
  }
  
  // Trim to expected bucket count if needed (except for allTime)
  if (config.bucketCount !== Infinity && normalizedBuckets.length > config.bucketCount) {
    return normalizedBuckets.slice(-config.bucketCount);
  }
  
  return normalizedBuckets;
}

/**
 * Create a sequence of empty buckets for a time scale
 */
function createEmptyBucketSequence(config: typeof TIME_SCALES[string], currentGameTime: number): ProductionBucket[] {
  if (config.bucketCount === Infinity) {
    // For allTime, just create a current bucket
    const bucketDurationMs = config.bucketDuration * 1000;
    const alignedTimestamp = Math.floor(currentGameTime / bucketDurationMs) * bucketDurationMs;
    return [createEmptyBucket(alignedTimestamp)];
  }
  
  const buckets: ProductionBucket[] = [];
  const bucketDurationMs = config.bucketDuration * 1000;
  const currentBucketTimestamp = Math.floor(currentGameTime / bucketDurationMs) * bucketDurationMs;
  
  // Create buckets going backwards in time
  for (let i = config.bucketCount - 1; i >= 0; i--) {
    const bucketTimestamp = currentBucketTimestamp - (i * bucketDurationMs);
    buckets.push(createEmptyBucket(bucketTimestamp));
  }
  
  return buckets;
}

/**
 * Test function to add some sample data
 */
export function recordTestProduction() {
  recordProduction('brewedCoffee', 5)
  recordProduction('espresso', 3)
  recordProduction('latte', 2)
  // console.log('🧪 Test production recorded')
}

// Composable return object
export function useProductionStats() {
  return {
    statsManager: computed(() => statsManager.value),
    recordProduction,
    recordBonusProduction,
    getProductionData,
    getBonusProductionData,
    getRegularProductionData,
    getCumulativeProduction,
    getItemsPerMinute,
    getBonusItemsPerMinute,
    getRegularItemsPerMinute,
    updateProductionBuckets,
    setUserReference,
    recordTestProduction,
    normalizeBucketsForAllTimeScales
  }
}