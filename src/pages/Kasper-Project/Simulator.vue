<template>
  <div id="app-container">
    <!-- DVD canvas in background -->
    <div class="dvd-background" v-if="owned.dvd">
      <DvdScreensaver
        :dvd-count="owned.dvd"
        :logo-src="'/assets/simulator/dvd.webp'"
        :hit-sound="'/assets/simulator/dvd-hit.mp3'"
        :volume="0.3"
        :color-change-on-bounce="!!owned.colorChange"
        :show-rain="!!owned.rain"
        :show-thunder="!!owned.thunder"
        @hit="onDvdHit"
      />
    </div>

    <!-- Media overlays positioned around the screen -->
    <div class="media-overlays">
      <!-- Nyan Cat - top left -->
      <div v-if="owned.nyanCat" class="media-overlay" :style="{ top: '1rem', left: '1rem' }">
        <img src="/assets/simulator/nyan-cat.gif" alt="nyan cat" />
        <audio src="/assets/simulator/nyan-cat.mp3" autoplay loop :volume="0.01" />
      </div>

      <!-- Gibson - top right -->
      <div v-if="owned.gibson" class="media-overlay" :style="{ top: '1rem', right: '1rem' }">
        <video src="/assets/simulator/gibson.mp4" autoplay :loop="false" playsinline :volume="1" />
      </div>

      <!-- qPCR - bottom left -->
      <div v-if="owned.qpcr" class="media-overlay" :style="{ bottom: '1rem', left: '1rem' }">
        <video src="/assets/simulator/qpcr.mp4" autoplay loop playsinline :volume="1" />
      </div>

      <!-- Mukbang - bottom right -->
      <div v-if="owned.mukbang" class="media-overlay" :style="{ bottom: '1rem', right: '1rem' }">
        <video src="/assets/simulator/mukbang.mp4" autoplay loop playsinline />
      </div>

      <!-- Subway Surfers - bottom middle -->
      <div
        v-if="owned.subwaySurfers"
        class="media-overlay"
        :style="{
          bottom: '1rem',
          left: '30%',
          transform: 'translateX(-50%)',
          width: '90px',
          height: '200px',
        }"
      >
        <video src="/assets/simulator/subway-surfers.mp4" autoplay loop playsinline />
      </div>

      <!-- MC Parkour - bottom middle -->
      <div
        v-if="owned.mc_parkour"
        class="media-overlay"
        :style="{ bottom: '50%', left: '10%', transform: 'translate(-50%, 50%)' }"
      >
        <video src="/assets/simulator/mc-parkour.mp4" autoplay loop playsinline />
      </div>

      <!-- Gangnam Style - Top middle-right -->
      <div v-if="owned.gangnamStyle" class="media-overlay" :style="{ top: '1rem', right: '35%' }">
        <img src="/assets/simulator/gangnam-style.gif" alt="gangnam style" />
      </div>
    </div>

    <!-- Main UI content -->
    <div class="main-content">
      <div class="main-container">
        <div class="money-display">
          <h2>Pengar: {{ money.toFixed(0) }} kr</h2>
          <div class="rates">
            <span>Per klick: +{{ displayPerClick }}</span>
            <span>Passivt: {{ passivePerSecond.toFixed(1) }}/s</span>
            <span v-if="totalCritChance > 0"
              >Crit: {{ (totalCritChance * 100).toFixed(0) }}% ×
              {{ totalCritMultiplier.toFixed(2) }}</span
            >
          </div>
          <div class="generation-display">
            <span>Genererar: {{ currentGeneration.toFixed(1) }}/s</span>
          </div>
        </div>
        <div class="clicker">
          <button class="click-btn" @click="doClick">Klicka!</button>
        </div>
      </div>

      <!-- Upgrades in a single horizontal row -->
      <section class="shop">
        <div class="upgrades-row">
          <div v-for="upgrade in visibleUpgrades" :key="upgrade.id" class="upgrade-container">
            <button
              class="upgrade-btn"
              :disabled="!canAfford(upgrade) || isMaxed(upgrade)"
              @click="buy(upgrade)"
            >
              <img v-if="upgrade.icon" :src="upgrade.icon" alt="" class="icon" />
              <small v-if="owned[upgrade.id]" class="level-badge">{{ owned[upgrade.id] }}</small>
            </button>
            <div class="upgrade-tooltip">
              <div class="title">
                {{ upgrade.name }}
                <small v-if="owned[upgrade.id]">Lv. {{ owned[upgrade.id] }}</small>
              </div>
              <div class="desc">{{ upgrade.description }}</div>
              <div class="effects">
                <div v-if="upgrade.perClick" class="effect">
                  +{{ upgrade.perClick }} kr per klick
                </div>
                <div v-if="upgrade.clickMultiplier" class="effect">
                  {{ upgrade.clickMultiplier }}x klickmultiplikator
                </div>
                <div v-if="upgrade.passivePerSecond" class="effect">
                  +{{ upgrade.passivePerSecond }} kr/s
                </div>
                <div v-if="upgrade.perBounce" class="effect">
                  +{{ upgrade.perBounce * (owned[upgrade.id] || 1) }} kr per studs
                </div>
                <div v-if="upgrade.critChance" class="effect">
                  +{{ (upgrade.critChance * 100).toFixed(0) }}% crit-chans
                </div>
                <div v-if="upgrade.critMultiplier" class="effect">
                  {{ upgrade.critMultiplier }}x crit-multiplikator
                </div>
                <div v-if="upgrade.colorChangeOnBounce" class="effect">
                  DVD:er byter färg vid studs
                </div>
                <div v-if="upgrade.showRain" class="effect">Regneffekt aktiverad</div>
                <div v-if="upgrade.showThunder" class="effect">Åskeffekt aktiverad</div>
              </div>
              <div class="cost">{{ getNextCost(upgrade).toFixed(0) }} kr</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import DvdScreensaver from '@/components/simulator/DvdScreensaver.vue'
