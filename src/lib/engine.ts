import type {
  Booking, Court, FeeItem, Incident, IncidentType, IncidentStatus, BookingStatus,
  MergeRequest, PayStatus, SurfaceStatus, HoopStatus, RainOption
} from '../types'

// ---------- 时间工具 ----------
export function hm(t?: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export function fmt(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sign = min < 0 ? '-' : ''
  return h > 0 ? `${sign}${h}小时${m > 0 ? m + '分' : ''}` : `${sign}${m}分钟`
}
export function hmLabel(min: number): string {
  const h = Math.floor(min / 60)
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')
}

// ---------- 文案映射 ----------
export const SURFACE_META: Record<SurfaceStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  good: { label: '地面干燥良好', type: 'success' },
  wet: { label: '雨后地面湿滑', type: 'warning' },
  slippery: { label: '地面积水打滑', type: 'error' },
  repair: { label: '地面维修中', type: 'error' }
}
export const HOOP_META: Record<HoopStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  normal: { label: '正常', type: 'success' },
  maintaining: { label: '维修中', type: 'warning' },
  sealed: { label: '已封停', type: 'error' }
}
export const STATUS_META: Record<BookingStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  booked: { label: '待开场', type: 'info' },
  ongoing: { label: '进行中', type: 'success' },
  finished: { label: '已结束', type: 'default' },
  earlyLeave: { label: '提前离场', type: 'default' },
  late: { label: '迟到进行中', type: 'warning' },
  overtime: { label: '超时占用中', type: 'error' },
  cancelled: { label: '已取消', type: 'default' },
  rescheduled: { label: '已改约', type: 'warning' },
  sealed: { label: '封场未使用', type: 'default' },
  rainPause: { label: '积水暂停·待选择', type: 'error' },
  noshow: { label: '爽约', type: 'error' },
  rejected: { label: '审核不通过', type: 'error' }
}
export const PAY_META: Record<PayStatus, { label: string; type: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  unpaid: { label: '未支付', type: 'warning' },
  depositPaid: { label: '押金已付', type: 'info' },
  paid: { label: '已结清', type: 'success' },
  refunding: { label: '退款处理中', type: 'warning' },
  refunded: { label: '已退款', type: 'success' },
  deducted: { label: '押金抵扣结清', type: 'default' }
}

export const INCIDENT_META: Record<IncidentType, { label: string; emoji: string }> = {
  rain: { label: '下雨地滑', emoji: '🌧️' },
  repair: { label: '临时维修', emoji: '🔧' },
  hoopDispute: { label: '争抢篮筐', emoji: '🥊' },
  noise: { label: '噪声投诉', emoji: '🔊' },
  minorNight: { label: '未成年人夜留', emoji: '🧒' },
  lightFault: { label: '照明故障', emoji: '💡' },
  seal: { label: '封场', emoji: '🚧' },
  late: { label: '队伍迟到', emoji: '⏰' },
  overtime: { label: '超时占用', emoji: '⌛' },
  refuseMerge: { label: '拒绝拼场', emoji: '🚫' }
}

export const FEE_META: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  lighting: { label: '照明费', type: 'info' },
  deposit: { label: '照明押金', type: 'default' },
  late: { label: '迟到占位费', type: 'warning' },
  overtime: { label: '超时占用费', type: 'error' },
  refuseMerge: { label: '拒拼资源占用费', type: 'warning' },
  earlyRefund: { label: '提前离场退还', type: 'success' },
  weather: { label: '天气补偿', type: 'success' },
  complaint: { label: '噪声处罚', type: 'error' },
  sealRefund: { label: '封场退款', type: 'success' },
  reschedule: { label: '改约补偿', type: 'success' },
  rainRefund: { label: '积水暂停退款', type: 'success' },
  rainWait: { label: '到场等待安抚补偿', type: 'success' }
}

// ---------- 照明实时计费 ----------
export interface LightQuote {
  minutes: number
  /** 全场 = 2 个半场单价 */
  gross: number
  /** 勾选接受拼场 8 折（R-BOOK-2 / R-LIGHT-1） */
  rate: number
  fee: number
  /** 拼场按签到人数平摊 */
  perPerson: number
  frozen: boolean
}

