import matplotlib.pyplot as plt
import numpy as np
import math
from pathlib import Path

from coffeequeen_sim_data import (
    GAME_SETTINGS,
    calculate_batch_size,
    calculate_efficiency_upgrade_cost,
    calculate_items_per_second,
    calculate_production_time_seconds,
    calculate_speed_upgrade_cost,
    calculate_target_upgrade_time_seconds,
)

PLOT_DIR = Path(__file__).parent / "plots"
PLOT_DIR.mkdir(exist_ok=True)

# Base machine parameters
MACHINE_BASE_COST = 100
ITEM_SELL_PRICE = 8.50
BASE_PRODUCTION_TIME_MS = 10_000
BASE_BATCH_SIZE = 1.0


def save_and_close(fig, file_name: str, dpi: int = 150) -> None:
    """Save a figure to the plot folder and close it to avoid memory buildup."""
    fig.savefig(PLOT_DIR / file_name, dpi=dpi)
    plt.close(fig)


def format_cost(cost: float) -> str:
    """Format costs safely for console/table output."""
    if not math.isfinite(cost):
        return "INF"
    return f"${cost:,.0f}"


def calculate_production(speedUpgrade, efficiencyUpgrade):
    """
    Calculate items produced per second with the new advanced system.
    Returns: (itemsPerSecond, batchSize, productionTime)
    """
    batchSize = calculate_batch_size(BASE_BATCH_SIZE, speedUpgrade)
    productionTime = calculate_production_time_seconds(BASE_BATCH_SIZE, speedUpgrade, BASE_PRODUCTION_TIME_MS)
    totalItemsPerSecond = calculate_items_per_second(BASE_BATCH_SIZE, speedUpgrade, efficiencyUpgrade, BASE_PRODUCTION_TIME_MS)
    return totalItemsPerSecond, batchSize, productionTime


def speed_cost_reference_efficiency_level() -> int:
    """Reference efficiency level used for speed-upgrade pricing."""
    return int(GAME_SETTINGS["speedCostReferenceEfficiencyLevel"])


def efficiency_cost_reference_speed_level() -> int:
    """Reference speed level used for efficiency-upgrade pricing."""
    return int(GAME_SETTINGS["efficiencyCostReferenceSpeedLevel"])


def graph_speed_upgrade_cost(current_level):
    """Graph helper: next speed upgrade cost from current level."""
    return calculate_speed_upgrade_cost(
        MACHINE_BASE_COST,
        current_level,
        initial_batch_size=BASE_BATCH_SIZE,
        current_efficiency_upgrade=speed_cost_reference_efficiency_level(),
        base_production_time_ms=BASE_PRODUCTION_TIME_MS,
        item_value_multiplier=ITEM_SELL_PRICE,
    )


def graph_efficiency_upgrade_cost(current_level):
    """Graph helper: next efficiency upgrade cost from current level."""
    return calculate_efficiency_upgrade_cost(
        MACHINE_BASE_COST,
        current_level,
        initial_batch_size=BASE_BATCH_SIZE,
        current_speed_upgrade=efficiency_cost_reference_speed_level(),
        base_production_time_ms=BASE_PRODUCTION_TIME_MS,
        item_value_multiplier=ITEM_SELL_PRICE,
    )


def marginal_money_gain_for_next_upgrade(speed_level, efficiency_level, upgrade_type):
    """Return marginal money/s gain for next speed or efficiency upgrade."""
    current_ips, _, _ = calculate_production(speed_level, efficiency_level)
    if upgrade_type == "speed":
        next_ips, _, _ = calculate_production(speed_level + 1, efficiency_level)
    else:
        next_ips, _, _ = calculate_production(speed_level, efficiency_level + 1)
    return max(0.0, (next_ips - current_ips) * ITEM_SELL_PRICE)


