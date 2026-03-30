from dataclasses import dataclass
import math
from typing import Dict, Optional


@dataclass(frozen=True)
class ItemConfig:
    name: str
    cost: float
    base_price: float
    sell_multiplier: float
    default_capacity: float


@dataclass(frozen=True)
class MachineConfig:
    name: str
    machine_type: str
    cost: float
    level_required: int
    production_time_ms: float
    uses: Optional[str]
    produces: str
    base_batch_size: float


@dataclass(frozen=True)
class SimTuning:
    duration_minutes: float = 30.0
    dt_seconds: float = 0.25
    downstream_buffer_seconds: float = 30.0
    max_actions_per_tick: int = 6
    sell_interval_seconds: float = 1.0


def calculate_batch_size(initial_batch_size: float, speed_upgrade: int) -> int:
    """Calculate batch size from shared speed thresholds."""
    thresholds_passed = 0
    for threshold in GAME_SETTINGS["batchSizeThreshold"]:
        if speed_upgrade >= threshold:
            thresholds_passed += 1
        else:
            break
    return int((2 ** thresholds_passed) * initial_batch_size)


def calculate_speed_multiplier(speed_upgrade: int) -> float:
    """Calculate speed multiplier using the same formula as the simulator."""
    if speed_upgrade == 0:
        return 1.0

    w = min(0.5 / math.exp(-(0.01 * speed_upgrade)), 0.8)
    lin_improvement = (speed_upgrade * GAME_SETTINGS["speedBaseMultiplier"]) ** (speed_upgrade ** 0.12)
    log_improvement = (math.log(speed_upgrade + 1) / math.log(1.5)) * GAME_SETTINGS["speedDiminishingFactor"]
    exp_improvement = (
        GAME_SETTINGS["speedIncrement"]
        / min(GAME_SETTINGS["speedIncrement"], 1.000025**speed_upgrade)
    ) ** speed_upgrade - (1 + speed_upgrade * 0.2)
    return 1 + lin_improvement + w * log_improvement + exp_improvement


def calculate_efficiency_bonus(efficiency_upgrade: int) -> float:
    """Calculate efficiency bonus using the same formula as the simulator."""
    if efficiency_upgrade == 0:
        return 0.0

    w = min(0.3 / math.exp(-(0.01 * efficiency_upgrade)), 0.8)
    lin_improvement = (efficiency_upgrade * GAME_SETTINGS["efficiencyPerUnit"]) ** 1.1
    log_improvement = GAME_SETTINGS["efficiencyDiminishingFactor"] * math.log(efficiency_upgrade + 1)
    return lin_improvement + w * log_improvement


def calculate_production_time_seconds(
    initial_batch_size: float,
    speed_upgrade: int,
    base_production_time_ms: float,
) -> float:
    """Calculate production time in seconds for a machine profile."""
    batch_size = calculate_batch_size(initial_batch_size, speed_upgrade)
    speed_multiplier = calculate_speed_multiplier(speed_upgrade)
    batch_multiplier = (batch_size / initial_batch_size) ** GAME_SETTINGS["batchTimeEfficiency"]
    return (base_production_time_ms / 1000.0) * batch_multiplier / speed_multiplier


def calculate_items_per_second(
    initial_batch_size: float,
    speed_upgrade: int,
    efficiency_upgrade: int,
    base_production_time_ms: float,
) -> float:
    """Calculate total items per second for shared graphing/simulation usage."""
    batch_size = calculate_batch_size(initial_batch_size, speed_upgrade)
    production_time_s = calculate_production_time_seconds(
        initial_batch_size,
        speed_upgrade,
        base_production_time_ms,
    )
    if production_time_s <= 0:
        return 0.0
    base_items_per_second = batch_size / production_time_s
    return base_items_per_second * (1.0 + calculate_efficiency_bonus(efficiency_upgrade))


def calculate_target_upgrade_time_seconds(next_level: int, upgrade_type: str = "speed") -> float:
    """Target time-to-buy curve used by payback anchored upgrade costs."""
    clamped_level = max(1, next_level)
    max_level = max(1, int(GAME_SETTINGS["timeCurveMaxLevel"]))
    normalized = min(clamped_level / max_level, 1.0)

    k = float(GAME_SETTINGS["timeCurveExponentK"])
    power = float(GAME_SETTINGS["timeCurveShapePower"])
    start_seconds = float(GAME_SETTINGS["timeCurveStartSeconds"])
    end_seconds = float(GAME_SETTINGS["timeCurveEndSeconds"])

    numerator = math.exp(k * (normalized**power)) - 1.0 # e^(k * (x^p)) - 1
    denominator = math.exp(k) - 1.0
    curve_progress = numerator / denominator if denominator > 0 else normalized
    target_seconds = start_seconds + (end_seconds - start_seconds) * curve_progress

    tail_growth = float(GAME_SETTINGS["timeCurveTailGrowthPerLevel"])
    if clamped_level > max_level:
        target_seconds *= tail_growth ** (clamped_level - max_level)

    if upgrade_type == "efficiency":
        target_seconds *= float(GAME_SETTINGS["efficiencyTargetTimeMultiplier"])
    else:
        target_seconds *= float(GAME_SETTINGS["speedTargetTimeMultiplier"])

    if upgrade_type == "speed" and clamped_level in GAME_SETTINGS["batchSizeThreshold"]:
        target_seconds *= float(GAME_SETTINGS["batchThresholdTimeDiscount"])

    return max(float(GAME_SETTINGS["minUpgradeTimeSeconds"]), target_seconds)


