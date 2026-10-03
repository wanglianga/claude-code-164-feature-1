<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NAlert, NButton, NTag, NRadioGroup, NRadio, NInputNumber, NPopconfirm,
  NGrid, NGridItem, NSwitch, NDivider, useMessage
} from 'naive-ui'
import { useState, nowStr, recordArrival, chooseRainOption, recoverRain } from '../store'
import {
  checkedInCount, hm, money, paidLighting, rainAffectedBookings,
  rainUpcomingBookings, rainWaitTier, rainWindowLeft,
  postponeAlternatives, indoorAlternatives, halfMergeAlternatives
} from '../lib/engine'
import type { Booking, Incident, RainOption } from '../types'
import type { RainAltSlot } from '../lib/engine'
import RuleLink from './RuleLink.vue'

const props = defineProps<{ incident: Incident }>()
const state = useState()
const message = useMessage()

const court = computed(() => state.courts.find(c => c.id === props.incident.courtId)!)

const affected = computed<Booking[]>(() =>
  props.incident.bookingIds
    .map(id => state.bookings.find(b => b.id === id))
    .filter((b): b is Booking => !!b)
    .sort((a, b) => hm(a.start) - hm(b.start)))

const upcoming = computed(() =>
  rainUpcomingBookings(
    { courtId: court.value.id, halves: props.incident.affectedHalves ?? [], slotStart: props.incident.slotStart ?? '00:00', slotEnd: props.incident.slotEnd ?? '23:59' },
    state.bookings))

const windowLeft = computed(() => rainWindowLeft(props.incident.chooseDeadline, nowStr.value))

function paid(b: Booking) {
  return paidLighting(b, state.courts.find(c => c.id === b.courtId), nowStr.value, true)
}
function tier(b: Booking) {
  return rainWaitTier(b, nowStr.value)
}

// 每队默认选中第一个可用顺延时段（切换其他方案时自动回退到该方案首个可用候选）
watch(affected, list => {
  for (const b of list) {
    if (picked.value[b.id]) continue
    const def = postponeSlots(b).find(s => s.available)
    if (def) picked.value[b.id] = def.key
  }
}, { immediate: true })

// 各队伍候选方案
function postponeSlots(b: Booking) {
  return postponeAlternatives(court.value, b, state.bookings, props.incident.recoverEta ?? nowStr.value)
}
function indoorSlots(b: Booking) {
  return indoorAlternatives(state.courts, b, state.bookings, nowStr.value)
}
function mergeSlots(b: Booking) {
  return halfMergeAlternatives(court.value, b, state.bookings, props.incident.slotStart ?? b.start, props.incident.slotEnd ?? b.end)
}

// 每队当前选中的候选 slot key
const picked = ref<Record<string, string>>({})
function slotOf(b: Booking, option: RainOption): RainAltSlot | undefined {
  const list = option === 'postpone' ? postponeSlots(b) : option === 'indoor' ? indoorSlots(b) : mergeSlots(b)
  return list.find(s => s.key === picked.value[b.id]) ?? list.find(s => s.available)
}

const isAdmin = computed(() => state.role === 'admin')
/** 队长可直接选择；管理员可电话确认后代为录入 */
function canChoose(b: Booking) {
  void b
  return isAdmin.value || state.role === 'captain'
}

// 到场点验表单
const arrivalDraft = ref<Record<string, { count: number; warming: boolean }>>({})
function draftOf(b: Booking) {
  if (!arrivalDraft.value[b.id]) {
    arrivalDraft.value[b.id] = { count: b.arrival?.presentCount ?? (checkedInCount(b) || b.members.length), warming: b.arrival?.warming ?? true }
  }
  return arrivalDraft.value[b.id]
}
function saveArrival(b: Booking) {
  const d = draftOf(b)
  if (d.count <= 0) return message.warning('到场人数需大于 0；若无人到场请保持未登记状态')
  recordArrival(b.id, d.count, d.warming)
  message.success('到场人数与等待计时已登记，补偿将与未到场预约区别计算')
}

function doChoose(b: Booking, option: RainOption) {
  if (option === 'refund') {
    chooseRainOption(b.id, 'refund')
    message.success('已提交全额退款，结果同步队员与散客')
    return
  }
  const slot = slotOf(b, option)
  if (!slot || !slot.available) return message.warning('请先选择一个可用的安置时段/场地')
  chooseRainOption(b.id, option, slot)
  message.success(option === 'postpone' ? '已顺延，新场次与签到码已同步' : option === 'indoor' ? '已改到室内场馆，新场次已同步' : '已并入拼场队伍，新签到码已同步')
}