export function lightQuote(b: Booking, court: Court | undefined, nowHm: string, frozen = false): LightQuote | null {
  if (!b.lighting.enabled || !court || !b.lighting.onAt) return null
  const endOf = b.lighting.offAt ?? (isActive(b, nowHm) ? nowHm : (b.actualEnd ?? b.end))
  const minutes = Math.max(0, hm(endOf) - hm(b.lighting.onAt))
  const halfFactor = b.scope === 'full' ? 2 : 1
  const gross = minutes * court.lighting.pricePerMinute * halfFactor
  const rate = b.acceptMerge ? 0.8 : 1
  const fee = gross * rate
  const present = Math.max(1, b.members.filter(m => m.checkedIn).length)
  return {
    minutes,
    gross,
    rate,
    fee,
    perPerson: fee / present,
    frozen
  }
}

// ---------- 到场 / 迟到 / 超时 ----------
export function checkedInCount(b: Booking): number {
  return b.members.filter(m => m.checkedIn).length
}

export function isActive(b: Booking, nowHm: string): boolean {
  return ['ongoing', 'late', 'overtime'].includes(b.status) && hm(nowHm) >= hm(b.actualStart ?? b.start)
}

export interface TimeState {
  /** 距离开场分钟数（负=尚未开场） */
  untilStart: number
  /** 迟到分钟数（以签到/当前时间较晚者为准） */
  lateMinutes: number
  /** 剩余可打分钟（进行中；含 5 分钟清场缓冲展示） */
  remaining: number
  /** 超时分钟数（已过结束+5 分钟缓冲） */
  overtimeMinutes: number
  /** 是否进入 5 分钟清场缓冲 */
  inGrace: boolean
  /** 是否超 15 分钟可强制清场（R-OT-2） */
  forceClearable: boolean
  /** 待释放：开场 20 分钟未签到（R-LATE-1 / R-FAIR-2） */
  releasable: boolean
}

export function timeState(b: Booking, nowHm: string): TimeState {
  const now = hm(nowHm)
  const start = hm(b.start)
  const end = hm(b.end)
  const active = isActive(b, nowHm)
  const lateMinutes = b.actualStart
    ? Math.max(0, hm(b.actualStart) - start)
    : (b.status === 'booked' ? Math.max(0, now - start) : 0)
  const overtimeMinutes = active ? Math.max(0, now - (end + 5)) : 0
  return {
    untilStart: start - now,
    lateMinutes,
    remaining: active ? end - now : 0,
    overtimeMinutes,
    inGrace: active && now > end && now <= end + 5,
    forceClearable: overtimeMinutes >= 15,
    releasable: b.status === 'booked' && now - start >= 20
  }
}

/** 迟到占位费：16–20 分钟 10 元（R-LATE-1） */
export function lateFee(b: Booking, nowHm: string): number {
  const lm = timeState(b, nowHm).lateMinutes
  if (lm >= 16) return 10
  return 0
}

/** 超时占用费：第 6 分钟起 2 元/分钟（R-OT-2） */
export function overtimeFee(b: Booking, nowHm: string): number {
  return timeState(b, nowHm).overtimeMinutes * 2
}

// ---------- 费用汇总 ----------
export interface FeeSummary {
  light: LightQuote | null
  /** 规则费用（押金以外的静态条目 + 迟到/超时动态条目），照明条目实时金额另算 */
  items: FeeItem[]
  charges: number
  refunds: number
  deposit: number
  /** 押金扣除已发生费用后的余额（可为负=需补缴） */
  depositBalance: number
  needTopup: boolean
}

export function feeSummary(b: Booking, court: Court | undefined, nowHm: string, lightFrozen = false): FeeSummary {
  const items: FeeItem[] = []
  const light = lightQuote(b, court, nowHm, lightFrozen)
  const lf = lateFee(b, nowHm)
  const of = overtimeFee(b, nowHm)
  for (const f of b.fees) {
    if (f.kind === 'lighting') continue // 照明实时计算
    items.push(f)
  }
  if (lf > 0 && !b.fees.some(f => f.kind === 'late')) {
    items.push({ kind: 'late', label: `迟到占位费（迟到 ${timeState(b, nowHm).lateMinutes} 分钟）`, amount: lf, ruleId: 'R-LATE-1' })
  }
  if (of > 0 && !b.fees.some(f => f.kind === 'overtime')) {
    items.push({ kind: 'overtime', label: `超时占用费（超时 ${timeState(b, nowHm).overtimeMinutes} 分钟 × 2 元）`, amount: of, ruleId: 'R-OT-2' })
  }
  const lightAmount = light?.fee ?? 0
  const charges = items.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0) + lightAmount
  const refunds = items.filter(i => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0)
  const deposit = b.lighting.deposit
  const depositBalance = deposit - charges
  return { light, items, charges, refunds, deposit, depositBalance, needTopup: depositBalance < 0 }
}

