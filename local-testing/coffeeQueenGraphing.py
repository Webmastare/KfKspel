import matplotlib.pyplot as plt
import numpy as np
import math
from pathlib import Path

"""
Advanced Coffee Queen Upgrade System

Key Design Principles:
1. Early upgrades (0-25) are very rewarding with diminishing returns
2. Every 25 speed upgrades: batch size doubles, production time scales smartly
3. Late game: bulk upgrade purchasing becomes viable
4. Exponential cost growth balanced with exponential income growth

Scaling Logic:
- Batch Size: 2^(speedLevel // 25) starting from 1
- Speed Boost: Logarithmic diminishing returns for fairness
- Production Time: Scales with batch size but with efficiency multipliers
- Cost: Exponential but manageable with game progression
"""
PLOT_DIR = Path(__file__).with_suffix("").parent / "plots"
PLOT_DIR.mkdir(exist_ok=True)

# Base machine parameters
machineCost = 1000
baseProductionTime = 10  # seconds for 1 item initially

gameSettings = {
    # Speed upgrade parameters
    "speedBaseMultiplier": 0.4,  # Much more modest early game boost
    "speedDiminishingFactor": 0.5,  # Stronger diminishing returns
    "speedIncrement": 1.037,  # Incremental speed improvement per upgrade
    "batchSizeThreshold": [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],  # Every X upgrades, batch size doubles
    
    # Efficiency parameters  
    "efficiencyPerUnit": 0.1,  # x% efficiency bonus per upgrade
    "efficiencyDiminishingFactor": 0.5,  # Diminishing returns factor for efficiency

    # Cost scaling
    "speedCostBase": 1.035,  # Base cost multiplier for speed
    "speedCostAcceleration": 1.01,  # Cost acceleration factor for speed
    "efficiencyCostBase": 1.04,  # Base cost multiplier for efficiency
    "efficiencyCostAcceleration": 1.0003,  # Cost acceleration factor for efficiency

    # Production time scaling
    "batchTimeEfficiency": 0.9  # When batch doubles, time scales more conservatively
}

def calculate_batch_size(speedUpgrade):
    """Calculate batch size based on speed upgrades - doubles at specific thresholds"""
    thresholds = gameSettings["batchSizeThreshold"]
    
    # Count how many thresholds we've passed
    thresholds_passed = 0
    for threshold in thresholds:
        if speedUpgrade >= threshold:
            thresholds_passed += 1
        else:
            break
    
    # Each threshold doubles the batch size, starting from 1
    return 2 ** thresholds_passed

def calculate_speed_multiplier(speedUpgrade):
    """
    Calculate speed multiplier with controlled progression.
    """
    if speedUpgrade == 0:
        return 1.0

    w = min(0.5 / math.exp(-(0.01*speedUpgrade)), 0.8)  # Cap at 0.8 for w

    linImprovement = (speedUpgrade * gameSettings["speedBaseMultiplier"]) ** (speedUpgrade ** 0.12)  # Linear component
    logImprovement = math.log(speedUpgrade, 1.5) * gameSettings["speedDiminishingFactor"]
    expImprovement = ((gameSettings["speedIncrement"]/ min(gameSettings["speedIncrement"], 1.000025**speedUpgrade)) ** speedUpgrade) - (1 + (speedUpgrade) * 0.2)  # Exponential component

    return 1 + linImprovement + (w) * logImprovement + expImprovement

def calculate_production_time(speedUpgrade):
    """
    Calculate production time considering batch size scaling and speed improvements.
    When batch size doubles, production time doesn't fully double (efficiency gains).
    """
    batchSize = calculate_batch_size(speedUpgrade)
    speedMultiplier = calculate_speed_multiplier(speedUpgrade)
    
    # Base time scales with batch size but with efficiency
    batchTimeMultiplier = batchSize ** gameSettings["batchTimeEfficiency"]
    
    # Speed reduces time
    adjustedTime = (baseProductionTime * batchTimeMultiplier) / speedMultiplier
    
    # Enforce minimum production time
    return adjustedTime

def calculate_efficiency_bonus(efficiencyUpgrade):
    """Calculate efficiency bonus with logarithmic scaling"""
    if efficiencyUpgrade == 0:
        return 0
    
    w = min(0.3 / math.exp(-(0.01*efficiencyUpgrade)), 0.8)
    linImprovement = (efficiencyUpgrade * gameSettings["efficiencyPerUnit"]) ** 1.1
    logImprovement = gameSettings["efficiencyDiminishingFactor"] * math.log(efficiencyUpgrade + 1)
    return linImprovement + w * logImprovement

