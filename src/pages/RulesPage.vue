<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NTag } from 'naive-ui'
import { RULES } from '../data/rules'
import { ruleId } from '../lib/ui'

const chapters = computed(() => {
  const m = new Map<string, typeof RULES>()
  for (const r of RULES) {
    if (!m.has(r.chapter)) m.set(r.chapter, [])
    m.get(r.chapter)!.push(r)
  }
  return [...m.entries()]
})

const highlight = ref<string | null>(ruleId.value)
watch(ruleId, async v => {
  highlight.value = v
  if (v) {
    await nextTick()
    document.getElementById('rule-' + v)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>

<template>
  <div class="page">
    <div class="fair-hero">
      <div class="fh-title">⚖️ 公共资源公平性说明</div>
      <p>同一片场地同时服务<b>固定球队、临时散客与周边居民</b>。当权益发生冲突时，规则按以下顺序排序，被改约或限制的一方都会看到<b>理由、规则编号与补偿方案</b>：</p>
      <div class="order-chain">
        <span>场地安全/维修</span>→<span>已支付且已签到队伍</span>→<span>固定球队固定时段</span>→<span>先到先得</span>→<span>信用分</span>
      </div>
      <div class="fh-points">
        <div>🏀 黄金时段（18:00–21:00）固定队预约不超过 60%，至少 40% 在开场前 24 小时对全体市民开放。</div>
        <div>🏃 散客拼场成功与固定球队享同等到场权益，照明费按人均平摊并享 8 折。</div>
        <div>🏘️ 静音时段、噪声敏感楼栋等居民权益为强制条款，不因任何预约豁免。</div>
        <div>📉 信用分低于 80 冲突排序靠后，低于 60 暂停预约资格，可通过社区文明运动宣讲恢复。</div>
      </div>
    </div>

    <div v-for="[chapter, rules] in chapters" :key="chapter" class="chapter">
      <div class="chapter-title">{{ chapter }}</div>
      <div v-for="r in rules" :key="r.id" :id="'rule-' + r.id" class="rule-card"
        :class="{ hl: highlight === r.id }">
        <div class="rc-head">
          <NTag size="tiny" type="info" round>{{ r.id }}</NTag>
          <b>{{ r.title }}</b>
        </div>
        <div class="rc-body">{{ r.body }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fair-hero { background:linear-gradient(135deg,#eaf4ff,#f3eaff); border-radius:12px; padding:14px; margin-bottom:12px; font-size:12.5px; line-height:1.8; }
.fh-title { font-size:15px; font-weight:800; margin-bottom:6px; }
.order-chain { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin:8px 0; font-size:11.5px; }
.order-chain span { background:#fff; border-radius:6px; padding:3px 7px; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.06); }
.fh-points { margin-top:6px; }
.fh-points div { background:rgba(255,255,255,.7); border-radius:8px; padding:6px 8px; margin-top:5px; }
.chapter-title { font-size:13px; font-weight:800; color:#555; margin:14px 2px 8px; }
.rule-card { background:#fff; border-radius:10px; padding:10px 12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,.05); transition:box-shadow .3s; }
.rule-card.hl { box-shadow:0 0 0 2px #2080f0, 0 2px 8px rgba(32,128,240,.25); }
.rc-head { display:flex; align-items:center; gap:8px; margin-bottom:5px; font-size:13.5px; }
.rc-body { font-size:12.5px; color:#444; line-height:1.8; }
</style>