// ---------- 冲突风险 ----------
export type RiskLevel = 'high' | 'medium' | 'low' | 'none'

export interface RiskView {
  level: RiskLevel
  reasons: string[]
}

const ACTIVE_INCIDENT: IncidentStatus[] = ['open', 'mediating']

export function bookingRisk(b: Booking, incidents: Incident[], nowHm: string): RiskView {
  const reasons: string[] = []
  let level: RiskLevel = 'none'
  const raise = (lv: RiskLevel, r: string) => {
    reasons.push(r)
    if (lv === 'high' || (lv === 'medium' && level !== 'high')) level = lv
    if (lv === 'low' && level === 'none') level = 'low'
  }
  const ts = timeState(b, nowHm)
  if (ts.forceClearable) raise('high', `已超时 ${ts.overtimeMinutes} 分钟，管理员可强制清场（R-OT-2）`)
  else if (ts.overtimeMinutes > 0) raise('high', `超时占用 ${ts.overtimeMinutes} 分钟，正在计费`)
  else if (ts.inGrace) raise('medium', '进入 5 分钟清场缓冲，下一时段队伍待场')
  if (ts.releasable) raise('high', '开场 20 分钟未签到，场地可释放给候补散客（R-LATE-1）')
  if (b.status === 'booked' && ts.lateMinutes > 0 && ts.lateMinutes < 20) raise('medium', `已迟到 ${ts.lateMinutes} 分钟`)
  if (b.credit < 80) raise('medium', `信用分 ${b.credit}（低于 80，冲突排序靠后）`)
  if (b.credit < 60) raise('high', `信用分 ${b.credit}（低于 60，应暂停预约资格）`)
  if (b.status === 'rainPause') {
    raise('high', b.rainChoice
      ? '积水暂停已完成安置'
      : '雨后积水暂停：队长须在改约窗口内选择退款/顺延/室内/半场拼场（R-WX-3）')
  }

  for (const inc of incidents) {
    if (!inc.bookingIds.includes(b.id) || !ACTIVE_INCIDENT.includes(inc.status)) continue
    switch (inc.type) {
      case 'noise': raise('medium', '居民噪声投诉处理中，再次核实将收费（R-NOISE-1）'); break
      case 'minorNight': raise('medium', '未成年人无监护人陪同，等待监护人接回（R-MINOR-1）'); break
      case 'lightFault': raise('high', '照明故障待核验，费用已冻结（R-LIGHT-3）'); break
      case 'seal': raise('high', '封场令待签发，该预约可能被中止并全额退款（R-SEAL-1）'); break
      case 'rain': raise('medium', '降雨地滑暂停/限制使用（R-WX-1）'); break
      case 'hoopDispute': raise('high', '篮筐使用权争议待裁决（R-DISPUTE-1）'); break
      case 'repair': raise('high', '设施临时维修影响使用（R-WX-2）'); break
      default: raise('medium', '事件处理中')
    }
  }
  if (level === 'none') reasons.push('暂未发现冲突风险')
  return { level, reasons }
}

