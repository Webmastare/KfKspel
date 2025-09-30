<template>
  <div class="cell" :class="{ highlighted: isClicked }" @click="emit('pressed')">
    <div
      class="lamp"
      :class="{
        'state-1': state === 1,
        'state-2': state === 2 && isHardMode,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  isClicked: {
    type: Boolean,
    required: true,
  },
  state: {
    type: Number,
    default: 0,
  },
  isHardMode: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['pressed'])
</script>

<style scoped lang="scss">
@use '@/styles/theme.scss';

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  background-color: var(--theme-canvas-bg, #505050);
  box-shadow: var(--theme-shadow-sm);
  cursor: pointer;
  transition:
    filter 0.15s ease,
    transform 0.05s ease;

  &.highlighted {
    outline: 2px dashed #ee4545;
    outline-offset: -2px;
  }

  .lamp {
    width: 58%;
    height: 58%;
    border-radius: 50%;
    background-color: transparent;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.1s ease;

    &.state-1 {
      background-color: var(--theme-light-on);
      box-shadow:
        0 0 10px rgba(232, 232, 171, 0.7),
        inset 0 0 6px rgba(255, 255, 255, 0.6);
      transform: scale(0.98);
    }

    &.state-2 {
      background-color: #1da11f;
      box-shadow:
        0 0 10px rgba(78, 205, 93, 0.7),
        inset 0 0 6px rgba(255, 255, 255, 0.6);
      transform: scale(0.98);
    }
  }

  &:hover {
    filter: brightness(1.2);
  }
}
</style>