def make_target_time_curve_plot():
    """Plot configured target buy-time curve used by payback anchored pricing."""
    max_level = int(GAME_SETTINGS["timeCurveMaxLevel"])
    levels = np.arange(1, max_level + 1, 1)
    speed_minutes = np.array([calculate_target_upgrade_time_seconds(int(level), "speed") for level in levels]) / 60.0
    efficiency_minutes = np.array([calculate_target_upgrade_time_seconds(int(level), "efficiency") for level in levels]) / 60.0

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 10), sharex=True)

    ax1.plot(levels, speed_minutes, label="Speed target time", linewidth=2.5)
    ax1.plot(levels, efficiency_minutes, label="Efficiency target time", linewidth=2.0)
    for threshold in GAME_SETTINGS["batchSizeThreshold"]:
        if 1 <= threshold <= max_level:
            ax1.axvline(threshold, color="orange", alpha=0.18, linewidth=1.0)
    ax1.set_title("Target Time to Buy Next Upgrade")
    ax1.set_ylabel("Minutes")
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    # Log scale helps inspect the late-game curve and threshold discounts.
    ax2.semilogy(levels, speed_minutes, label="Speed target time", linewidth=2.5)
    ax2.semilogy(levels, efficiency_minutes, label="Efficiency target time", linewidth=2.0)
    for threshold in GAME_SETTINGS["batchSizeThreshold"]:
        if 1 <= threshold <= max_level:
            ax2.axvline(threshold, color="orange", alpha=0.18, linewidth=1.0)
    ax2.set_title("Target Time Curve (Log Scale)")
    ax2.set_xlabel("Upgrade Level")
    ax2.set_ylabel("Minutes (Log Scale)")
    ax2.grid(True, alpha=0.3)
    ax2.legend()

    fig.tight_layout()
    save_and_close(fig, "target_time_curve.png", dpi=170)
    

def make_surface_plot():
    """
    Create a surface plot of items produced per second based on speed and efficiency upgrades.
    """
    speedUpgrades = np.arange(0, 500, 4)  # Extended range, coarser for performance
    efficiencyUpgrades = np.arange(0, 500, 4)  # Extended range

    X, Y = np.meshgrid(speedUpgrades, efficiencyUpgrades)
    Z = np.zeros_like(X, dtype=float)

    for i in range(X.shape[0]):
        for j in range(X.shape[1]):
            itemsPerSecond, _, _ = calculate_production(X[i, j], Y[i, j])
            Z[i, j] = itemsPerSecond

    fig = plt.figure(figsize=(12, 8))
    ax = fig.add_subplot(111, projection='3d')
    surface = ax.plot_surface(X, Y, Z, cmap='viridis', alpha=0.8)
    ax.set_xlabel('Speed Upgrades')
    ax.set_ylabel('Efficiency Upgrades')
    ax.set_zlabel('Items Produced per Second')
    ax.set_title('Production Rate vs Speed & Efficiency Upgrades')
    ax.set_zscale('log')  # Use log scale for z-axis
    fig.colorbar(surface, ax=ax)
    save_and_close(fig, "production_surface.png", dpi=150)