export function courtRisk(c: Court, bookings: Booking[], incidents: Incident[], nowHm: string): RiskView {
  const reasons: string[] = []
  let level: RiskLevel = 'none'
  const raise = (lv: RiskLevel, r: string) => {
    if (!reasons.includes(r)) reasons.push(r)
    if (lv === 'high' || (lv === 'medium' && level !== 'high')) level = lv
    if (lv === 'low' && level === 'none') level = 'low'
  }
  if (c.sealed) raise('high', `已封场：${c.sealReason ?? ''}`)
  if (c.sealedHalves?.length) raise('high', `${c.sealedHalves.join('/')} 已封停：${c.sealReason ?? ''}`)
  if (c.puddleHalves?.length) raise('high', `${c.puddleHalves.join('/')} 雨后积水暂停使用，受影响队伍待安置（R-WX-3）`)
  if (c.surface === 'slippery') raise('high', '地面积水打滑，暂停使用')
  else if (c.surface === 'wet') raise('low', '雨后湿滑，请注意防滑')
  else if (c.surface === 'repair') raise('high', '地面维修中')
  if (c.lighting.status === 'fault') raise('high', '照明故障，夜间场次受影响')
  Object.entries(c.hoops).forEach(([h, s]) => {
    if (s === 'maintaining') raise('medium', `${h} 篮筐维修中`)
    if (s === 'sealed') raise('high', `${h} 篮筐已封停`)
  })
  const actives = bookings.filter(b => b.courtId === c.id && isActive(b, nowHm))
  for (const b of actives) {
    const r = bookingRisk(b, incidents, nowHm)
    if (r.level === 'high') raise('high', `${b.halves.join('/')} ${b.teamName}：${r.reasons[0]}`)
    else if (r.level === 'medium') raise('medium', `${b.halves.join('/')} ${b.teamName}：${r.reasons[0]}`)
  }
  for (const inc of incidents) {
    if (inc.courtId !== c.id || !ACTIVE_INCIDENT.includes(inc.status)) continue
    raise(inc.type === 'noise' || inc.type === 'minorNight' ? 'medium' : 'high',
      `${INCIDENT_META[inc.type].emoji} ${inc.title}`)
  }
  if (level === 'none') reasons.push('场地运行正常')
  return { level, reasons }
}

// ---------- 场地占用 / 可用性 ----------
export function bookingsOfHalf(c: Court, half: string, bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => b.courtId === c.id && b.halves.includes(half))
    .sort((a, b2) => hm(a.start) - hm(b2.start))
}

export function halfUsable(c: Court, half: string): boolean {
  if (c.sealed) return false
  if (c.sealedHalves?.includes(half)) return false
  if (c.puddleHalves?.includes(half)) return false
  if (c.surface === 'slippery' || c.surface === 'repair') return false
  return c.hoops[half] !== 'maintaining' && c.hoops[half] !== 'sealed'
}

export function halfSealed(c: Court, half: string): boolean {
  return c.sealed || !!c.sealedHalves?.includes(half)
}

export interface SlotOption {
  start: string
  end: string
  /** 该时段可约半场编号（空=全满/不可约） */
  freeHalves: string[]
  fullAvailable: boolean
  label: string
  night: boolean
}

