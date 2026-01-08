import type { ManagerUpgrade, InventoryUpgrade } from "./types";

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
