// jsdom 烟雾测试：验证 AchievementManager + 以牌命名成就 + b1 注入 + 连续同牌解锁
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
const { window } = dom;
global.window = window;
global.localStorage = window.localStorage;
global.document = window.document;
window.localStorage.clear();   // 保证每次运行从干净状态开始

// 在 window 作用域内加载脚本，使 class/函数声明共享作用域，并挂到 window 上供测试使用
const code = ['js/config.js', 'js/achievements.js', 'js/game.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n;\n') + '\n' +
  'window.AchievementManager = AchievementManager;' +
  'window.MahjongGame = MahjongGame;' +
  'window.buildLevel = buildLevel;' +
  'window.TILE_POOL = TILE_POOL;';
window.eval(code);

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const TILES = Object.values(window.TILE_POOL).flat();
const EXPECT_TILE = TILES.length;        // 55
const EXPECT_TOTAL = 16 + EXPECT_TILE + 14;   // 85 (16 基础 + 55 牌 + 14 集合成就)

console.log('— 基础解锁 —');
const A = new window.AchievementManager();
assert('初始未解锁 first_win', !A.isUnlocked('first_win'));
assert('首次解锁返回 true', A.unlock('first_win') === true);
assert('首次解锁后状态为 true', A.isUnlocked('first_win') === true);
assert('重复解锁返回 false', A.unlock('first_win') === false);
assert('unlockedCount = 1', A.unlockedCount() === 1);
assert('totalCount = 85 (16 基础 + 55 牌 + 14 集合)', A.totalCount() === EXPECT_TOTAL);

console.log('— 以牌命名成就生成 —');
assert('牌成就数量 = 55', A.ACHIEVEMENTS.filter(a => a.isTile).length === EXPECT_TILE);
assert('含 tile_b1（百搭可达成）', !!A.getDef('tile_b1'));
assert('含 tile_t1 / tile_w1', !!A.getDef('tile_t1') && !!A.getDef('tile_w1'));
assert('t 族门槛=4', A.getDef('tile_t1').threshold === 4);
assert('s 族门槛=3', A.getDef('tile_s5').threshold === 3);
assert('w 族门槛=2', A.getDef('tile_w1').threshold === 2);
assert('f 族门槛=2', A.getDef('tile_f1').threshold === 2);
assert('h/y/d 族门槛=2',
  A.getDef('tile_h1').threshold === 2 && A.getDef('tile_y1').threshold === 2 && A.getDef('tile_d1').threshold === 2);
assert('b 族门槛=2', A.getDef('tile_b1').threshold === 2);
assert('t1 成就名为"一筒"', A.getDef('tile_t1').name === '一筒');
assert('w1 成就名为"一万"', A.getDef('tile_w1').name === '一万');
assert('b1 成就名为"百搭"', A.getDef('tile_b1').name === '百搭');
// 图标 emoji 映射（逐一对应牌面，非统一 🀄）
assert('t1 图标=🀙(筒一)', A.getDef('tile_t1').icon === '🀙');
assert('h1 图标=🀦(按用户顺序)',  A.getDef('tile_h1').icon === '🀦');
assert('d1 图标=🐱(猫)',  A.getDef('tile_d1').icon === '🐱');
assert('y1 图标=🎻(琴)',  A.getDef('tile_y1').icon === '🎻');
assert('b1 图标=🀪(百搭)', A.getDef('tile_b1').icon === '🀪');

console.log('— 连击成就即时解锁 —');
assert('combo10 解锁', A.unlock('combo10') === true);
assert('combo20 解锁', A.unlock('combo20') === true);

console.log('— 累计统计 recordWin —');
A.recordWin(0, 2500);
A.recordWin(2, 3500);
assert('wins = 2', A.stats.wins === 2);
assert('levelWins[0] true', A.stats.levelWins[0] === true);
assert('levelWins[2] true', A.stats.levelWins[2] === true);
assert('totalScore = 6000', A.stats.totalScore === 6000);
assert('win_10 未达成', !A.isUnlocked('win_10'));
assert('score_total 未达成', !A.isUnlocked('score_total'));

