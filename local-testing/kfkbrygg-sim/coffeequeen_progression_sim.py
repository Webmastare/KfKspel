import argparse
import copy
import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec, GridSpecFromSubplotSpec

from coffeequeen_sim_data import (
    GAME_SETTINGS,
    ITEMS,
    MACHINES,
    POLICIES,
    STARTING_STATE,
    SimTuning,
    calculate_batch_size,
    calculate_efficiency_bonus,
    calculate_production_time_seconds,
    calculate_speed_upgrade_cost,
    calculate_efficiency_upgrade_cost,
)


@dataclass
class MachineState:
    owned: bool = False
    speed_upgrade: int = 0
    efficiency_upgrade: int = 0
    progress_seconds: float = 0.0
    efficiency_progress: float = 0.0


@dataclass
class ActionCandidate:
    action_type: str
    machine_key: str
    cost: float
    roi_seconds: float
    projected_gain: float = 0.0
    delta_income_per_second: float = 0.0


@dataclass
class PurchaseEvent:
    t_seconds: float
    action_type: str
    machine_key: str
    cost: float
    money_after: float
    roi_seconds: float


@dataclass
class SimState:
    time_seconds: float
    money: float
    level: int
    experience: float
    next_level_experience: float
    inventory: Dict[str, int]
    machines: Dict[str, MachineState]


# Simulation constants for quick ROI approximations used in diagnostics plots.
ROI_SIM_SECONDS = 20.0
ROI_SIM_DT_SECONDS = 1.0


def empty_state() -> SimState:
    """Create initial simulation state."""
    return SimState(
        time_seconds=0.0,
        money=float(STARTING_STATE["money"]),
        level=int(STARTING_STATE["level"]),
        experience=float(STARTING_STATE["experience"]),
        next_level_experience=float(STARTING_STATE["next_level_experience"]),
        inventory={item_key: 0 for item_key in ITEMS},
        machines={machine_key: MachineState() for machine_key in MACHINES},
    )


def apply_leveling(state: SimState) -> None:
    """Apply in-game level up curve."""
    while state.experience >= state.next_level_experience:
        state.level += 1
        state.experience -= state.next_level_experience
        state.next_level_experience = math.ceil(state.next_level_experience * 1.2)


def build_machine_order() -> List[str]:
    """Sort machines from upstream to downstream for stable chain simulation."""
    machine_keys = list(MACHINES.keys())
    producers_by_item: Dict[str, List[str]] = {}
    for machine_key, conf in MACHINES.items():
        producers_by_item.setdefault(conf.produces, []).append(machine_key)

    cache: Dict[str, int] = {}

    def depth(machine_key: str) -> int:
        if machine_key in cache:
            return cache[machine_key]

        conf = MACHINES[machine_key]
        if conf.uses is None:
            cache[machine_key] = 0
            return 0

        producers = [k for k in producers_by_item.get(conf.uses, []) if k != machine_key]
        if not producers:
            cache[machine_key] = 0
            return 0

        d = 1 + max(depth(k) for k in producers)
        cache[machine_key] = d
        return d

    return sorted(machine_keys, key=lambda k: (depth(k), MACHINES[k].cost))


def machine_main_output_rate(state: SimState, machine_key: str) -> float:
    """Return machine main output per second."""
    conf = MACHINES[machine_key]
    machine = state.machines[machine_key]
    batch_size = calculate_batch_size(conf.base_batch_size, machine.speed_upgrade)
    production_time_s = calculate_production_time_seconds(conf.base_batch_size, machine.speed_upgrade, conf.production_time_ms)
    return batch_size / production_time_s


def machine_total_output_rate(state: SimState, machine_key: str) -> float:
    """Return machine total output including efficiency bonus."""
    machine = state.machines[machine_key]
    return machine_main_output_rate(state, machine_key) * (1.0 + calculate_efficiency_bonus(machine.efficiency_upgrade))


def machine_item_value_multiplier(machine_key: str) -> float:
    """Return effective sell value per produced item for pricing calculations."""
    produced_item = ITEMS[MACHINES[machine_key].produces]
    return produced_item.base_price * produced_item.sell_multiplier


def calculate_next_speed_upgrade_cost(state: SimState, machine_key: str) -> float:
    """Return next speed upgrade cost for a specific machine state."""
    conf = MACHINES[machine_key]
    ms = state.machines[machine_key]
    return calculate_speed_upgrade_cost(
        conf.cost,
        ms.speed_upgrade,
        initial_batch_size=conf.base_batch_size,
        current_efficiency_upgrade=int(GAME_SETTINGS["speedCostReferenceEfficiencyLevel"]),
        base_production_time_ms=conf.production_time_ms,
        item_value_multiplier=machine_item_value_multiplier(machine_key),
    )


