// ================= 成就系统 =================
// 数据驱动：单局成就在游戏事件点即时解锁；累计成就通过 localStorage 长期统计。

// 每张牌的中文名（与 TILE_POOL 顺序/数量一一对应）
const TILE_NAMES = {
    t: ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
    s: ['一索', '二索', '三索', '四索', '五索', '六索', '七索', '八索', '九索'],
    w: ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'],
    f: ['东风', '南风', '西风', '北风', '红中', '发财', '白板'],
    h: ['春', '夏', '秋', '冬', '梅', '兰', '菊', '竹'],
    y: ['琴', '棋', '书', '画', '渔', '樵', '耕', '读'],
    d: ['猫', '鼠', '鸡', '虫'],
    b: ['百搭']
};

// 每张牌的图标 emoji（按牌族/代号顺序，对应 TILE_POOL）。
// h 的 emoji 严格按用户指定顺序 h1~h8（🀦🀧🀨🀩🀢🀣🀥🀤，即 梅兰菊竹春夏秋冬）。
// 注：本项目名字顺序已改为 春、夏、秋、冬、梅、兰、菊、竹，故本族图标与名字按位置对应，不做语义重排。
// y(艺牌)/d(动物牌) 非标准麻将牌，下方 emoji 为占位，可按需调整。
const TILE_ICONS = {
    t: ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'], // 筒子 1-9
    s: ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'], // 索子 1-9
    w: ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'], // 万子 1-9
    f: ['🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆'],           // 风/箭: 东南西北中发白
    h: ['🀦', '🀧', '🀨', '🀩', '🀢', '🀣', '🀥', '🀤'],     // 按用户指定顺序 h1~h8
    y: ['🎻', '♟️', '📖', '🖌️', '🎣', '🪓', '🌾', '📜'],   // 琴棋书画渔樵耕读 (占位)
    d: ['🐱', '🐭', '🐔', '🐛'],                            // 猫鼠鸡虫 (占位)
    b: ['🀪']                                                 // 百搭
};
// 各牌族"连续消除同一牌"的成就门槛（对）：筒子最难(4)、索子次之(3)、其余(2)
// 注意：牌库每次 +4 张(2对)，故单牌只有 2对 或 4对。
//   - t=4 表示"把一张翻倍的筒子全清掉"（仅 入门/简单 模式有 4对筒子）
//   - s=3 对 4对索子 而言=连消到第3对即解锁（第4对冗余），比 t 略松
//   - 其他=2 任何牌在任何模式都至少有一张 2对，故全部可解锁
const TILE_THRESHOLD = { t: 4, s: 3, w: 2, f: 2, h: 2, y: 2, d: 2, b: 2 };

// 为牌池里每张牌生成一个以牌命名的成就
function buildTileAchievements() {
    const list = [];
    for (const fam of Object.keys(TILE_POOL)) {
        TILE_POOL[fam].forEach((code, i) => {
            const thr = TILE_THRESHOLD[fam] || 2;
            list.push({
                id: 'tile_' + code,
                name: TILE_NAMES[fam][i],
                icon: (TILE_ICONS[fam] && TILE_ICONS[fam][i]) || '🀄',
                tier: (fam === 't' || fam === 's') ? 'silver' : 'bronze',
                desc: `连续消除 ${thr} 对${TILE_NAMES[fam][i]}`,
                tile: code,
                threshold: thr,
                isTile: true
            });
        });
    }
    return list;
}

