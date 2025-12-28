<template>
  <div class="shop-modal-overlay" @click.self="emitClose">
    <div class="shop-modal">
      <h2>Machine Shop</h2>
      <div class="shop-items">
        <div v-for="(config, key) in machinesConfig" :key="key" class="shop-item">
          <img :src="config.icon" :alt="config.name" class="item-icon" />
          <div class="item-details">
            <h3>{{ config.name }}</h3>
            <p>Cost: ${{ config.cost }}</p>
          </div>
          <button @click="emitBuy(key)" :disabled="isOwned(key) || !canAfford(config.cost)">
            {{ isOwned(key) ? 'Owned' : 'Buy' }}
          </button>
        </div>
      </div>
      <button class="close-button" @click="emitClose">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MachineConfig, MachineKey } from '@/components/coffeequeen/types'

interface Props {
  machinesConfig: Record<MachineKey, MachineConfig>
  userMoney: number
  ownedMachines: MachineKey[]
}

interface Emits {
  (e: 'buy-machine', machineKey: MachineKey): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const canAfford = (cost: number): boolean => props.userMoney >= cost
const isOwned = (key: MachineKey): boolean => props.ownedMachines.includes(key)

const emitBuy = (key: MachineKey): void => {
  const machineConfig = props.machinesConfig[key]
  if (!isOwned(key) && canAfford(machineConfig.cost)) {
    emit('buy-machine', key)
  }
}

const emitClose = (): void => {
  emit('close')
}
</script>

<style scoped lang="scss">
.shop-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  font-family: 'Courier New', Courier, monospace;
}

.shop-modal {
  background-color: #cfae9e;
  padding: 20px;
  border-radius: 10px;
  border: 3px solid #452f26;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  color: #452f26;
}

h2 {
  text-align: center;
  margin-top: 0;
  margin-bottom: 20px;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.shop-item {
  display: flex;
  align-items: center;
  background-color: #8f6c5e;
  padding: 10px;
  border-radius: 8px;
  color: white;
}

.item-icon {
  width: 60px;
  height: 60px;
  margin-right: 15px;
}

.item-details {
  flex-grow: 1;

  h3 {
    margin: 0 0 5px 0;
  }

  p {
    margin: 0;
  }
}

button {
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;

  &:disabled {
    background-color: #555;
    cursor: not-allowed;
  }
}

.close-button {
  display: block;
  margin: 20px auto 0;
  background-color: #f44336;
}
</style>