function doRecover() {
  recoverRain(props.incident.id)
  message.success('积水清除，已解除暂停并公示')
}

function mergeReqs(b: Booking) {
  return state.mergeRequests.filter(r =>
    r.bookingId === b.id || r.bookingId === b.rainChoice?.newBookingId)
}
</script>

<template>
  <div class="rain-panel">
    <NAlert type="error" :show-icon="false" style="border-radius:10px;margin-bottom:8px">
      <div class="rp-head">
        <div>🌧️ <b>雨后积水暂停 · 改约窗口处置</b> <RuleLink id="R-WX-3" /></div>
        <div class="rp-sub">
          影响半场 <b>{{ incident.affectedHalves?.join(' / ') }}</b> · 时段 {{ incident.slotStart }}–{{ incident.slotEnd }} ·
          预计 {{ incident.recoverEta }} 恢复
        </div>
        <div class="rp-deadline">
          队长安置选择截止 {{ incident.chooseDeadline }}：
          <template v-if="windowLeft === null"><span>—</span></template>
          <template v-else-if="windowLeft > 0">
            <span class="wl-ok">还剩 {{ windowLeft }} 分钟</span>
          </template>
          <template v-else>
            <span class="wl-late">已逾期 {{ -windowLeft }} 分钟 · 未选择将按"全额退款+优先改约登记"兜底</span>
          </template>
        </div>
      </div>
    </NAlert>

    <!-- 该时段预约队伍 + 已支付照明费 -->
    <div class="rp-sec-title">该时段预约队伍（{{ affected.length }} 支）· 已支付照明费 · 到场与等待</div>

    <div v-for="b in affected" :key="b.id" class="rp-team">
      <div class="rt-top">
        <div>
          <b>{{ b.teamName }}</b>
          <NTag size="tiny" round style="margin-left:6px" :type="b.rainChoice ? 'success' : 'error'">
            {{ b.rainChoice ? '已完成安置' : '待队长选择' }}
          </NTag>
          <NTag v-if="b.fixedTeam" size="tiny" type="info" round style="margin-left:4px">固定球队</NTag>
        </div>
        <span class="rt-captain">队长 {{ b.captainName }} {{ b.captainPhone }}</span>
      </div>

      <NGrid :cols="3" :x-gap="6" class="rt-stats">
        <NGridItem>
          <div class="rs-n">{{ b.halves.join('+') }} · {{ b.scope === 'full' ? '全场' : '半场' }}</div>
          <div class="rs-l">预约场地</div>
        </NGridItem>
        <NGridItem>
          <div class="rs-n">{{ checkedInCount(b) }}/{{ b.members.length }}</div>
          <div class="rs-l">签到/名单</div>
        </NGridItem>
        <NGridItem>
          <div class="rs-n" style="color:#e8840c">¥{{ money(paid(b).deposit + paid(b).lighting) }}</div>
          <div class="rs-l">押金 ¥{{ money(paid(b).deposit) }} + 照明 ¥{{ money(paid(b).lighting) }}</div>
        </NGridItem>
      </NGrid>

      <!-- 到场热身 / 等待时长（管理员点验） -->
      <div class="rt-arrival">
        <template v-if="b.arrival">
          <NTag size="small" :type="tier(b) ? 'warning' : 'default'" round>
            🟠 {{ tier(b)?.label ?? '已到场（未开始热身）' }}
          </NTag>
          <div v-if="tier(b)" class="rt-tier">
            等待安抚补偿 <b>¥{{ tier(b)!.compensation }}</b><template v-if="tier(b)!.voucher"> + 同时长免费券 1 张</template>
            <span class="rt-tier-note">（完全未到场的预约只退费用、不发等待补偿）</span>
          </div>
        </template>
        <template v-else>
          <NTag size="small" round>⚪ 尚未登记到场（按完全未到场处理，仅退已付费用）</NTag>
        </template>

        <template v-if="isAdmin && !b.rainChoice">
          <NDivider style="margin:6px 0" />
          <div class="rt-check">
            <span style="font-size:12px;color:#666">管理员现场点验：</span>
            <NInputNumber :value="draftOf(b).count" size="tiny" :min="0" :max="b.members.length"
              @update:value="v => draftOf(b).count = v ?? 0" style="width:88px" />
            <span style="font-size:12px;color:#666">人</span>
            <span style="font-size:12px;color:#666;margin-left:4px">已热身</span>
            <NSwitch :value="draftOf(b).warming" size="small" @update:value="v => draftOf(b).warming = v" />
            <NButton size="tiny" type="warning" round @click="saveArrival(b)">登记到场/等待</NButton>
          </div>
        </template>
      </div>

      <!-- 已选择：展示结果 + 同步情况 -->
      <div v-if="b.rainChoice" class="rt-done">
        <div class="rd-line">✅ {{ b.rainChoice.summary }}</div>
        <div class="rd-sync">
          📲 选择结果已同步：队员 {{ b.members.length }} 名
          <template v-if="mergeReqs(b).length"> · 散客申请 {{ mergeReqs(b).length }} 条</template>
          <span class="rd-window">{{ b.rainChoice.withinWindow ? '（窗口内选择）' : '（逾期补登，已留痕）' }}</span>
        </div>
        <div v-for="r in mergeReqs(b)" :key="r.id" class="rd-req">
          🙋 {{ r.walkerName }} 等 {{ r.people }} 人：
          <NTag v-if="r.superseded" size="tiny" type="success" round>已同步新安排{{ r.supersededNote ? '' : '' }}</NTag>
          <NTag v-else size="tiny" type="warning" round>原申请随安置自动转挂</NTag>
          <span class="rd-req-note">{{ r.supersededNote }}</span>
        </div>
      </div>

      <!-- 未选择：四个方案 -->
      <template v-else>
        <div class="rt-options">
          <!-- 退款 -->
          <div class="opt-card">
            <div class="oc-head"><span>💸 全额退款</span></div>
            <div class="oc-note">押金 ¥{{ money(paid(b).deposit) }} 原路退回；暂停前照明费 ¥{{ money(paid(b).lighting) }} 免收<template v-if="tier(b)">；另补等待安抚 ¥{{ tier(b)!.compensation }}</template></div>
            <NButton size="tiny" type="error" ghost round :disabled="!canChoose(b)"
              @click="doChoose(b, 'refund')">{{ isAdmin ? '协助队长确认退款' : '选择退款' }}</NButton>
          </div>

          <!-- 顺延 -->
          <div class="opt-card">
            <div class="oc-head"><span>⏳ 顺延（优先排位）</span></div>
            <NRadioGroup v-model:value="picked[b.id]" class="opt-radio">
              <NRadio v-for="s in postponeSlots(b)" :key="s.key" :value="s.key" :disabled="!s.available">
                {{ s.start === b.start ? '明日同时段' : `今晚 ${s.start}–${s.end}` }}
              </NRadio>
            </NRadioGroup>
            <div class="oc-note">{{ slotOf(b, 'postpone')?.note }}</div>
            <NButton size="tiny" type="primary" ghost round :disabled="!canChoose(b)"
              @click="doChoose(b, 'postpone')">{{ isAdmin ? '协助确认顺延' : '选择顺延' }}</NButton>
          </div>

          <!-- 室内 -->
          <div class="opt-card">
            <div class="oc-head"><span>🏠 改到室内场</span></div>
            <div v-if="indoorSlots(b).length" class="opt-radio">
              <NRadioGroup v-model:value="picked[b.id]">
                <NRadio v-for="s in indoorSlots(b)" :key="s.key" :value="s.key" :disabled="!s.available">
                  {{ s.courtName }} {{ s.start }}–{{ s.end }}（{{ s.halves.join('+') }}）
                </NRadio>
              </NRadioGroup>
            </div>
            <div v-else class="oc-note">暂无可约室内半场</div>
            <div class="oc-note">{{ slotOf(b, 'indoor')?.note }}</div>
            <NButton size="tiny" type="primary" ghost round :disabled="!canChoose(b) || !indoorSlots(b).some(s => s.available)"
              @click="doChoose(b, 'indoor')">{{ isAdmin ? '协助确认改室内' : '改到室内场' }}</NButton>
          </div>

          <!-- 半场拼场 -->
          <div class="opt-card">
            <div class="oc-head"><span>🤝 接受半场拼场</span></div>
            <div v-if="mergeSlots(b).length" class="opt-radio">
              <NRadioGroup v-model:value="picked[b.id]">
                <NRadio v-for="s in mergeSlots(b)" :key="s.key" :value="s.key">
                  {{ s.partner!.teamName }}（{{ s.halves.join('/') }}，已到 {{ s.partner!.present }}/{{ s.partner!.members }} 人，余位 {{ Math.max(0, s.partner!.spare) }}）
                </NRadio>
              </NRadioGroup>
            </div>
            <div v-else class="oc-note">同场地未积水半场暂无接受拼场的同时段队伍，可改选其他方案</div>
            <div class="oc-note">{{ slotOf(b, 'halfMerge')?.note }}</div>
            <NButton size="tiny" type="primary" ghost round :disabled="!canChoose(b) || mergeSlots(b).length === 0"
              @click="doChoose(b, 'halfMerge')">{{ isAdmin ? '协助确认拼场' : '并入该半场' }}</NButton>
          </div>
        </div>
        <div v-if="!canChoose(b)" class="rt-hint">
          队长 {{ b.captainName }} 可在本页面完成选择；管理员可在现场电话确认后代为录入。
        </div>
        <div v-else-if="!isAdmin" class="rt-hint">
          演示环境：队长身份可体验各受影响队伍的安置选择；正式环境仅本队队长可操作、管理员可电话确认后代录。
        </div>
      </template>
    </div>

    <!-- 后续时段队伍：提前通知避免白跑 -->
    <div v-if="upcoming.length" class="rp-upcoming">
      <div class="rp-sec-title" style="margin-bottom:4px">后续时段队伍（已提前通知，避免到场扑空）</div>
      <div v-for="u in upcoming" :key="u.id" class="up-line">
        🕓 {{ u.teamName }} {{ u.start }}–{{ u.end }} {{ u.halves.join('+') }}：
        <NTag size="tiny" type="warning" round>已收到暂停预警</NTag>
      </div>
    </div>

    <!-- 管理员复查解除 -->
    <div v-if="isAdmin && affected.some(b => b.rainChoice)" class="rp-recover">
      <NPopconfirm @positive-click="doRecover">
        <template #trigger>
          <NButton size="small" type="success" round block>现场复查确认积水已清除 · 解除暂停并公示</NButton>
        </template>
        解除后该半场恢复预约与使用，后续时段队伍将收到恢复通知。
      </NPopconfirm>
    </div>
  </div>