import { UPGRADES, costAtLevel, type Upgrade } from '@/components/simulator/upgrades'

// Game state
const money = ref(1)
const owned = reactive<Record<string, number>>({})
const highestMoneyReached = ref(0)

// Track which upgrades have been unlocked (70% threshold reached)
const unlockedUpgrades = reactive<Set<string>>(new Set())

// Track live generation (kr/s)
const moneyLastSecond = ref(0)
const currentGeneration = ref(0)

// Sounds
const purchaseSound = new Audio('/assets/simulator/windows-startup.mp3')

// Calculate stats from owned upgrades
const perClickFlat = computed(() => {
  let flat = 1 // base click value
  UPGRADES.forEach((upgrade) => {
    const level = owned[upgrade.id] || 0
    if (level && upgrade.perClick) {
      flat += upgrade.perClick * level
    }
  })
  return flat
})

const clickMultiplier = computed(() => {
  let mult = 1
  UPGRADES.forEach((upgrade) => {
    const level = owned[upgrade.id] || 0
    if (level && upgrade.clickMultiplier) {
      mult *= Math.pow(upgrade.clickMultiplier, level)
    }
  })
  return mult
})

const totalCritChance = computed(() => {
  let chance = 0
  UPGRADES.forEach((upgrade) => {
    const level = owned[upgrade.id] || 0
    if (level && upgrade.critChance) {
      chance += upgrade.critChance * level
    }
  })
  return Math.min(0.95, chance)
})

const totalCritMultiplier = computed(() => {
  let mult = 1
  UPGRADES.forEach((upgrade) => {
    const level = owned[upgrade.id] || 0
    if (level && upgrade.critMultiplier) {
      mult *= Math.pow(upgrade.critMultiplier, level)
    }
  })
  return mult
})

const perClick = computed(() => perClickFlat.value * clickMultiplier.value)
const displayPerClick = computed(() => perClick.value.toFixed(0))

const passivePerSecond = computed(() => {
  let pps = 0
  UPGRADES.forEach((upgrade) => {
    const level = owned[upgrade.id] || 0
    if (level && upgrade.passivePerSecond) {
      pps += upgrade.passivePerSecond * level
    }
  })
  return pps
})

// Upgrade filtering logic
const visibleUpgrades = computed(() => {
  const filtered: Upgrade[] = []

  for (const upgrade of UPGRADES) {
    const currentLevel = owned[upgrade.id] || 0
    const maxLvl = upgrade.maxLevel || 1

    // If already maxed and maxLevel is 1 (single purchase), hide it
    if (currentLevel >= maxLvl && maxLvl === 1) {
      continue
    }

    // If already maxed but can have multiple levels, still hide once maxed
    if (currentLevel >= maxLvl) {
      continue
    }

    // Calculate cost for next level
    const nextCost = costAtLevel(upgrade.cost, upgrade.costMultiplier || 1.15, currentLevel)
    const threshold = nextCost * 0.7

    // Show if we've reached 70% of the cost OR already unlocked
    if (highestMoneyReached.value >= threshold || unlockedUpgrades.has(upgrade.id)) {
      unlockedUpgrades.add(upgrade.id) // Mark as unlocked
      filtered.push(upgrade)
    }
  }

  // Return only the first 5
  return filtered.slice(0, 5)
})