def calculate_production(speedUpgrade, efficiencyUpgrade):
    """
    Calculate items produced per second with the new advanced system.
    Returns: (itemsPerSecond, batchSize, productionTime)
    """
    batchSize = calculate_batch_size(speedUpgrade)
    productionTime = calculate_production_time(speedUpgrade) # In seconds
    efficiencyBonus = calculate_efficiency_bonus(efficiencyUpgrade) # Efficiency bonus as a fraction
    
    # Base items per second
    baseItemsPerSecond = batchSize / productionTime
    
    # Apply efficiency bonus
    totalItemsPerSecond = baseItemsPerSecond * (1 + efficiencyBonus)
    
    return totalItemsPerSecond, batchSize, productionTime

def calculate_speed_upgrade_cost(upgradeLevel):
    """Calculate the cost of a speed upgrade with exponential scaling"""
    baseCost = gameSettings["speedCostBase"] ** upgradeLevel
    acceleration = gameSettings["speedCostAcceleration"] ** (upgradeLevel)
    return machineCost * baseCost * acceleration

def calculate_efficiency_upgrade_cost(upgradeLevel):
    """Calculate the cost of an efficiency upgrade with exponential scaling"""
    baseCost = gameSettings["efficiencyCostBase"] ** upgradeLevel
    acceleration = gameSettings["efficiencyCostAcceleration"] ** (upgradeLevel)
    return machineCost * baseCost * acceleration

def calculate_bulk_upgrade_cost(currentLevel, upgradesToBuy, upgradeType='speed'):
    """Calculate the total cost of buying multiple upgrades at once"""
    totalCost = 0
    costFunc = calculate_speed_upgrade_cost if upgradeType == 'speed' else calculate_efficiency_upgrade_cost
    
    for i in range(upgradesToBuy):
        totalCost += costFunc(currentLevel + i)
    
    return totalCost
    

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
    plt.colorbar(surface)
    plt.savefig(PLOT_DIR / "production_surface.png", dpi=150)
    #plt.show()

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
    ax4.semilogy(speedUpgrades[1:], marginalBenefit, 'purple', linewidth=2)
    ax4.set_title('Marginal Benefit per Speed Upgrade (Log Scale)')
    ax4.set_xlabel('Speed Upgrades')
    ax4.set_ylabel('Additional Items/Second (Log Scale)')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(PLOT_DIR / "speed_progression.png", dpi=150)
    #plt.show()
    