console.log('— 进度函数 —');
const wp = A.getDef('win_10').progress(A.stats);
assert('win_10 进度 cur=2 target=10', wp.cur === 2 && wp.target === 10);
const sp = A.getDef('score_total').progress(A.stats);
assert('score_total 进度 cur=6000 target=10000', sp.cur === 6000 && sp.target === 10000);

console.log('— 主题累计 —');
assert('theme_collector 初始未解锁', !A.isUnlocked('theme_collector'));
A.markTheme('classic'); A.markTheme('animal');
assert('仅用 2 主题仍未解锁', !A.isUnlocked('theme_collector'));
A.markTheme('festival');
assert('用满 3 主题后解锁', A.isUnlocked('theme_collector') === true);

console.log('— 持久化（localStorage）—');
A.recordWin(0, 5000);
assert('score_total 达成后解锁', A.isUnlocked('score_total') === true);
const reloaded = new window.AchievementManager();
assert('重新加载后 win_10 仍锁定', reloaded.isUnlocked('win_10') === false);
assert('重新加载后 stats.wins 持久化', reloaded.stats.wins === 3);
assert('重新加载后 theme_collector 持久化', reloaded.isUnlocked('theme_collector') === true);

console.log('— b1 注入（1% 每局 / 替换 / 张数守恒）—');
const origRandom = Math.random;
Math.random = () => 0;                 // 强制触发注入
const lvIn = window.buildLevel(2);
assert('强制 1% 时含 b1', lvIn.tiles.includes('b1'));
const sumIn = lvIn.tiles.reduce((s, t, i) => s + lvIn.copyCounts[i], 0);
assert('注入后总张数守恒 = rows*cols', sumIn === lvIn.rows * lvIn.cols);

Math.random = () => 0.5;              // 不触发注入
const lvOut = window.buildLevel(2);
assert('不触发时不含 b1', !lvOut.tiles.includes('b1'));
const sumOut = lvOut.tiles.reduce((s, t, i) => s + lvOut.copyCounts[i], 0);
assert('未注入时总张数守恒', sumOut === lvOut.rows * lvOut.cols);
Math.random = origRandom;

console.log('— 连续同牌 registerConsecutiveMatch（模拟真实 序号→代号 映射）—');
const M = window.MahjongGame.prototype.registerConsecutiveMatch;
// 真实游戏中 type 是牌库序号；tileImages 把序号映射到代号，必须映射正确成就才能解锁
const tileImages = ['t1','t2','t3','s1','s2','s3','w1','w2','b1'];
const g1 = { ach: new window.AchievementManager(), tileImages, matchQueue: [] };
M.call(g1, 0); M.call(g1, 0); M.call(g1, 0);   // 序号 0 = t1 三次（门槛=4，仍未解锁）
assert('t1 三次未解锁(门槛4)', !g1.ach.isUnlocked('tile_t1'));
M.call(g1, 0);                  // 第四次，末尾连续4个 t1
assert('t1 四次解锁(门槛4)', g1.ach.isUnlocked('tile_t1') === true);
assert('队列记录为代号 t1', g1.matchQueue.join(',') === 't1,t1,t1,t1');

const g2 = { ach: new window.AchievementManager(), tileImages, matchQueue: [] };
M.call(g2, 6); M.call(g2, 6);   // 序号 6 = w1 两次（门槛2）
assert('w1 两次解锁(门槛2)', g2.ach.isUnlocked('tile_w1') === true);

const g3 = { ach: new window.AchievementManager(), tileImages, matchQueue: [] };
M.call(g3, 0);                  // t1
M.call(g3, 6);                  // w1 换类型（w 族门槛=2）
assert('换类型后队列=[t1,w1]', g3.matchQueue.join(',') === 't1,w1');
M.call(g3, 6);                  // w1 再来一次（末尾连续2个 w1）
assert('w1 两次解锁(门槛2，换类型后重新累计)', g3.ach.isUnlocked('tile_w1') === true);

// 换类型会打断连续：s 族门槛=3，前面夹了 t1 则需补满 3 个 s 才解锁
const g3b = { ach: new window.AchievementManager(), tileImages, matchQueue: [] };
M.call(g3b, 0);                 // t1
M.call(g3b, 3); M.call(g3b, 3); // s1, s1（末尾仅2个连续，未达门槛3）
assert('s 族夹了其他牌时2次不解锁(门槛3)', !g3b.ach.isUnlocked('tile_s1'));
M.call(g3b, 3);                 // s1 第三次，末尾连续3个 s1
assert('s 族补满3次解锁', g3b.ach.isUnlocked('tile_s1') === true);

