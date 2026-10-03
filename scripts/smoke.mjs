/**
 * 冒烟测试：用 esbuild 把 src/store.ts + src/lib/engine.ts 打包后在 Node 中执行断言。
 * 运行：npm test
 */
import { buildSync } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'node_modules', '.cache', 'smoke-bundle.mjs')
mkdirSync(dirname(out), { recursive: true })
buildSync({
  stdin: {
    contents: `export * as store from './src/store.ts'\nexport * as engine from './src/lib/engine.ts'`,
    resolveDir: root,
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent'
})

const { store, engine } = await import(pathToFileURL(out).href)
const state = store.useState()

let passed = 0
let failed = 0
function assert(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}
const booking = id => state.bookings.find(b => b.id === id)
const court = id => state.courts.find(c => c.id === id)

console.log('\n【回归】既有核心规则')
const q1 = engine.lightQuote(booking('B001'), court('court-1'), '19:42')
assert('照明实时计费 97 分钟 × 0.8 元 × 8 折 = 62.08 元', q1 && q1.minutes === 97 && Math.abs(q1.fee - 62.08) < 0.001, `got ${q1?.minutes}min ¥${q1?.fee}`)
assert('照明费按 6 名签到人均摊 ≈ 10.35 元', q1 && Math.abs(q1.perPerson - 62.08 / 6) < 0.001)
assert('开场 20 分钟未签到可释放（B012 初始可释放）', engine.timeState(booking('B012'), '19:42').releasable === true)

console.log('\n【积水暂停】管理员巡查发布（R-WX-1 / R-WX-3）')
assert('前三号场地地面干燥', court('court-3').surface === 'good')
const suspend = store.publishRainSuspend('court-3', '21:00', '巡查发现地面积水')
assert('场地置为积水打滑', court('court-3').surface === 'slippery')
assert('受影响预约 3 个（B003/B011/B012，21:00 开场的 B009 不受影响）',
  suspend.entries.length === 3 && ['B003', 'B011', 'B012'].every(id => suspend.entries.some(e => e.bookingId === id)))
assert('进行中预约被挂起为 suspended', booking('B003').status === 'suspended' && booking('B011').status === 'suspended')
assert('未开场预约同样挂起，且不再计爽约释放', booking('B012').status === 'suspended' && engine.timeState(booking('B012'), '19:42').releasable === false)
assert('照明计费于暂停时停止（B003 19:42 关灯）', booking('B003').lighting.offAt === '19:42')
assert('到场人数快照：B003=9、B011=4、B012=0',
  suspend.entries.find(e => e.bookingId === 'B003').arrivedAtPublish === 9 &&
  suspend.entries.find(e => e.bookingId === 'B011').arrivedAtPublish === 4 &&
  suspend.entries.find(e => e.bookingId === 'B012').arrivedAtPublish === 0)
assert('生成 rain 工单并关联 3 个预约', state.incidents[0].type === 'rain' && state.incidents[0].bookingIds.length === 3)
assert('全场通知已发送（避免白跑）', state.notices.some(n => n.to === 'all' && n.text.includes('暂停使用')))

console.log('\n【补偿规则】到场等待补贴（R-WX-3）')
assert('到场 9 人等待 20 分钟 = 27 元', engine.rainCompensation(9, 20).total === 27)
assert('到场 4 人等待 35 分钟 = 12 + 10 = 22 元', engine.rainCompensation(4, 35).total === 22)
assert('完全未到场无补贴', engine.rainCompensation(0, 60).total === 0)

console.log('\n【改约窗口】可替代场地实时计算')
const altsB003 = engine.rainAlternatives(booking('B003'), state.courts, state.bookings, '19:42', '2026-09-28')
assert('顺延 = 明日同时段同场地', altsB003.delay.label.includes('明日') && altsB003.delay.label.includes('19:00–21:00'))
assert('室内场 = 滨江体育中心室内馆（全场需 2 个空闲半场）', altsB003.indoor?.courtId === 'court-4' && altsB003.indoor.halves.length === 2)
assert('半场拼场 = B区 H1（A区 20:00 已满、B区 H2 维修）', altsB003.shareHalf?.courtId === 'court-2' && altsB003.shareHalf.halves[0] === 'H1')

console.log('\n【等待时长】推进演示时钟 35 分钟（19:42 → 20:17）')
store.tick(35)
assert('时钟到 20:17', store.nowStr.value === '20:17')

console.log('\n【队长四选一】B011 晨光队·二阵 → 改到室内场（到场 4 人）')
store.chooseRainOption('B011', 'indoor', 'captain')
const e11 = suspend.entries.find(e => e.bookingId === 'B011')
assert('状态改为已改约', booking('B011').status === 'rescheduled')
assert('管理员说明含室内馆与时段', booking('B011').adminNote.includes('室内') && booking('B011').adminNote.includes('20:00–22:00'))
assert('补贴 = 4 人 × 3 + 等待超 30 分钟 10 = 22 元', e11.compensate === 22 && booking('B011').fees.some(f => f.kind === 'weather' && f.amount === -22))
assert('照明费按实际 30 分钟计 24 元', booking('B011').lighting.minutes === 30 && Math.abs(booking('B011').lighting.fee - 24) < 0.001)
assert('免责窗口内签到，无迟到占位费干扰', !booking('B011').fees.some(f => f.kind === 'late'))
assert('结果同步队员与拼场散客（队员 7 人、散客 1 人）', e11.synced && e11.syncNote.includes('队员 7 人') && e11.syncNote.includes('拼场散客 1 人'))
assert('散客收到改约通知（避免白跑）', state.notices.some(n => n.to === 'walkin' && n.text.includes('晨光队·二阵') && n.text.includes('请勿白跑')))

console.log('\n【管理员代录】B003 烈风队 → 顺延（到场 9 人）')
store.chooseRainOption('B003', 'delay', 'admin')
const e03 = suspend.entries.find(e => e.bookingId === 'B003')
assert('状态改为已改约', booking('B003').status === 'rescheduled')
assert('顺延至明日同时段并优先排位', booking('B003').adminNote.includes('明日') && booking('B003').adminNote.includes('优先排位'))
assert('补贴 = 9 人 × 3 + 10 = 37 元', e03.compensate === 37 && booking('B003').fees.some(f => f.kind === 'weather' && f.amount === -37))
assert('照明费按实际 40 分钟 × 2 半场 × 8 折 = 64 元', booking('B003').lighting.minutes === 40 && Math.abs(booking('B003').lighting.fee - 64) < 0.001)

console.log('\n【完全未到场】B012 清风队 → 全额退款（无等待补贴）')
store.chooseRainOption('B012', 'refund', 'admin')
const e12 = suspend.entries.find(e => e.bookingId === 'B012')
assert('状态改为已取消、已退款', booking('B012').status === 'cancelled' && booking('B012').payStatus === 'refunded')
assert('未到场补贴为 0', e12.compensate === 0 && !booking('B012').fees.some(f => f.kind === 'weather' && f.label.includes('等待补贴')))
assert('押金 50 元全额退回', booking('B012').fees.some(f => f.kind === 'weather' && f.amount === -50))
assert('未开灯不产生照明费', !booking('B012').fees.some(f => f.kind === 'lighting'))

console.log('\n【恢复使用】积水清理完毕')
store.recoverRainSuspend(suspend.id)
assert('场地恢复为湿滑（警示）', court('court-3').surface === 'wet')
assert('暂停事件办结、工单办结', suspend.status === 'recovered' && state.incidents[0].status === 'resolved')

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed ? 1 : 0)