export function slotOptions(c: Court, bookings: Booking[]): SlotOption[] {
  const slots: Array<[string, string]> = [
    ['06:00', '08:00'], ['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '14:00'],
    ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00'], ['20:00', '22:00']
  ]
  const halfIds = Object.keys(c.hoops)
  return slots.map(([start, end]) => {
    const freeHalves = halfIds.filter(h => {
      if (!halfUsable(c, h)) return false
      const clash = bookingsOfHalf(c, h, bookings).some(b =>
        b.date === '2026-09-27' &&
        ![ 'cancelled', 'noshow', 'rejected'].includes(b.status) &&
        hm(b.start) < hm(end) && hm(b.end) > hm(start))
      return !clash
    })
    return {
      start, end, freeHalves,
      fullAvailable: freeHalves.length >= 2,
      label: `${start}–${end}`,
      night: hm(start) >= hm(`${c.lighting.autoOnHour}:00`)
    }
  })
}

// ---------- 公平性 / 改约解释 ----------
export function fairnessNote(b: Booking): string[] {
  const out: string[] = []
  if (b.status === 'rescheduled') {
    out.push('改约依据 R-FAIR-4：场地安全与维修 > 已支付已签到队伍 > 固定球队固定时段 > 先到先得 > 信用分。')
    out.push(b.adminNote ?? '管理员已给出改约理由与补偿。')
  }
  if (b.fixedTeam) out.push('固定球队资格：提前 7 天预约本周固定时段，但黄金时段固定队总量不超过 60%（R-FAIR-1）。')
  else out.push('散客/临时队伍：开场前 24 小时开放的公共名额可直接预约，与固定球队享同等到场权益（R-FAIR-1）。')
  if (b.credit < 80) out.push(`信用分 ${b.credit}：在场地冲突排序中靠后，建议按时到场、避免超时与投诉以恢复信用。`)
  return out
}

/** 拼场审核辅助：队长拒绝是否可能构成"无正当理由"（R-MERGE-1） */
export function rejectMergeCheck(b: Booking, req: MergeRequest): { unreasonable: boolean; hint: string } {
  const total = checkedInCount(b) + req.people
  if (req.minor) return { unreasonable: false, hint: '申请方含未成年人，夜场须监护人陪同，可作为正当理由（R-MINOR-1）' }
  if (b.headcount + req.people > (b.scope === 'full' ? 14 : 8)) {
    return { unreasonable: false, hint: '拼入后超出半场/全场建议人数上限，可作为正当理由' }
  }
  if (total >= 6) return { unreasonable: true, hint: '拼入后达到半场合理人数（≥6 人），无理由拒绝将收 20 元资源占用费并扣信用 5 分（R-MERGE-1）' }
  return { unreasonable: false, hint: '当前人数不足，建议同意拼场以提高场地利用率' }
}

// ---------- 雨后积水暂停 / 改约窗口（R-WX-3） ----------
const RAIN_LIVE: BookingStatus[] = ['booked', 'ongoing', 'late', 'overtime']
/** 受积水暂停影响的状态（发布瞬间为在场/待场，发布后转为 rainPause 仍应可查） */
const RAIN_AFFECTED: BookingStatus[] = [...RAIN_LIVE, 'rainPause']
/** 已不再占用场地的状态（计算替代场地空闲时排除） */
const FREE_STATUSES: BookingStatus[] = ['cancelled', 'noshow', 'rejected', 'sealed', 'rescheduled', 'rainPause', 'finished', 'earlyLeave']

export interface RainScope {
  courtId: string
  halves: string[]
  slotStart: string
  slotEnd: string
}

/** 受积水暂停影响的"该时段预约队伍"：占用受影响半场且时段重叠的在场/待场/已暂停队伍 */
export function rainAffectedBookings(scope: RainScope, bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => b.courtId === scope.courtId && RAIN_AFFECTED.includes(b.status))
    .filter(b => b.halves.some(h => scope.halves.includes(h)))
    .filter(b => hm(b.start) < hm(scope.slotEnd) && hm(b.end) > hm(scope.slotStart))
    .sort((a, b2) => hm(a.start) - hm(b2.start) || a.halves.join().localeCompare(b2.halves.join()))
}

/** 紧随其后、同半场已预约的队伍（暂停后需尽快通知，避免白跑） */
export function rainUpcomingBookings(scope: RainScope, bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => b.courtId === scope.courtId && b.status === 'booked')
    .filter(b => b.halves.some(h => scope.halves.includes(h)))
    .filter(b => hm(b.start) >= hm(scope.slotEnd))
    .sort((a, b2) => hm(a.start) - hm(b2.start))
}

/** 改约窗口剩余分钟（负=已逾期，系统兜底） */
export function rainWindowLeft(deadline: string | undefined, nowHm: string): number | null {
  if (!deadline) return null
  return hm(deadline) - hm(nowHm)
}

/** 已支付照明费口径：押金 + 暂停前实时照明费（暂停后计时冻结，见 store） */
export function paidLighting(b: Booking, court: Court | undefined, nowHm: string, frozen = false): { deposit: number; lighting: number } {
  const q = lightQuote(b, court, nowHm, frozen)
  return { deposit: b.lighting.deposit, lighting: Math.round((q?.fee ?? 0) * 100) / 100 }
}

export interface RainWaitTier {
  /** 已等待分钟（暂停发布至当前） */
  waited: number
  /** 管理员点验的到场人数 */
  presentCount: number
  /** 差异化安抚补偿（元） */
  compensation: number
  /** 是否赠同时长免费券（等待满 30 分钟） */
  voucher: boolean
  label: string
}

/**
 * 到场热身队伍的等待补偿阶梯（R-WX-3）：
 * 未到场不补偿；<15 分钟 5 元；15–29 分钟 10 元；≥30 分钟 15 元 + 免费券 1 张
 */
