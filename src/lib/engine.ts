import type {
  Booking, Court, FeeItem, Incident, IncidentType, IncidentStatus, BookingStatus,
  MergeRequest, PayStatus, SurfaceStatus, HoopStatus, RainChoice
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
  noshow: { label: '爽约', type: 'error' },
  rejected: { label: '审核不通过', type: 'error' },
  suspended: { label: '积水暂停中', type: 'warning' }
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
  reschedule: { label: '改约补偿', type: 'success' }
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
  if (b.status === 'suspended') raise('medium', '雨后积水暂停使用，等待队长四选一（退款/顺延/室内场/半场拼场，R-WX-3）')
  if (b.credit < 80) raise('medium', `信用分 ${b.credit}（低于 80，冲突排序靠后）`)
  if (b.credit < 60) raise('high', `信用分 ${b.credit}（低于 60，应暂停预约资格）`)

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

// ---------- 雨后积水暂停与改约（R-WX-3） ----------
export const RAIN_CHOICE_META: Record<RainChoice, { label: string; emoji: string; desc: string }> = {
  refund: { label: '全额退款', emoji: '💰', desc: '押金退还，已计照明费按实际开灯时长结算；到场补贴照发' },
  delay: { label: '顺延', emoji: '⏭️', desc: '顺延至明日同时段同场地，优先排位；押金余额转存新时段' },
  indoor: { label: '改到室内场', emoji: '🏢', desc: '改约室内场馆今日最近空闲时段，照明差价由场地方承担' },
  shareHalf: { label: '接受半场拼场', emoji: '🤝', desc: '并入其他场地空闲半场，照明 8 折，到场补贴照发' }
}

/** 到场等待补贴（R-WX-3）：到场 3 元/人，等待超 30 分钟每队再加 10 元；完全未到场无补贴 */
export function rainCompensation(arrived: number, waitMin: number): { perHead: number; waitBonus: number; total: number } {
  const perHead = arrived * 3
  const waitBonus = arrived > 0 && waitMin >= 30 ? 10 : 0
  return { perHead, waitBonus, total: perHead + waitBonus }
}

export interface RainAltOption {
  kind: RainChoice
  label: string
  desc: string
  courtId?: string
  courtName?: string
  halves?: string[]
  start?: string
  end?: string
  date?: string
}

export interface RainAlternatives {
  delay: RainAltOption
  indoor: RainAltOption | null
  shareHalf: RainAltOption | null
}

/** 受影响预约的改约窗口：顺延（明日同时段）/ 室内场（今日最近空闲）/ 半场拼场（其他场地空闲半场） */
export function rainAlternatives(
  b: Booking, courts: Court[], bookings: Booking[], nowHm: string, tomorrow: string
): RainAlternatives {
  const ownCourt = courts.find(c => c.id === b.courtId)
  const need = b.scope === 'full' ? 2 : 1
  const delay: RainAltOption = {
    kind: 'delay',
    label: `明日（${tomorrow.slice(5).replace('-', '/')}）${b.start}–${b.end} 同场地 ${b.halves.join('+')}`,
    desc: '同场地同半场顺延，优先排位；押金余额转存新时段',
    courtId: b.courtId,
    courtName: ownCourt?.name,
    halves: b.halves,
    start: b.start,
    end: b.end,
    date: tomorrow
  }
  const dur = hm(b.end) - hm(b.start)
  let indoor: RainAltOption | null = null
  for (const c of courts.filter(x => x.indoor && !x.sealed)) {
    // 今日尚未结束的时段均可转入（进行中的时段可立即转入）
    const slot = slotOptions(c, bookings).find(s =>
      hm(s.end) > hm(nowHm) && hm(s.end) - hm(s.start) >= dur && s.freeHalves.length >= need)
    if (slot) {
      indoor = {
        kind: 'indoor',
        label: `${c.name} ${slot.freeHalves.slice(0, need).join('+')} 今日 ${slot.start}–${slot.end}`,
        desc: `室内馆不受雨天影响，照明差价（¥${c.lighting.pricePerMinute}/分钟）由场地方承担`,
        courtId: c.id,
        courtName: c.name,
        halves: slot.freeHalves.slice(0, need),
        start: slot.start,
        end: slot.end,
        date: b.date
      }
      break
    }
  }
  let shareHalf: RainAltOption | null = null
  for (const c of courts.filter(x =>
    !x.indoor && x.id !== b.courtId && !x.sealed && x.surface !== 'slippery' && x.surface !== 'repair')) {
    const slot = slotOptions(c, bookings).find(s => hm(s.end) > hm(nowHm) && s.freeHalves.length >= 1)
    if (slot) {
      shareHalf = {
        kind: 'shareHalf',
        label: `${c.name} ${slot.freeHalves[0]} 今日 ${slot.start}–${slot.end}`,
        desc: '并入该空闲半场（若届时已有队伍则共同使用），照明 8 折',
        courtId: c.id,
        courtName: c.name,
        halves: [slot.freeHalves[0]],
        start: slot.start,
        end: slot.end,
        date: b.date
      }
      break
    }
  }
  return { delay, indoor, shareHalf }
}
