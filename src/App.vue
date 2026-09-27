<script setup lang="ts">
import { computed } from 'vue'
import {
  NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN,
  NBadge, NPopover
} from 'naive-ui'
import { useState, setRole, roles, nowStr, tick, resetClock, toggleAuto, autoRun } from './store'
import { activeTab, type TabId } from './lib/ui'
import CourtsPage from './pages/CourtsPage.vue'
import MinePage from './pages/MinePage.vue'
import BoardPage from './pages/BoardPage.vue'
import AdminPage from './pages/AdminPage.vue'
import IncidentsPage from './pages/IncidentsPage.vue'
import RulesPage from './pages/RulesPage.vue'

const state = useState()

const tabs = computed<{ id: TabId; label: string; icon: string }[]>(() => {
  const common = [
    { id: 'courts' as TabId, label: '场地预约', icon: '🏟️' },
    { id: 'board' as TabId, label: '现场看板', icon: '📡' },
    { id: 'incidents' as TabId, label: '事件处置', icon: '⚖️' },
    { id: 'rules' as TabId, label: '规则公平', icon: '📖' }
  ]
  if (state.role === 'captain' || state.role === 'walkin') {
    return [common[0], { id: 'mine', label: state.role === 'captain' ? '我的队伍' : '拼场签到', icon: '🏀' }, common[1], common[2], common[3]]
  }
  if (state.role === 'admin') {
    return [common[0], common[1], { id: 'admin', label: '管理后台', icon: '🗄️' }, common[2], common[3]]
  }
  // 社区工作人员
  return [common[0], common[1], common[2], common[3]]
})

function switchTab(id: TabId) {
  activeTab.value = id
}

function switchRole(r: typeof roles[number]['id']) {
  setRole(r)
  // 「我的」标签仅队长/散客可见，切到管理类角色时回到场地页避免空白
  if (activeTab.value === 'mine' && r !== 'captain' && r !== 'walkin') {
    activeTab.value = r === 'admin' ? 'courts' : 'board'
  }
  if (activeTab.value === 'admin' && r !== 'admin') {
    activeTab.value = 'courts'
  }
}

const pendingIncidents = computed(() =>
  state.incidents.filter(i => i.status === 'open' || i.status === 'mediating').length)