export function rainWaitTier(b: Booking, nowHm: string): RainWaitTier | null {
  const a = b.arrival
  if (!a || !a.warming || a.presentCount <= 0) return null
  const waited = Math.max(0, hm(nowHm) - hm(a.pausedAt))
  const presentCount = a.presentCount
  if (waited >= 30) return { waited, presentCount, compensation: 15, voucher: true, label: `已到场热身 ${presentCount} 人 · 等待 ${waited} 分钟（满 30 分钟）` }
  if (waited >= 15) return { waited, presentCount, compensation: 10, voucher: false, label: `已到场热身 ${presentCount} 人 · 等待 ${waited} 分钟（15–29 分钟）` }
  return { waited, presentCount, compensation: 5, voucher: false, label: `已到场热身 ${presentCount} 人 · 等待 ${waited} 分钟（不足 15 分钟）` }
}

/** 半场在指定时段是否空闲可用（排除已释放/改约/暂停的预约） */
export function halfFreeAt(c: Court, half: string, start: string, end: string, bookings: Booking[], excludeId?: string): boolean {
  if (!halfUsable(c, half)) return false
  return !bookings.some(b =>
    b.id !== excludeId &&
    b.courtId === c.id &&
    !FREE_STATUSES.includes(b.status) &&
    b.halves.includes(half) &&
    hm(b.start) < hm(end) && hm(b.end) > hm(start))
}

export interface RainAltSlot {
  key: string
  kind: RainOption
  courtId: string
  courtName: string
  indoor: boolean
  halves: string[]
  start: string
  end: string
  pricePerMinute: number
  distanceM: number
  note: string
  /** 半场拼场搭档 */
  partner?: { teamName: string; present: number; members: number; spare: number }
  available: boolean
  disabledReason?: string
}

const COURT_NAME_SHORT = (n: string) => n.replace('滨江社区篮球场 · ', '').replace('河滨公园灯光球场', '河滨灯光球场')

/** 顺延候选：恢复后当晚最近可约时段 + 次日同时段（同场地同半场，优先排位） */
export function postponeAlternatives(c: Court, b: Booking, bookings: Booking[], recoverEta: string): RainAltSlot[] {
  const out: RainAltSlot[] = []
  const need = b.scope === 'full' ? 2 : 1
  // 当晚：恢复时刻起 90 分钟，不晚于 22:00
  const rs = hm(recoverEta)
  const startMin = Math.min(rs, 22 * 60 - 90)
  const tonightStart = hmLabel(startMin)
  const tonightEnd = hmLabel(Math.min(startMin + 90, 22 * 60))
  const sameHalvesFree = b.halves.every(h => halfFreeAt(c, h, tonightStart, tonightEnd, bookings, b.id))
  out.push({
    key: 'postpone-tonight', kind: 'postpone', courtId: c.id, courtName: COURT_NAME_SHORT(c.name), indoor: false,
    halves: b.halves, start: tonightStart, end: tonightEnd, pricePerMinute: c.lighting.pricePerMinute, distanceM: 0,
    available: sameHalvesFree && startMin < 22 * 60,
    disabledReason: sameHalvesFree ? undefined : '恢复后原半场仍被占用，可改选次日同时段',
    note: `场地预计 ${recoverEta} 恢复，恢复后立即优先安排（今晚 ${tonightStart}–${tonightEnd}，照明按新时段重新计费）`
  })
  // 次日同时段
  out.push({
    key: 'postpone-tomorrow', kind: 'postpone', courtId: c.id, courtName: COURT_NAME_SHORT(c.name), indoor: false,
    halves: b.halves, start: b.start, end: b.end, pricePerMinute: c.lighting.pricePerMinute, distanceM: 0,
    available: true,
    note: `明日（9/28）${b.start}–${b.end} 同场地同半场，固定/优先排位，免收本次暂停前照明费`
  })
  return out
}

/** 室内候选：室内场馆当晚标准时段空闲半场（天气安置同价位，差价场地方承担） */
export function indoorAlternatives(courts: Court[], b: Booking, bookings: Booking[], afterHm: string): RainAltSlot[] {
  const need = b.scope === 'full' ? 2 : 1
  const slots: Array<[string, string]> = [['20:00', '22:00'], ['18:00', '20:00']]
  const out: RainAltSlot[] = []
  for (const c of courts.filter(x => x.indoor)) {
    for (const [s, e] of slots) {
      if (hm(s) < hm(afterHm)) continue
      const free = Object.keys(c.hoops).filter(h => halfFreeAt(c, h, s, e, bookings, b.id))
      const ok = free.length >= need
      out.push({
        key: `indoor-${c.id}-${s}`, kind: 'indoor', courtId: c.id, courtName: COURT_NAME_SHORT(c.name), indoor: true,
        halves: free.slice(0, need), start: s, end: e, pricePerMinute: c.lighting.pricePerMinute, distanceM: c.distanceM,
        available: ok,
        disabledReason: ok ? undefined : '该时段室内空闲半场不足',
        note: `室内场馆不受降雨影响；天气安置按原价结算（与室外同价位，差价场地方承担），距原场地 ${c.distanceM}m，照明 ¥${c.lighting.pricePerMinute}/分钟·半场`
      })
    }
  }
  return out.filter(x => x.available).concat(out.filter(x => !x.available)).slice(0, 3)
}