def calculate_speed_upgrade_cost(
    base_cost: float,
    current_speed_upgrade: int,
    initial_batch_size: float = 1.0,
    current_efficiency_upgrade: int = 0,
    base_production_time_ms: float = 10_000.0,
    item_value_multiplier: float = 1.0,
) -> float:
    """Calculate next speed upgrade cost using payback anchoring with affordability floor."""
    current_ips = calculate_items_per_second(
        initial_batch_size,
        current_speed_upgrade,
        current_efficiency_upgrade,
        base_production_time_ms,
    )
    next_ips = calculate_items_per_second(
        initial_batch_size,
        current_speed_upgrade + 1,
        current_efficiency_upgrade,
        base_production_time_ms,
    )
    delta_income_per_second = (next_ips - current_ips) * max(0.0, item_value_multiplier)
    if delta_income_per_second <= 0.0:
        return float("inf")

    target_seconds = calculate_target_upgrade_time_seconds(current_speed_upgrade + 1, "speed")
    payback_cost = target_seconds * delta_income_per_second
    current_income_per_second = current_ips * max(0.0, item_value_multiplier)
    affordability_floor_cost = (
        target_seconds
        * current_income_per_second
        * float(GAME_SETTINGS["targetAffordabilityFloorFraction"])
    )

    floor_cost = max(
        float(GAME_SETTINGS["minUpgradeCost"]),
        base_cost * float(GAME_SETTINGS["upgradeCostFloorFraction"]),
    )
    return math.ceil(max(payback_cost, affordability_floor_cost, floor_cost))


def calculate_efficiency_upgrade_cost(
    base_cost: float,
    current_eff_upgrade: int,
    initial_batch_size: float = 1.0,
    current_speed_upgrade: int = 0,
    base_production_time_ms: float = 10_000.0,
    item_value_multiplier: float = 1.0,
) -> float:
    """Calculate next efficiency upgrade cost using payback anchoring with affordability floor."""
    current_ips = calculate_items_per_second(
        initial_batch_size,
        current_speed_upgrade,
        current_eff_upgrade,
        base_production_time_ms,
    )
    next_ips = calculate_items_per_second(
        initial_batch_size,
        current_speed_upgrade,
        current_eff_upgrade + 1,
        base_production_time_ms,
    )
    delta_income_per_second = (next_ips - current_ips) * max(0.0, item_value_multiplier)
    if delta_income_per_second <= 0.0:
        return float("inf")

    target_seconds = calculate_target_upgrade_time_seconds(current_eff_upgrade + 1, "efficiency")
    payback_cost = target_seconds * delta_income_per_second
    current_income_per_second = current_ips * max(0.0, item_value_multiplier)
    affordability_floor_cost = (
        target_seconds
        * current_income_per_second
        * float(GAME_SETTINGS["targetAffordabilityFloorFraction"])
    )

    floor_cost = max(
        float(GAME_SETTINGS["minUpgradeCost"]),
        base_cost * float(GAME_SETTINGS["upgradeCostFloorFraction"]),
    )
    return math.ceil(max(payback_cost, affordability_floor_cost, floor_cost))


def calculate_bulk_upgrade_cost(
    base_cost: float,
    current_level: int,
    upgrades_to_buy: int,
    upgrade_type: str = "speed",
    initial_batch_size: float = 1.0,
    base_production_time_ms: float = 10_000.0,
    item_value_multiplier: float = 1.0,
    current_efficiency_upgrade: int = 0,
    current_speed_upgrade: int = 0,
) -> float:
    """Calculate total cost of buying multiple upgrades in sequence."""
    total = 0.0
    for i in range(upgrades_to_buy):
        level = current_level + i
        if upgrade_type == "speed":
            step_cost = calculate_speed_upgrade_cost(
                base_cost,
                level,
                initial_batch_size=initial_batch_size,
                current_efficiency_upgrade=current_efficiency_upgrade,
                base_production_time_ms=base_production_time_ms,
                item_value_multiplier=item_value_multiplier,
            )
        elif upgrade_type == "efficiency":
            step_cost = calculate_efficiency_upgrade_cost(
                base_cost,
                level,
                initial_batch_size=initial_batch_size,
                current_speed_upgrade=current_speed_upgrade,
                base_production_time_ms=base_production_time_ms,
                item_value_multiplier=item_value_multiplier,
            )
        else:
            raise ValueError(f"Unknown upgrade_type: {upgrade_type}")

        if not math.isfinite(step_cost):
            return float("inf")
        total += step_cost

        if not math.isfinite(total):
            return float("inf")

    return total