def make_speed_progression_plot():
    """
    Show how speed upgrades affect production, batch size, and production time.
    """
    speedUpgrades = np.arange(0, 501, 1)  # Extended to level 500
    
    itemsPerSecond = []
    batchSizes = []
    productionTimes = []
    
    for speed in speedUpgrades:
        ips, batch, time = calculate_production(speed, 0)  # No efficiency upgrades
        itemsPerSecond.append(ips)
        batchSizes.append(batch)
        productionTimes.append(time)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # Items per second (log scale)
    ax1.semilogy(speedUpgrades, itemsPerSecond, 'b-', linewidth=2)
    ax1.set_title('Items per Second vs Speed Upgrades (Log Scale)')
    ax1.set_xlabel('Speed Upgrades')
    ax1.set_ylabel('Items/Second (Log Scale)')
    ax1.grid(True, alpha=0.3)
    
    # Batch sizes (step plot, log scale)
    ax2.semilogy(speedUpgrades, batchSizes, 'r-', linewidth=2)
    ax2.set_title('Batch Size vs Speed Upgrades (Log Scale)')
    ax2.set_xlabel('Speed Upgrades')
    ax2.set_ylabel('Batch Size (Log Scale)')
    ax2.grid(True, alpha=0.3)
    
    # Production times
    ax3.plot(speedUpgrades, productionTimes, 'g-', linewidth=2)
    ax3.set_title('Production Time vs Speed Upgrades')
    ax3.set_xlabel('Speed Upgrades')
    ax3.set_ylabel('Production Time (seconds)')
    ax3.grid(True, alpha=0.3)
    
    # Efficiency per upgrade (marginal benefit)
    marginalBenefit = np.diff(itemsPerSecond)
    marginalBenefit = np.where(marginalBenefit > 0, marginalBenefit, np.nan)
    ax4.semilogy(speedUpgrades[1:], marginalBenefit, 'purple', linewidth=2)
    ax4.set_title('Marginal Benefit per Speed Upgrade (Log Scale)')
    ax4.set_xlabel('Speed Upgrades')
    ax4.set_ylabel('Additional Items/Second (Log Scale)')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    save_and_close(fig, "speed_progression.png", dpi=150)
    