const myNotices = computed(() =>
  state.notices.filter(n => n.to === 'all' || n.to === state.role).slice(0, 10))
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="null">
    <NMessageProvider>
      <NDialogProvider>
        <div class="phone">
          <!-- 顶栏 -->
          <header class="topbar">
            <div class="tb-row">
              <div class="tb-title">🏀 市民球场<span class="tb-sub">预约 · 拼场 · 照明计费 · 冲突调解</span></div>
              <div class="clock">
                <span class="clock-time">{{ nowStr }}</span>
                <button class="clk-btn" @click="tick(1)">+1分</button>
                <button class="clk-btn" @click="tick(10)">+10分</button>
                <button class="clk-btn" :class="{ on: autoRun }" @click="toggleAuto">{{ autoRun ? '停止' : '自动' }}</button>
                <button class="clk-btn" @click="resetClock">重置</button>
              </div>
            </div>
            <!-- 角色切换 -->
            <div class="role-bar">
              <div v-for="r in roles" :key="r.id" class="role-chip"
                :class="{ active: state.role === r.id }" @click="switchRole(r.id)">
                <span class="rc-emoji">{{ r.emoji }}</span>
                <span class="rc-name">{{ r.name }}</span>
              </div>
            </div>
          </header>

          <!-- 主内容 -->
          <main class="content">
            <CourtsPage v-if="activeTab === 'courts'" />
            <MinePage v-else-if="activeTab === 'mine'" />
            <BoardPage v-else-if="activeTab === 'board'" />
            <AdminPage v-else-if="activeTab === 'admin'" />
            <IncidentsPage v-else-if="activeTab === 'incidents'" />
            <RulesPage v-else-if="activeTab === 'rules'" />
          </main>

          <!-- 通知铃铛（悬浮） -->
          <div class="bell">
            <NPopover trigger="click" placement="bottom-end" :show-arrow="false">
              <template #trigger>
                <NBadge :value="myNotices.length" :max="99" :show="myNotices.length > 0">
                  <div class="bell-btn">🔔</div>
                </NBadge>
              </template>
              <div style="max-width:280px;max-height:300px;overflow-y:auto">
                <div style="font-weight:700;font-size:13px;margin-bottom:6px">站内通知</div>
                <div v-if="myNotices.length === 0" style="font-size:12px;color:#999">暂无通知，操作后（预约/拼场/处置）会收到提醒</div>
                <div v-for="n in myNotices" :key="n.id" class="notice-item">
                  <span class="nt-at">{{ n.at }}</span> {{ n.text }}
                </div>
              </div>
            </NPopover>
          </div>

          <!-- 底部标签栏（自定义，便于手机现场单手操作） -->
          <nav class="tabbar">
            <div v-for="t in tabs" :key="t.id" class="tb-item"
              :class="{ active: activeTab === t.id }" @click="switchTab(t.id)">
              <span class="tb-icon">{{ t.icon }}
                <NBadge v-if="t.id === 'incidents' && pendingIncidents > 0" :value="pendingIncidents"
                  style="position:absolute;top:-4px;right:-10px" :show-zero="false" />
              </span>
              <span class="tb-label">{{ t.label }}</span>
            </div>
          </nav>
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background:#e9edf2; }
.phone {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background:#f5f7fa;
  position:relative;
  box-shadow:0 0 24px rgba(0,0,0,.08);
  padding-bottom: calc(64px + env(safe-area-inset-bottom));
}
.topbar {
  position:sticky; top:0; z-index:50;
  background:linear-gradient(135deg,#18a058,#0f8a7a);
  color:#fff; padding:10px 12px 8px;
  border-radius:0 0 14px 14px;
}
.tb-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.tb-title { font-size:16px; font-weight:800; }
.tb-sub { display:block; font-size:10.5px; font-weight:400; opacity:.9; margin-top:1px; }
.clock { display:flex; align-items:center; gap:3px; flex-wrap:wrap; justify-content:flex-end; }
.clock-time { font-weight:800; font-size:15px; font-variant-numeric:tabular-nums; margin-right:2px; }
.clk-btn { font-size:10px; border:1px solid rgba(255,255,255,.5); background:rgba(255,255,255,.15); color:#fff; border-radius:5px; padding:1px 5px; cursor:pointer; }
.clk-btn.on { background:#ffd666; color:#7a4d00; border-color:#ffd666; }
.role-bar { display:flex; gap:6px; margin-top:8px; overflow-x:auto; padding-bottom:2px; }
.role-bar::-webkit-scrollbar { display:none; }
.role-chip { display:flex; align-items:center; gap:4px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.25);
  border-radius:20px; padding:4px 10px; font-size:11.5px; white-space:nowrap; cursor:pointer; flex-shrink:0; }
.role-chip.active { background:#fff; color:#0f8a7a; font-weight:700; }
.content { padding:10px 10px 16px; }
.bell { position:fixed; bottom:calc(74px + env(safe-area-inset-bottom)); right:max(12px, calc(50% - 228px)); z-index:60; }
.bell-btn { width:42px; height:42px; border-radius:50%; background:#fff; box-shadow:0 2px 10px rgba(0,0,0,.15);
  display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer; }
.notice-item { font-size:12px; line-height:1.7; padding:6px 0; border-bottom:1px dashed #eee; }
.nt-at { color:#999; margin-right:6px; }
.tabbar { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:480px;
  background:#fff; display:flex; border-radius:14px 14px 0 0;
  box-shadow:0 -2px 12px rgba(0,0,0,.08); padding-bottom:env(safe-area-inset-bottom); z-index:55; }
.tb-item { flex:1; text-align:center; padding:7px 0 6px; cursor:pointer; color:#909399; }
.tb-item.active { color:#18a058; }
.tb-icon { font-size:19px; position:relative; display:inline-block; }
.tb-label { display:block; font-size:10.5px; margin-top:1px; }
.tb-item.active .tb-label { font-weight:700; }
.page { animation: fade .2s ease; }
@keyframes fade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
</style>
