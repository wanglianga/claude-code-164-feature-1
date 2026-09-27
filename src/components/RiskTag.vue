<script setup lang="ts">
import { computed } from 'vue'
import { NPopover, NTag } from 'naive-ui'
import type { RiskLevel } from '../lib/engine'

const props = defineProps<{
  level: RiskLevel
  reasons: string[]
  size?: 'small' | 'medium'
}>()

const meta = computed(() => {
  switch (props.level) {
    case 'high': return { label: '高风险', type: 'error' as const }
    case 'medium': return { label: '中风险', type: 'warning' as const }
    case 'low': return { label: '需注意', type: 'info' as const }
    default: return { label: '正常', type: 'success' as const }
  }
})
</script>

<template>
  <NPopover trigger="click" placement="bottom" :show-arrow="false">
    <template #trigger>
      <NTag :type="meta.type" :size="size ?? 'small'" round style="cursor:pointer">
        ⚠ {{ meta.label }}
      </NTag>
    </template>
    <div style="max-width:260px">
      <div v-for="(r, i) in reasons" :key="i" style="font-size:12px;line-height:1.7">
        <span :style="{ color: level === 'none' ? '#18a058' : '#d03050' }">•</span> {{ r }}
      </div>
      <div style="font-size:11px;color:#999;margin-top:4px">点击空白处关闭</div>
    </div>
  </NPopover>
</template>