def make_efficiency_combined_plot():
    """Combine efficiency comparison and progression into one figure with subplots."""
    efficiencyUpgrades = np.arange(0, 501, 1)
    speedUpgrades = np.arange(0, 501, 1)

    speedLevels = [0, 10, 25, 50, 100, 200, 250, 400, 500]
    efficiencyLevels = [0, 10, 50, 100, 200, 300, 500]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 7))

    for speedLevel in speedLevels:
        itemsPerSecond = []
        for eff in efficiencyUpgrades:
            ips, _, _ = calculate_production(speedLevel, eff)
            itemsPerSecond.append(ips)
        ax1.semilogy(efficiencyUpgrades, itemsPerSecond, linewidth=2, label=f'Speed {speedLevel}')

    ax1.set_title('Efficiency Comparison')
    ax1.set_xlabel('Efficiency Upgrades')
    ax1.set_ylabel('Items Produced per Second (Log Scale)')
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=8)

    for eff in efficiencyLevels:
        itemsPerSecond = []
        for speed in speedUpgrades:
            ips, _, _ = calculate_production(speed, eff)
            itemsPerSecond.append(ips)
        ax2.semilogy(speedUpgrades, itemsPerSecond, linewidth=2, label=f'Efficiency {eff}')

    ax2.set_title('Efficiency Progression')
    ax2.set_xlabel('Speed Upgrades')
    ax2.set_ylabel('Items Produced per Second (Log Scale)')
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=8)

    fig.suptitle('Efficiency Impact Overview', fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    save_and_close(fig, "efficiency_combined.png", dpi=150)


def make_money_and_upgrade_time_plot():
    """Plot affordability time and payback time for next upgrades."""
    speedUpgrades = np.arange(0, 501, 1)
    efficiencyUpgrades = np.arange(0, 501, 1)
    efficiencyLevels = [0, 10, 50, 100, 200, 300, 400, 500]
    speedLevels = [0, 10, 50, 100, 200, 300, 400, 500]

    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 11))

    for eff in efficiencyLevels:
        affordability_minutes = []
        payback_minutes = []

        for speed in speedUpgrades:
            ips, _, _ = calculate_production(speed, eff)
            mps = ips * ITEM_SELL_PRICE
            next_upgrade_cost = graph_speed_upgrade_cost(speed)
            marginal_gain = marginal_money_gain_for_next_upgrade(speed, eff, "speed")
            if mps <= 0 or not math.isfinite(next_upgrade_cost):
                affordability_minutes.append(np.nan)
            else:
                affordability_minutes.append((next_upgrade_cost / mps) / 60.0)

            if marginal_gain <= 0 or not math.isfinite(next_upgrade_cost):
                payback_minutes.append(np.nan)
            else:
                payback_minutes.append((next_upgrade_cost / marginal_gain) / 60.0)

        ax1.semilogy(speedUpgrades, affordability_minutes, linewidth=2, label=f'Efficiency {eff}')
        ax2.semilogy(speedUpgrades, payback_minutes, linewidth=2, label=f'Efficiency {eff}')

    ax1.set_title('Time to Afford Next Speed Upgrade')
    ax1.set_xlabel('Speed Upgrades')
    ax1.set_ylabel('Minutes (Log Scale)')
    ax1.grid(True, alpha=0.3)
    ax1.legend(fontsize=8)

    ax2.set_title('Payback Time for Next Speed Upgrade')
    ax2.set_xlabel('Speed Upgrades')
    ax2.set_ylabel('Minutes (Log Scale)')
    ax2.grid(True, alpha=0.3)
    ax2.legend(fontsize=8)

    for speed in speedLevels:
        affordability_minutes = []
        payback_minutes = []

        for eff in efficiencyUpgrades:
            ips, _, _ = calculate_production(speed, eff)
            mps = ips * ITEM_SELL_PRICE
            next_upgrade_cost = graph_efficiency_upgrade_cost(eff)
            marginal_gain = marginal_money_gain_for_next_upgrade(speed, eff, "efficiency")
            if mps <= 0 or not math.isfinite(next_upgrade_cost):
                affordability_minutes.append(np.nan)
            else:
                affordability_minutes.append((next_upgrade_cost / mps) / 60.0)

            if marginal_gain <= 0 or not math.isfinite(next_upgrade_cost):
                payback_minutes.append(np.nan)
            else:
                payback_minutes.append((next_upgrade_cost / marginal_gain) / 60.0)

        ax3.semilogy(efficiencyUpgrades, affordability_minutes, linewidth=2, label=f'Speed {speed}')
        ax4.semilogy(efficiencyUpgrades, payback_minutes, linewidth=2, label=f'Speed {speed}')

    ax3.set_title('Time to Afford Next Efficiency Upgrade')
    ax3.set_xlabel('Efficiency Upgrades')
    ax3.set_ylabel('Minutes (Log Scale)')
    ax3.grid(True, alpha=0.3)
    ax3.legend(fontsize=8)

    ax4.set_title('Payback Time for Next Efficiency Upgrade')
    ax4.set_xlabel('Efficiency Upgrades')
    ax4.set_ylabel('Minutes (Log Scale)')
    ax4.grid(True, alpha=0.3)
    ax4.legend(fontsize=8)

    fig.tight_layout()
    save_and_close(fig, "money_and_upgrade_time.png", dpi=150)