def calculate_next_eff_upgrade_cost(state: SimState, machine_key: str) -> float:
    """Return next efficiency upgrade cost for a specific machine state."""
    conf = MACHINES[machine_key]
    ms = state.machines[machine_key]
    return calculate_efficiency_upgrade_cost(
        conf.cost,
        ms.efficiency_upgrade,
        initial_batch_size=conf.base_batch_size,
        current_speed_upgrade=int(GAME_SETTINGS["efficiencyCostReferenceSpeedLevel"]),
        base_production_time_ms=conf.production_time_ms,
        item_value_multiplier=machine_item_value_multiplier(machine_key),
    )


def estimate_money_per_second(state: SimState, downstream_buffer_seconds: float) -> float:
    """Estimate sell income per second with chain reserve logic."""
    item_total_rate = {item_key: 0.0 for item_key in ITEMS}
    item_main_demand = {item_key: 0.0 for item_key in ITEMS}

    for machine_key, machine in state.machines.items():
        if not machine.owned:
            continue

        conf = MACHINES[machine_key]
        item_total_rate[conf.produces] += machine_total_output_rate(state, machine_key)
        if conf.uses is not None:
            item_main_demand[conf.uses] += machine_main_output_rate(state, machine_key)

    money_rate = 0.0
    for item_key, item_cfg in ITEMS.items():
        produced = item_total_rate[item_key]
        reserved_for_chain = item_main_demand[item_key]
        sell_rate = max(0.0, produced - reserved_for_chain)

        # Keep some inventory buffer for items consumed by downstream machines.
        if reserved_for_chain > 0 and state.inventory[item_key] < reserved_for_chain * downstream_buffer_seconds:
            sell_rate *= 0.5

        money_rate += sell_rate * item_cfg.base_price * item_cfg.sell_multiplier

    return money_rate


def step_production(state: SimState, dt_seconds: float, machine_order: List[str]) -> None:
    """Run one production step with discrete batch and integer inventory rules."""
    produced_buffer = {item_key: 0 for item_key in ITEMS}
    exp_gain = 0

    for machine_key in machine_order:
        machine = state.machines[machine_key]
        if not machine.owned:
            continue

        conf = MACHINES[machine_key]
        machine.progress_seconds += dt_seconds

        batch_size = max(1, int(round(calculate_batch_size(conf.base_batch_size, machine.speed_upgrade))))
        production_time_s = calculate_production_time_seconds(
            conf.base_batch_size,
            machine.speed_upgrade,
            conf.production_time_ms,
        )
        if production_time_s <= 0:
            continue

        eff_bonus = calculate_efficiency_bonus(machine.efficiency_upgrade)

        while machine.progress_seconds >= production_time_s:
            machine.progress_seconds -= production_time_s

            # Efficiency bonus accumulates per completed batch cycle.
            machine.efficiency_progress += eff_bonus
            bonus_batches = int(machine.efficiency_progress)
            bonus_items = bonus_batches * batch_size

            capacity = int(ITEMS[conf.produces].default_capacity)
            current_total = state.inventory[conf.produces] + produced_buffer[conf.produces]
            available_space = capacity - current_total

            if available_space < batch_size:
                machine.progress_seconds = production_time_s
                break

            if conf.uses is not None:
                # Always consume full batch, even if it drives inventory negative.
                state.inventory[conf.uses] -= batch_size

            produced_buffer[conf.produces] += batch_size
            exp_gain += batch_size

            if bonus_batches > 0:
                bonus_add = min(bonus_items, max(0, available_space - batch_size))
                produced_buffer[conf.produces] += bonus_add
                machine.efficiency_progress -= bonus_batches

    for item_key, produced in produced_buffer.items():
        state.inventory[item_key] += produced

    state.experience += exp_gain
    apply_leveling(state)


def step_selling(state: SimState, downstream_buffer_seconds: float) -> tuple[float, Dict[str, int]]:
    """Sell whole items while reserving chain buffers."""
    demand_per_sec = {item_key: 0.0 for item_key in ITEMS}
    for machine_key, machine in state.machines.items():
        if not machine.owned:
            continue
        conf = MACHINES[machine_key]
        if conf.uses is not None:
            demand_per_sec[conf.uses] += machine_main_output_rate(state, machine_key)

    earned = 0.0
    sold_by_item = {item_key: 0 for item_key in ITEMS}
    for item_key, item_cfg in ITEMS.items():
        reserve = int(math.ceil(demand_per_sec[item_key] * downstream_buffer_seconds))
        sell_amount = max(0, state.inventory[item_key] - reserve)
        if sell_amount <= 0:
            continue
        state.inventory[item_key] -= sell_amount
        sold_by_item[item_key] += sell_amount
        earned += sell_amount * item_cfg.base_price * item_cfg.sell_multiplier

    state.money += earned
    return earned, sold_by_item


