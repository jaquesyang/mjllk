// ================= 游戏核心引擎 =================
class MahjongGame {
    constructor() {
        this.boardEl = document.getElementById('game-board');
        this.containerEl = document.getElementById('board-container');
        this.canvasEl = document.getElementById('connection-line');
        this.ctxCanvas = this.canvasEl.getContext('2d');
        this.sound = new SoundEngine();
        this.currentThemeKey = 'classic';
        this.currentLevel = 0;

        // 游戏状态
        this.allTiles = [];      // 所有牌实体数据
        this.grid = [];          // 统一的2D投影网格(用于连线判定)
        this.selectedTile = null;
        this.score = 0;
        this.combo = 0;
        this.lastMatchTime = 0;
        this.tilesLeft = 0;
        this.timer = CONFIG.TIME_LIMIT;
        this.hintCount = CONFIG.HINT_LIMIT;
        this.shuffleCount = CONFIG.SHUFFLE_LIMIT;
        this.isAnimating = false;
        this.isGameOver = false;
        this.timerInterval = null;

        this.tileW = 56;
        this.tileH = 74;
        this.layerOffsetX = 8;
        this.layerOffsetY = 8;
        this.bindEvents();
        window.addEventListener('resize', () => { this.canvasEl.width = window.innerWidth; this.canvasEl.height = window.innerHeight; this.canvasEl.style.width = window.innerWidth + 'px'; this.canvasEl.style.height = window.innerHeight + 'px'; this.autoScale(); });
        this.init();
    }