</template>

<style scoped>
.rp-head { font-size:13px; line-height:1.9; }
.rp-sub { font-size:12px; color:#666; }
.rp-deadline { font-size:12px; margin-top:2px; }
.wl-ok { color:#d48806; font-weight:700; }
.wl-late { color:#d03050; font-weight:700; }
.rp-sec-title { font-size:12.5px; font-weight:700; color:#555; margin:10px 2px 6px; }
.rp-team { background:#fff; border:1px solid #ffd8bf; border-radius:12px; padding:10px; margin-bottom:10px; }
.rt-top { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
.rt-captain { font-size:11.5px; color:#999; }
.rt-stats { background:#f7f9fc; border-radius:8px; padding:6px 4px; margin:8px 0; text-align:center; }
.rs-n { font-size:14px; font-weight:700; }
.rs-l { font-size:10.5px; color:#909399; margin-top:1px; line-height:1.3; }
.rt-arrival { background:#fff7e6; border-radius:8px; padding:7px 8px; font-size:12px; line-height:1.8; }
.rt-tier { margin-top:2px; color:#ad6800; }
.rt-tier-note { color:#999; font-size:11px; }
.rt-check { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.rt-options { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
.opt-card { border:1px solid #eef0f3; border-radius:10px; padding:7px 8px; display:flex; flex-direction:column; gap:5px; background:#fcfdff; }
.oc-head { font-size:12.5px; font-weight:700; }
.oc-note { font-size:11px; color:#888; line-height:1.6; }
.opt-radio { font-size:11.5px; display:flex; flex-direction:column; gap:2px; }
.rt-hint { font-size:11px; color:#999; margin-top:6px; }
.rt-done { background:#f0fbf5; border:1px solid #b7eb8f; border-radius:10px; padding:8px; margin-top:8px; font-size:12px; line-height:1.8; }
.rd-line { font-weight:700; color:#237804; }
.rd-sync { color:#555; }
.rd-window { color:#999; font-size:11px; }
.rd-req { background:#fff; border-radius:6px; padding:4px 6px; margin-top:4px; font-size:11.5px; color:#555; }
.rd-req-note { color:#888; margin-left:4px; }
.rp-upcoming { background:#f7f9fc; border-radius:10px; padding:8px 10px; font-size:12px; }
.up-line { line-height:2; color:#555; }
.rp-recover { margin-top:10px; }
</style>
