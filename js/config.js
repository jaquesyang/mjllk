// ================= 麻将牌面池 =================
const TILE_POOL = {
    t: ['t1','t2','t3','t4','t5','t6','t7','t8','t9'],  // 筒子
    s: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'],  // 索子/条子
    w: ['w1','w2','w3','w4','w5','w6','w7','w8','w9'],  // 万子
    f: ['f1','f2','f3','f4','f5','f6','f7'],             // 番子
    h: ['h1','h2','h3','h4','h5','h6','h7','h8'],       // 花牌
    y: ['y1','y2','y3','y4','y5','y6','y7','y8'],       // 艺牌
    d: ['d1','d2','d3','d4'],                             // 动物牌
    b: ['b1']                                             // 百搭
};

// 随机选取 n 个元素
function pickRandom(arr, n) {
    let pool = [...arr];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
}

// ================= 关卡配方 =================
// 每个配方: rows, cols, [ { pool, fixed?, count } ]
const LEVEL_RECIPES = [
    {
        name: '入门',
        rows: 6, cols: 8,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 't', fixed: false, count: 3 }
        ]
    },
    {
        name: '简单',
        rows: 8, cols: 10,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 't', fixed: false, count: 1 },
            { key: 's', fixed: true, count: 9 },
            { key: 's', fixed: false, count: 1 }
        ]
    },
    {
        name: '进阶',
        rows: 8, cols: 12,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 's', fixed: true, count: 9 },
            { key: 'w', fixed: false, count: 6 }
        ]
    },
    {
        name: '挑战',
        rows: 10, cols: 12,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 's', fixed: true, count: 9 },
            { key: 'w', fixed: true, count: 9 },
            { key: 'f', fixed: false, count: 3 }
        ]
    },
    {
        name: '困难',
        rows: 10, cols: 14,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 's', fixed: true, count: 9 },
            { key: 'w', fixed: true, count: 9 },
            { key: 'f', fixed: true, count: 7 },
            { key: 'h', fixed: false, count: 1 }
        ]
    },
    {
        name: '大师',
        rows: 10, cols: 16,
        recipe: [
            { key: 't', fixed: true, count: 9 },
            { key: 's', fixed: true, count: 9 },
            { key: 'w', fixed: true, count: 9 },
            { key: 'f', fixed: true, count: 7 },
            { key: 'h', fixed: false, count: 2 },
            { key: 'y', fixed: false, count: 2 },
            { key: 'd', fixed: false, count: 2 }
        ]
    }
];

// 根据配方构建牌面列表 (去重，计算每种牌的副本数)
function buildTiles(recipe) {
    let copies = {}; // filename -> copy count
    for (let step of recipe) {
        let pool = TILE_POOL[step.key];
        if (step.fixed) {
            let picks = pool.slice(0, step.count);
            picks.forEach(t => { copies[t] = (copies[t] || 0) + 4; });
        } else {
            let available = pool.filter(t => !(t in copies));
            if (available.length < step.count) {
                available = [...pool];
            }
            let picks = pickRandom(available, step.count);
            picks.forEach(t => { copies[t] = (copies[t] || 0) + 4; });
        }
    }
    let tiles = Object.keys(copies);
    let copyCounts = tiles.map(t => copies[t]);
    return { tiles, copyCounts };
}

function buildLevel(levelIdx) {
    const recipe = LEVEL_RECIPES[levelIdx];
    const { tiles, copyCounts } = buildTiles(recipe.recipe);
    return {
        name: recipe.name,
        rows: recipe.rows,
        cols: recipe.cols,
        tiles,
        copyCounts
    };
}

// ================= 游戏参数 =================
const CONFIG = {
    TIME_BASE: 120,           // 最低难度时间 (秒)
    TIME_PER_LEVEL: 60,       // 每级增加时间 (秒)
    HINT_BASE: 2,             // 最低难度提示次数
    HINT_PER_LEVEL: 1,        // 每级增加提示次数
    SHUFFLE_BASE: 2,          // 最低难度洗牌次数
    SHUFFLE_PER_LEVEL: 1,     // 每级增加洗牌次数
    COMBO_TIMEOUT: 3000,
    TIMER_MODE: 'countdown'   // 'countdown' | 'countup'
};

// ================= 主题配色方案 =================
const THEMES = {
    classic: { name: '经典麻将' },
    animal: { name: '可爱动物' },
    festival: { name: '节日庆典' }
};