    init() {
        const lv = buildLevel(this.currentLevel);
        this.tileImages = lv.tiles;
        this.copyCounts = lv.copyCounts;
        this.levelRows = lv.rows;
        this.levelCols = lv.cols;
        this.levelTypes = lv.tiles.length;
        document.getElementById('level-name').innerText = lv.name;
        document.querySelectorAll('.level-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === this.currentLevel);
        });
        this.updateThemeUI();
        this.calculateBoardSize();
        this.autoScale();
        this.generateSolvableBoard();
        this.renderBoard();
        this.startTimer();
        this.updateHUD();
    }

    calculateBoardSize() {
        this.padX = 20;
        this.padY = 20;

        const gridW = this.levelCols * this.tileW;
        const gridH = this.levelRows * this.tileH;
        const borderW = 4;

        // 内容区 = 牌面网格 + 四边等距 padding
        const contentW = gridW + this.padX * 2;
        const contentH = gridH + this.padY * 2;
        // border-box: width 含 border，所以要加回去
        this.boardEl.style.width = (contentW + borderW * 2) + 'px';
        this.boardEl.style.height = (contentH + borderW * 2) + 'px';
        this.boardEl.style.setProperty('--tile-w', this.tileW + 'px');
        this.boardEl.style.setProperty('--tile-h', this.tileH + 'px');

        // canvas 铺满整个窗口
        this.canvasEl.width = window.innerWidth;
        this.canvasEl.height = window.innerHeight;
        this.canvasEl.style.width = window.innerWidth + 'px';
        this.canvasEl.style.height = window.innerHeight + 'px';
        this.canvasEl.style.left = '0px';
        this.canvasEl.style.top = '0px';
    }

    autoScale() {
        const margin = 40;
        const boardW = this.boardEl.offsetWidth;
        const boardH = this.boardEl.offsetHeight;
        const availW = window.innerWidth - margin;
        const hudH = document.getElementById('hud').offsetHeight;
        const btnsEl = document.getElementById('btn-restart').closest('div');
        const btnsH = btnsEl ? btnsEl.offsetHeight : 50;
        const availH = window.innerHeight - hudH - btnsH - margin - 20;

        const scale = Math.min(1, availW / boardW, availH / boardH);
        this.currentScale = scale;
        this.containerEl.style.transform = `scale(${scale})`;
        this.containerEl.style.marginBottom = (-boardH * (1 - scale)) + 'px';
    }

    // ================= 终极稳定版：分层独立生成 =================
    generateSolvableBoard() {
        this.allTiles = [];
        // 1. 准备牌池并打乱 (每种牌按副本数生成)
        let pool = [];
        for (let i = 0; i < this.levelTypes; i++) {
            for (let c = 0; c < this.copyCounts[i]; c++) pool.push(i);
        }
        let totalCards = pool.length;
        this.shuffleArray(pool);

        // 2. 分层分配牌数
        let layerAlloc = [];
        let remaining = totalCards;
        for (let l = 0; l < 1; l++) {
            let rows = this.levelRows - l * 2;
            let cols = this.levelCols - l * 2;
            let capacity = rows * cols;
            let count;
            if (l === 0) {
                count = capacity;
            } else {
                count = remaining;
            }
            count = Math.min(count, remaining);
            if (count % 2 !== 0) count--;
            remaining -= count;
            layerAlloc.push({ layer: l, rows, cols, count, startRow: l, startCol: l });
        }
        // 修正底层牌数以耗尽池子
        layerAlloc[0].count = totalCards - layerAlloc.slice(1).reduce((s, a) => s + a.count, 0);
        if (layerAlloc[0].count % 2 !== 0) layerAlloc[0].count--;
        remaining = totalCards - layerAlloc.reduce((s, a) => s + a.count, 0);
        layerAlloc[0].count += remaining;

        // 3. 逐层生成
        this.grid = Array(this.levelRows).fill().map(() => Array(this.levelCols).fill(null));
        this.pathFinder = new PathFinder(
            this.grid.map(r => r.map(c => c ? 1 : 0)),
            this.levelRows,
            this.levelCols
        );

        for (let alloc of layerAlloc) {
            let { layer, rows, cols, count, startRow, startCol } = alloc;
            if (count === 0) continue;
            let layerPool = pool.splice(0, count);

            if (layer === 0) {
                this.fillBaseLayer(layerPool, rows, cols, startRow, startCol);
            } else {
                this.generateHigherLayer(layerPool, rows, cols, startRow, startCol, layer);
            }
        }
        this.tilesLeft = this.allTiles.length;
        this.totalTiles = this.tilesLeft;
    }

    fillBaseLayer(pool, rows, cols, startRow, startCol) {
        let positions = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push({ r: r + startRow, c: c + startCol });
            }
        }
        this.shuffleArray(positions);

        for (let i = 0; i < pool.length; i++) {
            let pos = positions[i];
            let type = pool[i];
            let tile = {
                id: this.allTiles.length,
                type,
                layer: 0,
                row: pos.r,
                col: pos.c,
                isRemoved: false
            };
            this.allTiles.push(tile);
            this.grid[pos.r][pos.c] = tile;
            this.pathFinder.updatePoint(pos.r, pos.c, false);
        }
    }

    generateHigherLayer(pool, rows, cols, startRow, startCol, layer) {
        let localGrid = Array(rows).fill().map(() => Array(cols).fill(0));
        let localPF = new PathFinder(localGrid, rows, cols);
        let positions = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push({ r, c });
            }
        }
        this.shuffleArray(positions);

        let placedTiles = [];
        let pairs = pool.slice();
        let maxRetries = 50;
        let retryCount = 0;

        while (pairs.length > 0 && positions.length >= 2 && retryCount < maxRetries) {
            let type = pairs[0];
            let pos1 = null, pos2 = null;

            // 随机快速尝试
            for (let att = 0; att < 200; att++) {
                let idx1 = Math.floor(Math.random() * positions.length);
                let idx2 = Math.floor(Math.random() * positions.length);
                if (idx1 === idx2) continue;
                let p1 = positions[idx1], p2 = positions[idx2];
                if (localPF.checkConnect(p1.r, p1.c, p2.r, p2.c)) {
                    pos1 = { ...p1, idx: idx1 };
                    pos2 = { ...p2, idx: idx2 };
                    break;
                }
            }
            // 全面扫描兜底
            if (!pos1) {
                for (let i = 0; i < positions.length; i++) {
                    for (let j = i + 1; j < positions.length; j++) {
                        if (localPF.checkConnect(positions[i].r, positions[i].c, positions[j].r, positions[j].c)) {
                            pos1 = { ...positions[i], idx: i };
                            pos2 = { ...positions[j], idx: j };
                            break;
                        }
                    }
                    if (pos1) break;
                }
            }

            if (!pos1) {
                if (placedTiles.length > 0) {
                    let t1 = placedTiles.pop(), t2 = placedTiles.pop();
                    localGrid[t1.r][t1.c] = 0;
                    localGrid[t2.r][t2.c] = 0;
                    localPF.updatePoint(t1.r, t1.c, true);
                    localPF.updatePoint(t2.r, t2.c, true);
                    positions.push({ r: t1.r, c: t1.c }, { r: t2.r, c: t2.c });
                    pairs.push(t1.type, t2.type);
                    this.shuffleArray(positions);
                } else {
                    this.shuffleArray(pairs);
                    retryCount++;
                }
                continue;
            }

            // 放置成功
            localGrid[pos1.r][pos1.c] = 1;
            localGrid[pos2.r][pos2.c] = 1;
            localPF.updatePoint(pos1.r, pos1.c, false);
            localPF.updatePoint(pos2.r, pos2.c, false);
            placedTiles.push({ r: pos1.r, c: pos1.c, type }, { r: pos2.r, c: pos2.c, type });

            let removeIdx = [pos1.idx, pos2.idx].sort((a, b) => b - a);
            positions.splice(removeIdx[0], 1);
            positions.splice(removeIdx[1], 1);
            pairs.splice(0, 2);
        }

        // 将高层牌映射到全局2D投影网格和物理坐标
        for (let pt of placedTiles) {
            let physRow = pt.r + startRow;
            let physCol = pt.c + startCol;
            let tile = {
                id: this.allTiles.length,
                type: pt.type,
                layer,
                row: physRow,
                col: physCol,
                isRemoved: false
            };
            this.allTiles.push(tile);
            this.grid[physRow][physCol] = tile;
            this.pathFinder.updatePoint(physRow, physCol, false);
        }
    }

    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // ================= 运行时阻塞判定 =================
    isTileBlocked(tile) {
        if (tile.layer > 0) return false;
        let higherTiles = this.allTiles.filter(t => !t.isRemoved && t.layer > tile.layer);
        for (let ht of higherTiles) {
            if (
                tile.row >= ht.row - 1 && tile.row <= ht.row &&
                tile.col >= ht.col - 1 && tile.col <= ht.col
            ) {
                return true;
            }
        }
        return false;
    }

    // ================= 渲染与交互 =================
    renderBoard() {
        this.boardEl.innerHTML = '';
        let emptyGrid = this.grid.map(r => r.map(c => c && !c.isRemoved ? 1 : 0));
        this.pathFinder = new PathFinder(emptyGrid, this.levelRows, this.levelCols);

        for (let t of this.allTiles) {
            if (t.isRemoved) continue;
            const el = document.createElement('div');
            el.className = 'tile';
            el.id = `tile-${t.id}`;

            const img = document.createElement('img');
            img.src = `assets/images/${this.tileImages[t.type]}.png`;
            img.draggable = false;
            el.appendChild(img);

            let offsetX = t.layer * this.layerOffsetX;
            let offsetY = -t.layer * this.layerOffsetY;
            el.style.left = (this.padX + t.col * this.tileW + offsetX) + 'px';
            el.style.top = (this.padY + t.row * this.tileH + offsetY) + 'px';
            el.style.zIndex = 10 + t.row * this.levelCols + t.col;

            if (this.isTileBlocked(t)) el.classList.add('blocked');
            this.boardEl.appendChild(el);
        }
    }

    bindEvents() {
        this.boardEl.addEventListener('click', e => {
            if (this.isAnimating || this.isGameOver) return;
            let tileEl = e.target.closest('.tile');
            if (!tileEl || tileEl.classList.contains('blocked')) return;
            let tileId = parseInt(tileEl.id.replace('tile-', ''));
            this.handleTileClick(this.allTiles[tileId], tileEl);
        });
        document.getElementById('btn-hint').addEventListener('click', () => this.showHint());
        document.getElementById('btn-shuffle').addEventListener('click', () => this.shuffleRemaining());
        document.getElementById('btn-theme').addEventListener('click', () => this.switchTheme());
        document.getElementById('btn-restart').addEventListener('click', () => this.confirmRestart());
        document.getElementById('btn-modal-restart').addEventListener('click', () => this.restart());
        document.getElementById('btn-confirm-yes').addEventListener('click', () => {
            if (this.pendingLevel != null) {
                this.setLevel(this.pendingLevel, true);
                this.pendingLevel = null;
            } else {
                this.restart();
            }
        });
        document.getElementById('btn-confirm-no').addEventListener('click', () => {
            document.getElementById('modal-overlay').style.display = 'none';
            this.pendingLevel = null;
        });
        document.querySelectorAll('.level-btn').forEach((btn, i) => {
            btn.addEventListener('click', () => this.setLevel(i));
        });
    }

    handleTileClick(tile, el) {
        this.sound.play('click');
        if (this.selectedTile && this.selectedTile.id === tile.id) {
            el.classList.remove('selected');
            this.selectedTile = null;
            return;
        }
        if (!this.selectedTile) {
            el.classList.add('selected');
            this.selectedTile = tile;
            this.selectedEl = el;
            return;
        }

        let prevTile = this.selectedTile, prevEl = this.selectedEl;
        if (prevTile.type === tile.type) {
            let path = this.pathFinder.checkConnect(prevTile.row, prevTile.col, tile.row, tile.col);
            if (path) {
                this.matchSuccess(prevTile, prevEl, tile, el, path);
            } else {
                this.matchFail(prevEl, el);
            }
        } else {
            this.matchFail(prevEl, el);
        }
    }

    matchSuccess(t1, el1, t2, el2, path) {
        this.sound.play('match');
        let now = Date.now();
        this.combo = (now - this.lastMatchTime < CONFIG.COMBO_TIMEOUT) ? this.combo + 1 : 1;
        this.lastMatchTime = now;
        this.score += 100 + (this.combo - 1) * 50;

        el1.classList.remove('selected');
        this.selectedTile = null;
        this.selectedEl = null;
        this.isAnimating = true;
        this.drawConnectionLine(path, this.combo);
        if (this.combo >= 2) this.sound.play('combo', this.combo);
        if (this.combo >= 3) this.showComboEffect();
        el1.classList.add('removing');
        el2.classList.add('removing');
        this.spawnParticles(el1);
        this.spawnParticles(el2);

        setTimeout(() => {
            t1.isRemoved = true;
            t2.isRemoved = true;
            this.tilesLeft -= 2;
            this.pathFinder.updatePoint(t1.row, t1.col, true);
            this.pathFinder.updatePoint(t2.row, t2.col, true);
            this.renderBoard();
            this.updateHUD();
            this.isAnimating = false;

            if (this.tilesLeft === 0) {
                this.gameWin();
            } else if (!this.hasAnyMatch()) {
                if (this.shuffleCount <= 0) {
                    this.gameLose("无可用消除路径且洗牌次数耗尽！");
                } else {
                    this.shuffleRemaining();
                }
            }
        }, 400);
    }

    matchFail(el1, el2) {
        this.sound.play('wrong');
        this.combo = 0;
        el1.classList.remove('selected');
        el1.classList.add('wrong');
        el2.classList.add('wrong');
        this.selectedTile = null;
        this.selectedEl = null;
        setTimeout(() => {
            el1.classList.remove('wrong');
            el2.classList.remove('wrong');
        }, 500);
    }

    drawConnectionLine(pathData, combo) {
        const ctx = this.ctxCanvas;
        const cw = this.canvasEl.width;
        const ch = this.canvasEl.height;
        ctx.clearRect(0, 0, cw, ch);

        const br = this.boardEl.getBoundingClientRect();
        const s = this.currentScale || 1;
        const clamp = (v, max) => Math.max(0, Math.min(max, v));
        let points = pathData.path.map(p => ({
            x: clamp(br.left + (this.padX + (p.c - 2) * this.tileW + this.tileW / 2) * s, cw),
            y: clamp(br.top + (this.padY + (p.r - 2) * this.tileH + this.tileH / 2) * s, ch)
        }));

        // 连击闪电效果：宽度和颜色随 combo 变化
        const baseW = combo >= 3 ? 3 + combo * 2.5 : 3;
        const colors = ['#fbbf24', '#f59e0b', '#f97316', '#ef4444', '#e040fb', '#ff00ff'];
        const color = colors[Math.min(combo - 1, colors.length - 1)];

        // 外发光
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = baseW + 6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14 + combo * 3;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        this.drawLightningPath(ctx, points);
        ctx.stroke();
        ctx.restore();

        // 主线 - 闪电锯齿
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = baseW;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + combo * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        this.drawLightningPath(ctx, points);
        ctx.stroke();
        ctx.restore();

        // 白色核心
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, baseW * 0.4);
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        this.drawLightningPath(ctx, points);
        ctx.stroke();
        ctx.restore();

        setTimeout(() => ctx.clearRect(0, 0, cw, ch), 350);
    }

    drawLightningPath(ctx, points) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            let p1 = points[i - 1];
            let p2 = points[i];
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 8) {
                ctx.lineTo(p2.x, p2.y);
                continue;
            }
            // 闪电锯齿：在直线上加随机偏移
            let segs = Math.max(1, Math.floor(dist / 15));
            for (let s = 1; s <= segs; s++) {
                let t = s / segs;
                let x = p1.x + dx * t;
                let y = p1.y + dy * t;
                let jitter = (s < segs) ? (Math.random() - 0.5) * dist * 0.12 : 0;
                if (Math.abs(dx) > Math.abs(dy)) {
                    y += jitter;
                } else {
                    x += jitter;
                }
                ctx.lineTo(x, y);
            }
        }
    }

    showComboEffect() {
        const br = this.boardEl.getBoundingClientRect();
        const s = this.currentScale || 1;
        const el = document.createElement('div');
        el.className = 'combo-popup';
        el.style.left = (br.left + br.width / 2) + 'px';
        el.style.top = (br.top + 20 * s) + 'px';
        el.innerHTML = `${this.combo}<span>x</span> COMBO!`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }

    spawnParticles(el) {
        const rect = el.getBoundingClientRect();
        const boardRect = this.boardEl.getBoundingClientRect();
        const cx = rect.left - boardRect.left + rect.width / 2;
        const cy = rect.top - boardRect.top + rect.height / 2;
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('span');
            p.className = 'particle';
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 40 + 20;
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
            this.boardEl.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    }

    hasAnyMatch() {
        let activeTiles = this.allTiles.filter(t => !t.isRemoved && !this.isTileBlocked(t));
        for (let i = 0; i < activeTiles.length; i++) {
            for (let j = i + 1; j < activeTiles.length; j++) {
                if (activeTiles[i].type === activeTiles[j].type) {
                    if (this.pathFinder.checkConnect(
                        activeTiles[i].row, activeTiles[i].col,
                        activeTiles[j].row, activeTiles[j].col
                    )) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    showHint() {
        if (this.hintCount <= 0 || this.isAnimating) return;
        this.hintCount--;
        this.updateHUD();
        this.sound.play('click');
        let activeTiles = this.allTiles.filter(t => !t.isRemoved && !this.isTileBlocked(t));
        for (let i = 0; i < activeTiles.length; i++) {
            for (let j = i + 1; j < activeTiles.length; j++) {
                if (activeTiles[i].type === activeTiles[j].type &&
                    this.pathFinder.checkConnect(activeTiles[i].row, activeTiles[i].col, activeTiles[j].row, activeTiles[j].col)) {
                    let el1 = document.getElementById(`tile-${activeTiles[i].id}`);
                    let el2 = document.getElementById(`tile-${activeTiles[j].id}`);
                    if (el1 && el2) {
                        el1.classList.add('hint');
                        el2.classList.add('hint');
                        setTimeout(() => {
                            el1.classList.remove('hint');
                            el2.classList.remove('hint');
                        }, 2000);
                    }
                    return;
                }
            }
        }
    }

    shuffleRemaining() {
        if (this.shuffleCount <= 0 || this.isAnimating) return;
        this.shuffleCount--;
        this.sound.play('click');
        this.updateHUD();
        let remainingTiles = this.allTiles.filter(t => !t.isRemoved);
        let types = remainingTiles.map(t => t.type);
        this.shuffleArray(types);
        remainingTiles.forEach((t, idx) => { t.type = types[idx]; });
        this.renderBoard();

        if (!this.hasAnyMatch()) {
            this.ensureHasMatch();
            this.renderBoard();
        }

        if (!this.hasAnyMatch()) {
            if (this.shuffleCount > 0) {
                this.shuffleRemaining();
            } else {
                this.gameLose("洗牌后仍无解，游戏结束！");
            }
        }
    }

    // 保证洗牌后至少有一对可消除
    ensureHasMatch() {
        let free = this.allTiles.filter(t => !t.isRemoved && !this.isTileBlocked(t));
        // 找一对可连线的空闲牌
        for (let i = 0; i < free.length; i++) {
            for (let j = i + 1; j < free.length; j++) {
                if (this.pathFinder.checkConnect(free[i].row, free[i].col, free[j].row, free[j].col)) {
                    if (free[i].type === free[j].type) return; // 已有匹配
                    // 找另一张与 free[i] 同类型的牌，交换使其配对
                    let sameType = this.allTiles.find(t =>
                        t !== free[i] && t !== free[j] && !t.isRemoved && t.type === free[i].type
                    );
                    if (sameType) {
                        let tmp = free[j].type;
                        free[j].type = free[i].type;
                        sameType.type = tmp;
                        return;
                    }
                }
            }
        }
    }

    switchTheme() {
        const keys = Object.keys(THEMES);
        let idx = keys.indexOf(this.currentThemeKey);
        idx = (idx + 1) % keys.length;
        this.currentThemeKey = keys[idx];
        this.updateThemeUI();
        this.sound.play('click');
    }

    updateThemeUI() {
        document.body.setAttribute('data-theme', this.currentThemeKey);
        document.getElementById('btn-theme').innerText = `🎨 ${THEMES[this.currentThemeKey].name}`;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timer = CONFIG.TIME_LIMIT;
        this.timerInterval = setInterval(() => {
            if (this.isGameOver) return;
            this.timer--;
            this.updateHUD();
            if (this.timer <= 0) this.gameLose("时间耗尽！");
        }, 1000);
    }

    updateHUD() {
        let mins = Math.floor(this.timer / 60);
        let secs = this.timer % 60;
        document.getElementById('timer').innerText =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('score').innerText = this.score;
        document.getElementById('combo').innerText = this.combo;
        document.getElementById('tiles-left').innerText = this.tilesLeft;
        document.getElementById('hint-count').innerText = this.hintCount;
        document.getElementById('shuffle-count').innerText = this.shuffleCount;
        document.getElementById('timer').style.color = this.timer <= 30 ? '#ff4757' : '';
    }

    gameWin() {
        this.isGameOver = true;
        clearInterval(this.timerInterval);
        this.sound.play('win');
        this.showModal("🎉 恭喜通关", `最终得分: ${this.score}<br>用时: ${CONFIG.TIME_LIMIT - this.timer}秒`, true);
    }

    gameLose(reason) {
        this.isGameOver = true;
        clearInterval(this.timerInterval);
        this.sound.play('wrong');
        this.showModal("💔 游戏失败", `${reason}<br>得分: ${this.score}`, false);
    }

    showModal(title, text, isWin) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-text').innerHTML = text;
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    confirmRestart() {
        if (this.tilesLeft === this.totalTiles) {
            this.restart();
            return;
        }
        document.getElementById('modal-title').innerText = '确认重开';
        document.getElementById('modal-text').innerText = '当前进度将会丢失，确定重新开始吗？';
        document.getElementById('btn-confirm-yes').style.display = 'inline-block';
        document.getElementById('btn-confirm-no').style.display = 'inline-block';
        document.getElementById('btn-modal-restart').style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    restart() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('btn-confirm-yes').style.display = 'none';
        document.getElementById('btn-confirm-no').style.display = 'none';
        document.getElementById('btn-modal-restart').style.display = 'inline-block';
        this.pendingLevel = null;
        this.isGameOver = false;
        this.score = 0;
        this.combo = 0;
        this.hintCount = CONFIG.HINT_LIMIT;
        this.shuffleCount = CONFIG.SHUFFLE_LIMIT;
        this.selectedTile = null;
        clearInterval(this.timerInterval);
        this.init();
    }

    setLevel(idx, force) {
        if (idx === this.currentLevel) return;
        if (!force && this.tilesLeft < this.totalTiles) {
            this.pendingLevel = idx;
            document.getElementById('modal-title').innerText = '切换关卡';
            document.getElementById('modal-text').innerText = '当前进度将会丢失，确定切换吗？';
            document.getElementById('btn-confirm-yes').style.display = 'inline-block';
            document.getElementById('btn-confirm-no').style.display = 'inline-block';
            document.getElementById('btn-modal-restart').style.display = 'none';
            document.getElementById('modal-overlay').style.display = 'flex';
            return;
        }
        this.currentLevel = idx;
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('btn-confirm-yes').style.display = 'none';
        document.getElementById('btn-confirm-no').style.display = 'none';
        document.getElementById('btn-modal-restart').style.display = 'inline-block';
        this.pendingLevel = null;
        this.isGameOver = false;
        this.score = 0;
        this.combo = 0;
        this.hintCount = CONFIG.HINT_LIMIT;
        this.shuffleCount = CONFIG.SHUFFLE_LIMIT;
        this.selectedTile = null;
        clearInterval(this.timerInterval);
        this.init();
    }
}
