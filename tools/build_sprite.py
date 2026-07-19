#!/usr/bin/env python3
"""
麻将牌雪碧图（sprite sheet）生成器
==================================
把 assets/images/ 下所有 300x380 的 PNG 牌面拼成一张大图，
同时导出分区映射（assets/images/tiles.js），供前端用
CSS background-position 分区显示，避免开局 55 张图分别加载造成的闪烁。

用法:
    python3 tools/build_sprite.py

依赖:
    Pillow

输出:
    assets/images/tiles.png   合成后的雪碧图（RGBA）
    assets/images/tiles.js    全局变量 window.TILE_SPRITE 的分区映射
"""

import os
import glob
import json
import math

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "images")
OUT_PNG = os.path.join(SRC_DIR, "tiles.png")
OUT_JS = os.path.join(SRC_DIR, "tiles.js")


def main():
    files = sorted(
        f for f in glob.glob(os.path.join(SRC_DIR, "*.png"))
        if os.path.basename(f) != "tiles.png"
    )
    if not files:
        raise SystemExit("未在 assets/images/ 找到任何 PNG 牌面")

    # 读取首张确认尺寸，并统一校验
    sample = Image.open(files[0])
    cell_w, cell_h = sample.size
    print(f"单元尺寸: {cell_w}x{cell_h}, 共 {len(files)} 张")

    # 网格布局：列数取接近正方形，避免超长图
    cols = math.ceil(math.sqrt(len(files)))
    rows = math.ceil(len(files) / cols)
    sheet_w = cols * cell_w
    sheet_h = rows * cell_h
    print(f"雪碧图布局: {cols} 列 x {rows} 行 = {sheet_w}x{sheet_h}")

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    tiles = {}
    for idx, path in enumerate(files):
        im = Image.open(path).convert("RGBA")
        if im.size != (cell_w, cell_h):
            print(f"  ⚠️ 跳过尺寸不符的 {os.path.basename(path)} ({im.size})")
            continue
        col = idx % cols
        row = idx // cols
        x = col * cell_w
        y = row * cell_h
        sheet.paste(im, (x, y), im)
        name = os.path.splitext(os.path.basename(path))[0]
        tiles[name] = {
            "index": idx,
            "col": col,
            "row": row,
            "x": x,
            "y": y,
            "w": cell_w,
            "h": cell_h,
        }

    sheet.save(OUT_PNG, optimize=True)
    print(f"✅ 写出 {OUT_PNG} ({os.path.getsize(OUT_PNG) // 1024} KB)")

    meta = {
        "url": "assets/images/tiles.png",
        "cellW": cell_w,
        "cellH": cell_h,
        "cols": cols,
        "rows": rows,
        "sheetW": sheet_w,
        "sheetH": sheet_h,
        "count": len(tiles),
        "tiles": tiles,
    }

    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// 自动生成，请勿手工修改。运行 tools/build_sprite.py 重新生成。\n")
        f.write("window.TILE_SPRITE = ")
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"✅ 写出 {OUT_JS}")


if __name__ == "__main__":
    main()
