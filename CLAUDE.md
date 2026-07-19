# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Mahjong Connect (麻将连连看) browser game. Open `index.html` in a browser to play. No build step, no dependencies, no server needed.

## Development

- **Run**: Open `index.html` directly in a browser. Live Server or similar can be used for hot-reload convenience.
- **Regenerate tile sprite**: If you add, remove, or edit PNG images in `assets/images/`, run `python3 tools/build_sprite.py` to regenerate `assets/images/tiles.png` and `assets/images/tiles.js`.
- **Test UX logic**: `tools/test_undo.js` runs a jsdom-based smoke test that verifies match + undo + incremental DOM removal (requires `jsdom`).

## Project Structure

```
index.html          # Entry point — UI markup, loads all JS/CSS
css/style.css       # All styles, CSS variables for theming, animations
js/config.js        # CONFIG constants and THEMES data
js/sound-engine.js  # SoundEngine — Web Audio API oscillator-based SFX with mute support
js/path-finder.js   # PathFinder — 0/1/2-turn connection path algorithm
js/game.js          # MahjongGame — board generation, rendering, input, timer, HUD, undo/history, toast/progress
assets/images/      # 55 source PNG tile images, plus generated tiles.png (sprite sheet) and tiles.js (mapping)
```

## Architecture

- **Themes**: Three themes (classic/animal/festival) controlled by `data-theme` attribute on `<body>`. CSS variables (`--bg-color`, `--tile-bg`, etc.) drive all theming. Tile faces are rendered from a single preloaded sprite sheet (`assets/images/tiles.png`) using CSS `background-position`.
- **Tile images**: All 55 tile PNGs are composited into one sprite sheet by `tools/build_sprite.py` at build/generation time. The game preloads this single image and shows a loading overlay until it is ready, eliminating per-image startup flicker.
- **Board generation** (`generateSolvableBoard` in `js/game.js`): Multi-layer board. Layer 0 fills the base grid densely; higher layers use reverse-placement (place connectable pairs, remove from pool) to guarantee solvability. `PathFinder` is used during both generation and gameplay.
- **PathFinder** (`js/path-finder.js`): Extended-grid approach (board + 2-cell border on each side) enables connection paths wrapping around the board edge. Supports 0-turn (straight line), 1-turn (L-shaped), and 2-turn (Z-shaped) connections.
- **`isTileBlocked`**: A tile on layer 0 is "blocked" (unclickable) if a higher-layer tile overlaps its bounding box.
- **`SoundEngine`** (`js/sound-engine.js`): Web Audio API oscillator-based sound effects — no audio files needed.
- **State**: `MahjongGame` class holds all state (score, combo, timer, tiles). `CONFIG` controls difficulty: layers, board dimensions, time limit, hint/shuffle/undo counts, combo timeout.
- **UX features**: Hint (`btn-hint`), Shuffle (`btn-shuffle`), Undo (`btn-undo` with a bounded history snapshot), Sound toggle (`btn-sound`), timer mode toggle, progress bar, and toast notifications for user actions and deadlocks.