/** 半场拼场候选：同场地未积水半场、同时段接受拼场且有余位的队伍 */
export function halfMergeAlternatives(c: Court, b: Booking, bookings: Booking[], slotStart: string, slotEnd: string): RainAltSlot[] {
  const partners = bookings
    .filter(x => x.id !== b.id && x.courtId === c.id)
    .filter(x => RAIN_LIVE.includes(x.status) && x.acceptMerge)
    .filter(x => hm(x.start) < hm(slotEnd) && hm(x.end) > hm(slotStart))
    .filter(x => x.halves.length === 1 && !c.puddleHalves?.includes(x.halves[0]) && halfUsable(c, x.halves[0]))
  return partners.map(p => {
    const spare = 8 - p.members.length
    const over = b.members.length > Math.max(0, spare)
    return {
      key: `merge-${p.id}`, kind: 'halfMerge' as RainOption, courtId: c.id, courtName: COURT_NAME_SHORT(c.name), indoor: false,
      halves: p.halves, start: p.start, end: p.end, pricePerMinute: c.lighting.pricePerMinute, distanceM: 0,
      available: true,
      note: over
        ? `与 ${p.teamName} 共用 ${p.halves[0]}：本队 ${b.members.length} 人、余位 ${Math.max(0, spare)} 个，需双方现场分波轮换（队长协商一致即可）`
        : `与 ${p.teamName} 共用 ${p.halves[0]}：对方 ${p.members.length} 人、余位 ${spare} 个，照明拼场 8 折按签到人数平摊`,
      partner: { teamName: p.teamName, present: checkedInCount(p), members: p.members.length, spare }
    }
  })
}

export interface RainPlan {
  /** 原路退回金额（押金；暂停前照明费免收） */
  refund: number
  /** 免收的暂停前照明费（仅展示） */
  waivedLight: number
  /** 到场等待安抚补偿（0=完全未到场） */
  compensation: number
  vouchers: number
  statusAfter: BookingStatus
  payStatusAfter: Booking['payStatus']
  summary: string
}

/** 四种安置方案的费用/状态试算（退款或补偿区别于完全未到场的预约） */
export function rainOptionPlan(b: Booking, option: RainOption, court: Court | undefined, nowHm: string): RainPlan {
  const paid = paidLighting(b, court, nowHm, true)
  const tier = rainWaitTier(b, nowHm)
  const comp = tier?.compensation ?? 0
  const vouchers = tier?.voucher ? 1 : 0
  if (option === 'refund') {
    return {
      refund: paid.deposit, waivedLight: paid.lighting, compensation: comp, vouchers,
      statusAfter: 'cancelled', payStatusAfter: 'refunded',
      summary: `全额退款：照明押金 ¥${paid.deposit} 原路退回，暂停前照明费 ¥${paid.lighting.toFixed(2)} 免收` +
        (comp ? `；${tier!.label}，安抚补偿 ¥${comp}${vouchers ? ' + 同时长免费券 1 张' : ''}` : '；队伍未到场热身，不发等待补偿')
    }
  }
  const label = option === 'postpone' ? '顺延新时段' : option === 'indoor' ? '改到室内场馆' : '接受半场拼场'
  return {
    refund: 0, waivedLight: paid.lighting, compensation: comp, vouchers,
    statusAfter: 'rescheduled', payStatusAfter: 'depositPaid',
    summary: `${label}：照明押金 ¥${paid.deposit} 平移到新预约，暂停前照明费 ¥${paid.lighting.toFixed(2)} 免收` +
      (comp ? `；${tier!.label}，安抚补偿 ¥${comp}${vouchers ? ' + 同时长免费券 1 张' : ''}` : '；队伍未到场热身，不发等待补偿')
  }
}
