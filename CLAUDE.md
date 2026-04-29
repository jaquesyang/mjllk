# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Mahjong Connect (麻将连连看) browser game. Open `index.html` in a browser to play. No build step, no dependencies, no server needed.

## Development

- **Run**: Open `index.html` directly in a browser. Live Server or similar can be used for hot-reload convenience.
- **No build/lint/test commands** — vanilla HTML/CSS/JS project with no toolchain.

## Project Structure

```
index.html          # Entry point — UI markup, loads all JS/CSS
css/style.css       # All styles, CSS variables for theming, animations
js/config.js        # CONFIG constants and THEMES data
js/sound-engine.js  # SoundEngine — Web Audio API oscillator-based SFX
js/path-finder.js   # PathFinder — 0/1/2-turn connection path algorithm
js/game.js          # MahjongGame — board generation, rendering, input, timer, HUD
assets/images/      # 56 PNG tile images (unused; code uses emoji rendering)
```

## Architecture

- **Themes**: Three themes (classic/animal/festival) controlled by `data-theme` attribute on `<body>`. CSS variables (`--bg-color`, `--tile-bg`, etc.) drive all theming. `THEMES` in `js/config.js` defines 36 tile emoji sets per theme.
- **Board generation** (`generateSolvableBoard` in `js/game.js`): Multi-layer board. Layer 0 fills the base grid densely; higher layers use reverse-placement (place connectable pairs, remove from pool) to guarantee solvability. `PathFinder` is used during both generation and gameplay.
- **PathFinder** (`js/path-finder.js`): Extended-grid approach (board + 2-cell border on each side) enables connection paths wrapping around the board edge. Supports 0-turn (straight line), 1-turn (L-shaped), and 2-turn (Z-shaped) connections.
- **`isTileBlocked`**: A tile on layer 0 is "blocked" (unclickable) if a higher-layer tile overlaps its bounding box.
- **`SoundEngine`** (`js/sound-engine.js`): Web Audio API oscillator-based sound effects — no audio files needed.
- **State**: `MahjongGame` class holds all state (score, combo, timer, tiles). `CONFIG` controls difficulty: layers, board dimensions, time limit, hint/shuffle counts, combo timeout.
