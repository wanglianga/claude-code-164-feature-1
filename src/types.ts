// ============ 领域类型定义 ============

export type RoleId = 'captain' | 'walkin' | 'admin' | 'worker'

export interface Role {
  id: RoleId
  name: string
  emoji: string
  desc: string
}

/** 场地地面状况 */
export type SurfaceStatus = 'good' | 'wet' | 'slippery' | 'repair'
/** 篮筐状态 */
export type HoopStatus = 'normal' | 'maintaining' | 'sealed'

export interface Court {
  id: string
  name: string
  park: string
  /** 可划分半场数量（全场 = 2 个半场） */
  halfCourts: number
  surface: SurfaceStatus
  /** 各篮筐状态，按半场编号 */
  hoops: Record<string, HoopStatus>
  /** 附近噪声敏感小区 */
  noiseSensitive: string[]
  /** 噪声截止时间（小时，22 表示 22:00 后须静音/关灯） */
  noiseCurfew: number
  lockersTotal: number
  lockersFree: number
  /** 照明元数据 */
  lighting: {
    available: boolean
    /** 每半场每分钟单价（元） */
    pricePerMinute: number
    /** 照明起步开启时间（小时，18 表示 18:00 起可开灯） */
    autoOnHour: number
    /** 押金（元） */
    deposit: number
    status: 'ok' | 'fault' | 'off'
  }
  /** 距离（米），仅展示用 */
  distanceM: number
  sealed: boolean
  sealReason?: string
  /** 部分封场（如仅封 H3/H4），为空表示全场地封停 */
  sealedHalves?: string[]
}

export type Scope = 'half' | 'full'
export type BookingStatus =
  | 'booked'        // 已预约待开始
  | 'ongoing'       // 进行中
  | 'finished'      // 正常结束
  | 'earlyLeave'    // 提前离场
  | 'late'          // 迟到（进行中但触发迟到规则）
  | 'overtime'      // 超时占用
  | 'cancelled'     // 取消
  | 'rescheduled'   // 被改约
  | 'sealed'        // 封场未使用
  | 'noshow'        // 爽约
  | 'rejected'      // 审核不通过

export type PayStatus = 'unpaid' | 'depositPaid' | 'paid' | 'refunding' | 'refunded' | 'deducted'

export interface Member {
  id: string
  name: string
  phone: string
  isCaptain: boolean
  checkedIn: boolean
  checkInAt?: string // HH:mm
  /** 未成年人需监护人陪同夜场 */
  minor?: boolean
}

/** 照明实际使用记录 */
export interface LightingUsage {
  enabled: boolean
  /** 实际开灯时间 HH:mm */
  onAt?: string
  /** 实际关灯时间 HH:mm（未关则按当前/结束时间计） */
  offAt?: string
  minutes: number
  fee: number
  deposit: number
}

export type FeeItemKind =
  | 'lighting'      // 照明费
  | 'deposit'       // 押金
  | 'late'          // 迟到扣费
  | 'overtime'      // 超时占用费
  | 'refuseMerge'  // 拒绝拼场资源占用费
  | 'earlyRefund'  // 提前离场退还
  | 'weather'      // 天气/维修补偿
  | 'complaint'    // 噪声投诉处罚
  | 'sealRefund'   // 封场全额退款
  | 'reschedule'   // 改约补偿

export interface FeeItem {
  kind: FeeItemKind
  label: string
  amount: number   // 正=收取，负=退还/抵扣
  ruleId: string
  note?: string
}

export type IncidentType =
  | 'rain'            // 下雨地滑
  | 'repair'          // 临时维修
  | 'hoopDispute'     // 争抢篮筐
  | 'noise'           // 噪声投诉
  | 'minorNight'      // 未成年人夜间滞留
  | 'lightFault'      // 照明故障
  | 'seal'            // 管理员封场
  | 'late'            // 队伍迟到
  | 'overtime'        // 超时占用
  | 'refuseMerge'    // 拒绝拼场

export type IncidentStatus = 'open' | 'mediating' | 'resolved' | 'penalized'

export interface Incident {
  id: string
  type: IncidentType
  courtId: string
  bookingIds: string[]
  title: string
  desc: string
  source: string // 投诉人/上报人
  time: string   // HH:mm
  status: IncidentStatus
  /** 处置记录（时间线） */
  actions: IncidentAction[]
  /** 关联的费用/补偿条目，已在结算时写入 booking */
  ruleApplied?: string[]
  /** 后续处罚 */
  penalty?: string
}

export interface IncidentAction {
  at: string
  by: RoleId
  text: string
}

/** 拼场申请 */
export interface MergeRequest {
  id: string
  bookingId: string
  walkerName: string
  walkerPhone: string
  people: number
  minor?: boolean
  message: string
  status: 'pending' | 'accepted' | 'rejected'
  /** 队长拒绝是否被判为"无正当理由拒拼" */
  unreasonable?: boolean
  time: string
}

export interface Booking {
  id: string
  code: string
  courtId: string
  /** 使用的半场编号列表，全场占两个 */
  halves: string[]
  scope: Scope
  date: string        // YYYY-MM-DD
  start: string       // HH:mm
  end: string
  /** 实际开始 / 结束（迟到、提前离场、超时用） */
  actualStart?: string
  actualEnd?: string
  headcount: number
  acceptMerge: boolean
  teamName: string
  captainId: string
  captainName: string
  captainPhone: string
  members: Member[]
  status: BookingStatus
  payStatus: PayStatus
  lighting: LightingUsage
  fees: FeeItem[]
  /** 固定球队优先标识（公平性说明用） */
  fixedTeam?: boolean
  /** 历史履约信用分（初始 100） */
  credit: number
  /** 管理员改约/限制原因 */
  adminNote?: string
  /** 权益/核验时间线 */
  timeline: TimelineEvent[]
  /** 签到码 */
  checkInCode: string
  lockerNos?: number[]
}

export interface TimelineEvent {
  at: string
  text: string
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export interface RuleText {
  id: string
  chapter: string
  title: string
  body: string
}