def process_sales_managers(
    state: SimState,
    downstream_buffer_seconds: float,
) -> tuple[float, float, set[str], Dict[str, int], Dict[str, int]]:
    """Buy deficits first, then sell surplus."""
    spent = 0.0
    deficit_items: set[str] = set()
    bought_by_item = {item_key: 0 for item_key in ITEMS}

    # Managers buy missing items to bring negative inventories back to zero.
    for item_key, amount in state.inventory.items():
        if amount < 0:
            deficit = -amount
            state.inventory[item_key] = 0
            cost = deficit * ITEMS[item_key].cost
            state.money -= cost
            spent += cost
            deficit_items.add(item_key)
            bought_by_item[item_key] += deficit

    earned, sold_by_item = step_selling(state, downstream_buffer_seconds)
    return earned, spent, deficit_items, bought_by_item, sold_by_item


def evaluate_upgrade_roi_fast(state: SimState, action_type: str, machine_key: str, downstream_buffer_seconds: float) -> ActionCandidate:
    """Compute a quick approximate ROI for plotting diagnostics."""
    baseline = estimate_money_per_second(state, downstream_buffer_seconds)
    test_state = copy.deepcopy(state)

    if action_type == "buy_machine":
        conf = MACHINES[machine_key]
        cost = conf.cost
        test_state.machines[machine_key].owned = True
    elif action_type == "speed_upgrade":
        ms = test_state.machines[machine_key]
        cost = calculate_next_speed_upgrade_cost(test_state, machine_key)
        ms.speed_upgrade += 1
    elif action_type == "eff_upgrade":
        ms = test_state.machines[machine_key]
        cost = calculate_next_eff_upgrade_cost(test_state, machine_key)
        ms.efficiency_upgrade += 1
    else:
        return ActionCandidate(action_type, machine_key, float("inf"), float("inf"), projected_gain=float("-inf"), delta_income_per_second=0.0)

    after = estimate_money_per_second(test_state, downstream_buffer_seconds)
    delta = after - baseline
    if delta <= 1e-9:
        return ActionCandidate(action_type, machine_key, cost, float("inf"), projected_gain=-cost, delta_income_per_second=0.0)

    return ActionCandidate(
        action_type,
        machine_key,
        cost,
        cost / delta,
        projected_gain=0.0,
        delta_income_per_second=delta,
    )


def calculate_factory_upgrade_payback_minutes(
    state: SimState,
    action_type: str,
    machine_key: str,
    downstream_buffer_seconds: float,
) -> float:
    """Return payback minutes using whole-factory money/s delta from one upgrade."""
    baseline = estimate_money_per_second(state, downstream_buffer_seconds)
    test_state = copy.deepcopy(state)

    if action_type == "speed_upgrade":
        ms = test_state.machines[machine_key]
        cost = calculate_next_speed_upgrade_cost(test_state, machine_key)
        ms.speed_upgrade += 1
    elif action_type == "eff_upgrade":
        ms = test_state.machines[machine_key]
        cost = calculate_next_eff_upgrade_cost(test_state, machine_key)
        ms.efficiency_upgrade += 1
    else:
        return math.nan

    after = estimate_money_per_second(test_state, downstream_buffer_seconds)
    delta = after - baseline
    if delta <= 1e-12:
        return math.nan

    return (cost / delta) / 60.0


def select_action(
    state: SimState,
    downstream_buffer_seconds: float,
    policy: str,
    deficit_items: set[str],
) -> Optional[ActionCandidate]:
    """Pick next action using cheap-first or flow-balance policy."""

    def cheapest_machine_purchase(filter_items: Optional[set[str]] = None) -> Optional[ActionCandidate]:
        machine_choices: List[ActionCandidate] = []
        for machine_key, conf in MACHINES.items():
            ms = state.machines[machine_key]
            if ms.owned:
                continue
            if state.level < conf.level_required:
                continue
            if conf.cost > state.money:
                continue
            if filter_items is not None and conf.produces not in filter_items:
                continue

            roi_est = evaluate_upgrade_roi_fast(
                state,
                "buy_machine",
                machine_key,
                downstream_buffer_seconds,
            ).roi_seconds
            machine_choices.append(ActionCandidate("buy_machine", machine_key, conf.cost, roi_est))

        if not machine_choices:
            return None
        machine_choices.sort(key=lambda c: (c.cost, MACHINES[c.machine_key].level_required, c.machine_key))
        return machine_choices[0]

    def cheapest_upgrade(filter_items: Optional[set[str]] = None) -> Optional[ActionCandidate]:
        upgrade_choices: List[ActionCandidate] = []
        for machine_key, conf in MACHINES.items():
            ms = state.machines[machine_key]
            if not ms.owned:
                continue
            if filter_items is not None and conf.produces not in filter_items:
                continue

            speed_cost = calculate_next_speed_upgrade_cost(state, machine_key)
            if speed_cost <= state.money:
                speed_roi = evaluate_upgrade_roi_fast(
                    state,
                    "speed_upgrade",
                    machine_key,
                    downstream_buffer_seconds,
                ).roi_seconds
                upgrade_choices.append(ActionCandidate("speed_upgrade", machine_key, speed_cost, speed_roi))

            eff_cost = calculate_next_eff_upgrade_cost(state, machine_key)
            if eff_cost <= state.money:
                eff_roi = evaluate_upgrade_roi_fast(
                    state,
                    "eff_upgrade",
                    machine_key,
                    downstream_buffer_seconds,
                ).roi_seconds
                upgrade_choices.append(ActionCandidate("eff_upgrade", machine_key, eff_cost, eff_roi))

        if not upgrade_choices:
            return None
        upgrade_choices.sort(key=lambda c: (c.cost, c.action_type, c.machine_key))
        return upgrade_choices[0]

    if policy == "flow-balance" and deficit_items:
        fix_upgrade = cheapest_upgrade(deficit_items)
        if fix_upgrade is not None:
            return fix_upgrade
        fix_machine = cheapest_machine_purchase(deficit_items)
        if fix_machine is not None:
            return fix_machine

    machine_choice = cheapest_machine_purchase()
    if machine_choice is not None:
        return machine_choice
    return cheapest_upgrade()


