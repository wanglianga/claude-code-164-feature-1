/**
 * 核心业务规则冒烟测试（无 DOM 依赖）：
 *   node_modules/.bin/esbuild scripts/smoke.ts --bundle --platform=node --format=esm | node
 * 覆盖：照明实时计费、拒拼扣费、押金结算、爽约释放、照明故障、封场，
 *      以及新增的雨后积水暂停/改约窗口/到场等待差异化补偿（R-WX-3）。
 */
import {
  useState, respondMerge, endUsage, releaseBooking, resolveLightFault,
  issueSealOrder, publishRainSuspension, chooseRainOption, recoverRain
} from '../src/store'
import {
  checkedInCount, feeSummary, halfUsable, rainAffectedBookings, rainWaitTier, rainWindowLeft,
  halfMergeAlternatives, indoorAlternatives, postponeAlternatives
} from '../src/lib/engine'

let passed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ASSERT FAIL: ${msg}`)
    process.exit(1)
  }
  passed++
  console.log(`✅ ${msg}`)
}

const state = useState()
const court3 = state.courts.find(c => c.id === 'court-3')!
const court4 = state.courts.find(c => c.id === 'court-4')!
const b003 = state.bookings.find(b => b.id === 'B003')!
const b011 = state.bookings.find(b => b.id === 'B011')!
const b012 = state.bookings.find(b => b.id === 'B012')!
const inc7 = state.incidents.find(i => i.id === 'I-007')!

// ---------- 初始演示数据：三号场积水暂停 ----------
assert(court3.puddleHalves?.join() === 'H1,H2,H3', '三号场 H1/H2/H3 初始即为积水暂停半场')
assert(!halfUsable(court3, 'H1') && halfUsable(court3, 'H4'), 'H1 不可用、H4 仍可用')
assert(!!court4.indoor, 'court-4 为室内场馆（雨天替代场地）')
assert(b003.status === 'rainPause' && b011.status === 'rainPause', '烈风队/晚风女篮均处于积水暂停待选择')
assert(b003.arrival?.presentCount === 9 && b003.arrival.warming === true, '烈风队已点验到场热身 9 人')
assert(!b011.arrival, '晚风女篮未到场（无到场登记）')

const scope = { courtId: 'court-3', halves: ['H1', 'H2', 'H3'], slotStart: '19:00', slotEnd: '21:00' }
const affected = rainAffectedBookings(scope, state.bookings).map(b => b.id)
assert(affected.join() === 'B003,B011', '该时段受影响队伍为 B003、B011（H4 的 B012 不受影响）')
assert(rainWindowLeft('19:55', '19:42') === 13, '改约窗口 19:55 截止，19:42 时剩余 13 分钟')

// ---------- 到场等待阶梯补偿 ----------
assert(rainWaitTier(b003, '19:42')!.compensation === 5, '等待 2 分钟：安抚补偿 5 元')
assert(rainWaitTier(b003, '19:55')!.compensation === 10, '等待 15 分钟：补偿升为 10 元')
const tier30 = rainWaitTier(b003, '20:10')!
assert(tier30.compensation === 15 && tier30.voucher === true, '等待满 30 分钟：补偿 15 元 + 免费券 1 张')
assert(rainWaitTier(b011, '20:10') === null, '完全未到场的晚风女篮：无等待补偿')

// ---------- 可替代场地 / 半场拼场候选 ----------
const merges = halfMergeAlternatives(court3, b003, state.bookings, '19:00', '21:00')
assert(merges.some(s => s.partner?.teamName === b012.teamName && s.halves[0] === 'H4'), '半场拼场候选含 H4 夜训小组')
const indoors = indoorAlternatives(state.courts, b003, state.bookings, '19:42')
const indoor20 = indoors.find(s => s.start === '20:00')
assert(!!indoor20 && indoor20.available && indoor20.halves.length === 2, '室内场 20:00–22:00 有 2 个空闲半场，可安置烈风队全场')
assert(!indoors.some(s => s.start === '18:00'), '已开始的 18:00–20:00 室内时段不作为候选')
const post = postponeAlternatives(court3, b011, state.bookings, '20:30')
assert(post[0].start === '20:30' && post[1].key === 'postpone-tomorrow', '顺延候选=今晚恢复后 20:30 起 90 分钟 + 明日同时段')

// ---------- 烈风队选择全额退款（到场等待 2 分钟，区别于未到场） ----------
chooseRainOption('B003', 'refund')
assert(b003.status === 'cancelled' && b003.payStatus === 'refunded', '退款后：预约取消、已退款')
assert(b003.fees.some(f => f.kind === 'rainRefund' && f.amount === -100), '照明押金 100 元全额退回')
assert(b003.fees.some(f => f.kind === 'rainWait' && f.amount === -5), '到场热身队伍另退等待安抚 5 元')
assert(!b003.fees.some(f => f.kind === 'lighting'), '暂停前照明实时费已免收（占位费移除）')
const mr4 = state.mergeRequests.find(r => r.id === 'MR-4')!
assert(mr4.superseded === true && !!mr4.supersededNote, '散客王同学的 MR-4 拼场申请被同步（superseded，避免白跑）')

// ---------- 晚风女篮选择改到室内场（未到场：只退/平移费用，无等待补偿） ----------
const before = state.bookings.length
const indoorB011 = indoorAlternatives(state.courts, b011, state.bookings, '19:42')
  .find(s => s.start === '20:00' && s.available)!
const res = chooseRainOption('B011', 'indoor', indoorB011)
assert(b011.status === 'rescheduled' && !!res.newBooking, '晚风女篮改到室内场：原预约标记已改约并生成新预约')
assert(state.bookings.length === before + 1, '新预约已写入预约列表')
assert(res.newBooking!.courtId === 'court-4' && res.newBooking!.lighting.deposit === 50, '新预约在室内馆，押金 50 元平移')
assert(res.newBooking!.status === 'booked' && res.newBooking!.payStatus === 'depositPaid', '新预约待开场、押金已付')
assert(res.newBooking!.members.length === 5 && res.newBooking!.members.every(m => !m.checkedIn), '新预约携带 5 名队员且签到清零')
assert(!b011.fees.some(f => f.kind === 'rainWait'), '未到场队伍不产生等待安抚补偿')
assert(inc7.status === 'resolved', '两队全部完成安置后，积水工单自动办结')

// ---------- 复查解除 ----------
recoverRain('I-007')
assert(!court3.puddleHalves?.length, '复查积水清除后，三号场暂停半场全部解除')

// ---------- 管理员在 A 区新发布积水暂停（完整发布流程） ----------
const inc = publishRainSuspension({
  courtId: 'court-1', halves: ['H1'], slotStart: '18:00', slotEnd: '20:00',
  chooseDeadline: '19:57', recoverEta: '20:30', desc: '演示：A区 H1 积水'
})
const b001 = state.bookings.find(b => b.id === 'B001')!
assert(b001.status === 'rainPause' && b001.rainIncidentId === inc.id, '发布后进行中的晨光队自动进入暂停待选择')
assert(b001.lighting.offAt === '19:42', '进行中场次照明立即关灯、计时冻结')
assert(b001.arrival?.presentCount === checkedInCount(b001), '进行中场次以签到人数预填到场点验（管理员可修正）')
assert(inc.bookingIds.includes('B001') && !inc.bookingIds.includes('B002'), '仅关联占用 H1 的 B001（H2 的 B002 不关联）')
assert(state.notices.some(n => n.text.includes('积水暂停')), '已向队员/散客/全员推送暂停通知')

// ---------- 半场拼场：晨光队并入同场 H2 散客联队（临时开放其拼场作为候选） ----------
const court1 = state.courts.find(c => c.id === 'court-1')!
const b002 = state.bookings.find(b => b.id === 'B002')!
b002.acceptMerge = true
const merge1 = halfMergeAlternatives(court1, b001, state.bookings, '18:00', '20:00')
assert(merge1.some(s => s.partner?.teamName === b002.teamName && s.halves[0] === 'H2'), '同场未积水 H2 的散客联队成为半场拼场候选')
const b002MembersBefore = b002.members.length
const b002DepositBefore = b002.lighting.deposit
chooseRainOption('B001', 'halfMerge', merge1.find(s => s.partner?.teamName === b002.teamName)!)
assert(b001.status === 'rescheduled', '晨光队接受半场拼场：原预约标记已改约')
assert(b002.members.length === b002MembersBefore + 7, `晨光队 7 名队员并入散客联队（${b002.members.length} = ${b002MembersBefore}+7）`)
assert(b002.lighting.deposit === b002DepositBefore + 50, '照明押金 50 元平移到拼场场次共同担保')
assert(b001.fees.some(f => f.kind === 'rainWait' && f.amount === -5), '到场热身队员的等待安抚 5 元照常补偿')
const mr1 = state.mergeRequests.find(r => r.id === 'MR-1')!
assert(mr1.bookingId === 'B002' && mr1.superseded === true, '晨光队的散客申请 MR-1 自动转挂到 B002 并同步新签到码')
assert(!!b001.rainChoice?.newBookingId && b001.rainChoice.newBookingId === 'B002', '安置结果记录新场次 id（B002）')

// ---------- 原有核心规则回归 ----------
// 照明实时计费：B002 18:25 开灯，当前 19:42 = 77 分钟
const fs2 = feeSummary(b002, state.courts.find(c => c.id === 'court-1'), '19:42')
const lightMin = fs2.light?.minutes
assert(lightMin === 77, `照明按实际开灯分钟累计（18:25→19:42 = 77 分钟，实际 ${lightMin}）`)

// 无理由拒拼 20 元已在 B002 静态费用
assert(b002.fees.some(f => f.kind === 'refuseMerge' && f.amount === 20), '无理由拒拼收 20 元资源占用费')

// 封场只作用于 H3/H4：B009 退款，B003 已因积水 rescheduled 不受封场影响；新增一支 H1/H2 在场队伍验证
issueSealOrder('I-006', '社区文化活动', '22:30')
const b009 = state.bookings.find(b => b.id === 'B009')!
assert(b009.status === 'sealed' && b009.payStatus === 'refunded', '封场：B009 中止并全额退款')
assert(b012.status !== 'sealed', 'H4 的夜训小组 21:00 正好结束，与 21:00 起封场时段不重叠，不受影响')

// 结算链：B010 押金 50 - 照明 40 = 退 10
const b010 = state.bookings.find(b => b.id === 'B010')!
assert(b010.fees.some(f => f.kind === 'earlyRefund' && f.amount === -10), '提前离场结算押金余额退回 10 元')

// 照明故障三选一（B004）
resolveLightFault('I-005', 'refund')
const b004 = state.bookings.find(b => b.id === 'B004')!
assert(b004.status === 'cancelled' && b004.payStatus === 'refunded', '照明故障核验后全额退款、工单办结')

console.log(`\n🎉 全部 ${passed} 项冒烟断言通过`)