// 集合类成就：集齐某族/某子集的全部"以牌命名成就"后解锁对应的汇总成就。
// requires 列出所依赖的 tile 成就 id；checkSets() 在依赖全部解锁时自动解锁本成就。
function buildSetAchievements() {
    const list = [];
    const add = (id, name, icon, tier, desc, codes) => {
        list.push({
            id, name, icon, tier, desc,
            requires: codes.map(c => 'tile_' + c),
            isSet: true
        });
    };
    const allTiles = Object.keys(TILE_POOL).reduce((acc, f) => acc.concat(TILE_POOL[f]), []);
    add('set_w',        '萬子',   '🀇', 'gold', '集齐全部万子（一万~九万）成就', TILE_POOL.w);
    add('set_t',        '筒子',   '🀙', 'gold', '集齐全部筒子（一筒~九筒）成就', TILE_POOL.t);
    add('set_s',        '索子',   '🀐', 'gold', '集齐全部索子（一索~九索）成就', TILE_POOL.s);
    add('set_f',        '番子',   '🀄', 'gold', '集齐全部番子（东南西北中发白）成就', TILE_POOL.f);
    add('set_big4',     '大四喜', '🀀', 'gold', '集齐 东风·南风·西风·北风 成就', TILE_POOL.f.slice(0, 4));
    add('set_big3',     '大三元', '🀅', 'gold', '集齐 红中·发财·白板 成就', TILE_POOL.f.slice(4, 7));
    add('set_h_season', '四季',   '🀢', 'gold', '集齐 春·夏·秋·冬 成就', TILE_POOL.h.slice(0, 4));
    add('set_h_bamboo', '四君子', '🀦', 'gold', '集齐 梅·兰·菊·竹 成就', TILE_POOL.h.slice(4, 8));
    add('set_h',        '花牌',   '🀦', 'gold', '集齐全部花牌（四季+四君子）成就', TILE_POOL.h);
    add('set_y_art',    '四艺',   '🎻', 'gold', '集齐 琴·棋·书·画 成就', TILE_POOL.y.slice(0, 4));
    add('set_y_job',    '四业',   '🪓', 'gold', '集齐 渔·樵·耕·读 成就', TILE_POOL.y.slice(4, 8));
    add('set_y',        '雅牌',   '🎴', 'gold', '集齐全部艺牌（四艺+四业）成就', TILE_POOL.y);
    add('set_d',        '动物牌', '🐱', 'gold', '集齐全部动物牌（猫·鼠·鸡·虫）成就', TILE_POOL.d);
    add('set_all',      '麻将',   '🀫', 'gold', '集齐全部 55 张麻将牌成就', allTiles);
    return list;
}

class AchievementManager {
    constructor() {
        // 成就定义。progress(stats) 返回 {cur,target} 时显示进度条（累计型）。
        this.ACHIEVEMENTS = [
            { id: 'first_win',       name: '初出茅庐', icon: '🎉', tier: 'bronze', desc: '完成你的第一局通关' },
            { id: 'win_10',          name: '十战十胜', icon: '🔟', tier: 'silver', desc: '累计通关 10 局', check: s => s.wins >= 10, progress: s => ({ cur: s.wins, target: 10 }) },
            { id: 'win_50',          name: '百战百胜', icon: '💯', tier: 'gold',   desc: '累计通关 50 局', check: s => s.wins >= 50, progress: s => ({ cur: s.wins, target: 50 }) },
            { id: 'combo10',         name: '连击大师', icon: '🔥', tier: 'silver', desc: '单局达成 10 连击' },
            { id: 'combo20',         name: '连击宗师', icon: '⚡', tier: 'gold',   desc: '单局达成 20 连击' },
            { id: 'no_hint',         name: '明察秋毫', icon: '💡', tier: 'silver', desc: '不使用提示通关一局' },
            { id: 'no_shuffle',      name: '稳如泰山', icon: '🔄', tier: 'bronze', desc: '不使用洗牌通关一局' },
            { id: 'no_undo',         name: '一击不悔', icon: '↩️', tier: 'bronze', desc: '不使用悔棋通关一局' },
            { id: 'flawless',        name: '完美通关', icon: '🌟', tier: 'gold',   desc: '不提示 / 不洗牌 / 不悔棋通关一局' },
            { id: 'speed_clear',     name: '神速通关', icon: '💨', tier: 'silver', desc: '倒计时模式剩余时间过半即通关' },
            { id: 'fast',            name: '闪电手',   icon: '🏃', tier: 'silver', desc: '单局 60 秒内通关' },
            { id: 'high_score',      name: '高分玩家', icon: '🏆', tier: 'gold',   desc: '单局得分达到 3000' },
            { id: 'all_levels',      name: '全能高手', icon: '🗺️', tier: 'gold',   desc: '通关全部 6 个关卡', check: s => Object.values(s.levelWins).filter(Boolean).length >= 6, progress: s => ({ cur: Object.values(s.levelWins).filter(Boolean).length, target: 6 }) },
            { id: 'theme_collector', name: '主题收藏家', icon: '🎨', tier: 'bronze', desc: '体验过全部 3 个主题', check: s => Object.keys(s.themesUsed).length >= 3, progress: s => ({ cur: Object.keys(s.themesUsed).length, target: 3 }) },
            { id: 'score_total',     name: '财富积累', icon: '💰', tier: 'gold',   desc: '累计得分达到 10000', check: s => s.totalScore >= 10000, progress: s => ({ cur: s.totalScore, target: 10000 }) },
            { id: 'night_owl',       name: '夜猫子',   icon: '🦉', tier: 'silver', desc: '在凌晨 0:00–5:00 期间通关' }
        ];
        // 以牌命名的成就：每张牌一个，按牌族分档；集合成就：集齐某族/子集解锁
        this.ACHIEVEMENTS = this.ACHIEVEMENTS
            .concat(buildTileAchievements())
            .concat(buildSetAchievements());
        this.STORE_KEY = 'mjllk_achievements';
        this.STATS_KEY = 'mjllk_stats';
        this.unlocked = this.loadUnlocked();
        this.stats = this.loadStats();
        this.onUnlock = null; // 回调(def) => {}，由游戏层注入以弹出提示/音效
        this.checkSets();     // 补发重进游戏前已满足的集合成就
    }

