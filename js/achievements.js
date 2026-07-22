// ================= 成就系统 =================
// 数据驱动：单局成就在游戏事件点即时解锁；累计成就通过 localStorage 长期统计。

// 每张牌的中文名（与 TILE_POOL 顺序/数量一一对应）
const TILE_NAMES = {
    t: ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
    s: ['一索', '二索', '三索', '四索', '五索', '六索', '七索', '八索', '九索'],
    w: ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'],
    f: ['东风', '南风', '西风', '北风', '红中', '发财', '白板'],
    h: ['梅', '兰', '竹', '菊', '春', '夏', '秋', '冬'],
    y: ['琴', '棋', '书', '画', '诗', '酒', '花', '茶'],
    d: ['猫', '狗', '兔', '鸟'],
    b: ['百搭']
};
// 各牌族"连续消除同一牌"的成就门槛（对）：筒/索较难(3)，其余(2)
const TILE_THRESHOLD = { t: 3, s: 3, w: 2, f: 2, h: 2, y: 2, d: 2, b: 2 };

// 为牌池里每张牌生成一个以牌命名的成就
function buildTileAchievements() {
    const list = [];
    for (const fam of Object.keys(TILE_POOL)) {
        TILE_POOL[fam].forEach((code, i) => {
            const thr = TILE_THRESHOLD[fam] || 2;
            list.push({
                id: 'tile_' + code,
                name: TILE_NAMES[fam][i],
                icon: '🀄',
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
        // 以牌命名的成就：每张牌一个，按牌族分档（t/s 需连续 3 对，其余 2 对）
        this.ACHIEVEMENTS = this.ACHIEVEMENTS.concat(buildTileAchievements());
        this.STORE_KEY = 'mjllk_achievements';
        this.STATS_KEY = 'mjllk_stats';
        this.unlocked = this.loadUnlocked();
        this.stats = this.loadStats();
        this.onUnlock = null; // 回调(def) => {}，由游戏层注入以弹出提示/音效
    }

    loadUnlocked() {
        try { return JSON.parse(localStorage.getItem(this.STORE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    saveUnlocked() { localStorage.setItem(this.STORE_KEY, JSON.stringify(this.unlocked)); }

    loadStats() {
        const def = { wins: 0, losses: 0, levelWins: {}, themesUsed: {}, totalScore: 0 };
        try {
            const s = JSON.parse(localStorage.getItem(this.STATS_KEY) || '{}');
            return Object.assign(def, s);
        } catch (e) { return def; }
    }
    saveStats() { localStorage.setItem(this.STATS_KEY, JSON.stringify(this.stats)); }

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