def apply_action(state: SimState, candidate: ActionCandidate) -> PurchaseEvent:
    """Apply selected action and create purchase event."""
    state.money -= candidate.cost

    if candidate.action_type == "buy_machine":
        state.machines[candidate.machine_key].owned = True
    elif candidate.action_type == "speed_upgrade":
        state.machines[candidate.machine_key].speed_upgrade += 1
    elif candidate.action_type == "eff_upgrade":
        state.machines[candidate.machine_key].efficiency_upgrade += 1

    return PurchaseEvent(
        t_seconds=state.time_seconds,
        action_type=candidate.action_type,
        machine_key=candidate.machine_key,
        cost=candidate.cost,
        money_after=state.money,
        roi_seconds=candidate.roi_seconds,
    )


def init_machine_history() -> Dict[str, Dict[str, List[float]]]:
    """Initialize time-series storage per machine."""
    history: Dict[str, Dict[str, List[float]]] = {}
    for machine_key in MACHINES:
        history[machine_key] = {
            "time_minutes": [],
            "owned": [],
            "speed_level": [],
            "eff_level": [],
            "next_speed_cost": [],
            "next_eff_cost": [],
            "output_rate": [],
            "items_per_minute": [],
            "best_upgrade_payback_minutes": [],
        }
    return history


def snapshot_machine_history(
    state: SimState,
    machine_history: Dict[str, Dict[str, List[float]]],
    downstream_buffer_seconds: float,
) -> None:
    """Append current machine states to time-series history."""
    t_min = state.time_seconds / 60.0
    for machine_key, conf in MACHINES.items():
        ms = state.machines[machine_key]

        if ms.owned:
            next_speed = calculate_next_speed_upgrade_cost(state, machine_key)
            next_eff = calculate_next_eff_upgrade_cost(state, machine_key)
            out_rate = machine_total_output_rate(state, machine_key)

            speed_payback = calculate_factory_upgrade_payback_minutes(
                state,
                "speed_upgrade",
                machine_key,
                downstream_buffer_seconds,
            )
            eff_payback = calculate_factory_upgrade_payback_minutes(
                state,
                "eff_upgrade",
                machine_key,
                downstream_buffer_seconds,
            )

            payback_options = [x for x in (speed_payback, eff_payback) if math.isfinite(x)]
            best_payback_minutes = min(payback_options) if payback_options else math.nan
        else:
            next_speed = math.nan
            next_eff = math.nan
            out_rate = 0.0
            best_payback_minutes = math.nan

        machine_history[machine_key]["time_minutes"].append(t_min)
        machine_history[machine_key]["owned"].append(1.0 if ms.owned else 0.0)
        machine_history[machine_key]["speed_level"].append(float(ms.speed_upgrade))
        machine_history[machine_key]["eff_level"].append(float(ms.efficiency_upgrade))
        machine_history[machine_key]["next_speed_cost"].append(float(next_speed))
        machine_history[machine_key]["next_eff_cost"].append(float(next_eff))
        machine_history[machine_key]["output_rate"].append(float(out_rate))
        machine_history[machine_key]["items_per_minute"].append(float(out_rate * 60.0))
        machine_history[machine_key]["best_upgrade_payback_minutes"].append(float(best_payback_minutes))


