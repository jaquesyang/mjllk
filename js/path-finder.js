// ================= 严密路径搜索算法 =================
class PathFinder {
    constructor(gridData, rows, cols) {
        this.extRows = rows + 4;
        this.extCols = cols + 4;
        this.extGrid = Array(this.extRows).fill().map(() => Array(this.extCols).fill(0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this.extGrid[r + 2][c + 2] = gridData[r][c] ? 1 : 0;
            }
        }
    }

    updatePoint(r, c, isEmpty) {
        this.extGrid[r + 2][c + 2] = isEmpty ? 0 : 1;
    }

    isLineEmpty(r1, c1, r2, c2) {
        if (r1 === r2) {
            const minC = Math.min(c1, c2);
            const maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (this.extGrid[r1][c] !== 0) return false;
            }
            return true;
        }
        if (c1 === c2) {
            const minR = Math.min(r1, r2);
            const maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (this.extGrid[r][c1] !== 0) return false;
            }
            return true;
        }
        return false;
    }

    // 修复版：严密判定0/1/2折路径，消除所有逻辑死角
    canConnect(r1, c1, r2, c2) {
        // 0折：直线
        if (r1 === r2 && this.isLineEmpty(r1, c1, r2, c2)) {
            return { path: [{ r: r1, c: c1 }, { r: r2, c: c2 }] };
        }
        if (c1 === c2 && this.isLineEmpty(r1, c1, r2, c2)) {
            return { path: [{ r: r1, c: c1 }, { r: r2, c: c2 }] };
        }

        // 1折：拐点必须为空地
        if (this.extGrid[r1][c2] === 0 && this.isLineEmpty(r1, c1, r1, c2) && this.isLineEmpty(r1, c2, r2, c2)) {
            return { path: [{ r: r1, c: c1 }, { r: r1, c: c2 }, { r: r2, c: c2 }] };
        }
        if (this.extGrid[r2][c1] === 0 && this.isLineEmpty(r1, c1, r2, c1) && this.isLineEmpty(r2, c1, r2, c2)) {
            return { path: [{ r: r1, c: c1 }, { r: r2, c: c1 }, { r: r2, c: c2 }] };
        }

        // 2折：两个拐点C,D必须均为空地
        // 扫描垂直中间线 (中间行r)
        for (let r = 0; r < this.extRows; r++) {
            if (r === r1 || r === r2) continue; // 排除与起终点同行(已归入0/1折)
            if (this.extGrid[r][c1] === 0 && this.extGrid[r][c2] === 0) {
                if (this.isLineEmpty(r1, c1, r, c1) && this.isLineEmpty(r, c1, r, c2) && this.isLineEmpty(r, c2, r2, c2)) {
                    return { path: [{ r: r1, c: c1 }, { r: r, c: c1 }, { r: r, c: c2 }, { r: r2, c: c2 }] };
                }
            }
        }
        // 扫描水平中间线 (中间列c)
        for (let c = 0; c < this.extCols; c++) {
            if (c === c1 || c === c2) continue;
            if (this.extGrid[r1][c] === 0 && this.extGrid[r2][c] === 0) {
                if (this.isLineEmpty(r1, c1, r1, c) && this.isLineEmpty(r1, c, r2, c) && this.isLineEmpty(r2, c, r2, c2)) {
                    return { path: [{ r: r1, c: c1 }, { r: r1, c: c }, { r: r2, c: c }, { r: r2, c: c2 }] };
                }
            }
        }
        return null;
    }

    checkConnect(r1, c1, r2, c2) {
        return this.canConnect(r1 + 2, c1 + 2, r2 + 2, c2 + 2);
    }
}
