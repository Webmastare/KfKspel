// TypeScript interfaces for Coffee Queen game

export interface ItemData {
    name: string;
    icon: string;
    cost: number;
    basePrice: number;
    sellMultiplier: number;
    defaultCapacity: number;
}

export interface InventoryItem {
    name: string;
    icon: string;
    amount: number;
    cost: number;
    basePrice: number;
    sellMultiplier: number;
    capacity: number; // Current capacity limit for this item
}

export interface MachineConfig {
    name: string;
    type: string;
    icon: string;
    cost: number;
    levelRequired: number;
    productionTime: number; // in milliseconds
    uses: string | null;
    produces: string;
    baseBatchSize: number;
    description?: string[];
}

export interface UserMachine {
    key: string;
    name: string;
    type: string;
    icon: string;
    cost: number;
    levelRequired: number;
    baseBatchSize: number;
    batchSize: number;
    productionTime: number;
    uses: string | null;
    produces: string;

    // State
    isOwned: boolean;
    isActive: boolean;
    isManual: boolean; // Whether machine requires manual start
    isRunning: boolean; // Whether currently producing
    progressPercent: number;
    efficiencyProgress: number;
    speedUpgrade: number;
    efficiencyUpgrade: number;
    speedUpgradeCost: number;
    efficiencyUpgradeCost: number;
    lastUpdateTime: number;

    // Trackers
    itemsProduced: number; // Property to track items produced
    bonusItems: number; // Property to track bonus items produced
}

export interface User {
    money: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
    machines: Record<string, UserMachine>;
    inventory: Record<string, InventoryItem>;
    upgrades: UserUpgrades;
    speedupBuffer: SpeedupBufferState;
    lastSaved: string;
    lastActiveAt?: string;
    productionStats?: any; // Production statistics data
}

export interface SpeedupBufferState {
    currentSeconds: number;
    maxSeconds: number;
    onlineRefillIntervalSeconds: number;
    offlineRefillIntervalSeconds: number;
}

export interface GameSettings {
    // Speed upgrade parameters
    speedBaseMultiplier: number;
    speedDiminishingFactor: number;
    speedIncrement: number;
    batchSizeThreshold: number[];

    // Efficiency parameters
    efficiencyPerUnit: number;
    efficiencyDiminishingFactor: number;

    // Cost scaling
    speedCostBase: number;
    speedCostAcceleration: number;
    efficiencyCostBase: number;
    efficiencyCostAcceleration: number;

    // Production time scaling
    batchTimeEfficiency: number;
}

export interface ProductionCalculation {
    itemsPerSecond: number;
    batchSize: number;
    productionTime: number;
}

export interface OfflineProductionSummary {
    [itemKey: string]: {
        amount: number;
        bonusAmount: number;
        name?: string;
        icon?: string;
        itemsLostToCapacity?: number; // Items that couldn't be added due to inventory limits
        itemsSold?: number; // Items sold by sales managers
        itemsBought?: number; // Items bought by sales managers
    };
}

export interface LoadGameResult {
    gameData: User;
    offlineTimeMS: number;
    simulatedOfflineTimeMS: number;
    offlineProductionSummary: OfflineProductionSummary;
    offlineExperienceGained: number;
    offlineSpeedupRefilledSeconds: number;
}

export interface SavedGameData {
    userName: string;
    saveId?: string;
    money: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
    machines: Record<string, UserMachine>;
    inventory: Record<string, InventoryItem>;
    upgrades: UserUpgrades;
    speedupBuffer: SpeedupBufferState;
    lastSaved: string;
    lastActiveAt?: string;
    itemKey?: string;
    productionStats?: any; // Production statistics data
}

// Multi-action types for inventory operations
export type MultiActionValue = number | "10%" | "50%" | "Custom%" | "Max";

// Upgrade system interfaces
export interface ManagerUpgrade {
    id: string;
    name: string;
    description: string;
    cost: number;
    levelRequired: number;
    machineKey: MachineKey;
    category: "automation";
}

export interface InventoryUpgrade {
    id: string;
    name: string;
    description: string;
    cost: number;
    levelRequired: number;
    multiplier: number; // How much to multiply capacity by (e.g., 2.0 = double capacity)
    category: "inventory";
}

export interface UserUpgrades {
    managers: Record<string, boolean>; // upgradeid -> purchased
    inventory: Record<string, boolean>; // inventory upgrade id -> purchased
    salesManagers: Record<string, SalesManager>; // itemKey -> sales manager
}

import type { ManagerStatsManager } from "@/composables/coffeequeen/managerStatsTypes";
export interface SalesManager {
    id: string;
    itemKey: ItemKey;
    level: number; // 0 = not owned, 1-3 = levels
    settings: {
        buyThreshold?: number;
        sellThreshold?: number;
        sellRate?: 1 | 3 | number; // items per second
        autoBuyEnabled?: boolean;
        autoSellEnabled?: boolean;
        offlineWork: boolean;
    };
    statistics: {
        totalItemsBought: number;
        totalItemsSold: number;
        totalMoneyEarned: number;
        totalMoneySpent: number;
        lastActionTime: number;
        timeseries?: ManagerStatsManager;
    };
    // Accumulator for smooth rate limiting
    partialItemsToSell: number; // Tracks fractional items to sell
    partialItemsToBuy: number; // Tracks fractional items to buy
}

// Machine type categories
export type MachineType =
    | "farm"
    | "roaster"
    | "grinder"
    | "brewer"
    | "brewerAssistant";

// Item keys as a union type for type safety
export type ItemKey =
    | "rawCoffeeBeans"
    | "roastedCoffeeBeans"
    | "groundCoffee"
    | "brewedCoffee"
    | "espresso"
    | "latte";

// Machine keys as a union type for type safety
export type MachineKey =
    | "farm1"
    | "farm2"
    | "coffeeBeanRoaster1"
    | "coffeeBeanRoaster2"
    | "coffeeGrinder1"
    | "coffeeGrinder2"
    | "coffeeBrewer1"
    | "espressoMachine1"
    | "milkSteamer"
    | "espressoMachine2"
    | "frenchPress1"
    | "pourOver1";
