<script setup lang="ts">
import { NDrawer, NDrawerContent } from 'naive-ui'

defineProps<{
  show: boolean
  title?: string
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
}>()
</script>

<template>
  <NDrawer :show="show" placement="bottom" :height="'auto'"
    @update:show="emit('update:show', $event)">
    <NDrawerContent :native-scrollbar="false" closable>
      <template #header>
        <span style="font-weight:700">{{ title }}</span>
      </template>
      <div style="max-height:70vh;overflow-y:auto;padding-bottom:env(safe-area-inset-bottom)">
        <slot />
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
:deep(.n-drawer) { border-radius: 16px 16px 0 0; }
</style>
