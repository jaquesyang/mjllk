const { JSDOM } = require('jsdom');
const fs = require('fs');

const ROOT = '/Users/jaquesyang/Documents/mjllk';
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// ---- stubs for browser-only APIs ----
window.AudioContext = class {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  resume() {}
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
  }
  createGain() {
    return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
  }
};
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
window.Image = class { set src(v) { if (this.onload) setTimeout(() => this.onload(), 0); } };
window.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, { get: () => noop, set: () => true });
};

// ---- load game scripts into window scope (single eval so lexical bindings are shared) ----
const bundle = ['js/config.js', 'js/sound-engine.js', 'js/path-finder.js', 'js/game.js']
  .map(f => fs.readFileSync(ROOT + '/' + f, 'utf8')).join('\n;\n') + '\n;window.MahjongGame = MahjongGame;';
window.eval(bundle);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
const assert = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ': ' + msg); if (!cond) failures++; };

(async () => {
  const g = new window.MahjongGame();
  await sleep(50); // preloadTiles -> init (Image stub fires onload)

  assert(g.allTiles.length > 0, 'board generated, tiles=' + g.allTiles.length);
  assert(g.tilesLeft === g.totalTiles, 'tilesLeft == totalTiles (' + g.tilesLeft + ')');
  const domTiles = g.boardEl.querySelectorAll('.tile').length;
  assert(domTiles === g.tilesLeft, 'DOM tile count matches tilesLeft (' + domTiles + ')');
  const initialUndo = g.undoCount;
  assert(initialUndo > 0, 'undoCount initialized=' + initialUndo);

  // find a matchable pair using the game's own solver
  let pair = null;
  const active = g.allTiles.filter(t => !t.isRemoved);
  outer:
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++)
      if (active[i].type === active[j].type &&
          g.pathFinder.checkConnect(active[i].row, active[i].col, active[j].row, active[j].col)) {
        pair = [active[i], active[j]]; break outer;
      }
  assert(!!pair, 'found a matchable pair');
  if (!pair) { console.log('cannot test match/undo'); process.exit(1); }

  const scoreBefore = g.score;
  const id1 = pair[0].id, id2 = pair[1].id;

  // simulate the two clicks
  g.handleTileClick(pair[0], g.boardEl.querySelector('#tile-' + id1));
  assert(g.selectedTile && g.selectedTile.id === id1, 'first tile selected');
  g.handleTileClick(pair[1], g.boardEl.querySelector('#tile-' + id2));
  assert(g.isAnimating, 'match triggered animation');

  await sleep(500); // wait for removal timeout (400ms)

  assert(g.tilesLeft === g.totalTiles - 2, 'tilesLeft decreased by 2 (' + g.tilesLeft + ')');
  assert(g.history.length === 1, 'history has 1 snapshot');
  assert(!g.boardEl.querySelector('#tile-' + id1), 'tile1 DOM removed (incremental)');
  assert(!g.boardEl.querySelector('#tile-' + id2), 'tile2 DOM removed (incremental)');
  assert(g.score >= scoreBefore, 'score increased (' + scoreBefore + '->' + g.score + ')');

  // undo
  const domBeforeUndo = g.boardEl.querySelectorAll('.tile').length;
  g.undo();
  await sleep(20);
  assert(g.tilesLeft === g.totalTiles, 'tilesLeft restored after undo (' + g.tilesLeft + ')');
  assert(g.history.length === 0, 'history empty after undo');
  assert(g.undoCount === initialUndo - 1, 'undoCount decremented (' + g.undoCount + ')');
  assert(!!g.boardEl.querySelector('#tile-' + id1), 'tile1 DOM restored after undo');
  assert(!!g.boardEl.querySelector('#tile-' + id2), 'tile2 DOM restored after undo');
  assert(g.boardEl.querySelectorAll('.tile').length === domBeforeUndo + 2, 'DOM tile count +2 after undo');

  // undo with no history should not throw / no-op
  const tilesNow = g.tilesLeft;
  g.undo();
  assert(g.tilesLeft === tilesNow, 'undo with empty history is a safe no-op');

  console.log('\n' + (failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
