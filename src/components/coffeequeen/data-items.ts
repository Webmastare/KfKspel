import type { ItemData, ItemKey } from "./types";

export const itemDataList: Record<ItemKey, ItemData> = {
    "rawCoffeeBeans": {
        "name": "Raw Coffee Beans",
        "icon": "/assets/coffeeQ/rawBeans.png",
        "cost": 10,
        "basePrice": 10,
        "volatility": 0.15,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            10,
        ],
        "sellMultiplier": 0.85,
    },
    "roastedCoffeeBeans": {
        "name": "Roasted Coffee Beans",
        "icon": "/assets/coffeeQ/roastedBeans.png",
        "cost": 20,
        "basePrice": 20,
        "volatility": 0.12,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            20,
        ],
        "sellMultiplier": 0.8,
    },
    "groundCoffee": {
        "name": "Ground Coffee",
        "icon": "/assets/coffeeQ/groundCoffee.png",
        "cost": 30,
        "basePrice": 30,
        "volatility": 0.1,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            30,
        ],
        "sellMultiplier": 0.75,
    },
    "brewedCoffee": {
        "name": "Brewed Coffee",
        "icon": "/assets/coffeeQ/brewedCoffee.png",
        "cost": 35,
        "basePrice": 35,
        "volatility": 0.08,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            35,
        ],
        "sellMultiplier": 0.75,
    },
    "espresso": {
        "name": "Espresso",
        "icon": "/assets/coffeeQ/espresso.png",
        "cost": 40,
        "basePrice": 40,
        "volatility": 0.08,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            40,
        ],
        "sellMultiplier": 0.75,
    },
    "latte": {
        "name": "Latte",
        "icon": "/assets/coffeeQ/latte.png",
        "cost": 55,
        "basePrice": 55,
        "volatility": 0.06,
        "trend": 0,
        "timeSinceLastUpdate": 0,
        "priceHistory": [
            55,
        ],
        "sellMultiplier": 0.7,
    },
};