def make_efficiency_comparison_plot():
    """
    Compare the effect of efficiency upgrades at different speed levels.
    """
    efficiencyUpgrades = np.arange(0, 200, 1)  # Extended range
    speedLevels = [0, 10, 25, 50, 100, 200, 250, 400, 500]  # Extended speed levels

    plt.figure(figsize=(12, 8))
    
    for speedLevel in speedLevels:
        itemsPerSecond = []
        for eff in efficiencyUpgrades:
            ips, _, _ = calculate_production(speedLevel, eff)
            itemsPerSecond.append(ips)
        
        plt.semilogy(efficiencyUpgrades, itemsPerSecond, 
                linewidth=2, label=f'Speed Level {speedLevel}')
    
    plt.title('Items Per Second vs Efficiency Upgrades at Different Speed Levels (Log Scale)')
    plt.xlabel('Efficiency Upgrades')
    plt.ylabel('Items Produced per Second (Log Scale)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig(PLOT_DIR / "efficiency_comparison.png", dpi=150)
    #plt.show()

def make_efficiency_progression_plot():
    """
    Show how speed upgrades affect production, batch size, and production time.
    """
    speedUpgrades = np.arange(0, 501, 1)  # Extended to level 500
    
    efficiencyLevels = [0, 10, 50, 100, 200, 300, 500]
    itemsPerSecond = {}
    for eff in efficiencyLevels:
        itemsPerSecond[eff] = []
        for speed in speedUpgrades:
            ips, _, _ = calculate_production(speed, eff)
            itemsPerSecond[eff].append(ips)
    
    fig, ax1 = plt.subplots(figsize=(12, 8))
    
    # Items per second (log scale)
    for eff in efficiencyLevels:
        ax1.semilogy(speedUpgrades, itemsPerSecond[eff], label=f'Efficiency {eff}')

    ax1.set_title('Items per Second vs Speed Upgrades (Log Scale)')
    ax1.set_xlabel('Speed Upgrades')
    ax1.set_ylabel('Items/Second (Log Scale)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    plt.tight_layout()
    plt.savefig(PLOT_DIR / "efficiency_progression.png", dpi=150)
    #plt.show()

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
    plt.savefig(PLOT_DIR / "beginning_progression.png", dpi=300)
    #plt.show()

def make_cost_analysis_plot():
    """
    Analyze upgrade costs and their value proposition.
    """
    upgradeLevels = np.arange(0, 501, 1)  # Extended to 500, skip some for performance
    
    speedCosts = []
    efficiencyCosts = []
    speedValues = []  # Items per second per dollar
    efficiencyValues = []
    
    for level in upgradeLevels:
        # Calculate costs
        speedCost = calculate_speed_upgrade_cost(level)
        effCost = calculate_efficiency_upgrade_cost(level)
        speedCosts.append(speedCost)
        efficiencyCosts.append(effCost)
        
        # Calculate value (production increase per dollar spent)
        if level == 0:
            speedValues.append(0)
            efficiencyValues.append(0)
        else:
            # Compare production before and after upgrade
            before_speed, _, _ = calculate_production(level - 1, 0) # At efficiency level 0
            after_speed, _, _ = calculate_production(level, 0)
            speed_benefit = after_speed - before_speed
            speedValues.append(speed_benefit / speedCost if speedCost > 0 else 0)
            
            before_eff, _, _ = calculate_production(100, level - 1)  # At speed level 100
            after_eff, _, _ = calculate_production(100, level)
            eff_benefit = after_eff - before_eff
            efficiencyValues.append(eff_benefit / effCost if effCost > 0 else 0)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # Cost progression (log scale)
    ax1.semilogy(upgradeLevels, speedCosts, 'b-', label='Speed Upgrade Cost', linewidth=2)
    ax1.semilogy(upgradeLevels, efficiencyCosts, 'r-', label='Efficiency Upgrade Cost', linewidth=2)
    ax1.set_title('Upgrade Costs (Log Scale)')
    ax1.set_xlabel('Upgrade Level')
    ax1.set_ylabel('Cost ($)')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Value per dollar (log scale)
    valid_speed_values = [v for v in speedValues[1:] if v > 0]
    valid_eff_values = [v for v in efficiencyValues[1:] if v > 0]
    if valid_speed_values and valid_eff_values:
        ax2.semilogy(upgradeLevels[1:len(valid_speed_values)+1], valid_speed_values, 'b-', label='Speed Value/Dollar', linewidth=2)
        ax2.semilogy(upgradeLevels[1:len(valid_eff_values)+1], valid_eff_values, 'r-', label='Efficiency Value/Dollar', linewidth=2)
    ax2.set_title('Value per Dollar Spent (Log Scale)')
    ax2.set_xlabel('Upgrade Level')
    ax2.set_ylabel('Items/Second per Dollar (Log Scale)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # Batches per second (log scale)
    speedLevels = np.arange(0, 501, 1)  # Extended to 500
    
    batchSizes = []
    itemsPerBatch = []
    timePerBatch = []
    batchesPerSecond = []
    
    for speed in speedLevels:
        ips, batch, time = calculate_production(speed, 0)
        batchSizes.append(batch)
        itemsPerBatch.append(batch)
        timePerBatch.append(time)
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
        cost = calculate_speed_upgrade_cost(milestone) if milestone > 0 else 0
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
            f"${data['cost']:,.0f}" if data['cost'] > 0 else "$0"
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
    plt.savefig(PLOT_DIR / "cost_analysis.png", dpi=150)
    #plt.show()
    
# Print system overview
print("=== Coffee Queen Advanced Upgrade System (Balanced) ===")
print(f"Base Production Time: {baseProductionTime}s")
print(f"Batch Size Doubles Every: {gameSettings['batchSizeThreshold']} speed upgrades")
print("\nKey Milestones:")
for level in [0, 10, 25, 49, 50, 75, 99, 100, 150, 199, 200, 300, 400, 500]:
    ips, batch, time = calculate_production(level, 0)
    cost = calculate_speed_upgrade_cost(level) if level > 0 else 0
    print(f"Level {level:3d}: {batch:2d} items/batch, {time:5.2f}s/batch, {ips:8.1f} items/sec, Cost: ${cost:,.0f}")

print(f"\n=== Target Check ===")
level_100_ips, _, _ = calculate_production(100, 0)
level_100_ips_eff, _, _ = calculate_production(100, 10)  # With efficiency upgrades
level_100_cost = calculate_speed_upgrade_cost(100)
print(f"Level 100: {level_100_ips:.1f} items/sec (Target: ~1000)")
print(f"Level 100, Eff 10: {level_100_ips_eff:.1f} items/sec (Target: ~1000)")
print(f"Level 100 Cost: ${level_100_cost:,.0f} (Target: ~$1M)")

print("\n=== Running Visualizations ===")

# Run all the analysis plots
make_surface_plot()
make_speed_progression_plot()
make_efficiency_comparison_plot()
make_efficiency_progression_plot()
make_cost_analysis_plot()
make_beginning_progression_plot()
