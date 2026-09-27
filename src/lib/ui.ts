import { ref } from 'vue'

export type TabId = 'courts' | 'mine' | 'board' | 'admin' | 'incidents' | 'rules'

export const activeTab = ref<TabId>('courts')
export const ruleId = ref<string | null>(null)
/** 待处理事件筛选（从看板跳入时用） */
export const incidentFilter = ref<string | null>(null)

export function openRule(id: string) {
  activeTab.value = 'rules'
  ruleId.value = id
}
export function openIncidents(filter?: string) {
  activeTab.value = 'incidents'
  incidentFilter.value = filter ?? null
}