def make_beginning_progression_plot():
    """
    Show how speed upgrades affect production, batch size, and production time.
    """
    speedUpgrades = np.arange(0, 26, 1)  # Extended to level 500
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    efficiencyLevels = [0, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 35, 40, 50]  # Efficiency levels from 0 to 50 in steps
    itemsPerSecond = {}
    for eff in efficiencyLevels:
        itemsPerSecond[eff] = []
        for speed in speedUpgrades:
            ips, _, _ = calculate_production(speed, eff)
            itemsPerSecond[eff].append(ips)
        
    # Items per second (log scale)
    for eff in efficiencyLevels:
        ax1.semilogy(speedUpgrades, itemsPerSecond[eff], label=f'Efficiency {eff}')

    ax1.set_title('Items per Second vs Speed Upgrades (Log Scale)')
    ax1.set_xlabel('Speed Upgrades')
    ax1.set_ylabel('Items/Second (Log Scale)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    itemsPerSecond = []
    productionTimes = []
    for speed in speedUpgrades:
        ips, _, prod_time = calculate_production(speed, 0)  # No efficiency upgrades
        itemsPerSecond.append(ips)
        productionTimes.append(prod_time)

    # Items per second (log scale)
    ax2.semilogy(speedUpgrades, itemsPerSecond, 'b-', linewidth=2)
    ax2.set_title('Items per Second vs Speed Upgrades (Log Scale)')
    ax2.set_xlabel('Speed Upgrades')
    ax2.set_ylabel('Items/Second (Log Scale)')
    ax2.grid(True, alpha=0.3)

    # Production times
    ax3.plot(speedUpgrades, productionTimes, 'g-', linewidth=2)
    ax3.set_title('Production Time vs Speed Upgrades')
    ax3.set_xlabel('Speed Upgrades')
    ax3.set_ylabel('Production Time (seconds)')
    ax3.grid(True, alpha=0.3)

    plt.tight_layout()
    save_and_close(fig, "beginning_progression.png", dpi=300)

def make_cost_analysis_plot():
    """
    Analyze upgrade costs and their value proposition.
    """
    upgradeLevels = np.arange(0, 501, 1)  # Extended to 500, skip some for performance
    
    speedCosts = []
    efficiencyCosts = []
    speedValues = []  # Items per second per dollar
    efficiencyValues = []
    ref_eff = speed_cost_reference_efficiency_level()
    ref_speed = efficiency_cost_reference_speed_level()
    
    for level in upgradeLevels:
        # Calculate costs
        speedCost = graph_speed_upgrade_cost(level)
        effCost = graph_efficiency_upgrade_cost(level)
        speedCosts.append(speedCost)
        efficiencyCosts.append(effCost)
        
        # Calculate value (production increase per dollar spent)
        if level == 0:
            speedValues.append(0)
            efficiencyValues.append(0)
        else:
            # Compare production before and after upgrade
            before_speed, _, _ = calculate_production(level - 1, ref_eff)
            after_speed, _, _ = calculate_production(level, ref_eff)
            speed_benefit = after_speed - before_speed
            speedValues.append(speed_benefit / speedCost if speedCost > 0 else 0)
            
            before_eff, _, _ = calculate_production(ref_speed, level - 1)
            after_eff, _, _ = calculate_production(ref_speed, level)
            eff_benefit = after_eff - before_eff
            efficiencyValues.append(eff_benefit / effCost if effCost > 0 else 0)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # Cost progression (log scale)
    speed_cost_plot = np.array(speedCosts, dtype=float)
    eff_cost_plot = np.array(efficiencyCosts, dtype=float)
    speed_cost_plot[~np.isfinite(speed_cost_plot)] = np.nan
    eff_cost_plot[~np.isfinite(eff_cost_plot)] = np.nan

    ax1.semilogy(upgradeLevels, speed_cost_plot, 'b-', label='Speed Upgrade Cost', linewidth=2)
    ax1.semilogy(upgradeLevels, eff_cost_plot, 'r-', label='Efficiency Upgrade Cost', linewidth=2)
    ax1.set_title('Upgrade Costs (Log Scale)')
    ax1.set_xlabel('Upgrade Level')
    ax1.set_ylabel('Cost ($)')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Value per dollar (log scale)
    speed_values_arr = np.array(speedValues[1:], dtype=float)
    eff_values_arr = np.array(efficiencyValues[1:], dtype=float)
    speed_x = upgradeLevels[1:]
    eff_x = upgradeLevels[1:]

    speed_mask = speed_values_arr > 0
    eff_mask = eff_values_arr > 0
    if np.any(speed_mask):
        ax2.semilogy(speed_x[speed_mask], speed_values_arr[speed_mask], 'b-', label='Speed Value/Dollar', linewidth=2)
    if np.any(eff_mask):
        ax2.semilogy(eff_x[eff_mask], eff_values_arr[eff_mask], 'r-', label='Efficiency Value/Dollar', linewidth=2)
    ax2.set_title('Value per Dollar Spent (Log Scale)')
    ax2.set_xlabel('Upgrade Level')
    ax2.set_ylabel('Items/Second per Dollar (Log Scale)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # Batches per second (log scale)
    speedLevels = np.arange(0, 501, 1)  # Extended to 500
    
    batchSizes = []
    batchesPerSecond = []
    
    for speed in speedLevels:
        ips, batch, time = calculate_production(speed, 0)
        batchSizes.append(batch)
        batchesPerSecond.append(ips / batch)
    
    ax3.semilogy(speedLevels, batchesPerSecond, 'green', linewidth=2)
    ax3.set_title('Batches per Second (Log Scale)')
    ax3.set_xlabel('Speed Upgrade Level')
    ax3.set_ylabel('Batches/Second (Log Scale)')
    ax3.grid(True, alpha=0.3)
    
    # Extended milestone analysis
    milestones = [0, 10, 25, 50, 100, 200, 300, 400, 500]
    milestone_data = []
    
    for milestone in milestones:
        ips, batch, time = calculate_production(milestone, 0)
        cost = graph_speed_upgrade_cost(milestone) if milestone > 0 else 0
        milestone_data.append({
            'level': milestone,
            'batch_size': batch,
            'production_time': time,
            'items_per_second': ips,
            'batches_per_second': ips / batch,
            'cost': cost
        })
    
    # Create milestone table visualization
    table_data = []
    headers = ['Level', 'Batch Size', 'Time/Batch', 'Items/Sec', 'Cost ($)']
    
    for data in milestone_data:
        table_data.append([
            f"{data['level']}",
            f"{data['batch_size']}",
            f"{data['production_time']:.2f}s",
            f"{data['items_per_second']:.1f}",
            format_cost(data['cost']) if data['cost'] > 0 else "$0"
        ])
    
    ax4.axis('tight')
    ax4.axis('off')
    table = ax4.table(cellText=table_data, colLabels=headers, 
                     cellLoc='center', loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.2, 1.5)
    ax4.set_title('Key Milestones (Extended to Level 500)', pad=20)
    
    plt.tight_layout()
    save_and_close(fig, "cost_analysis.png", dpi=150)
    
def main() -> None:
    """Generate console summary and all analysis visualizations."""
    print("=== Coffee Queen Upgrade Curves ===")
    print(f"Base Production Time: {BASE_PRODUCTION_TIME_MS / 1000:.0f}s")
    print(f"Batch Threshold Levels: {GAME_SETTINGS['batchSizeThreshold']}")
    print(
        "Target time curve: "
        f"{GAME_SETTINGS['timeCurveStartSeconds']:.0f}s -> "
        f"{GAME_SETTINGS['timeCurveEndSeconds'] / 60.0:.0f}m by level {GAME_SETTINGS['timeCurveMaxLevel']}"
    )
    print(
        "Cost references: "
        f"speed@eff={speed_cost_reference_efficiency_level()}, "
        f"eff@speed={efficiency_cost_reference_speed_level()}"
    )
    print("\nKey Milestones:")
    for level in [0, 10, 25, 49, 50, 75, 99, 100, 150, 199, 200, 300, 400, 500]:
        ips, batch, time = calculate_production(level, 0)
        cost = graph_speed_upgrade_cost(level) if level > 0 else 0
        print(
            f"Level {level:3d}: {batch:2d} items/batch, {time:5.2f}s/batch, "
            f"{ips:8.1f} items/sec, Cost: {format_cost(cost)}"
        )

    print("\n=== Running Visualizations ===")

    make_target_time_curve_plot()
    make_surface_plot()
    make_speed_progression_plot()
    make_efficiency_combined_plot()
    make_money_and_upgrade_time_plot()
    make_cost_analysis_plot()
    make_beginning_progression_plot()


if __name__ == "__main__":
    main()
