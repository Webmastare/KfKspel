// TypeScript interfaces for Coffee Queen game

export interface ItemData {
    name: string;
    icon: string;
    cost: number;
    basePrice: number;
    volatility: number;
    trend: number;
    timeSinceLastUpdate: number;
    priceHistory: number[];
    sellMultiplier: number;
}

export interface InventoryItem {
    name: string;
    icon: string;
    amount: number;
    cost: number;
    basePrice: number;
    sellMultiplier: number;
    priceHistory: number[];
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
    isOwned: boolean;
    isActive: boolean;
    progressPercent: number;
    efficiencyProgress: number;
    speedUpgrade: number;
    efficiencyUpgrade: number;
    speedUpgradeCost: number;
    efficiencyUpgradeCost: number;
    lastUpdateTime: number;
}

export interface User {
    money: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
    machines: Record<string, UserMachine>;
    inventory: Record<string, InventoryItem>;
    lastSaved?: string;
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
        name?: string;
        icon?: string;
    };
}

export interface LoadGameResult {
    gameData: User;
    offlineProductionSummary: OfflineProductionSummary;
    offlineExperienceGained: number;
}

export interface SavedGameData {
    userName: string;
    money: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
    machines: Record<string, UserMachine>;
    inventory: Record<string, InventoryItem>;
    lastSaved: string;
    itemKey?: string;
}

// Multi-action types for inventory operations
export type MultiActionValue = number | "10%" | "Custom%" | "Max";

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
