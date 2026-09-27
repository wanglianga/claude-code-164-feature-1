<script setup lang="ts">
import { NButton } from 'naive-ui'
import { RULE_MAP } from '../data/rules'
import { openRule } from '../lib/ui'

const props = defineProps<{ id: string }>()
const rule = RULE_MAP[props.id]
</script>

<template>
  <NButton text size="tiny" type="primary" style="font-size:11px;padding:0 2px"
    @click="openRule(id)">
    {{ id }}<template v-if="rule">（{{ rule.title.length > 8 ? rule.title.slice(0, 8) + '…' : rule.title }}）</template>
  </NButton>
</template>