// Helper functions
function getNextCost(upgrade: Upgrade): number {
  const currentLevel = owned[upgrade.id] || 0
  return costAtLevel(upgrade.cost, upgrade.costMultiplier || 1.15, currentLevel)
}

function canAfford(upgrade: Upgrade): boolean {
  return money.value >= getNextCost(upgrade)
}

function isMaxed(upgrade: Upgrade): boolean {
  const currentLevel = owned[upgrade.id] || 0
  const maxLvl = upgrade.maxLevel || 1
  return currentLevel >= maxLvl
}

function buy(upgrade: Upgrade) {
  if (!canAfford(upgrade) || isMaxed(upgrade)) return

  const cost = getNextCost(upgrade)
  money.value -= cost
  owned[upgrade.id] = (owned[upgrade.id] || 0) + 1

  try {
    purchaseSound.currentTime = 0
    purchaseSound.play()
  } catch {}
}

function doClick() {
  let gain = perClick.value
  if (Math.random() < totalCritChance.value) {
    gain *= totalCritMultiplier.value
  }
  money.value += Math.round(gain)
}

function onDvdHit(bounceValue: number) {
  // Each DVD gives bounceValue per hit (1 or 5 depending on colorChange upgrade)
  const level = owned.dvd || 0
  money.value += bounceValue * level
}

// Track highest money reached
let moneyWatcher: any
let lastFrameTime = Date.now()

onMounted(() => {
  moneyWatcher = setInterval(() => {
    if (money.value > highestMoneyReached.value) {
      highestMoneyReached.value = money.value
    }
  }, 100)

  // Track live generation rate
  const generationTracker = setInterval(() => {
    const gained = money.value - moneyLastSecond.value
    currentGeneration.value = gained
    moneyLastSecond.value = money.value
  }, 1000)

  // Passive income per frame (for smooth updates)
  function passiveIncomeLoop() {
    const now = Date.now()
    const deltaTime = (now - lastFrameTime) / 1000 // Convert to seconds
    lastFrameTime = now

    const delta = passivePerSecond.value * deltaTime
    if (delta > 0) money.value += delta

    requestAnimationFrame(passiveIncomeLoop)
  }
  passiveIncomeLoop()

  onUnmounted(() => {
    clearInterval(moneyWatcher)
    clearInterval(generationTracker)
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/generalGames.scss';
#app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  min-height: 100%;
  padding: 20px;
  overflow: hidden;
}

// DVD background layer
.dvd-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.media-overlay {
  position: absolute;
  max-width: 300px;
  max-height: 200px;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

// Main content with higher z-index
.main-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 1200px;
}

.main-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.money-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: center;

  h2 {
    margin: 0;
    color: #333;
  }
}

.rates {
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #666;
  flex-wrap: wrap;
  justify-content: center;
}

.generation-display {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #ddd;
  font-size: 1rem;
  font-weight: 600;
  color: #4caf50;
}

.click-btn {
  font-size: 1.25rem;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  border: 2px solid #333;
  border-radius: 0.5rem;
  background: #4caf50;
  color: white;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: #45a049;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.shop {
  margin-bottom: 1.5rem;
  background: var(--theme-bg-secondary);
  color: var(--theme-text-secondary);
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  .upgrades-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem;
    justify-content: center;

    .upgrade-container {
      position: relative;
      display: flex;
      flex-direction: column;

      .upgrade-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border: 2px solid #ddd;
        border-radius: 0.5rem;
        background: #fafafa;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 70px;
        height: 70px;
        position: relative;

        &:hover:not(:disabled) {
          border-color: #4caf50;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .icon {
          width: 50px;
          height: 50px;
          object-fit: contain;
        }

        .level-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #4caf50;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 600;
        }
      }

      .upgrade-tooltip {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        width: 220px;
        opacity: 0;
        pointer-events: none;
        transition:
          opacity 0.2s ease,
          transform 0.2s ease;
        z-index: 100;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        &::after {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-bottom-color: rgba(0, 0, 0, 0.9);
        }

        .title {
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 0.25rem;

          small {
            margin-left: 0.25rem;
            opacity: 0.8;
          }
        }

        .desc {
          font-size: 0.8rem;
          line-height: 1.3;
          margin-bottom: 0.5rem;
          opacity: 0.9;
        }

        .effects {
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;

          .effect {
            color: #90ee90;
            opacity: 0.95;
          }
        }

        .cost {
          font-size: 0.85rem;
          font-weight: 600;
          color: #4caf50;
        }
      }

      &:hover .upgrade-tooltip {
        opacity: 1;
        transform: translateX(-50%) translateY(-12px);
      }
    }
  }
}
</style>
