import type { ManagerUpgrade, InventoryUpgrade, SalesManager, ItemKey } from "./types";

export const managerUpgrades: ManagerUpgrade[] = [
    {
        id: "manager_farm1",
        name: "Farm Supervisor",
        description: "Automates Small Coffee Farm operations",
        cost: 500,
        levelRequired: 1,
        machineKey: "farm1",
        category: "automation",
    },
    {
        id: "manager_coffeeBeanRoaster1",
        name: "Roasting Expert",
        description: "Automates Old Roaster operations",
        cost: 800,
        levelRequired: 2,
        machineKey: "coffeeBeanRoaster1",
        category: "automation",
    },
    {
        id: "manager_coffeeGrinder1",
        name: "Grinding Specialist",
        description: "Automates Used Coffee Grinder operations",
        cost: 2000,
        levelRequired: 4,
        machineKey: "coffeeGrinder1",
        category: "automation",
    },
    {
        id: "manager_coffeeBrewer1",
        name: "Brewing Master",
        description: "Automates Coffee Brewer operations",
        cost: 5000,
        levelRequired: 6,
        machineKey: "coffeeBrewer1",
        category: "automation",
    },
    {
        id: "manager_espressoMachine1",
        name: "Barista Assistant",
        description: "Automates Small Espresso Machine operations",
        cost: 12000,
        levelRequired: 8,
        machineKey: "espressoMachine1",
        category: "automation",
    },
    {
        id: "manager_milkSteamer",
        name: "Latte Specialist",
        description: "Automates Milk Steamer operations",
        cost: 25000,
        levelRequired: 12,
        machineKey: "milkSteamer",
        category: "automation",
    },
    {
        id: "manager_frenchPress1",
        name: "Press Master",
        description: "Automates French Press operations",
        cost: 3000,
        levelRequired: 14,
        machineKey: "frenchPress1",
        category: "automation",
    },
    {
        id: "manager_pourOver1",
        name: "Pour-Over Expert",
        description: "Automates Manual Pour-Over operations",
        cost: 8000,
        levelRequired: 16,
        machineKey: "pourOver1",
        category: "automation",
    },
    {
        id: "manager_coffeeBeanRoaster2",
        name: "Master Roaster",
        description: "Automates Modern Roaster operations",
        cost: 150000,
        levelRequired: 18,
        machineKey: "coffeeBeanRoaster2",
        category: "automation",
    },
    {
        id: "manager_coffeeGrinder2",
        name: "Industrial Grinding Manager",
        description: "Automates Coffee Grinder operations",
        cost: 800000,
        levelRequired: 20,
        machineKey: "coffeeGrinder2",
        category: "automation",
    },
    {
        id: "manager_espressoMachine2",
        name: "Head Barista",
        description: "Automates Espresso Machine operations",
        cost: 15000000,
        levelRequired: 27,
        machineKey: "espressoMachine2",
        category: "automation",
    },
    {
        id: "manager_farm2",
        name: "Farm Director",
        description: "Automates Coffee Farm operations",
        cost: 2000000,
        levelRequired: 25,
        machineKey: "farm2",
        category: "automation",
    },
];

// Inventory capacity upgrades
export const inventoryUpgrades: InventoryUpgrade[] = [
    {
        id: "inventory_upgrade_1",
        name: "Storage Expansion I",
        description: "Doubles the storage capacity for all items",
        cost: 5000,
        levelRequired: 3,
        multiplier: 2.0,
        category: "inventory",
    },
    {
        id: "inventory_upgrade_2", 
        name: "Storage Expansion II",
        description: "Triples the storage capacity for all items (stacks with previous)",
        cost: 50000,
        levelRequired: 10,
        multiplier: 3.0,
        category: "inventory",
    },
    {
        id: "inventory_upgrade_3",
        name: "Mega Storage Complex",
        description: "Quintuples the storage capacity for all items (stacks with previous)",
        cost: 500000,
        levelRequired: 20,
        multiplier: 5.0,
        category: "inventory",
    },
];

// Helper function to get all available upgrades sorted by level requirement
export function getAvailableUpgrades(): ManagerUpgrade[] {
    return [...managerUpgrades].sort((a, b) =>
        a.levelRequired - b.levelRequired
    );
}

