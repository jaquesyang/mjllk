// ================= 麻将牌面池 =================
const TILE_POOL = {
    t: ['t1','t2','t3','t4','t5','t6','t7','t8','t9'],  // 筒子 0-8
    s: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'],  // 索子/条子 9-17
    w: ['w1','w2','w3','w4','w5','w6','w7','w8','w9'],  // 万子 18-26
    f: ['f1','f2','f3','f4','f5','f6','f7'],             // 番子 (1-4风牌, 5-7箭牌) 27-33
    h: ['h1','h2','h3','h4','h5','h6','h7','h8'],       // 花牌 34-41
    y: ['y1','y2','y3','y4','y5','y6','y7','y8'],       // 艺牌 42-49
    d: ['d1','d2','d3','d4'],                             // 动物牌 50-53
    b: ['b1']                                             // 百搭 54
};

// ================= 关卡定义 (铺满棋盘) =================
const LEVELS = [
    {
        name: '入门',
        rows: 6, cols: 8,       // 48格 = 12种×4张
        tiles: [
            ...TILE_POOL.t.slice(0,4),
            ...TILE_POOL.s.slice(0,4),
            ...TILE_POOL.w.slice(0,4)
        ]
    },
    {
        name: '简单',
        rows: 8, cols: 10,      // 80格 = 20种×4张
        tiles: [
            ...TILE_POOL.t.slice(0,7),
            ...TILE_POOL.s.slice(0,7),
            ...TILE_POOL.w.slice(0,6)
        ]
    },
    {
        name: '进阶',
        rows: 8, cols: 12,      // 96格 = 24种×4张
        tiles: [
            ...TILE_POOL.t,
            ...TILE_POOL.s,
            ...TILE_POOL.w.slice(0,6)
        ]
    },
    {
        name: '挑战',
        rows: 10, cols: 12,     // 120格 = 30种×4张
        tiles: [
            ...TILE_POOL.t,
            ...TILE_POOL.s,
            ...TILE_POOL.w,
            ...TILE_POOL.f.slice(0,3)
        ]
    },
    {
        name: '困难',
        rows: 10, cols: 14,     // 140格 = 35种×4张
        tiles: [
            ...TILE_POOL.t,
            ...TILE_POOL.s,
            ...TILE_POOL.w,
            ...TILE_POOL.f,
            ...TILE_POOL.h.slice(0,1)
        ]
    },
    {
        name: '大师',
        rows: 10, cols: 16,     // 160格 = 40种×4张
        tiles: [
            ...TILE_POOL.t,
            ...TILE_POOL.s,
            ...TILE_POOL.w,
            ...TILE_POOL.f,
            ...TILE_POOL.h.slice(0,2),
            ...TILE_POOL.y.slice(0,2),
            ...TILE_POOL.d.slice(0,1),
            ...TILE_POOL.b
        ]
    }
];

// ================= 游戏参数 =================
const CONFIG = {
    TIME_LIMIT: 300,
    HINT_LIMIT: 3,
    SHUFFLE_LIMIT: 3,
    COMBO_TIMEOUT: 3000
};

// ================= 主题配色方案 =================
const THEMES = {
    classic: { name: '经典麻将' },
    animal: { name: '可爱动物' },
    festival: { name: '节日庆典' }
};