def run_simulation(tuning: SimTuning, policy: str):
    """Run a simplified active-only progression simulation."""
    state = empty_state()
    machine_order = build_machine_order()

    timeline: List[Dict[str, float]] = []
    purchases: List[PurchaseEvent] = []
    machine_history = init_machine_history()
    deficit_items: set[str] = set()
    sell_timer = 0.0
    cumulative_bought = {item_key: 0 for item_key in ITEMS}
    cumulative_sold = {item_key: 0 for item_key in ITEMS}
    item_trade_history = {
        item_key: {
            "time_minutes": [],
            "bought_this_step": [],
            "sold_this_step": [],
            "cumulative_bought": [],
            "cumulative_sold": [],
        }
        for item_key in ITEMS
    }

    total_steps = int((tuning.duration_minutes * 60.0) / tuning.dt_seconds)
    print(f"Starting simulation for {tuning.duration_minutes} minutes ({total_steps} steps) with policy '{policy}'")
    for step_idx in range(total_steps):
        state.time_seconds = step_idx * tuning.dt_seconds

        step_production(state, tuning.dt_seconds, machine_order)

        # Managers are processed after production in coarser intervals.
        earned_step = 0.0
        sell_timer += tuning.dt_seconds
        if sell_timer >= tuning.sell_interval_seconds:
            manager_calls = int(sell_timer / tuning.sell_interval_seconds)
            deficit_items = set()
            step_bought = {item_key: 0 for item_key in ITEMS}
            step_sold = {item_key: 0 for item_key in ITEMS}
            for _ in range(manager_calls):
                earned, _spent, deficits, bought_by_item, sold_by_item = process_sales_managers(
                    state,
                    tuning.downstream_buffer_seconds,
                )
                earned_step += earned
                deficit_items.update(deficits)
                for item_key in ITEMS:
                    step_bought[item_key] += bought_by_item[item_key]
                    step_sold[item_key] += sold_by_item[item_key]
            sell_timer -= manager_calls * tuning.sell_interval_seconds
        else:
            step_bought = {item_key: 0 for item_key in ITEMS}
            step_sold = {item_key: 0 for item_key in ITEMS}

        for item_key in ITEMS:
            cumulative_bought[item_key] += step_bought[item_key]
            cumulative_sold[item_key] += step_sold[item_key]
            item_trade_history[item_key]["time_minutes"].append(state.time_seconds / 60.0)
            item_trade_history[item_key]["bought_this_step"].append(step_bought[item_key])
            item_trade_history[item_key]["sold_this_step"].append(step_sold[item_key])
            item_trade_history[item_key]["cumulative_bought"].append(cumulative_bought[item_key])
            item_trade_history[item_key]["cumulative_sold"].append(cumulative_sold[item_key])

        actions_this_step = 0
        while actions_this_step < tuning.max_actions_per_tick:
            action = select_action(state, tuning.downstream_buffer_seconds, policy, deficit_items)
            if action is None:
                break
            purchases.append(apply_action(state, action))
            actions_this_step += 1

        snapshot_machine_history(state, machine_history, tuning.downstream_buffer_seconds)

        money_rate = estimate_money_per_second(state, tuning.downstream_buffer_seconds)
        owned_count = sum(1 for m in state.machines.values() if m.owned)
        total_speed = sum(m.speed_upgrade for m in state.machines.values())
        total_eff = sum(m.efficiency_upgrade for m in state.machines.values())

        timeline.append(
            {
                "time_seconds": state.time_seconds,
                "money": state.money,
                "level": float(state.level),
                "experience": state.experience,
                "next_level_experience": state.next_level_experience,
                "owned_machines": float(owned_count),
                "total_speed_levels": float(total_speed),
                "total_eff_levels": float(total_eff),
                "estimated_money_per_second": money_rate,
                "money_earned_this_step": earned_step,
                "actions_this_step": float(actions_this_step),
            }
        )

    state.time_seconds = tuning.duration_minutes * 60.0
    return state, timeline, purchases, machine_history, item_trade_history


def save_csv(path: Path, rows: List[Dict[str, float]]) -> None:
    """Save rows to CSV file."""
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def save_purchases(path: Path, purchases: List[PurchaseEvent]) -> None:
    """Save purchase events to CSV."""
    rows = []
    for p in purchases:
        rows.append(
            {
                "time_seconds": p.t_seconds,
                "action_type": p.action_type,
                "machine_key": p.machine_key,
                "cost": p.cost,
                "money_after": p.money_after,
                "roi_seconds": p.roi_seconds,
            }
        )
    save_csv(path, rows)


def save_machine_history_csv(output_dir: Path, machine_history: Dict[str, Dict[str, List[float]]]) -> None:
    """Save one CSV per machine with levels, costs, and output rate over time."""
    history_dir = output_dir / "machine_history"
    history_dir.mkdir(parents=True, exist_ok=True)

    for machine_key, h in machine_history.items():
        row_count = len(h["time_minutes"])
        rows = []
        for i in range(row_count):
            rows.append(
                {
                    "time_minutes": h["time_minutes"][i],
                    "owned": h["owned"][i],
                    "speed_level": h["speed_level"][i],
                    "eff_level": h["eff_level"][i],
                    "next_speed_cost": h["next_speed_cost"][i],
                    "next_eff_cost": h["next_eff_cost"][i],
                    "output_rate": h["output_rate"][i],
                    "items_per_minute": h["items_per_minute"][i],
                    "best_upgrade_payback_minutes": h["best_upgrade_payback_minutes"][i],
                }
            )
        save_csv(history_dir / f"{machine_key}.csv", rows)