// Helper function to get manager for a specific machine
export function getManagerForMachine(
    machineKey: string,
): ManagerUpgrade | undefined {
    return managerUpgrades.find((upgrade) => upgrade.machineKey === machineKey);
}

// Helper function to get all available inventory upgrades sorted by level requirement
export function getAvailableInventoryUpgrades(): InventoryUpgrade[] {
    return [...inventoryUpgrades].sort((a, b) =>
        a.levelRequired - b.levelRequired
    );
}

// Helper function to calculate total inventory capacity multiplier
export function calculateInventoryMultiplier(purchasedUpgrades: Record<string, boolean>): number {
    let multiplier = 1.0;
    
    for (const upgrade of inventoryUpgrades) {
        if (purchasedUpgrades[upgrade.id]) {
            multiplier *= upgrade.multiplier;
        }
    }
    
    return multiplier;
}

// Sales Manager Level Configurations
export interface SalesManagerLevelConfig {
    level: number;
    name: string;
    description: string;
    cost: number;
    levelRequired: number;
    sellRate: number; // items per second
    features: {
        canSell: boolean;
        canBuy: boolean;
        canSetThresholds: boolean;
        offlineWork: boolean;
    };
}

export const salesManagerLevels: SalesManagerLevelConfig[] = [
    {
        level: 1,
        name: "Basic Sales Assistant",
        description: "Simple auto-sell when inventory reaches 90% capacity",
        cost: 1000,
        levelRequired: 3,
        sellRate: 1, // 1 item/s
        features: {
            canSell: true,
            canBuy: false,
            canSetThresholds: false,
            offlineWork: false
        }
    },
    {
        level: 2,
        name: "Junior Sales Manager", 
        description: "Auto-sell with configurable thresholds and offline capability",
        cost: 5000,
        levelRequired: 7,
        sellRate: 5, // 5 items/s
        features: {
            canSell: true,
            canBuy: false,
            canSetThresholds: true,
            offlineWork: true
        }
    },
    {
        level: 3,
        name: "Senior Sales Manager",
        description: "Full auto-buy/sell with unlimited rate and complete control",
        cost: 25000,
        levelRequired: 12,
        sellRate: -1, // unlimited (-1 indicates no rate limit)
        features: {
            canSell: true,
            canBuy: true,
            canSetThresholds: true,
            offlineWork: true
        }
    }
];

// Helper function to get sales manager level config
export function getSalesManagerLevelConfig(level: number): SalesManagerLevelConfig | undefined {
    return salesManagerLevels.find(config => config.level === level);
}

// Helper function to create a new sales manager for an item
export function createSalesManager(itemKey: ItemKey, level: number = 0): SalesManager {
    return {
        id: `sales_${itemKey}`,
        itemKey,
        level,
        settings: {
            buyThreshold: 10,
            sellThreshold: level === 1 ? 90 : 80, // Level 1 uses fixed 90%, others default to 80%
            sellRate: getSalesManagerLevelConfig(level)?.sellRate || 0,
            autoBuyEnabled: false,
            autoSellEnabled: level > 0,
            offlineWork: getSalesManagerLevelConfig(level)?.features.offlineWork || false
        },
        statistics: {
            totalItemsBought: 0,
            totalItemsSold: 0,
            totalMoneyEarned: 0,
            totalMoneySpent: 0,
            lastActionTime: Date.now()
        },
        // Initialize accumulator properties
        partialItemsToSell: 0,
        partialItemsToBuy: 0
    };
}

// Helper function to get upgrade cost for sales manager level
export function getSalesManagerUpgradeCost(fromLevel: number, toLevel: number): number {
    let totalCost = 0;
    for (let level = fromLevel + 1; level <= toLevel; level++) {
        const config = getSalesManagerLevelConfig(level);
        if (config) {
            totalCost += config.cost;
        }
    }
    return totalCost;
}

// Helper function to get all available sales manager items
export function getAvailableSalesManagerItems(): ItemKey[] {
    return [
        'rawCoffeeBeans',
        'roastedCoffeeBeans', 
        'groundCoffee',
        'brewedCoffee',
        'espresso',
        'latte'
    ];
}