    loadUnlocked() {
        try { return JSON.parse(localStorage.getItem(this.STORE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    saveUnlocked() { try { localStorage.setItem(this.STORE_KEY, JSON.stringify(this.unlocked)); } catch (e) {} }

    loadStats() {
        const def = { wins: 0, losses: 0, levelWins: {}, themesUsed: {}, totalScore: 0 };
        try {
            const s = JSON.parse(localStorage.getItem(this.STATS_KEY) || '{}');
            return Object.assign(def, s);
        } catch (e) { return def; }
    }
    saveStats() { try { localStorage.setItem(this.STATS_KEY, JSON.stringify(this.stats)); } catch (e) {} }

    isUnlocked(id) { return !!this.unlocked[id]; }
    unlockedCount() { return Object.keys(this.unlocked).length; }
    totalCount() { return this.ACHIEVEMENTS.length; }
    getDef(id) { return this.ACHIEVEMENTS.find(a => a.id === id); }

    // 尝试解锁，返回是否为"新解锁"（已解锁则返回 false）
    unlock(id) {
        if (this.unlocked[id]) return false;
        const def = this.getDef(id);
        if (!def) return false;
        this.unlocked[id] = Date.now();
        this.saveUnlocked();
        if (this.onUnlock) this.onUnlock(def);
        return true;
    }

    // 根据累计统计，解锁所有 check(stats) 成立的累计型成就
    evaluateCumulative() {
        for (const a of this.ACHIEVEMENTS) {
            if (a.check && a.check(this.stats)) this.unlock(a.id);
        }
    }

    // 集合成就：当 requires 中全部"以牌命名成就"均已解锁时，解锁该集合成就。
    // 用 while 循环支持连锁解锁（集齐全部牌 → 同时解锁各族/子集/总集）。
    checkSets() {
        let changed = true;
        while (changed) {
            changed = false;
            for (const a of this.ACHIEVEMENTS) {
                if (!a.requires || this.isUnlocked(a.id)) continue;
                if (a.requires.every(id => this.isUnlocked(id))) {
                    this.unlock(a.id);
                    changed = true;
                }
            }
        }
    }

    // 通关时记录累计统计并自动检查累计型成就
    recordWin(level, score) {
        this.stats.wins++;
        this.stats.levelWins[level] = true;
        this.stats.totalScore += score;
        this.saveStats();
        this.evaluateCumulative();
    }

    // 切换主题时记录
    markTheme(key) {
        this.stats.themesUsed[key] = true;
        this.saveStats();
        this.evaluateCumulative();
    }

    // 渲染成就面板（在成就弹窗打开时调用）
    renderPanel() {
        const grid = document.getElementById('ach-grid');
        if (!grid) return;
        grid.innerHTML = this.ACHIEVEMENTS.map(a => {
            const got = this.isUnlocked(a.id);
            let progHtml = '';
            if (a.progress && !got) {
                const p = a.progress(this.stats);
                if (p) {
                    const pct = Math.min(100, Math.round(p.cur / p.target * 100));
                    progHtml = `<div class="ach-prog"><div class="ach-prog-fill" style="width:${pct}%"></div></div>` +
                        `<div class="ach-prog-text">${p.cur} / ${p.target}</div>`;
                }
            }
            return `<div class="ach-card ${got ? 'unlocked' : 'locked'} tier-${a.tier}">
                <div class="ach-icon">${got ? a.icon : '🔒'}</div>
                <div class="ach-body">
                    <div class="ach-name">${a.name}</div>
                    <div class="ach-desc">${a.desc}</div>
                    ${progHtml}
                </div>
                ${got ? '<div class="ach-check">✓</div>' : ''}
            </div>`;
        }).join('');
        const cnt = document.getElementById('ach-count');
        if (cnt) cnt.innerText = `已解锁 ${this.unlockedCount()} / ${this.totalCount()}`;
    }
}