def save_item_trade_history_csv(output_dir: Path, item_trade_history: Dict[str, Dict[str, List[float]]]) -> None:
    """Save one CSV per item with buy/sell flow and cumulative totals."""
    history_dir = output_dir / "item_trade_history"
    history_dir.mkdir(parents=True, exist_ok=True)

    for item_key, h in item_trade_history.items():
        row_count = len(h["time_minutes"])
        rows = []
        for i in range(row_count):
            rows.append(
                {
                    "time_minutes": h["time_minutes"][i],
                    "bought_this_step": h["bought_this_step"][i],
                    "sold_this_step": h["sold_this_step"][i],
                    "cumulative_bought": h["cumulative_bought"][i],
                    "cumulative_sold": h["cumulative_sold"][i],
                }
            )
        save_csv(history_dir / f"{item_key}.csv", rows)


def save_item_trade_summary_figure(output_dir: Path, item_trade_history: Dict[str, Dict[str, List[float]]]) -> None:
    """Save multi-subplot summary for bought and sold item flows on log scale."""
    item_keys = list(ITEMS.keys())
    cols = 3
    rows = math.ceil(len(item_keys) / cols)

    fig, axes = plt.subplots(rows, cols, figsize=(18, 9), sharex=True)
    axes_flat = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for idx, item_key in enumerate(item_keys):
        ax = axes_flat[idx]
        h = item_trade_history[item_key]
        t = h["time_minutes"]
        bought = h["bought_this_step"]
        sold = h["sold_this_step"]

        # Add 1 for log scale visibility when zero values are present.
        ax.plot(t, [x + 1 for x in bought], label="Bought (+1)", linewidth=1.8)
        ax.plot(t, [x + 1 for x in sold], label="Sold (+1)", linewidth=1.8)
        ax.set_yscale("log")
        ax.grid(True, alpha=0.3)

        total_bought = int(h["cumulative_bought"][-1]) if h["cumulative_bought"] else 0
        total_sold = int(h["cumulative_sold"][-1]) if h["cumulative_sold"] else 0
        ax.set_title(f"{item_key} | cum bought: {total_bought:,} | cum sold: {total_sold:,}", fontsize=9)
        ax.set_xlabel("Time (minutes)")
        ax.set_ylabel("Items per step (log)")
        ax.legend(fontsize=7)

    # Hide unused axes in case grid has extra cells.
    for j in range(len(item_keys), len(axes_flat)):
        axes_flat[j].axis("off")

    fig.suptitle("Item Manager Flow Summary (Bought vs Sold)", fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(output_dir / "item_trade_summary.png", dpi=170)
    plt.close(fig)


def save_final_machine_summary(path: Path, state: SimState) -> None:
    """Save final ownership/upgrade summary for all machines."""
    rows: List[Dict[str, float]] = []
    for machine_key, conf in MACHINES.items():
        ms = state.machines[machine_key]
        rows.append(
            {
                "machine_key": machine_key,
                "machine_name": conf.name,
                "owned": float(1 if ms.owned else 0),
                "speed_upgrade": float(ms.speed_upgrade),
                "efficiency_upgrade": float(ms.efficiency_upgrade),
                "next_speed_cost": float(calculate_next_speed_upgrade_cost(state, machine_key)),
                "next_eff_cost": float(calculate_next_eff_upgrade_cost(state, machine_key)),
                "output_rate": float(machine_total_output_rate(state, machine_key) if ms.owned else 0.0),
            }
        )

    save_csv(path, rows)


def save_overview_plot(
    output_dir: Path,
    timeline: List[Dict[str, float]],
    purchases: List[PurchaseEvent],
) -> None:
    """Save compact progression overview plot."""
    t = [r["time_seconds"] / 60.0 for r in timeline]
    money = [r["money"] for r in timeline]
    money_rate = [r["estimated_money_per_second"] for r in timeline]
    owned = [r["owned_machines"] for r in timeline]
    speed_lv = [r["total_speed_levels"] for r in timeline]
    eff_lv = [r["total_eff_levels"] for r in timeline]
    cumulative_money = sum(r["money_earned_this_step"] for r in timeline)
    final_owned = int(owned[-1]) if owned else 0
    final_speed = int(speed_lv[-1]) if speed_lv else 0
    final_eff = int(eff_lv[-1]) if eff_lv else 0

    fig, axes = plt.subplots(4, 1, figsize=(12, 14), sharex=True)
    fig.suptitle(
        (
            "Progression Overview\n"
            f"Cumulative Money Gained: {cumulative_money:,.2f} | "
            f"Final Owned Machines: {final_owned} | "
            f"Final Speed Upgrades: {final_speed} | Final Efficiency Upgrades: {final_eff}"
        ),
        fontsize=11,
        y=0.995,
    )

    axes[0].plot(t, money, linewidth=2, color="tab:green")
    axes[0].set_title("Money Over Time")
    axes[0].set_ylabel("Money")
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(t, money_rate, linewidth=2, color="tab:blue")
    axes[1].set_title("Estimated Income Rate")
    axes[1].set_ylabel("Money/s")
    axes[1].grid(True, alpha=0.3)

    axes[2].plot(t, owned, label="Owned Machines", linewidth=2)
    axes[2].plot(t, speed_lv, label="Total Speed Levels", linewidth=2)
    axes[2].plot(t, eff_lv, label="Total Efficiency Levels", linewidth=2)
    axes[2].set_title("Progression State")
    axes[2].set_ylabel("Count")
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)

    purchase_times_min = [p.t_seconds / 60.0 for p in purchases]
    if len(purchase_times_min) >= 2:
        intervals = [purchase_times_min[i] - purchase_times_min[i - 1] for i in range(1, len(purchase_times_min))]
        axes[3].plot(purchase_times_min[1:], intervals, color="tab:purple", linewidth=1.8)
        axes[3].set_title("Time Between Purchases")
        axes[3].set_ylabel("Minutes")
    elif len(purchase_times_min) == 1:
        axes[3].scatter([purchase_times_min[0]], [0.0], color="tab:purple", s=20)
        axes[3].set_title("Time Between Purchases")
        axes[3].set_ylabel("Minutes")
        axes[3].text(0.5, 0.6, "Only one purchase in run", transform=axes[3].transAxes, ha="center")
    else:
        axes[3].set_title("Time Between Purchases")
        axes[3].set_ylabel("Minutes")
        axes[3].text(0.5, 0.6, "No purchases in run", transform=axes[3].transAxes, ha="center")

    axes[3].set_xlabel("Time (minutes)")
    axes[3].grid(True, alpha=0.3)

    fig.tight_layout(rect=[0, 0, 1, 0.965])
    fig.savefig(output_dir / "overview_progression.png", dpi=160)
    plt.close(fig)


