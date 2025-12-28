<template>
  <div class="offline-progress-overlay" @click.self="$emit('close')">
    <div class="offline-progress-modal">
      <h2>Welcome Back!</h2>
      <p>While you were away, your machines produced:</p>
      <div v-if="Object.keys(summary).length > 0" class="production-summary">
        <ul>
          <li v-for="(item, key) in detailedSummary" :key="key">
            <img :src="item.icon" :alt="item.name" class="item-icon" />
            <span>{{ item.name }}: +{{ item.amount.toLocaleString() }}</span>
          </li>
        </ul>
      </div>
      <div v-else>
        <p>No new items were produced while you were away.</p>
      </div>
      <p v-if="experience > 0">
        You gained <strong>{{ experience.toLocaleString() }}</strong> experience!
      </p>
      <button @click="$emit('close')">Got it!</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { OfflineProductionSummary, ItemData, ItemKey } from '@/components/coffeequeen/types'

interface Props {
  summary: OfflineProductionSummary
  experience: number
  itemData: Record<ItemKey, ItemData>
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const detailedSummary = computed(() => {
  console.log(Object.keys(props.summary).length, 'items produced while offline')
  const details: Record<string, any> = {}

  for (const key in props.summary) {
    const itemInfo = props.itemData[key as ItemKey]
    if (itemInfo) {
      details[key] = {
        ...props.summary[key],
        name: itemInfo.name,
        icon: itemInfo.icon,
      }
    }
  }
  return details
})

onMounted(() => {
  console.log(Object.keys(props.summary).length, 'items produced while offline')
  // Ensure the summary is computed correctly on mount
  if (Object.keys(detailedSummary.value).length === 0) {
    console.warn('No items produced while offline.')
  }
})
</script>

<style scoped lang="scss">
.offline-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.offline-progress-modal {
  background: #f5e7de;
  padding: 30px;
  border-radius: 15px;
  border: 3px solid #6f4c3e;
  text-align: center;
  max-width: 400px;
  width: 90%;
  font-family: 'Courier New', Courier, monospace;
  color: #452f26;

  h2 {
    color: #6f4c3e;
    margin-top: 0;
    font-size: 1.8rem;
  }

  p {
    font-size: 1.1rem;
    margin: 15px 0;
  }

  .production-summary {
    ul {
      list-style: none;
      padding: 0;
      margin: 20px 0;
      text-align: left;

      li {
        display: flex;
        align-items: center;
        font-size: 1.2rem;
        margin-bottom: 10px;

        .item-icon {
          width: 30px;
          height: 30px;
          margin-right: 15px;
        }
      }
    }
  }

  button {
    padding: 12px 25px;
    font-size: 1rem;
    background-color: #6f4c3e;
    color: white;
    border: 2px solid #452f26;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    margin-top: 10px;

    &:hover {
      background-color: #8f6c5e;
    }
  }
}
</style>