STARTING_STATE = {
    "money": 100.0,
    "level": 1,
    "experience": 0.0,
    "next_level_experience": 100.0,
}


GAME_SETTINGS = {
    "speedBaseMultiplier": 0.4,
    "speedDiminishingFactor": 0.5,
    "speedIncrement": 1.037,

    "batchSizeThreshold": [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    
    "efficiencyPerUnit": 0.1,
    "efficiencyDiminishingFactor": 0.5,

    # Target time curve for payback-anchored upgrade pricing.
    "timeCurveStartSeconds": 45.0,
    "timeCurveEndSeconds": 600_000,
    "timeCurveMaxLevel": 500,
    "timeCurveExponentK": 5.0, # Higher k means slower initial growth and faster late-game growth.
    "timeCurveShapePower": 1.5, # Higher power means more of the curve's growth happens in the late game.
    "timeCurveTailGrowthPerLevel": 1.008, # After max level, each additional level increases target time by this factor.

    # Multipliers multiply the target time curve by some factor, altering time from the baseline curve by that factor.
    "speedTargetTimeMultiplier": 1.0,
    "efficiencyTargetTimeMultiplier": 1.0,
    "batchThresholdTimeDiscount": 0.8,
    
    # Reference counterpart levels used when pricing each stat's upgrade curve.
    "speedCostReferenceEfficiencyLevel": 0,
    "efficiencyCostReferenceSpeedLevel": 0,
    # 1.0 means affordability at reference levels follows target time curve.
    "targetAffordabilityFloorFraction": 1.0,
    "minUpgradeTimeSeconds": 10.0,
    "minUpgradeCost": 1.0,
    "upgradeCostFloorFraction": 0.0,

    "batchTimeEfficiency": 0.9,
}


POLICIES = [
    "cheap-first",
    "flow-balance",
]


ITEMS: Dict[str, ItemConfig] = {
    "rawCoffeeBeans": ItemConfig("Raw Coffee Beans", 10, 10, 0.85, 100),
    "roastedCoffeeBeans": ItemConfig("Roasted Coffee Beans", 20, 20, 0.80, 100),
    "groundCoffee": ItemConfig("Ground Coffee", 30, 30, 0.75, 100),
    "brewedCoffee": ItemConfig("Brewed Coffee", 35, 35, 0.75, 80),
    "espresso": ItemConfig("Espresso", 40, 40, 0.75, 60),
    "latte": ItemConfig("Latte", 55, 55, 0.70, 50),
}


MACHINES: Dict[str, MachineConfig] = {
    "farm1": MachineConfig("Small Coffee Farm", "farm", 100, 0, 10000, None, "rawCoffeeBeans", 1),
    "farm2": MachineConfig("Coffee Farm", "farm", 1000000, 0, 40000, None, "rawCoffeeBeans", 5),
    "coffeeBeanRoaster1": MachineConfig(
        "Old Roaster",
        "roaster",
        200,
        0,
        5000,
        "rawCoffeeBeans",
        "roastedCoffeeBeans",
        1,
    ),
    "coffeeBeanRoaster2": MachineConfig(
        "Modern Roaster",
        "roaster",
        100000,
        14,
        20000,
        "rawCoffeeBeans",
        "roastedCoffeeBeans",
        5,
    ),
    "coffeeGrinder1": MachineConfig(
        "Used Coffee Grinder",
        "grinder",
        1000,
        2,
        20000,
        "roastedCoffeeBeans",
        "groundCoffee",
        1,
    ),
    "coffeeGrinder2": MachineConfig(
        "Coffee Grinder",
        "grinder",
        500000,
        18,
        30000,
        "roastedCoffeeBeans",
        "groundCoffee",
        3,
    ),
    "coffeeBrewer1": MachineConfig(
        "Coffee Brewer",
        "brewer",
        3000,
        4,
        60000,
        "groundCoffee",
        "brewedCoffee",
        2,
    ),
    "espressoMachine1": MachineConfig(
        "Small Espresso Machine",
        "brewer",
        10000,
        6,
        20000,
        "groundCoffee",
        "espresso",
        1,
    ),
    "milkSteamer": MachineConfig(
        "Milk Steamer",
        "brewerAssistant",
        20000,
        10,
        12000,
        "espresso",
        "latte",
        1,
    ),
    "espressoMachine2": MachineConfig(
        "Espresso Machine",
        "brewer",
        10000000,
        25,
        20000,
        "groundCoffee",
        "espresso",
        2,
    ),
    "frenchPress1": MachineConfig(
        "French Press",
        "brewer",
        400,
        12,
        60000,
        "groundCoffee",
        "brewedCoffee",
        1,
    ),
    "pourOver1": MachineConfig(
        "Manual Pour-Over",
        "brewer",
        1000,
        14,
        30000,
        "groundCoffee",
        "brewedCoffee",
        1,
    ),
}