def save_purchase_price_plot(output_dir: Path, purchases: List[PurchaseEvent]) -> None:
    """Save purchase price evolution plot colored by action type."""
    if not purchases:
        return

    action_colors = {
        "buy_machine": "tab:purple",
        "speed_upgrade": "tab:orange",
        "eff_upgrade": "tab:red",
    }

    fig, ax = plt.subplots(figsize=(12, 5))
    for action_type in ("buy_machine", "speed_upgrade", "eff_upgrade"):
        x = [p.t_seconds / 60.0 for p in purchases if p.action_type == action_type]
        y = [p.cost for p in purchases if p.action_type == action_type]
        if x:
            ax.scatter(x, y, s=14, alpha=0.75, label=action_type, color=action_colors[action_type])

    ax.set_title("Purchase Price Evolution During Run")
    ax.set_xlabel("Time (minutes)")
    ax.set_ylabel("Purchase Cost")
    ax.set_yscale("log")
    ax.grid(True, alpha=0.3)
    ax.legend()

    fig.tight_layout()
    fig.savefig(output_dir / "purchase_price_evolution.png", dpi=160)
    plt.close(fig)


def save_machine_dashboard(output_dir: Path, machine_history: Dict[str, Dict[str, List[float]]]) -> None:
    """Save one combined 3x4 machine dashboard with 3 subplots per machine."""
    machine_keys = list(MACHINES.keys())

    fig = plt.figure(figsize=(26, 18))
    outer = GridSpec(3, 4, figure=fig, wspace=0.22, hspace=0.22)

    for idx, machine_key in enumerate(machine_keys):
        row = idx // 4
        col = idx % 4
        history = machine_history[machine_key]

        t = history["time_minutes"]
        speed_level = history["speed_level"]
        eff_level = history["eff_level"]
        speed_cost = history["next_speed_cost"]
        eff_cost = history["next_eff_cost"]
        payback_min = history["best_upgrade_payback_minutes"]
        items_per_min = history["items_per_minute"]
        owned = history["owned"]

        inner = GridSpecFromSubplotSpec(3, 1, subplot_spec=outer[row, col], hspace=0.13)
        ax1 = fig.add_subplot(inner[0, 0])
        ax2 = fig.add_subplot(inner[1, 0], sharex=ax1)
        ax3 = fig.add_subplot(inner[2, 0], sharex=ax1)

        ax1.plot(t, speed_level, color="tab:blue", linewidth=1.6)
        ax1.set_title(f"{machine_key}: speed", fontsize=9)
        ax1.set_ylabel("Lvl", fontsize=8)
        ax1.tick_params(axis="both", labelsize=7)
        ax1.grid(True, alpha=0.25)

        ax1_cost = ax1.twinx()
        ax1_cost.plot(t, speed_cost, color="tab:orange", linewidth=1.0, alpha=0.9)
        ax1_cost.set_yscale("log")
        ax1_cost.set_ylabel("Cost", fontsize=8)
        ax1_cost.tick_params(axis="y", labelsize=7)

        ax2.plot(t, eff_level, color="tab:green", linewidth=1.6)
        ax2.set_title(f"{machine_key}: efficiency", fontsize=9)
        ax2.set_ylabel("Lvl", fontsize=8)
        ax2.tick_params(axis="both", labelsize=7)
        ax2.grid(True, alpha=0.25)

        ax2_cost = ax2.twinx()
        ax2_cost.plot(t, eff_cost, color="tab:red", linewidth=1.0, alpha=0.9)
        ax2_cost.set_yscale("log")
        ax2_cost.set_ylabel("Cost", fontsize=8)
        ax2_cost.tick_params(axis="y", labelsize=7)

        ax3.plot(t, payback_min, color="tab:purple", linewidth=1.4)
        ax3.set_title(f"{machine_key}: payback + items/min", fontsize=9)
        ax3.set_ylabel("Payback m", fontsize=8)
        ax3.tick_params(axis="both", labelsize=7)
        ax3.grid(True, alpha=0.25)

        ax3_items = ax3.twinx()
        ax3_items.plot(t, items_per_min, color="tab:brown", linewidth=1.0, alpha=0.9)
        ax3_items.set_ylabel("Items/m", fontsize=8)
        ax3_items.tick_params(axis="y", labelsize=7)

        never_owned = max(owned) < 0.5
        if never_owned:
            ax1.text(0.5, 0.5, "Never purchased", ha="center", va="center", transform=ax1.transAxes, fontsize=8)
            ax2.text(0.5, 0.5, "Never purchased", ha="center", va="center", transform=ax2.transAxes, fontsize=8)
            ax3.text(0.5, 0.5, "Never purchased", ha="center", va="center", transform=ax3.transAxes, fontsize=8)
        else:
            first_owned_index = next(i for i, v in enumerate(owned) if v > 0.5)
            first_owned_t = t[first_owned_index]
            ax1.axvspan(t[0], first_owned_t, color="gray", alpha=0.10)
            ax2.axvspan(t[0], first_owned_t, color="gray", alpha=0.10)
            ax3.axvspan(t[0], first_owned_t, color="gray", alpha=0.10)

        if row < 2:
            ax1.tick_params(labelbottom=False)
            ax2.tick_params(labelbottom=False)
            ax3.tick_params(labelbottom=False)
        ax3.set_xlabel("Time (m)", fontsize=8)

    fig.suptitle("Machine Dashboard (3x4) - Levels, Prices, Payback, and Items per Minute", fontsize=14)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(output_dir / "machine_dashboard_3x4.png", dpi=170)
    plt.close(fig)