const g4 = { ach: new window.AchievementManager(), tileImages, matchQueue: [] };
M.call(g4, 8); M.call(g4, 8);   // 序号 8 = b1 两次（门槛2）
assert('b1 两次解锁(门槛2, 1%局可达成)', g4.ach.isUnlocked('tile_b1') === true);

// 回归：序号未映射会拼出不存在的 ID（tile_0），必须解锁失败
const g5 = { ach: new window.AchievementManager(), tileImages: ['t1'], matchQueue: [] };
M.call(g5, 0);
M.call(g5, 0);
M.call(g5, 0);
assert('映射正确时 t1 解锁（回归旧 bug：序号当代号）', g5.ach.isUnlocked('tile_t1') === true);

console.log('— 集合成就（集齐某族/子集解锁汇总）—');
function unlockAllTiles(mgr, pool) { Object.values(pool).flat().forEach(c => mgr.unlock('tile_' + c)); }
const S = new window.AchievementManager();
window.TILE_POOL.w.forEach(c => S.unlock('tile_' + c)); S.checkSets();
assert('集齐万子解锁 萬子', S.isUnlocked('set_w') === true);
assert('仅万子未解锁 麻将', !S.isUnlocked('set_all'));
unlockAllTiles(S, window.TILE_POOL); S.checkSets();
assert('全集解锁 麻将', S.isUnlocked('set_all') === true);
assert('全集解锁 筒子', S.isUnlocked('set_t') === true);
assert('全集解锁 索子', S.isUnlocked('set_s') === true);
assert('全集解锁 番子', S.isUnlocked('set_f') === true);
assert('全集解锁 花牌', S.isUnlocked('set_h') === true);
assert('全集解锁 雅牌', S.isUnlocked('set_y') === true);
assert('全集解锁 动物牌', S.isUnlocked('set_d') === true);

const S2 = new window.AchievementManager();
window.TILE_POOL.f.slice(0,4).forEach(c => S2.unlock('tile_' + c)); S2.checkSets();
assert('集齐东南西北解锁 大四喜', S2.isUnlocked('set_big4') === true);
window.TILE_POOL.f.slice(4,7).forEach(c => S2.unlock('tile_' + c)); S2.checkSets();
assert('集齐中发白解锁 大三元', S2.isUnlocked('set_big3') === true);

const S3 = new window.AchievementManager();
window.TILE_POOL.h.slice(0,4).forEach(c => S3.unlock('tile_' + c)); S3.checkSets();
assert('集齐春夏秋冬解锁 四季', S3.isUnlocked('set_h_season') === true);
window.TILE_POOL.h.slice(4,8).forEach(c => S3.unlock('tile_' + c)); S3.checkSets();
assert('集齐梅兰菊竹解锁 四君子', S3.isUnlocked('set_h_bamboo') === true);

const S4 = new window.AchievementManager();
window.TILE_POOL.y.slice(0,4).forEach(c => S4.unlock('tile_' + c)); S4.checkSets();
assert('集齐琴棋书画解锁 四艺', S4.isUnlocked('set_y_art') === true);
window.TILE_POOL.y.slice(4,8).forEach(c => S4.unlock('tile_' + c)); S4.checkSets();
assert('集齐渔樵耕读解锁 四业', S4.isUnlocked('set_y_job') === true);

assert('集合成就数量 = 14', S.ACHIEVEMENTS.filter(a => a.isSet).length === 14);

console.log('— 成就面板渲染（85 张）—');
const grid = window.document.createElement('div'); grid.id = 'ach-grid'; window.document.body.appendChild(grid);
const cnt = window.document.createElement('div'); cnt.id = 'ach-count'; window.document.body.appendChild(cnt);
A.renderPanel();
assert('面板渲染 85 张卡片', grid.children.length === 85);
assert('面板含"一筒"文案', grid.innerHTML.includes('一筒'));
assert('面板含"百搭"文案', grid.innerHTML.includes('百搭'));
assert('计数文案含 / 85', cnt.innerText.includes('/ 85'));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
