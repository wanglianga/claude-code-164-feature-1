<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NPopconfirm, NTag, useMessage } from 'naive-ui'
import type { Booking, RainChoice } from '../types'
import { chooseRainOption, lightLive, nowStr, rainEntryOf, useState } from '../store'
import { checkedInCount, hm, money, RAIN_CHOICE_META, rainAlternatives, rainCompensation } from '../lib/engine'
import { TOMORROW } from '../data/mock'
import RuleLink from './RuleLink.vue'

/**
 * 雨后积水暂停 · 受影响预约的处置卡（R-WX-3）
 * - 队长视角（acting=captain）：队长四选一
 * - 管理后台（acting=admin）：管理员代队长登记（电话确认）
 */
const props = defineProps<{ booking: Booking; acting: 'captain' | 'admin' }>()
const message = useMessage()
const state = useState()

const found = computed(() => rainEntryOf(props.booking.id))
const entry = computed(() => found.value?.entry)
const suspend = computed(() => found.value?.suspend)
const waitMin = computed(() => entry.value ? Math.max(0, hm(nowStr.value) - hm(entry.value.waitFrom)) : 0)
const comp = computed(() => rainCompensation(entry.value?.arrivedAtPublish ?? 0, waitMin.value))
const alts = computed(() => rainAlternatives(props.booking, state.courts, state.bookings, nowStr.value, TOMORROW))
const light = computed(() => lightLive(props.booking))

const options = computed(() => ([
  { key: 'refund' as RainChoice, alt: `押金余额 ¥${money(Math.max(0, props.booking.lighting.deposit - (light.value?.fee ?? 0)))} 退回`, disabled: false },
  { key: 'delay' as RainChoice, alt: alts.value.delay.label, disabled: false },
  { key: 'indoor' as RainChoice, alt: alts.value.indoor?.label ?? '今日室内馆无空闲时段', disabled: !alts.value.indoor },
  { key: 'shareHalf' as RainChoice, alt: alts.value.shareHalf?.label ?? '今日其他场地无空闲半场', disabled: !alts.value.shareHalf }
]))

function choose(c: RainChoice) {
  chooseRainOption(props.booking.id, c, props.acting)
  message.success(`已选择「${RAIN_CHOICE_META[c].label}」，结果已同步队员与拼场散客`)
}
</script>

<template>
  <div v-if="entry && suspend" class="rain-box">
    <!-- 待选择 -->
    <template v-if="!entry.choice">
      <div class="rb-head">
        <span class="rb-title">🌧️ 积水暂停 · 请{{ acting === 'admin' ? '代队长登记（电话确认）' : '队长四选一' }}</span>
        <NTag size="tiny" type="warning" round>等待队长决定</NTag>
      </div>
      <div class="rb-grid">
        <div>暂停窗口：<b>{{ suspend.publishAt }} – 预计 {{ suspend.recoverAt }} 恢复</b></div>
        <div>到场热身：<b>{{ entry.arrivedAtPublish }} 人</b>（现签到 {{ checkedInCount(booking) }} 人）</div>
        <div>已等待：<b class="rb-wait">{{ waitMin }} 分钟</b></div>
        <div>补贴预估：<b :style="{ color: comp.total ? '#18a058' : '#999' }">¥{{ comp.total }}</b>
          <span style="color:#999">（到场 3 元/人{{ comp.waitBonus ? '＋等待超30分 10 元' : '' }}，未到场无补贴）</span>
        </div>
        <div>已支付照明费：押金 ¥{{ booking.lighting.deposit }} · 已计照明 ¥{{ money(light?.fee ?? 0) }}（{{ light?.minutes ?? 0 }} 分钟，已停止计费）</div>
      </div>
      <div class="rb-choices">
        <NPopconfirm v-for="o in options" :key="o.key" placement="top" @positive-click="choose(o.key)">
          <template #trigger>
            <NButton size="small" round :disabled="o.disabled" :type="o.key === 'refund' ? 'error' : 'primary'" ghost>
              {{ RAIN_CHOICE_META[o.key].emoji }} {{ RAIN_CHOICE_META[o.key].label }}
            </NButton>
          </template>
          <div style="max-width:240px;font-size:12px;line-height:1.7">
            <b>{{ RAIN_CHOICE_META[o.key].label }}</b>：{{ RAIN_CHOICE_META[o.key].desc }}<br>
            {{ o.alt }}<br>
            到场补贴 ¥{{ comp.total }} 照发，结果将同步 {{ booking.members.length }} 名队员与拼场散客。
          </div>
        </NPopconfirm>
      </div>
      <div class="rb-alt">
        <div v-for="o in options.filter(x => !x.disabled && x.key !== 'refund')" :key="o.key" class="rb-alt-line">
          {{ RAIN_CHOICE_META[o.key].emoji }} {{ o.alt }}
        </div>
      </div>
      <div class="rb-rule">暂停期间不计迟到/爽约；选择结果实时同步队员与拼场散客 <RuleLink id="R-WX-3" /></div>
    </template>

    <!-- 已选择 -->
    <template v-else>
      <div class="rb-head">
        <span class="rb-title">🌧️ 积水暂停 · 已选「{{ RAIN_CHOICE_META[entry.choice].emoji }} {{ RAIN_CHOICE_META[entry.choice].label }}」</span>
        <NTag size="tiny" type="success" round>{{ entry.choiceAt }} 已办结</NTag>
      </div>
      <div class="rb-done">
        <div>📋 {{ entry.detail }}</div>
        <div>⏱️ 到场 {{ entry.arrivedAtPublish }} 人 · 等待 {{ waitMin }} 分钟 · 补贴 ¥{{ entry.compensate }}（{{ entry.arrivedAtPublish > 0 ? '已到场热身队伍' : '完全未到场，无等待补贴' }}）</div>
        <div>📣 {{ entry.syncNote }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rain-box { background:#fffaf0; border:1px solid #ffe7ba; border-radius:12px; padding:10px 12px; margin-bottom:10px; }
.rb-head { display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; }
.rb-title { font-weight:700; font-size:13px; color:#7a4d00; }
.rb-grid { font-size:12px; color:#555; line-height:1.9; margin:6px 0; }
.rb-wait { color:#d03050; font-size:14px; }
.rb-choices { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 4px; }
.rb-alt { background:rgba(255,255,255,.7); border-radius:8px; padding:6px 8px; margin-top:4px; }
.rb-alt-line { font-size:11.5px; color:#666; line-height:1.8; }
.rb-rule { font-size:11px; color:#999; margin-top:6px; }
.rb-done { font-size:12px; color:#444; line-height:1.9; margin-top:6px; }
</style>