def create_run_output_dir(base_dir: Path) -> Path:
    """Create timestamped output folder."""
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = base_dir / f"run_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def run_and_save(args: argparse.Namespace) -> None:
    """Run simulation and save CSV/plots."""
    tuning = SimTuning(
        duration_minutes=args.duration_minutes,
        dt_seconds=args.dt_seconds,
        downstream_buffer_seconds=args.buffer_seconds,
        max_actions_per_tick=args.max_actions_per_tick,
        sell_interval_seconds=args.sell_interval_seconds,
    )

    state, timeline, purchases, machine_history, item_trade_history = run_simulation(tuning, args.policy)

    out_root = Path(__file__).parent / "outputs"
    out_dir = create_run_output_dir(out_root)

    save_csv(out_dir / "timeline.csv", timeline)
    save_purchases(out_dir / "purchases.csv", purchases)
    save_machine_history_csv(out_dir, machine_history)
    save_item_trade_history_csv(out_dir, item_trade_history)
    save_final_machine_summary(out_dir / "final_machine_summary.csv", state)

    save_overview_plot(out_dir, timeline, purchases)
    save_purchase_price_plot(out_dir, purchases)
    save_machine_dashboard(out_dir, machine_history)
    save_item_trade_summary_figure(out_dir, item_trade_history)

    summary = {
        "duration_minutes": tuning.duration_minutes,
        "dt_seconds": tuning.dt_seconds,
        "buffer_seconds": tuning.downstream_buffer_seconds,
        "max_actions_per_tick": tuning.max_actions_per_tick,
        "sell_interval_seconds": tuning.sell_interval_seconds,
        "policy": args.policy,
        "final_money": state.money,
        "final_level": state.level,
        "purchase_count": len(purchases),
    }
    (out_dir / "run_config.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("Simulation complete.")
    print(f"Output folder: {out_dir}")
    print(f"Final money: {state.money:,.2f}")
    print(f"Final level: {state.level}")
    print(f"Purchases: {len(purchases)}")


def main() -> None:
    """CLI entrypoint for simplified simulator."""
    parser = argparse.ArgumentParser(description="Coffee Queen simplified progression simulator")
    parser.add_argument("--duration-minutes", type=float, default=30.0)
    parser.add_argument("--dt-seconds", type=float, default=0.25)
    parser.add_argument("--buffer-seconds", type=float, default=30.0)
    parser.add_argument("--max-actions-per-tick", type=int, default=6)
    parser.add_argument("--sell-interval-seconds", type=float, default=1.0)
    parser.add_argument("--policy", choices=POLICIES, default="cheap-first")

    args = parser.parse_args()
    run_and_save(args)


if __name__ == "__main__":
    main()
