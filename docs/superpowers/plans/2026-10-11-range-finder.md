# Range Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `range-finder`, a standalone Foundry v14 module that pins/previews an item's range on the canvas as merged penalty bands with per-target distance/penalty badges, PF2e adapter first.

**Architecture:** Pure, Foundry-free core (`scripts/core/*`: range specs, cell banding, outline merging, target classification, theme) unit-tested with `node --test`. Thin Foundry layer: a PIXI overlay and badge layer (`scripts/canvas/*`), UI state/managers (`scripts/ui/*`: pins, window ghosting, row buttons/keybind), system adapters (`scripts/adapters/*`), and `main.mjs` wiring hooks, settings, keybindings and the module socket.

**Tech Stack:** Foundry VTT v13–v14 (ApplicationV1 PF2e sheets, ApplicationV2 pf2e-hud apps, PIXI v7 Graphics), plain ES modules (`.mjs`), Node `node --test`, `jsdom` (dev only) for DOM tests.

**Spec:** `docs/superpowers/specs/2026-10-11-range-finder-design.md`

## Global Constraints

- Module id `range-finder`, title `Range Finder`, compatibility minimum `13`, verified `14`.
- No runtime dependencies: no socketlib, no libWrapper, no Tactical Grid. Socket via `game.socket` on `module.range-finder` (`"socket": true` in module.json).
- Files under `scripts/core/` must not reference `game`, `canvas`, `foundry`, `CONFIG`, `PIXI`, `Hooks`, `ui` or `document`.
- Console messages are prefixed `Range Finder |`.
- Penalties render with an en dash: `–2`, `–10` (U+2013), never a hyphen.
- Range increments: at most 6 bands, penalty `0, –2, –4, –6, –8, –10`; beyond max range → out of range (`✗`).
- Badge text format: `"{distance} ft · {mark}"` where mark is `✓` (penalty 0), `–N`, or `✗`.
- Settings keys and defaults exactly as the spec's Settings table.
- Respect `prefers-reduced-motion: reduce` (no fade animation, no CSS transitions).
- Every DOM injection and every redraw is wrapped in try/catch; failures never break sheet rendering and always release window ghosting.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Actor with no token on the current scene (sheet opened from the sidebar) → clicking 📏 shows a warning notification, nothing throws, no pin is created. (Task 10 test.)
2. Very long ranges (longbow 600 ft) → banding stays bounded by the scene grid and fast; drag redraws reuse cached band geometry. (Task 2 perf test, Task 9 cache test.)
3. A sheet re-renders while an item is pinned → the re-rendered button shows the active state. (Task 10 test.)
4. Window ghosting never gets stuck: pin dropped by token deletion, scene teardown, or Esc releases the ghost. (Task 7 + Task 8 tests.)
5. Item changed or deleted while pinned (rune swap, weapon dropped) → pin spec rebuilt or pin dropped. (Task 7 test.)

---

### Task 1: Scaffold + RangeSpec core

**Files:**
- Create: `module.json`, `package.json`, `.gitignore`, `lang/en.json`, `styles/range-finder.css`, `main.mjs` (placeholder), `scripts/core/spec.mjs`
- Test: `tests/spec.test.mjs`

**Interfaces:**
- Produces (`scripts/core/spec.mjs`):
  - `KINDS`, `TONES`, `MAX_INCREMENTS = 6`
  - `fmtPenalty(penalty:number) → string` (`0` → `'0'`, `-2` → `'–2'`)
  - `inBand(band, distance) → boolean`; `bandIndexFor(bands, distance) → number` (−1 if none)
  - `incrementBands(increment, max = increment*6) → Band[]`
  - `singleBand(max, tone='base', label=\`${max} ft\`) → Band[]`
  - `makeSpec({kind, bands, overlays, note, itemName}) → RangeSpec | null`
  - `noneSpec(note=null, itemName='') → RangeSpec`
  - `hasRange(spec) → boolean`, `showsButton(spec) → boolean`, `maxRange(spec) → number`
  - `Band = { min, max, penalty, tone, label }`, `RangeSpec = { kind, bands, overlays, note, itemName }`

- [ ] **Step 1: Create static files**

`module.json`:
```json
{
  "id": "range-finder",
  "title": "Range Finder",
  "description": "See an item's, attack's or spell's range on the canvas: penalty bands, reach, and per-target distance and penalty badges. PF2e support built in.",
  "version": "0.1.0",
  "authors": [{ "name": "RoiLeaf" }],
  "compatibility": { "minimum": "13", "verified": "14" },
  "esmodules": ["main.mjs"],
  "styles": ["styles/range-finder.css"],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "socket": true,
  "relationships": {
    "recommends": [{ "id": "pf2e-hud", "type": "module" }]
  }
}
```

`package.json`:
```json
{
  "name": "range-finder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/*.test.mjs" },
  "devDependencies": { "jsdom": "^25.0.1" }
}
```

`.gitignore`:
```
node_modules/
.superpowers/
```

`lang/en.json`:
```json
{
  "RANGE_FINDER": {
    "Button": { "Show": "Show range (Shift+click to share)" },
    "Notify": { "NoToken": "Range Finder: this actor has no token on the current scene." },
    "Controls": { "ClearShared": "Range Finder — clear shared ranges" },
    "Keys": {
      "Preview": { "Name": "Preview hovered range", "Hint": "Hold while hovering an item, attack or spell row to preview its range." },
      "Clear": { "Name": "Clear my ranges", "Hint": "Clear your pinned ranges and previews." },
      "ClearShared": { "Name": "Clear shared ranges (GM)", "Hint": "Clear every shared range for all players." }
    },
    "Settings": {
      "bandStyle": { "Name": "Range Finder: band style", "Hint": "How range bands are drawn.", "Choices": { "fill": "Fill only", "outline": "Outline only", "both": "Fill and outline" } },
      "bandOpacity": { "Name": "Range Finder: band opacity", "Hint": "Multiplier for band fill opacity." },
      "showLabels": { "Name": "Range Finder: band labels", "Hint": "Show distance and penalty labels on band edges." },
      "badgeScale": { "Name": "Range Finder: badge size", "Hint": "Size of the distance badges above tokens." },
      "palette": { "Name": "Range Finder: colors", "Hint": "Color palette for bands and badges.", "Choices": { "default": "Default", "colorblind": "Colorblind-safe" } },
      "dimBehindWalls": { "Name": "Range Finder: dim behind walls", "Hint": "Hatch squares and mark targets without line of effect from the token. Range itself is unchanged." },
      "ghostMode": { "Name": "Range Finder: hide windows while showing range", "Hint": "What happens to the sheet or HUD window a range was shown from.", "Choices": { "fade": "Fade (hover to restore)", "minimize": "Minimize", "off": "Do nothing" } },
      "ghostPersistentHud": { "Name": "Range Finder: also hide PF2e HUD bar", "Hint": "Also fade the PF2e HUD persistent bar when a range is shown from it." },
      "allowSharing": { "Name": "Range Finder: allow sharing", "Hint": "Let players Shift+click to show a range to everyone." },
      "badgesCombatOnly": { "Name": "Range Finder: badges only in combat", "Hint": "Only show distance badges on combatants of the active combat." }
    }
  }
}
```

`styles/range-finder.css`:
```css
.range-finder-btn {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  width: 1.5em; height: 1.5em; margin-left: 4px; border-radius: 4px;
  color: var(--color-text-secondary, #9aa4ad); cursor: pointer;
  transition: color .15s, background-color .15s, box-shadow .15s;
}
.range-finder-btn:hover { color: #2ec4b6; background: rgb(46 196 182 / 12%); }
.range-finder-btn.is-active { color: #2ec4b6; background: rgb(46 196 182 / 18%); box-shadow: 0 0 6px rgb(46 196 182 / 60%); }
.range-finder-btn.is-shared { color: var(--range-finder-user, #2ec4b6); box-shadow: 0 0 0 1px currentColor, 0 0 8px currentColor; }
.range-finder-btn.is-disabled { opacity: .4; cursor: help; }
.range-finder-ghostable { transition: opacity .15s ease; }
.range-finder-ghost { opacity: .1 !important; pointer-events: none !important; }
@media (prefers-reduced-motion: reduce) {
  .range-finder-btn, .range-finder-ghostable { transition: none; }
}
```

`main.mjs` (placeholder, replaced in Task 11):
```js
// Range Finder — wiring lands in Task 11.
```

- [ ] **Step 2: Install dev dependency**

Run: `npm install`
Expected: `node_modules/jsdom` exists, `package-lock.json` created.

- [ ] **Step 3: Write the failing tests** — `tests/spec.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { bandIndexFor, fmtPenalty, hasRange, incrementBands, inBand, makeSpec, maxRange, noneSpec, showsButton, singleBand } from '../scripts/core/spec.mjs';

test('fmtPenalty uses an en dash and zero', () => {
  assert.equal(fmtPenalty(0), '0');
  assert.equal(fmtPenalty(-2), '–2');
  assert.equal(fmtPenalty(-10), '–10');
  assert.equal(fmtPenalty(1), '+1');
});

test('incrementBands builds six capped bands with penalties', () => {
  const bands = incrementBands(100, 600);
  assert.equal(bands.length, 6);
  assert.deepEqual(bands.map(b => b.penalty), [0, -2, -4, -6, -8, -10]);
  assert.deepEqual(bands.map(b => [b.min, b.max]), [[0, 100], [100, 200], [200, 300], [300, 400], [400, 500], [500, 600]]);
  assert.equal(bands[0].tone, 'base');
  assert.equal(bands[1].tone, 'increment');
  assert.equal(bands[0].label, '100 ft');
  assert.equal(bands[1].label, '200 ft · –2');
  assert.ok(Object.is(bands[0].penalty, 0));
});

test('incrementBands respects a shorter max and bad input', () => {
  assert.deepEqual(incrementBands(30, 75).map(b => [b.min, b.max]), [[0, 30], [30, 60], [60, 75]]);
  assert.equal(incrementBands(30).length, 6);
  assert.deepEqual(incrementBands(0, 60), []);
});

test('inBand: first band includes 0, later bands exclude their min', () => {
  const [a, b] = incrementBands(30, 60);
  assert.ok(inBand(a, 0));
  assert.ok(inBand(a, 30));
  assert.ok(!inBand(b, 30));
  assert.ok(inBand(b, 35));
  assert.equal(bandIndexFor([a, b], 45), 1);
  assert.equal(bandIndexFor([a, b], 61), -1);
});

test('makeSpec validates kinds and bands', () => {
  assert.equal(makeSpec({ kind: 'nope', bands: singleBand(30) }), null);
  assert.equal(makeSpec({ kind: 'radius', bands: [] }), null);
  assert.equal(makeSpec({ kind: 'radius', bands: [{ min: 10, max: 5, penalty: 0, tone: 'base', label: 'x' }] }), null);
  assert.equal(makeSpec({ kind: 'radius', bands: [{ min: 0, max: 5, penalty: 0, tone: 'weird', label: 'x' }] }), null);
  const spec = makeSpec({ kind: 'radius', bands: singleBand(30), itemName: 'Fireball' });
  assert.deepEqual(spec, { kind: 'radius', bands: singleBand(30), overlays: [], note: null, itemName: 'Fireball' });
});

test('hasRange / showsButton / maxRange', () => {
  const spec = makeSpec({ kind: 'increments', bands: incrementBands(30), overlays: [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }] });
  assert.ok(hasRange(spec));
  assert.equal(maxRange(spec), 180);
  assert.ok(!hasRange(noneSpec('Range: varies')));
  assert.ok(showsButton(noneSpec('Range: varies')));
  assert.ok(!showsButton(noneSpec()));
  assert.ok(!showsButton(null));
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/core/spec.mjs'`.

- [ ] **Step 5: Implement** — `scripts/core/spec.mjs`:

```js
/** RangeSpec: what an adapter says an item reaches. Pure — no Foundry globals. */
export const KINDS = ['reach', 'increments', 'radius', 'none'];
export const TONES = ['base', 'increment', 'reach', 'penalty-zone'];
export const MAX_INCREMENTS = 6;

export function fmtPenalty(penalty) {
  if (!penalty) return '0';
  return `${penalty < 0 ? '–' : '+'}${Math.abs(penalty)}`;
}

/** The first band starts at 0 inclusive; later bands exclude their min (it belongs to the band before). */
export function inBand(band, distance) {
  return distance <= band.max && (band.min === 0 ? distance >= 0 : distance > band.min);
}

export function bandIndexFor(bands, distance) {
  return bands.findIndex(band => inBand(band, distance));
}

export function incrementBands(increment, max = increment * MAX_INCREMENTS) {
  const bands = [];
  if (!(increment > 0) || !(max > 0)) return bands;
  for (let k = 0; k < MAX_INCREMENTS; k++) {
    const min = k * increment;
    if (min >= max) break;
    const end = Math.min((k + 1) * increment, max);
    const penalty = k === 0 ? 0 : -2 * k;
    bands.push({
      min, max: end, penalty, tone: k === 0 ? 'base' : 'increment',
      label: penalty ? `${end} ft · ${fmtPenalty(penalty)}` : `${end} ft`
    });
  }
  return bands;
}

export function singleBand(max, tone = 'base', label = `${max} ft`) {
  return [{ min: 0, max, penalty: 0, tone, label }];
}

function validBand(band) {
  return Boolean(band) && Number.isFinite(band.min) && Number.isFinite(band.max) && band.min >= 0 && band.max > band.min
    && Number.isFinite(band.penalty) && TONES.includes(band.tone) && typeof band.label === 'string';
}

export function makeSpec({ kind, bands = [], overlays = [], note = null, itemName = '' } = {}) {
  if (!KINDS.includes(kind)) return null;
  if (!bands.every(validBand) || !overlays.every(validBand)) return null;
  if (kind !== 'none' && !bands.length) return null;
  return {
    kind,
    bands: bands.map(band => ({ ...band })),
    overlays: overlays.map(band => ({ ...band })),
    note: note ?? null,
    itemName: String(itemName ?? '')
  };
}

export const noneSpec = (note = null, itemName = '') => makeSpec({ kind: 'none', note, itemName });
export const hasRange = spec => Boolean(spec && spec.kind !== 'none' && spec.bands.length);
export const showsButton = spec => Boolean(spec && (hasRange(spec) || spec.note));
export const maxRange = spec => Math.max(0, ...[...(spec?.bands ?? []), ...(spec?.overlays ?? [])].map(band => band.max));
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add module.json package.json package-lock.json .gitignore lang styles main.mjs scripts/core/spec.mjs tests/spec.test.mjs
git commit -m "feat: scaffold module and RangeSpec core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cell banding

**Files:**
- Create: `scripts/core/cells.mjs`
- Test: `tests/cells.test.mjs`

**Interfaces:**
- Consumes: `inBand`, `incrementBands`, `singleBand` from `scripts/core/spec.mjs`.
- Produces (`scripts/core/cells.mjs`):
  - `Cell = { i, j }` (i = row, j = column, matching Foundry grid offsets)
  - `cellKey(cell) → 'i,j'`
  - `alternatingDistance(a, b, unit = 5) → feet` (5/10/5 diagonals, PF2e and Foundry default)
  - `chebyshevDistance(a, b, unit = 5) → feet`
  - `bandCells({ originCells, bands, measure, unit = 5, bounds = null }) → Cell[][]` (one array per band, same order; `measure(fromCell, toCell, band) → feet`; `bounds = { rows, cols }` clips to `0..rows-1`, `0..cols-1`; cells occupied by the origin are excluded; each cell lands in the first band containing its distance).

- [ ] **Step 1: Write the failing tests** — `tests/cells.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { alternatingDistance, bandCells, cellKey, chebyshevDistance } from '../scripts/core/cells.mjs';
import { incrementBands, singleBand } from '../scripts/core/spec.mjs';

const plain = (a, b) => alternatingDistance(a, b, 5);

test('distances', () => {
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 0, j: 1 }), 5);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 1, j: 1 }), 5);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 2, j: 2 }), 15);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 3, j: 3 }), 20);
  assert.equal(chebyshevDistance({ i: 0, j: 0 }, { i: 3, j: 2 }), 15);
  assert.equal(cellKey({ i: 2, j: 7 }), '2,7');
});

test('1x1 token, two 10 ft bands, alternating diagonals', () => {
  const [near, far] = bandCells({ originCells: [{ i: 10, j: 10 }], bands: incrementBands(10, 20), measure: plain });
  assert.equal(near.length, 20);
  assert.equal(far.length, 40);
  assert.ok(!near.some(c => c.i === 10 && c.j === 10));
  assert.ok(far.some(c => c.i === 12 && c.j === 12));
});

test('2x2 token excludes its own cells', () => {
  const origin = [{ i: 5, j: 5 }, { i: 5, j: 6 }, { i: 6, j: 5 }, { i: 6, j: 6 }];
  const [ring] = bandCells({ originCells: origin, bands: singleBand(5), measure: plain });
  assert.equal(ring.length, 12);
});

test('bounds clip to the scene grid', () => {
  const [cells] = bandCells({ originCells: [{ i: 0, j: 0 }], bands: singleBand(5), measure: plain, bounds: { rows: 10, cols: 10 } });
  assert.equal(cells.length, 3);
});

test('per-band measure override (PF2e reach 10 diagonal)', () => {
  const reach10 = (a, b, band) => {
    if (band.tone === 'reach' && band.max === 10 && Math.abs(a.i - b.i) === 2 && Math.abs(a.j - b.j) === 2) return 10;
    return plain(a, b);
  };
  const band = singleBand(10, 'reach', 'Reach 10 ft');
  assert.equal(bandCells({ originCells: [{ i: 5, j: 5 }], bands: band, measure: reach10 })[0].length, 24);
  assert.equal(bandCells({ originCells: [{ i: 5, j: 5 }], bands: singleBand(10), measure: reach10 })[0].length, 20);
});

test('empty origin or bands', () => {
  assert.deepEqual(bandCells({ originCells: [], bands: singleBand(5), measure: plain }), [[]]);
  assert.deepEqual(bandCells({ originCells: [{ i: 0, j: 0 }], bands: [], measure: plain }), []);
});

test('600 ft longbow stays bounded and fast', () => {
  const started = Date.now();
  const groups = bandCells({ originCells: [{ i: 10, j: 10 }], bands: incrementBands(100, 600), measure: plain, unit: 5, bounds: { rows: 300, cols: 300 } });
  const cells = groups.flat();
  assert.ok(cells.length > 10000);
  assert.ok(cells.every(c => c.i >= 0 && c.i < 300 && c.j >= 0 && c.j < 300), 'cells outside the scene grid');
  assert.ok(cells.every(c => c.i <= 130 && c.j <= 130), 'cells beyond 600 ft');
  assert.ok(Date.now() - started < 3000, 'banding took too long');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/core/cells.mjs'`.

- [ ] **Step 3: Implement** — `scripts/core/cells.mjs`:

```js
/** Which grid cells fall in which range band. Pure — no Foundry globals. */
import { inBand } from './spec.mjs';

export const cellKey = ({ i, j }) => `${i},${j}`;

/** Square grid, diagonals alternate 5/10/5 (PF2e and Foundry's default rule). */
export function alternatingDistance(a, b, unit = 5) {
  const di = Math.abs(a.i - b.i), dj = Math.abs(a.j - b.j);
  return unit * (Math.max(di, dj) + Math.floor(Math.min(di, dj) / 2));
}

export function chebyshevDistance(a, b, unit = 5) {
  return unit * Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}

export function bandCells({ originCells, bands, measure, unit = 5, bounds = null }) {
  const groups = bands.map(() => []);
  if (!originCells?.length || !bands.length) return groups;
  const steps = Math.ceil(Math.max(...bands.map(band => band.max)) / unit);
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (const { i, j } of originCells) {
    i0 = Math.min(i0, i); i1 = Math.max(i1, i);
    j0 = Math.min(j0, j); j1 = Math.max(j1, j);
  }
  i0 -= steps; i1 += steps; j0 -= steps; j1 += steps;
  if (bounds) {
    i0 = Math.max(i0, 0); j0 = Math.max(j0, 0);
    i1 = Math.min(i1, bounds.rows - 1); j1 = Math.min(j1, bounds.cols - 1);
  }
  const occupied = new Set(originCells.map(cellKey));
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (occupied.has(`${i},${j}`)) continue;
      const cell = { i, j };
      for (let b = 0; b < bands.length; b++) {
        let distance = Infinity;
        for (const origin of originCells) distance = Math.min(distance, measure(origin, cell, bands[b]));
        if (inBand(bands[b], distance)) { groups[b].push(cell); break; }
      }
    }
  }
  return groups;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS (all spec + cells tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/core/cells.mjs tests/cells.test.mjs
git commit -m "feat: grid cell banding core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Outline merging

**Files:**
- Create: `scripts/core/outline.mjs`
- Test: `tests/outline.test.mjs`

**Interfaces:**
- Consumes: `Cell` shape from Task 2, `cellKey` from `scripts/core/cells.mjs`.
- Produces (`scripts/core/outline.mjs`), all points in grid-corner units `{ x: column, y: row }`:
  - `outline(cells) → Point[][]` closed loops (outer boundaries and holes), collinear points removed
  - `rowRuns(cells) → [{ i, j0, j1 }]` horizontal runs sorted by row then column
  - `topRightPoint(loops) → Point | null` (point maximizing `x - y`)

- [ ] **Step 1: Write the failing tests** — `tests/outline.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { outline, rowRuns, topRightPoint } from '../scripts/core/outline.mjs';

const sortPts = pts => pts.map(p => `${p.x},${p.y}`).sort();

test('single cell → one 4-point loop', () => {
  const loops = outline([{ i: 2, j: 3 }]);
  assert.equal(loops.length, 1);
  assert.deepEqual(sortPts(loops[0]), ['3,2', '3,3', '4,2', '4,3']);
});

test('L shape → one 6-point loop', () => {
  const loops = outline([{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 6);
});

test('ring (3x3 minus center) → outer and hole loops', () => {
  const cells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i === 1 && j === 1)) cells.push({ i, j });
  const loops = outline(cells);
  assert.equal(loops.length, 2);
  assert.deepEqual(loops.map(l => l.length).sort(), [4, 4]);
  assert.ok(loops.some(l => sortPts(l).join() === ['0,0', '0,3', '3,0', '3,3'].join()));
  assert.ok(loops.some(l => sortPts(l).join() === ['1,1', '1,2', '2,1', '2,2'].join()));
});

test('diagonal pinch still yields closed loops', () => {
  const loops = outline([{ i: 0, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(loops.reduce((n, l) => n + l.length, 0), 8);
  assert.ok(loops.every(l => l.length >= 4));
});

test('empty input', () => {
  assert.deepEqual(outline([]), []);
  assert.equal(topRightPoint([]), null);
});

test('rowRuns merges contiguous columns', () => {
  assert.deepEqual(rowRuns([{ i: 1, j: 1 }, { i: 0, j: 3 }, { i: 0, j: 0 }, { i: 0, j: 1 }]), [
    { i: 0, j0: 0, j1: 1 }, { i: 0, j0: 3, j1: 3 }, { i: 1, j0: 1, j1: 1 }
  ]);
});

test('topRightPoint', () => {
  assert.deepEqual(topRightPoint(outline([{ i: 2, j: 3 }])), { x: 4, y: 2 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/core/outline.mjs'`.

- [ ] **Step 3: Implement** — `scripts/core/outline.mjs`:

```js
/** Merge a band's cells into outline loops and fill runs. Pure — no Foundry globals. */
import { cellKey } from './cells.mjs';

/** Remove points that sit on a straight line between their neighbours. */
function simplify(points) {
  const n = points.length;
  return points.filter((p, k) => {
    const a = points[(k - 1 + n) % n], b = points[(k + 1) % n];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** At a pinch point (two cells touching diagonally) take the sharpest right turn (screen y-down). */
function pickTurn(current, candidates) {
  const dx = current.x2 - current.x1, dy = current.y2 - current.y1;
  let best = candidates[0], bestCross = -Infinity;
  for (const edge of candidates) {
    const cross = dx * (edge.y2 - edge.y1) - dy * (edge.x2 - edge.x1);
    if (cross > bestCross) { bestCross = cross; best = edge; }
  }
  return best;
}

export function outline(cells) {
  const set = new Set(cells.map(cellKey));
  const has = (i, j) => set.has(`${i},${j}`);
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const key = `${x1},${y1}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ x1, y1, x2, y2, used: false });
  };
  // Clockwise on screen (y down): interior is always on the right of each edge.
  for (const { i, j } of cells) {
    if (!has(i - 1, j)) add(j, i, j + 1, i);
    if (!has(i, j + 1)) add(j + 1, i, j + 1, i + 1);
    if (!has(i + 1, j)) add(j + 1, i + 1, j, i + 1);
    if (!has(i, j - 1)) add(j, i + 1, j, i);
  }
  const loops = [];
  for (const list of edges.values()) {
    for (const start of list) {
      if (start.used) continue;
      const points = [];
      let edge = start;
      while (edge && !edge.used) {
        edge.used = true;
        points.push({ x: edge.x1, y: edge.y1 });
        const next = (edges.get(`${edge.x2},${edge.y2}`) ?? []).filter(candidate => !candidate.used);
        edge = next.length > 1 ? pickTurn(edge, next) : next[0];
      }
      loops.push(simplify(points));
    }
  }
  return loops;
}

export function rowRuns(cells) {
  const rows = new Map();
  for (const { i, j } of cells) {
    if (!rows.has(i)) rows.set(i, []);
    rows.get(i).push(j);
  }
  const runs = [];
  for (const i of [...rows.keys()].sort((a, b) => a - b)) {
    const columns = rows.get(i).sort((a, b) => a - b);
    let start = columns[0], previous = columns[0];
    for (const j of columns.slice(1)) {
      if (j === previous + 1) { previous = j; continue; }
      runs.push({ i, j0: start, j1: previous });
      start = previous = j;
    }
    runs.push({ i, j0: start, j1: previous });
  }
  return runs;
}

export function topRightPoint(loops) {
  let best = null;
  for (const loop of loops) for (const point of loop) if (!best || point.x - point.y > best.x - best.y) best = point;
  return best;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/core/outline.mjs tests/outline.test.mjs
git commit -m "feat: merge band cells into outlines and fill runs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Target classification + theme

**Files:**
- Create: `scripts/core/targets.mjs`, `scripts/core/theme.mjs`
- Test: `tests/targets.test.mjs`, `tests/theme.test.mjs`

**Interfaces:**
- Consumes: `bandIndexFor`, `fmtPenalty`, `incrementBands`, `makeSpec` from `scripts/core/spec.mjs`.
- Produces:
  - `classifyTargets({ spec, targets: [{ id, distance, blocked? }] }) → [{ id, distance, bandIndex: number|null, penalty: number|null, outOfRange: boolean, blocked: boolean }]`
  - `badgeText({ distance, penalty, outOfRange }) → string`
  - `PALETTES` (`default`, `colorblind`), each `{ ramp: number[6], reach, penalty, halo, text }`
  - `bandStyle({ tone, index = 0, palette = 'default', opacity = 1, preview = false, tint = null }) → { fill, line, fillAlpha, lineAlpha, lineWidth, halo, text }`

- [ ] **Step 1: Write the failing tests**

`tests/targets.test.mjs`:
```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeText, classifyTargets } from '../scripts/core/targets.mjs';
import { incrementBands, makeSpec, singleBand } from '../scripts/core/spec.mjs';

const javelin = makeSpec({ kind: 'increments', bands: incrementBands(30) });

test('classifies by band, penalty and range', () => {
  const [a, b, c, d] = classifyTargets({ spec: javelin, targets: [
    { id: 'a', distance: 25 }, { id: 'b', distance: 45 }, { id: 'c', distance: 200 }, { id: 'd', distance: 30, blocked: true }
  ] });
  assert.deepEqual(a, { id: 'a', distance: 25, bandIndex: 0, penalty: 0, outOfRange: false, blocked: false });
  assert.deepEqual(b, { id: 'b', distance: 45, bandIndex: 1, penalty: -2, outOfRange: false, blocked: false });
  assert.deepEqual(c, { id: 'c', distance: 200, bandIndex: null, penalty: null, outOfRange: true, blocked: false });
  assert.equal(d.blocked, true);
});

test('non-finite distance is out of range', () => {
  const [r] = classifyTargets({ spec: makeSpec({ kind: 'reach', bands: singleBand(5, 'reach', 'Reach 5 ft') }), targets: [{ id: 'x', distance: NaN }] });
  assert.equal(r.outOfRange, true);
});

test('badgeText marks', () => {
  assert.equal(badgeText({ distance: 25, penalty: 0, outOfRange: false }), '25 ft · ✓');
  assert.equal(badgeText({ distance: 45, penalty: -2, outOfRange: false }), '45 ft · –2');
  assert.equal(badgeText({ distance: 200.4, penalty: null, outOfRange: true }), '200 ft · ✗');
});
```

`tests/theme.test.mjs`:
```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { PALETTES, bandStyle } from '../scripts/core/theme.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('base band is teal at 18%', () => {
  const s = bandStyle({ tone: 'base' });
  assert.equal(s.fill, PALETTES.default.ramp[0]);
  near(s.fillAlpha, 0.18);
  assert.equal(s.lineWidth, 2);
});

test('increments shift color and fade, clamped', () => {
  const s3 = bandStyle({ tone: 'increment', index: 3 });
  assert.equal(s3.fill, PALETTES.default.ramp[3]);
  near(s3.fillAlpha, 0.12);
  near(bandStyle({ tone: 'increment', index: 9 }).fillAlpha, 0.06);
  assert.equal(bandStyle({ tone: 'increment', index: 9 }).fill, PALETTES.default.ramp[5]);
});

test('reach, penalty zone, palette, preview, tint, opacity', () => {
  assert.equal(bandStyle({ tone: 'reach' }).fill, PALETTES.default.reach);
  assert.equal(bandStyle({ tone: 'penalty-zone' }).fill, PALETTES.default.penalty);
  assert.equal(bandStyle({ tone: 'base', palette: 'colorblind' }).fill, PALETTES.colorblind.ramp[0]);
  assert.equal(bandStyle({ tone: 'base', palette: 'missing' }).fill, PALETTES.default.ramp[0]);
  near(bandStyle({ tone: 'base', preview: true }).fillAlpha, 0.09);
  assert.ok(bandStyle({ tone: 'base', preview: true }).lineAlpha < bandStyle({ tone: 'base' }).lineAlpha);
  assert.equal(bandStyle({ tone: 'base', tint: 0xff0000 }).line, 0xff0000);
  near(bandStyle({ tone: 'base', opacity: 1.5 }).fillAlpha, 0.27);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `targets.mjs` / `theme.mjs`.

- [ ] **Step 3: Implement**

`scripts/core/targets.mjs`:
```js
/** Classify target tokens against a range spec. Pure — distance is computed by the caller. */
import { bandIndexFor, fmtPenalty } from './spec.mjs';

export function classifyTargets({ spec, targets }) {
  return targets.map(({ id, distance, blocked = false }) => {
    const index = Number.isFinite(distance) ? bandIndexFor(spec.bands, distance) : -1;
    const band = spec.bands[index];
    return {
      id, distance,
      bandIndex: band ? index : null,
      penalty: band ? band.penalty : null,
      outOfRange: !band,
      blocked: Boolean(blocked)
    };
  });
}

export function badgeText({ distance, penalty, outOfRange }) {
  const mark = outOfRange ? '✗' : penalty ? fmtPenalty(penalty) : '✓';
  return `${Math.round(distance)} ft · ${mark}`;
}
```

`scripts/core/theme.mjs`:
```js
/** Colors per semantic tone. Adapters never pick colors. Pure — no Foundry globals. */
export const PALETTES = {
  default: {
    ramp: [0x2ec4b6, 0x8ac926, 0xffca3a, 0xff924c, 0xe76f51, 0xb5432a],
    reach: 0x5b8def, penalty: 0xe63946, halo: 0x0b0f14, text: 0xf5f7fa
  },
  colorblind: {
    ramp: [0x0072b2, 0x56b4e9, 0x009e73, 0xf0e442, 0xe69f00, 0xd55e00],
    reach: 0xcc79a7, penalty: 0xd55e00, halo: 0x000000, text: 0xffffff
  }
};

const clamp01 = value => Math.min(1, Math.max(0, value));

export function bandStyle({ tone, index = 0, palette = 'default', opacity = 1, preview = false, tint = null }) {
  const colors = PALETTES[palette] ?? PALETTES.default;
  const color = tone === 'reach' ? colors.reach
    : tone === 'penalty-zone' ? colors.penalty
    : colors.ramp[Math.min(index, colors.ramp.length - 1)];
  const baseFill = tone === 'penalty-zone' ? 0.12 : Math.max(0.06, 0.18 - 0.02 * index);
  return {
    fill: color,
    line: tint ?? color,
    fillAlpha: clamp01(baseFill * opacity * (preview ? 0.5 : 1)),
    lineAlpha: clamp01((preview ? 0.6 : 0.95) * Math.min(1, opacity)),
    lineWidth: preview ? 1.5 : 2,
    halo: colors.halo,
    text: colors.text
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/core/targets.mjs scripts/core/theme.mjs tests/targets.test.mjs tests/theme.test.mjs
git commit -m "feat: target classification and band theme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: PF2e adapter — specs, measure, distance

**Files:**
- Create: `scripts/adapters/pf2e.mjs`
- Test: `tests/pf2e.test.mjs`

**Interfaces:**
- Consumes: `makeSpec`, `noneSpec`, `incrementBands`, `singleBand` (spec.mjs); `alternatingDistance` (cells.mjs).
- Produces (`scripts/adapters/pf2e.mjs`):
  - `specFor({ actor, item, actionIndex = null }) → RangeSpec`
  - `cellMeasure(spec, unit = 5) → (fromCell, toCell, band) → feet`
  - `distance(sourceToken, targetToken, spec) → feet`
  - `pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, rows: [] }` (`rows` filled in Task 10)

PF2e facts this task relies on (PF2e 8.6, `systems/pf2e/pf2e.mjs`): `WeaponPF2e#range` → `{ increment, max }` or `null` (melee without thrown); `WeaponPF2e#isMelee`; NPC `MeleePF2e` (`type: 'melee'`) has the same `range` / `isMelee`; `CreaturePF2e#getReach({ action: 'attack', weapon })` returns reach in feet including `reach`/`reach-N`; spells store raw range text in `system.range.value` (`"30 feet"`, `"touch"`, `"varies"`, `""`) and area in `system.area = { type, value }`; base reach at `actor.system.attributes.reach.base`; `TokenPF2e#distanceTo(target, { reach })`; character/NPC strikes at `actor.system.actions[i].item`.

- [ ] **Step 1: Write the failing tests** — `tests/pf2e.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { cellMeasure, distance, pf2eAdapter, specFor } from '../scripts/adapters/pf2e.mjs';

const weapon = (name, { melee = false, range = null, traits = [] } = {}) => ({ name, type: 'weapon', isMelee: melee, range, system: { traits: { value: traits } } });
const longbow = weapon('Longbow', { range: { increment: 100, max: 600 }, traits: ['deadly-d10', 'volley-30'] });
const javelin = weapon('Javelin', { range: { increment: 30, max: 180 }, traits: ['thrown'] });
const dagger = weapon('Dagger', { melee: true, range: { increment: 10, max: 60 }, traits: ['agile', 'thrown-10'] });
const whip = weapon('Whip', { melee: true, traits: ['reach', 'disarm'] });
const npcClaw = { name: 'Claw', type: 'melee', isMelee: true, range: null, system: { traits: { value: ['reach-15'] } } };
const spell = (name, range, area = null) => ({ name, type: 'spell', system: { range: { value: range }, area } });

const actor = {
  system: { attributes: { reach: { base: 5 } }, actions: [{ item: longbow }, { item: whip }] },
  getReach({ weapon: w } = {}) {
    const traits = w?.system?.traits?.value ?? [];
    const n = traits.map(t => t.match(/^reach-(\d+)$/)).find(Boolean);
    return n ? Number(n[1]) : traits.includes('reach') ? 10 : 5;
  }
};

test('longbow: six increments to 600 plus volley zone', () => {
  const spec = specFor({ actor, item: longbow });
  assert.equal(spec.kind, 'increments');
  assert.equal(spec.bands.length, 6);
  assert.equal(spec.bands.at(-1).max, 600);
  assert.equal(spec.bands.at(-1).penalty, -10);
  assert.deepEqual(spec.overlays, [{ min: 0, max: 30, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2' }]);
  assert.equal(spec.itemName, 'Longbow');
});

test('javelin: increments of 30', () => {
  const spec = specFor({ actor, item: javelin });
  assert.deepEqual(spec.bands.map(b => b.max), [30, 60, 90, 120, 150, 180]);
  assert.deepEqual(spec.overlays, []);
});

test('dagger: thrown increments plus reach overlay', () => {
  const spec = specFor({ actor, item: dagger });
  assert.equal(spec.kind, 'increments');
  assert.equal(spec.bands[0].max, 10);
  assert.deepEqual(spec.overlays, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }]);
});

test('whip and NPC reach', () => {
  assert.deepEqual(specFor({ actor, item: whip }).bands, [{ min: 0, max: 10, penalty: 0, tone: 'reach', label: 'Reach 10 ft' }]);
  const claw = specFor({ actor, item: npcClaw });
  assert.equal(claw.kind, 'reach');
  assert.equal(claw.bands[0].max, 15);
});

test('actionIndex resolves the strike item', () => {
  assert.equal(specFor({ actor, item: null, actionIndex: 1 }).itemName, 'Whip');
  assert.equal(specFor({ actor, item: null, actionIndex: 0 }).kind, 'increments');
});

test('spells', () => {
  assert.deepEqual(specFor({ actor, item: spell('Shocking Grasp', 'touch') }).bands, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Touch · 5 ft' }]);
  assert.deepEqual(specFor({ actor, item: spell('Electric Arc', '30 feet') }).bands, [{ min: 0, max: 30, penalty: 0, tone: 'base', label: '30 ft' }]);
  assert.deepEqual(specFor({ actor, item: spell('Heroism', '120 ft.') }).bands[0].max, 120);
  const aura = specFor({ actor, item: spell('Bless', '', { type: 'emanation', value: 15 }) });
  assert.equal(aura.kind, 'radius');
  assert.equal(aura.bands[0].label, 'Emanation 15 ft');
  const varies = specFor({ actor, item: spell('Wish', 'varies') });
  assert.equal(varies.kind, 'none');
  assert.equal(varies.note, 'Range: varies');
  const self = specFor({ actor, item: spell('Shield', '') });
  assert.equal(self.kind, 'none');
  assert.equal(self.note, null);
});

test('other item types and missing items have no range', () => {
  assert.equal(specFor({ actor, item: { name: 'Rope', type: 'equipment', system: {} } }).kind, 'none');
  assert.equal(specFor({ actor, item: null }).kind, 'none');
});

test('cellMeasure: reach 10 counts the 15 ft double diagonal as 10', () => {
  const reachSpec = specFor({ actor, item: whip });
  const m = cellMeasure(reachSpec, 5);
  assert.equal(m({ i: 0, j: 0 }, { i: 2, j: 2 }, reachSpec.bands[0]), 10);
  assert.equal(m({ i: 0, j: 0 }, { i: 2, j: 1 }, reachSpec.bands[0]), 10);
  const bowSpec = specFor({ actor, item: longbow });
  assert.equal(cellMeasure(bowSpec, 5)({ i: 0, j: 0 }, { i: 2, j: 2 }, bowSpec.bands[0]), 15);
});

test('distance uses TokenPF2e#distanceTo with reach for reach specs', () => {
  const calls = [];
  const source = { distanceTo: (target, options) => { calls.push(options); return 10; } };
  assert.equal(distance(source, {}, specFor({ actor, item: whip })), 10);
  assert.deepEqual(calls[0], { reach: 10 });
  distance(source, {}, specFor({ actor, item: longbow }));
  assert.deepEqual(calls[1], {});
  assert.ok(Number.isNaN(distance({}, {}, specFor({ actor, item: whip }))));
});

test('adapter object', () => {
  assert.equal(pf2eAdapter.id, 'pf2e');
  assert.equal(pf2eAdapter.specFor, specFor);
  assert.ok(Array.isArray(pf2eAdapter.rows));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scripts/adapters/pf2e.mjs`.

- [ ] **Step 3: Implement** — `scripts/adapters/pf2e.mjs`:

```js
/** PF2e adapter: item → RangeSpec, PF2e measuring rules, token distance. */
import { alternatingDistance } from '../core/cells.mjs';
import { incrementBands, makeSpec, noneSpec, singleBand } from '../core/spec.mjs';

const sluggify = text => String(text ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const traitsOf = item => item?.system?.traits?.value ?? [];
function traitNumber(item, slug) {
  for (const trait of traitsOf(item)) {
    const match = String(trait).match(new RegExp(`^${slug}-(\\d+)$`));
    if (match) return Number(match[1]);
  }
  return null;
}

function weaponSpec(actor, item) {
  const name = item.name ?? '';
  const range = item.range ?? null;
  const overlays = [];
  const volley = traitNumber(item, 'volley');
  if (volley) overlays.push({ min: 0, max: volley, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2' });
  const melee = item.isMelee ?? !range;
  const increments = range?.increment ? incrementBands(range.increment, range.max ?? range.increment * 6) : null;
  if (melee) {
    const reach = actor?.getReach?.({ action: 'attack', weapon: item }) ?? 5;
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ft` };
    if (increments?.length) return makeSpec({ kind: 'increments', bands: increments, overlays: [reachBand, ...overlays], itemName: name });
    return makeSpec({ kind: 'reach', bands: [reachBand], overlays, itemName: name });
  }
  if (increments?.length) return makeSpec({ kind: 'increments', bands: increments, overlays, itemName: name });
  if (range?.max > 0) return makeSpec({ kind: 'radius', bands: singleBand(range.max), overlays, itemName: name });
  return noneSpec('Range: —', name);
}

function spellSpec(actor, spell) {
  const name = spell.name ?? '';
  const raw = String(spell.system?.range?.value ?? '').trim();
  const slug = sluggify(raw);
  if (slug === 'touch') {
    const reach = actor?.system?.attributes?.reach?.base ?? 5;
    return makeSpec({ kind: 'reach', bands: singleBand(reach, 'reach', `Touch · ${reach} ft`), itemName: name });
  }
  const feet = slug.match(/^(\d+)-f(?:ee)?t\b/);
  if (feet) return makeSpec({ kind: 'radius', bands: singleBand(Number(feet[1])), itemName: name });
  const area = spell.system?.area;
  if (!raw && area?.type === 'emanation' && Number(area.value) > 0) {
    return makeSpec({ kind: 'radius', bands: singleBand(Number(area.value), 'base', `Emanation ${Number(area.value)} ft`), itemName: name });
  }
  return noneSpec(raw ? `Range: ${raw}` : null, name);
}

export function specFor({ actor, item, actionIndex = null }) {
  if (actionIndex !== null && actionIndex !== undefined) item = actor?.system?.actions?.[actionIndex]?.item ?? item;
  if (!item) return noneSpec();
  if (item.type === 'spell') return spellSpec(actor, item);
  if (item.type === 'weapon' || item.type === 'melee') return weaponSpec(actor, item);
  return noneSpec(null, item.name ?? '');
}

/** PF2e: alternating diagonals; reach exactly 10 also covers the 15 ft double diagonal. */
export function cellMeasure(_spec, unit = 5) {
  return (from, to, band) => {
    if (band?.tone === 'reach' && band.max === 10 && Math.abs(from.i - to.i) === 2 && Math.abs(from.j - to.j) === 2) return 10;
    return alternatingDistance(from, to, unit);
  };
}

export function distance(source, target, spec) {
  if (typeof source?.distanceTo !== 'function') return NaN;
  const options = spec?.kind === 'reach' ? { reach: spec.bands[0].max } : {};
  return source.distanceTo(target, options);
}

export const pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, rows: [] };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e.mjs tests/pf2e.test.mjs
git commit -m "feat: PF2e range adapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Generic adapter + registry

**Files:**
- Create: `scripts/adapters/generic.mjs`, `scripts/adapters/index.mjs`
- Test: `tests/adapters.test.mjs`

**Interfaces:**
- Consumes: `makeSpec`, `noneSpec`, `singleBand` (spec.mjs); `alternatingDistance` (cells.mjs); `pf2eAdapter` (Task 5).
- Produces:
  - `genericAdapter = { id: 'generic', specFor, cellMeasure, distance, rows: [] }`; `specFor({ item })` reads `item.system.range` as a number or `{ value, long }`; `distance(source, target)` uses `canvas.grid.measurePath` at runtime and returns `NaN` without a canvas.
  - `getAdapter(systemId) → adapter` (`pf2e`, `sf2e` → pf2e adapter; anything else → generic, or a registered adapter)
  - `registerAdapter(systemId, adapter)` for other modules

- [ ] **Step 1: Write the failing tests** — `tests/adapters.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { genericAdapter } from '../scripts/adapters/generic.mjs';
import { getAdapter, registerAdapter } from '../scripts/adapters/index.mjs';
import { pf2eAdapter } from '../scripts/adapters/pf2e.mjs';

test('generic reads numeric range', () => {
  const spec = genericAdapter.specFor({ item: { name: 'Sling', system: { range: 30 } } });
  assert.equal(spec.kind, 'radius');
  assert.equal(spec.bands[0].max, 30);
});

test('generic reads normal/long range', () => {
  const spec = genericAdapter.specFor({ item: { name: 'Longbow', system: { range: { value: 150, long: 600 } } } });
  assert.deepEqual(spec.bands.map(b => [b.min, b.max, b.tone]), [[0, 150, 'base'], [150, 600, 'increment']]);
  assert.equal(spec.bands[1].label, '600 ft · long');
});

test('generic: no range → none', () => {
  assert.equal(genericAdapter.specFor({ item: { name: 'Rope', system: {} } }).kind, 'none');
  assert.equal(genericAdapter.specFor({ item: null }).kind, 'none');
  assert.ok(Number.isNaN(genericAdapter.distance({}, {})));
});

test('registry', () => {
  assert.equal(getAdapter('pf2e'), pf2eAdapter);
  assert.equal(getAdapter('sf2e'), pf2eAdapter);
  assert.equal(getAdapter('dnd5e'), genericAdapter);
  const custom = { id: 'x', specFor: () => null, cellMeasure: () => () => 0, distance: () => 0, rows: [] };
  registerAdapter('custom-system', custom);
  assert.equal(getAdapter('custom-system'), custom);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `generic.mjs` / `index.mjs`.

- [ ] **Step 3: Implement**

`scripts/adapters/generic.mjs`:
```js
/** Fallback adapter: reads a plain range number (or {value, long}) from item.system.range. */
import { alternatingDistance } from '../core/cells.mjs';
import { makeSpec, noneSpec, singleBand } from '../core/spec.mjs';

function specFor({ item }) {
  if (!item) return noneSpec();
  const name = item.name ?? '';
  const range = item.system?.range;
  const value = typeof range === 'number' ? range : Number(range?.value) || 0;
  const long = typeof range === 'object' && range ? Number(range.long) || 0 : 0;
  if (!(value > 0)) return noneSpec(null, name);
  const bands = singleBand(value);
  if (long > value) bands.push({ min: value, max: long, penalty: 0, tone: 'increment', label: `${long} ft · long` });
  return makeSpec({ kind: long > value ? 'increments' : 'radius', bands, itemName: name });
}

const cellMeasure = (_spec, unit = 5) => (from, to) => alternatingDistance(from, to, unit);

function distance(source, target) {
  const grid = globalThis.canvas?.grid;
  if (!grid?.measurePath || !source?.center || !target?.center) return NaN;
  return grid.measurePath([source.center, target.center]).distance;
}

export const genericAdapter = { id: 'generic', specFor, cellMeasure, distance, rows: [] };
```

`scripts/adapters/index.mjs`:
```js
import { genericAdapter } from './generic.mjs';
import { pf2eAdapter } from './pf2e.mjs';

const adapters = new Map([['pf2e', pf2eAdapter], ['sf2e', pf2eAdapter]]);

export function registerAdapter(systemId, adapter) {
  adapters.set(systemId, adapter);
}

export function getAdapter(systemId) {
  return adapters.get(systemId) ?? genericAdapter;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/generic.mjs scripts/adapters/index.mjs tests/adapters.test.mjs
git commit -m "feat: generic adapter and adapter registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: PinManager

**Files:**
- Create: `scripts/ui/PinManager.mjs`
- Test: `tests/pins.test.mjs`

**Interfaces:**
- Consumes: `hasRange` (spec.mjs). A `ghost` object with `hold(el, { sticky })`, `release(el, { sticky })` (Task 8 implements it; tests use a fake).
- Produces (`scripts/ui/PinManager.mjs`):
  - `new PinManager({ userId, build, onChange, broadcast, allowShare, ghost })` where `build({ tokenId, itemUuid, actionIndex }) → RangeSpec | null`
  - `Pin = { key, userId, tokenId, itemUuid, actionIndex, spec, shared, preview, sourceEl }`
  - `PinManager.key(userId, tokenId)`; getters `size`, `previewing`
  - `all() → Pin[]` (pins then preview), `tokenIds() → Set`, `pinFor({ tokenId, itemUuid, actionIndex }) → Pin | null` (own pins only)
  - `toggle({ tokenId, itemUuid, actionIndex, share, sourceEl }) → 'pinned' | 'unpinned' | 'unavailable'`
  - `preview({ tokenId, itemUuid, actionIndex, sourceEl }) → boolean`, `endPreview() → boolean`
  - `receive(message)` — socket messages `{ action: 'pin'|'unpin'|'clearAll', userId, tokenId?, itemUuid?, actionIndex? }`
  - `clearLocal() → boolean`, `clearShared()`, `dropToken(tokenId)`, `dropItem(itemUuid)`, `rebuild()`, `reset()`

- [ ] **Step 1: Write the failing tests** — `tests/pins.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { PinManager } from '../scripts/ui/PinManager.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ specs = {}, allowShare = true } = {}) {
  const sent = [], ghostLog = [];
  let changes = 0;
  const lookup = { 'Item.bow': makeSpec({ kind: 'radius', bands: singleBand(60) }), 'Item.sword': makeSpec({ kind: 'reach', bands: singleBand(5, 'reach', 'Reach 5 ft') }), 'Item.wish': noneSpec('Range: varies'), ...specs };
  const pins = new PinManager({
    userId: 'me',
    build: ({ itemUuid }) => lookup[itemUuid] ?? null,
    onChange: () => { changes++; },
    broadcast: message => sent.push(message),
    allowShare: () => allowShare,
    ghost: { hold: (el, o) => ghostLog.push(['hold', el, o.sticky]), release: (el, o) => ghostLog.push(['release', el, o.sticky]) }
  });
  return { pins, sent, ghostLog, lookup, changes: () => changes };
}

test('toggle pins, replaces and unpins; ghost held and released', () => {
  const { pins, ghostLog } = setup();
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'sheet' }), 'pinned');
  assert.ok(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null }));
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' }), 'pinned');
  assert.equal(pins.size, 1);
  assert.equal(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow' }), null);
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' }), 'unpinned');
  assert.equal(pins.size, 0);
  assert.deepEqual(ghostLog, [['hold', 'sheet', true], ['release', 'sheet', true], ['hold', 'sheet', true], ['release', 'sheet', true]]);
});

test('no range → unavailable', () => {
  const { pins } = setup();
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.wish' }), 'unavailable');
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.missing' }), 'unavailable');
});

test('actionIndex distinguishes strikes of the same item', () => {
  const { pins } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0 });
  assert.ok(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0 }));
  assert.equal(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 1 }), null);
});

test('sharing broadcasts pin and unpin; disabled sharing stays local', () => {
  const { pins, sent } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true });
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.deepEqual(sent, [
    { action: 'pin', userId: 'me', tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null },
    { action: 'unpin', userId: 'me', tokenId: 't1' }
  ]);
  const off = setup({ allowShare: false });
  off.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true });
  assert.deepEqual(off.sent, []);
  assert.equal(off.pins.all()[0].shared, false);
});

test('receive builds remote pins; ignores own echo; clearAll removes shared', () => {
  const { pins } = setup();
  pins.receive({ action: 'pin', userId: 'me', tokenId: 't9', itemUuid: 'Item.bow' });
  assert.equal(pins.size, 0);
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow', actionIndex: null });
  assert.equal(pins.all()[0].shared, true);
  assert.equal(pins.all()[0].userId, 'ally');
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword' });
  pins.receive({ action: 'clearAll', userId: 'gm' });
  assert.deepEqual(pins.all().map(p => p.itemUuid), ['Item.sword']);
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  pins.receive({ action: 'unpin', userId: 'ally', tokenId: 't2' });
  assert.equal(pins.size, 1);
});

test('preview: one at a time, separate from pins, non-sticky ghost', () => {
  const { pins, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.equal(pins.preview({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'hud' }), true);
  assert.equal(pins.preview({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'hud' }), false);
  assert.equal(pins.previewing, true);
  assert.equal(pins.all().length, 2);
  assert.equal(pins.all()[1].preview, true);
  assert.equal(pins.endPreview(), true);
  assert.equal(pins.endPreview(), false);
  assert.deepEqual(ghostLog.slice(-2), [['hold', 'hud', false], ['release', 'hud', false]]);
});

test('clearLocal clears own pins and preview, keeps remote', () => {
  const { pins } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  pins.preview({ tokenId: 't1', itemUuid: 'Item.sword' });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  assert.equal(pins.clearLocal(), true);
  assert.deepEqual(pins.all().map(p => p.userId), ['ally']);
  assert.equal(pins.clearLocal(), false);
});

test('clearShared broadcasts and drops shared pins', () => {
  const { pins, sent } = setup();
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  pins.clearShared();
  assert.equal(pins.size, 0);
  assert.deepEqual(sent.at(0), { action: 'clearAll', userId: 'me' });
});

test('dropToken / dropItem release ghosts (Review Focus 4)', () => {
  const { pins, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'sheet' });
  pins.preview({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' });
  pins.dropToken('t1');
  assert.equal(pins.size, 0);
  assert.equal(ghostLog.filter(e => e[0] === 'release').length, 2);
  pins.toggle({ tokenId: 't3', itemUuid: 'Item.sword' });
  pins.dropItem('Item.sword');
  assert.equal(pins.size, 0);
});

test('rebuild refreshes specs and drops pins whose item lost its range (Review Focus 5)', () => {
  const { pins, lookup } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  pins.toggle({ tokenId: 't2', itemUuid: 'Item.sword' });
  lookup['Item.bow'] = makeSpec({ kind: 'radius', bands: singleBand(90) });
  delete lookup['Item.sword'];
  pins.rebuild();
  assert.equal(pins.size, 1);
  assert.equal(pins.all()[0].spec.bands[0].max, 90);
});

test('reset clears everything without broadcasting', () => {
  const { pins, sent, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true, sourceEl: 'sheet' });
  sent.length = 0;
  pins.reset();
  assert.equal(pins.size, 0);
  assert.deepEqual(sent, []);
  assert.deepEqual(ghostLog.at(-1), ['release', 'sheet', true]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scripts/ui/PinManager.mjs`.

- [ ] **Step 3: Implement** — `scripts/ui/PinManager.mjs`:

```js
/** Pinned and previewed ranges for this client, plus shared pins from other users. */
import { hasRange } from '../core/spec.mjs';

const same = (a, b) => a.itemUuid === b.itemUuid && (a.actionIndex ?? null) === (b.actionIndex ?? null);

export class PinManager {
  #pins = new Map();
  #preview = null;

  constructor({ userId, build, onChange = () => {}, broadcast = () => {}, allowShare = () => true, ghost = null }) {
    Object.assign(this, { userId, build, onChange, broadcast, allowShare, ghost });
  }

  static key(userId, tokenId) { return `${userId}:${tokenId}`; }

  get size() { return this.#pins.size + (this.#preview ? 1 : 0); }
  get previewing() { return Boolean(this.#preview); }

  all() { return [...this.#pins.values(), ...(this.#preview ? [this.#preview] : [])]; }
  tokenIds() { return new Set(this.all().map(pin => pin.tokenId)); }

  pinFor(request) {
    const pin = this.#pins.get(PinManager.key(this.userId, request.tokenId));
    return pin && same(pin, request) ? pin : null;
  }

  #spec(request) {
    const spec = this.build({ tokenId: request.tokenId, itemUuid: request.itemUuid, actionIndex: request.actionIndex ?? null });
    return hasRange(spec) ? spec : null;
  }

  toggle({ tokenId, itemUuid, actionIndex = null, share = false, sourceEl = null }) {
    const key = PinManager.key(this.userId, tokenId);
    const request = { tokenId, itemUuid, actionIndex };
    const existing = this.#pins.get(key);
    if (existing && same(existing, request)) { this.#remove(key); return 'unpinned'; }
    const spec = this.#spec(request);
    if (!spec) return 'unavailable';
    if (existing) this.#remove(key, false);
    const shared = Boolean(share && this.allowShare());
    this.#pins.set(key, { key, userId: this.userId, ...request, spec, shared, preview: false, sourceEl });
    this.ghost?.hold(sourceEl, { sticky: true });
    if (shared) this.broadcast({ action: 'pin', userId: this.userId, ...request });
    this.onChange();
    return 'pinned';
  }

  #remove(key, notify = true) {
    const pin = this.#pins.get(key);
    if (!pin) return false;
    this.#pins.delete(key);
    this.ghost?.release(pin.sourceEl, { sticky: true });
    if (pin.shared && pin.userId === this.userId) this.broadcast({ action: 'unpin', userId: this.userId, tokenId: pin.tokenId });
    if (notify) this.onChange();
    return true;
  }

  preview({ tokenId, itemUuid, actionIndex = null, sourceEl = null }) {
    if (this.#preview) return false;
    const request = { tokenId, itemUuid, actionIndex };
    const spec = this.#spec(request);
    if (!spec) return false;
    this.#preview = { key: `preview:${tokenId}`, userId: this.userId, ...request, spec, shared: false, preview: true, sourceEl };
    this.ghost?.hold(sourceEl, { sticky: false });
    this.onChange();
    return true;
  }

  #dropPreview() {
    const preview = this.#preview;
    if (!preview) return false;
    this.#preview = null;
    this.ghost?.release(preview.sourceEl, { sticky: false });
    return true;
  }

  endPreview() {
    if (!this.#dropPreview()) return false;
    this.onChange();
    return true;
  }

  receive(message) {
    if (!message || message.userId === this.userId) return;
    if (message.action === 'clearAll') {
      let changed = false;
      for (const [key, pin] of [...this.#pins]) {
        if (!pin.shared) continue;
        this.#pins.delete(key);
        this.ghost?.release(pin.sourceEl, { sticky: true });
        changed = true;
      }
      if (changed) this.onChange();
      return;
    }
    const key = PinManager.key(message.userId, message.tokenId);
    if (message.action === 'unpin') {
      if (this.#pins.delete(key)) this.onChange();
      return;
    }
    if (message.action !== 'pin') return;
    const request = { tokenId: message.tokenId, itemUuid: message.itemUuid, actionIndex: message.actionIndex ?? null };
    const spec = this.#spec(request);
    if (!spec) return;
    this.#pins.set(key, { key, userId: message.userId, ...request, spec, shared: true, preview: false, sourceEl: null });
    this.onChange();
  }

  clearLocal() {
    let had = this.#dropPreview();
    for (const [key, pin] of [...this.#pins]) if (pin.userId === this.userId) had = this.#remove(key, false) || had;
    if (had) this.onChange();
    return had;
  }

  clearShared() {
    this.broadcast({ action: 'clearAll', userId: this.userId });
    let changed = false;
    for (const [key, pin] of [...this.#pins]) if (pin.shared) changed = this.#remove(key, false) || changed;
    if (changed) this.onChange();
  }

  #dropWhere(test) {
    let changed = false;
    if (this.#preview && test(this.#preview)) changed = this.#dropPreview();
    for (const [key, pin] of [...this.#pins]) if (test(pin)) changed = this.#remove(key, false) || changed;
    if (changed) this.onChange();
  }

  dropToken(tokenId) { this.#dropWhere(pin => pin.tokenId === tokenId); }
  dropItem(itemUuid) { this.#dropWhere(pin => pin.itemUuid === itemUuid); }

  rebuild() {
    let changed = false;
    for (const [key, pin] of [...this.#pins]) {
      const spec = this.#spec(pin);
      if (!spec) changed = this.#remove(key, false) || changed;
      else if (spec !== pin.spec) { pin.spec = spec; changed = true; }
    }
    if (this.#preview) {
      const spec = this.#spec(this.#preview);
      if (!spec) changed = this.#dropPreview() || changed;
      else if (spec !== this.#preview.spec) { this.#preview.spec = spec; changed = true; }
    }
    if (changed) this.onChange();
  }

  /** Scene teardown: drop everything locally, broadcast nothing. */
  reset() {
    for (const pin of this.all()) this.ghost?.release(pin.sourceEl, { sticky: !pin.preview });
    this.#pins.clear();
    this.#preview = null;
    this.onChange();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/PinManager.mjs tests/pins.test.mjs
git commit -m "feat: pin and preview state with sharing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Window ghosting

**Files:**
- Create: `scripts/ui/Ghost.mjs`
- Test: `tests/ghost.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks (PinManager calls it).
- Produces (`scripts/ui/Ghost.mjs`):
  - `GHOST_CLASS = 'range-finder-ghost'`, `GHOSTABLE_CLASS = 'range-finder-ghostable'` (CSS from Task 1)
  - `new Ghost({ mode: () => 'fade'|'minimize'|'off', doc, appFor: el => app|null })`
  - `hold(el, { sticky })`, `release(el, { sticky })`, `releaseAll()`, `isGhosted(el) → boolean`, `onMove(event)` (bound; registered on `doc` `pointermove` while anything is held)
  - Rules: counts pins (`sticky: true`) and previews separately per element; fade mode adds both classes; minimize mode calls `app.minimize()` once and `app.maximize()` on final release; hover-restore (cursor inside the element's rect removes `GHOST_CLASS`, outside re-adds) applies only to fade-mode elements with no active preview.

- [ ] **Step 1: Write the failing tests** — `tests/ghost.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { GHOST_CLASS, GHOSTABLE_CLASS, Ghost } from '../scripts/ui/Ghost.mjs';

function element(rect = { left: 0, top: 0, right: 100, bottom: 100 }) {
  const classes = new Set();
  return {
    isConnected: true,
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
      contains: name => classes.has(name)
    },
    getBoundingClientRect: () => rect
  };
}
function doc() {
  const listeners = new Map();
  return { listeners, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
}

test('fade: hold adds classes, release removes ghost', () => {
  const d = doc(), el = element(), ghost = new Ghost({ doc: d });
  ghost.hold(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  assert.ok(el.classList.contains(GHOSTABLE_CLASS));
  assert.ok(d.listeners.has('pointermove'));
  ghost.release(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  assert.ok(!d.listeners.has('pointermove'));
});

test('counts holds per element', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!ghost.isGhosted(el));
});

test('hover restores a pinned window; leaving re-ghosts it', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.onMove({ clientX: 50, clientY: 50 });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.onMove({ clientX: 500, clientY: 50 });
  assert.ok(el.classList.contains(GHOST_CLASS));
});

test('no hover restore while a preview is active', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.onMove({ clientX: 50, clientY: 50 });
  assert.ok(el.classList.contains(GHOST_CLASS));
});

test('minimize mode', () => {
  const calls = [];
  const app = { minimized: false, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, ['min', 'max']);
  assert.ok(!el.classList.contains(GHOST_CLASS));
});

test('minimize mode leaves an already minimized window alone', () => {
  const calls = [];
  const app = { minimized: true, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, []);
});

test('off mode and null elements are no-ops', () => {
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'off' });
  ghost.hold(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.hold(null, { sticky: true });
  ghost.release(null, { sticky: true });
});

test('releaseAll restores everything and forgets disconnected elements', () => {
  const d = doc(), a = element(), b = element(), ghost = new Ghost({ doc: d });
  ghost.hold(a, { sticky: true });
  ghost.hold(b, { sticky: true });
  b.isConnected = false;
  ghost.onMove({ clientX: 500, clientY: 500 });
  assert.ok(!ghost.isGhosted(b));
  ghost.releaseAll();
  assert.ok(!a.classList.contains(GHOST_CLASS));
  assert.ok(!d.listeners.has('pointermove'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scripts/ui/Ghost.mjs`.

- [ ] **Step 3: Implement** — `scripts/ui/Ghost.mjs`:

```js
/** Fade (or minimize) the window a range was shown from, so the canvas underneath is visible. */
export const GHOST_CLASS = 'range-finder-ghost';
export const GHOSTABLE_CLASS = 'range-finder-ghostable';

export class Ghost {
  #held = new Map();
  #listening = false;

  constructor({ mode = () => 'fade', doc = globalThis.document, appFor = () => null } = {}) {
    Object.assign(this, { mode, doc, appFor });
    this.onMove = this.onMove.bind(this);
  }

  hold(el, { sticky = false } = {}) {
    if (!el) return;
    let entry = this.#held.get(el);
    if (!entry) {
      const mode = this.mode();
      if (mode === 'off') return;
      entry = { pins: 0, previews: 0, app: null };
      if (mode === 'minimize') {
        const app = this.appFor(el);
        if (app && !app.minimized) { entry.app = app; app.minimize?.(); }
      } else {
        el.classList.add(GHOSTABLE_CLASS, GHOST_CLASS);
      }
      this.#held.set(el, entry);
    }
    if (sticky) entry.pins++;
    else entry.previews++;
    this.#listen();
  }

  release(el, { sticky = false } = {}) {
    const entry = el ? this.#held.get(el) : null;
    if (!entry) return;
    if (sticky) entry.pins = Math.max(0, entry.pins - 1);
    else entry.previews = Math.max(0, entry.previews - 1);
    if (entry.pins + entry.previews > 0) return;
    this.#restore(el, entry);
    this.#held.delete(el);
    if (!this.#held.size) this.#unlisten();
  }

  releaseAll() {
    for (const [el, entry] of this.#held) this.#restore(el, entry);
    this.#held.clear();
    this.#unlisten();
  }

  isGhosted(el) { return this.#held.has(el); }

  onMove(event) {
    for (const [el, entry] of this.#held) {
      if (!el.isConnected) { this.#held.delete(el); continue; }
      if (entry.app || entry.previews > 0) continue;
      const rect = el.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      el.classList.toggle(GHOST_CLASS, !inside);
    }
    if (!this.#held.size) this.#unlisten();
  }

  #restore(el, entry) {
    el.classList.remove(GHOST_CLASS);
    if (entry.app) entry.app.maximize?.();
  }

  #listen() {
    if (this.#listening || !this.doc) return;
    this.doc.addEventListener('pointermove', this.onMove, { passive: true });
    this.#listening = true;
  }

  #unlisten() {
    if (!this.#listening) return;
    this.doc.removeEventListener('pointermove', this.onMove);
    this.#listening = false;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/Ghost.mjs tests/ghost.test.mjs
git commit -m "feat: ghost source windows while a range is shown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Canvas overlay, badges, scene geometry

**Files:**
- Create: `scripts/canvas/geometry.mjs`, `scripts/canvas/RangeOverlay.mjs`, `scripts/canvas/TargetBadges.mjs`
- Test: `tests/canvas.test.mjs`, helper `tests/fake-pixi.mjs`

**Interfaces:**
- Consumes: `bandCells` (cells.mjs), `outline`, `rowRuns`, `topRightPoint` (outline.mjs), `bandStyle` (theme.mjs), `classifyTargets`, `badgeText` (targets.mjs), adapter `cellMeasure`/`distance` (Task 5/6), `Pin` (Task 7).
- Produces:
  - `sceneGeometry(canvas) → Geo` where `Geo = { isSquare, size, unit, bounds: { rows, cols }, pxPerFoot, topLeft(i, j) → {x,y}, originCells(token) → Cell[], center(token) → {x,y}, tokenRadius(token) → px, losFor(token) → { cell(Cell) → blocked:boolean, point({x,y}) → blocked:boolean } }`
  - `makeText(text, style) → PIXI display object` (Foundry `PreciseText`)
  - `Entry = { pin: Pin, token, adapter, tint: number|null, ownerName: string|null }`
  - `new RangeOverlay({ parent, PIXI, makeText, settings: () => Settings })` with `draw(entries, geo)`, `destroy()`
  - `new TargetBadges({ parent, PIXI, makeText, settings })` with `draw(entries, { targets, zoom, blockedFor(entry, targetToken) → boolean })`, `destroy()`
  - `Settings` = the object returned by `readSettings()` in Task 11 (`bandStyle`, `bandOpacity`, `showLabels`, `badgeScale`, `palette`, `dimBehindWalls`, …)

Foundry facts (verify in `C:/Program Files/Foundry Virtual Tabletop/resources/app/client` before relying on them, adjust and note in your report if different): `canvas.grid.getTopLeftPoint({i,j})`, `canvas.grid.getCenterPoint({i,j})`, `canvas.grid.isSquare`, `canvas.grid.size`, `canvas.grid.distance`; `canvas.dimensions.rows/columns/size/distance`; `TokenDocument#getOccupiedGridSpaceOffsets()`; `CONFIG.Canvas.polygonBackends.sight.create(origin, { type: 'sight' })` returns a polygon with `contains(x, y)`; `foundry.canvas.containers.PreciseText` and its static `getTextStyle(options)`; `canvas.interface.grid` is the grid layer (bands go there, beneath tokens); `canvas.interface` hosts badges above tokens. Font Awesome family name for PIXI text: check Foundry's `css/` (`--font-awesome` variable) — use it for the eye-slash glyph `\uf070`.

- [ ] **Step 1: Write the fake PIXI helper** — `tests/fake-pixi.mjs`:

```js
/** Minimal PIXI stand-in: records Graphics calls, tracks children and destruction. */
export class Container {
  constructor() { this.children = []; this.destroyed = false; this.alpha = 1; this.width = 40; this.height = 16; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set: s => { this.scale.value = s; } }; }
  addChild(...children) { this.children.push(...children); return children[0]; }
  removeChildren() { const old = this.children; this.children = []; return old; }
  destroy() { this.destroyed = true; }
}
export function makeGraphicsClass(log) {
  return class Graphics extends Container {
    constructor() {
      super();
      return new Proxy(this, {
        get(target, key) {
          if (key in target) return target[key];
          return (...args) => { log.push([key, ...args]); return target; };
        }
      });
    }
  };
}
export function fakePIXI() {
  const log = [];
  return { log, PIXI: { Container, Graphics: makeGraphicsClass(log) } };
}
export function fakeGeo({ isSquare = true } = {}) {
  return {
    isSquare, size: 100, unit: 5, bounds: { rows: 50, cols: 50 }, pxPerFoot: 20,
    topLeft: (i, j) => ({ x: j * 100, y: i * 100 }),
    originCells: token => token.cells,
    center: token => token.center,
    tokenRadius: () => 50,
    losFor: () => ({ cell: c => c.j > 12, point: p => p.x > 1200 })
  };
}
export const baseSettings = { bandStyle: 'both', bandOpacity: 1, showLabels: true, badgeScale: 1, palette: 'default', dimBehindWalls: false };
```

- [ ] **Step 2: Write the failing tests** — `tests/canvas.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { RangeOverlay } from '../scripts/canvas/RangeOverlay.mjs';
import { TargetBadges } from '../scripts/canvas/TargetBadges.mjs';
import { pf2eAdapter } from '../scripts/adapters/pf2e.mjs';
import { incrementBands, makeSpec, singleBand } from '../scripts/core/spec.mjs';
import { Container, baseSettings, fakeGeo, fakePIXI } from './fake-pixi.mjs';

const token = { id: 'src', cells: [{ i: 10, j: 10 }], center: { x: 1050, y: 1050 }, x: 1000, y: 1000, w: 100, h: 100 };
const pin = (spec, extra = {}) => ({ key: 'me:src', userId: 'me', tokenId: 'src', itemUuid: 'Item.x', actionIndex: null, spec, shared: false, preview: false, sourceEl: null, ...extra });
const reach = makeSpec({ kind: 'reach', bands: singleBand(5, 'reach', 'Reach 5 ft'), itemName: 'Sword' });
const javelin = makeSpec({ kind: 'increments', bands: incrementBands(30), itemName: 'Javelin' });

function overlay(settings = baseSettings) {
  const { log, PIXI } = fakePIXI();
  const texts = [];
  const parent = new Container();
  const o = new RangeOverlay({ parent, PIXI, makeText: (text) => { texts.push(text); return new Container(); }, settings: () => settings });
  return { o, log, texts, parent };
}

test('square grid: fills runs, strokes outline, labels band', () => {
  const { o, log, texts } = overlay();
  o.draw([{ pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo());
  assert.ok(log.some(c => c[0] === 'drawRect'));
  assert.ok(log.some(c => c[0] === 'lineTo'));
  assert.deepEqual(texts, ['Reach 5 ft']);
});

test('outline-only style skips fills; labels can be hidden', () => {
  const { o, log, texts } = overlay({ ...baseSettings, bandStyle: 'outline', showLabels: false });
  o.draw([{ pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo());
  assert.ok(!log.some(c => c[0] === 'drawRect'));
  assert.deepEqual(texts, []);
});

test('redraw destroys previous layers; empty draw clears', () => {
  const { o } = overlay();
  o.draw([{ pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo());
  const first = o.container.children[0];
  o.draw([], fakeGeo());
  assert.equal(first.destroyed, true);
  assert.equal(o.container.children.length, 0);
});

test('shared pin shows owner label', () => {
  const { o, texts } = overlay();
  o.draw([{ pin: pin(reach, { shared: true, userId: 'ally' }), token, adapter: pf2eAdapter, tint: 0xff0000, ownerName: 'Valeros' }], fakeGeo());
  assert.ok(texts.includes('Valeros — Sword'));
});

test('gridless/hex: rings with holes', () => {
  const { o, log } = overlay();
  o.draw([{ pin: pin(javelin), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo({ isSquare: false }));
  assert.equal(log.filter(c => c[0] === 'drawCircle').length >= 6, true);
  assert.ok(log.some(c => c[0] === 'beginHole'));
});

test('band geometry is cached across redraws of the same origin (Review Focus 2)', () => {
  const { o } = overlay();
  let measured = 0;
  const adapter = { ...pf2eAdapter, cellMeasure: (spec, unit) => { const m = pf2eAdapter.cellMeasure(spec, unit); return (a, b, band) => { measured++; return m(a, b, band); }; } };
  const entry = { pin: pin(javelin), token, adapter, tint: null, ownerName: null };
  o.draw([entry], fakeGeo());
  const afterFirst = measured;
  o.draw([entry], fakeGeo());
  assert.equal(measured, afterFirst);
  o.draw([{ ...entry, token: { ...token, cells: [{ i: 11, j: 10 }] } }], fakeGeo());
  assert.ok(measured > afterFirst);
});

test('dim behind walls hatches blocked cells', () => {
  const { o, log } = overlay({ ...baseSettings, dimBehindWalls: true });
  o.draw([{ pin: pin(javelin), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo());
  const fills = log.filter(c => c[0] === 'beginFill').map(c => c[2]);
  assert.ok(new Set(fills.map(a => a.toFixed(3))).size > 1, 'blocked cells use a lower fill alpha');
});

test('badges: distance/penalty text per visible target, source excluded, stacked per pin', () => {
  const { PIXI } = fakePIXI();
  const texts = [];
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: text => { texts.push(text); return new Container(); }, settings: () => baseSettings });
  const goblin = { id: 'g', center: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 100 };
  const ogre = { id: 'o', center: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 100 };
  const distances = { g: 45, o: 300 };
  const adapter = { ...pf2eAdapter, distance: (_s, t) => distances[t.id] };
  badges.draw([{ pin: pin(javelin), token, adapter, tint: null, ownerName: null }], { targets: [token, goblin, ogre], zoom: 1 });
  assert.deepEqual(texts, ['45 ft · –2', '300 ft · ✗']);
  assert.equal(badges.container.children.length, 2);
});

test('badges: blocked targets get the eye-slash glyph when walls dimming is on', () => {
  const { PIXI } = fakePIXI();
  const texts = [];
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: text => { texts.push(text); return new Container(); }, settings: () => ({ ...baseSettings, dimBehindWalls: true }) });
  const goblin = { id: 'g', center: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 100 };
  badges.draw([{ pin: pin(javelin), token, adapter: { ...pf2eAdapter, distance: () => 20 }, tint: null, ownerName: null }], { targets: [goblin], zoom: 1, blockedFor: () => true });
  assert.ok(texts.includes('\uf070'));
  assert.ok(texts.includes('20 ft · ✓'));
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `RangeOverlay.mjs` / `TargetBadges.mjs`.

- [ ] **Step 4: Implement**

`scripts/canvas/geometry.mjs`:
```js
/** Runtime adapter from Foundry's canvas to the plain geometry the overlay needs. */
export function sceneGeometry(canvas) {
  const { grid, dimensions } = canvas;
  const sight = new Map();
  const losFor = token => {
    if (!sight.has(token.id)) {
      const polygon = CONFIG.Canvas.polygonBackends.sight.create(token.center, { type: 'sight' });
      const point = ({ x, y }) => !polygon.contains(x, y);
      sight.set(token.id, { point, cell: ({ i, j }) => point(grid.getCenterPoint({ i, j })) });
    }
    return sight.get(token.id);
  };
  return {
    isSquare: grid.isSquare,
    size: grid.size,
    unit: grid.distance,
    bounds: { rows: dimensions.rows, cols: dimensions.columns },
    pxPerFoot: dimensions.size / dimensions.distance,
    topLeft: (i, j) => grid.getTopLeftPoint({ i, j }),
    originCells: token => token.document.getOccupiedGridSpaceOffsets(),
    center: token => token.center,
    tokenRadius: token => Math.max(token.w, token.h) / 2,
    losFor
  };
}

export function makeText(text, style = {}) {
  const PreciseText = foundry.canvas.containers.PreciseText;
  return new PreciseText(text, PreciseText.getTextStyle({ fontFamily: 'Signika', strokeThickness: 3, ...style }));
}

/** Font Awesome family for glyph text; check Foundry's css/ for the exact family name in v14. */
export const FA_FAMILY = 'Font Awesome 6 Pro';
```

`scripts/canvas/RangeOverlay.mjs`:
```js
/** Draws range bands: merged fills, outer outlines, edge labels, wall hatching, fade-in. */
import { bandCells, cellKey } from '../core/cells.mjs';
import { outline, rowRuns, topRightPoint } from '../core/outline.mjs';
import { bandStyle } from '../core/theme.mjs';

const FADE_MS = 150;
const reducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

export class RangeOverlay {
  #seen = new Set();
  #cache = new Map();

  constructor({ parent, PIXI = globalThis.PIXI, makeText, settings }) {
    Object.assign(this, { PIXI, makeText, settings });
    this.container = new PIXI.Container();
    this.container.eventMode = 'none';
    parent.addChild(this.container);
  }

  destroy() { this.container.destroy({ children: true }); this.#cache.clear(); }

  draw(entries, geo) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    const settings = this.settings();
    const seen = new Set(), used = new Set();
    for (const entry of entries) {
      const layer = new this.PIXI.Container();
      this.#drawPin(layer, entry, geo, settings, used);
      this.container.addChild(layer);
      const key = `${entry.pin.key}|${entry.pin.itemUuid}|${entry.pin.actionIndex}|${entry.pin.preview}`;
      seen.add(key);
      if (!this.#seen.has(key)) this.#fadeIn(layer);
    }
    this.#seen = seen;
    for (const key of this.#cache.keys()) if (!used.has(key)) this.#cache.delete(key);
  }

  #fadeIn(layer) {
    if (reducedMotion() || typeof globalThis.requestAnimationFrame !== 'function') return;
    const start = performance.now();
    layer.alpha = 0;
    const step = now => {
      if (layer.destroyed) return;
      const t = Math.min(1, (now - start) / FADE_MS);
      layer.alpha = t;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Cells and outlines per band, cached by spec object + origin cells + grid size. */
  #groups(spec, bands, which, origin, geo, adapter, used) {
    const key = `${which}|${origin.map(cellKey).join(';')}|${geo.size}|${geo.unit}`;
    let bySpec = this.#cache.get(spec);
    const cacheKey = spec;
    used.add(cacheKey);
    if (!bySpec) { bySpec = new Map(); this.#cache.set(cacheKey, bySpec); }
    if (!bySpec.has(key)) {
      const measure = adapter.cellMeasure(spec, geo.unit);
      const groups = bandCells({ originCells: origin, bands, measure, unit: geo.unit, bounds: geo.bounds });
      bySpec.set(key, groups.map(cells => ({ cells, loops: outline(cells), runs: rowRuns(cells) })));
      for (const old of bySpec.keys()) if (old !== key && old.startsWith(`${which}|`)) bySpec.delete(old);
    }
    return bySpec.get(key);
  }

  #drawPin(layer, { pin, token, adapter, tint, ownerName }, geo, settings, used) {
    const g = new this.PIXI.Graphics();
    layer.addChild(g);
    const { spec } = pin;
    const style = (band, index) => bandStyle({ tone: band.tone, index, palette: settings.palette, opacity: settings.bandOpacity, preview: pin.preview, tint });
    if (ownerName) this.#ownerLabel(layer, `${ownerName} — ${spec.itemName}`, token, geo, style(spec.bands[0], 0));
    if (!geo.isSquare) return this.#drawRings(layer, g, spec, token, geo, settings, style);
    const origin = geo.originCells(token);
    const blocked = settings.dimBehindWalls ? geo.losFor(token).cell : null;
    const paint = (bands, which) => {
      const groups = this.#groups(spec, bands, which, origin, geo, adapter, used);
      groups.forEach(({ cells, loops, runs }, index) => {
        if (!cells.length) return;
        const band = bands[index];
        const overlay = which === 'overlays';
        const s = style(band, overlay ? 0 : index);
        if (!overlay && settings.bandStyle !== 'outline') {
          if (blocked) {
            const open = cells.filter(cell => !blocked(cell));
            const shut = cells.filter(cell => blocked(cell));
            this.#fill(g, rowRuns(open), s.fill, s.fillAlpha, geo);
            this.#fill(g, rowRuns(shut), s.fill, s.fillAlpha * 0.4, geo);
            this.#hatch(g, shut, s.line, 0.5, geo);
          } else {
            this.#fill(g, runs, s.fill, s.fillAlpha, geo);
          }
        }
        if (overlay && band.tone === 'penalty-zone') this.#hatch(g, cells, s.fill, 0.45, geo);
        if (overlay || settings.bandStyle !== 'fill') this.#stroke(g, loops, s, geo);
        if (settings.showLabels) this.#label(layer, band.label, topRightPoint(loops), s, geo);
      });
    };
    paint(spec.bands, 'bands');
    if (spec.overlays.length) paint(spec.overlays, 'overlays');
  }

  #fill(g, runs, color, alpha, geo) {
    if (!runs.length) return;
    g.beginFill(color, alpha);
    for (const { i, j0, j1 } of runs) {
      const a = geo.topLeft(i, j0), b = geo.topLeft(i + 1, j1 + 1);
      g.drawRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    g.endFill();
  }

  #hatch(g, cells, color, alpha, geo) {
    if (!cells.length) return;
    const size = geo.size;
    g.lineStyle(1, color, alpha);
    for (const { i, j } of cells) {
      const { x, y } = geo.topLeft(i, j);
      g.moveTo(x, y + size); g.lineTo(x + size, y);
      g.moveTo(x, y + size / 2); g.lineTo(x + size / 2, y);
      g.moveTo(x + size / 2, y + size); g.lineTo(x + size, y + size / 2);
    }
    g.lineStyle(0);
  }

  #stroke(g, loops, s, geo) {
    const trace = () => {
      for (const loop of loops) {
        if (loop.length < 3) continue;
        const points = loop.map(point => geo.topLeft(point.y, point.x));
        g.moveTo(points[0].x, points[0].y);
        for (const p of points.slice(1)) g.lineTo(p.x, p.y);
        g.closePath();
      }
    };
    g.lineStyle({ width: s.lineWidth + 2, color: s.halo, alpha: 0.45, join: 'round' });
    trace();
    g.lineStyle({ width: s.lineWidth, color: s.line, alpha: s.lineAlpha, join: 'round' });
    trace();
    g.lineStyle(0);
  }

  #pill(text, s, geo) {
    const label = this.makeText(text, { fontSize: Math.max(11, Math.round(geo.size * 0.22)), fill: s.text });
    const pad = 4;
    const box = new this.PIXI.Graphics();
    box.beginFill(s.halo, 0.75);
    box.lineStyle(1, s.line, 0.9);
    box.drawRoundedRect(0, 0, label.width + pad * 2, label.height + pad, 6);
    box.endFill();
    label.position.set(pad, pad / 2);
    const pill = new this.PIXI.Container();
    pill.addChild(box, label);
    return pill;
  }

  #label(layer, text, point, s, geo) {
    if (!point || !text) return;
    const corner = geo.topLeft(point.y, point.x);
    const pill = this.#pill(text, s, geo);
    pill.position.set(corner.x - pill.width - 4, corner.y + 4);
    layer.addChild(pill);
  }

  #ownerLabel(layer, text, token, geo, s) {
    const pill = this.#pill(text, s, geo);
    const center = geo.center(token);
    pill.position.set(center.x - pill.width / 2, center.y - geo.tokenRadius(token) - pill.height - 6);
    layer.addChild(pill);
  }

  #drawRings(layer, g, spec, token, geo, settings, style) {
    const { x, y } = geo.center(token);
    const base = geo.tokenRadius(token);
    const ring = (band, index, overlay) => {
      const s = style(band, overlay ? 0 : index);
      const inner = base + band.min * geo.pxPerFoot, outer = base + band.max * geo.pxPerFoot;
      if (!overlay && settings.bandStyle !== 'outline') {
        g.beginFill(s.fill, s.fillAlpha);
        g.drawCircle(x, y, outer);
        if (band.min > 0) { g.beginHole(); g.drawCircle(x, y, inner); g.endHole(); }
        g.endFill();
      }
      if (overlay || settings.bandStyle !== 'fill') {
        g.lineStyle({ width: s.lineWidth + 2, color: s.halo, alpha: 0.45 });
        g.drawCircle(x, y, outer);
        g.lineStyle({ width: s.lineWidth, color: s.line, alpha: s.lineAlpha });
        g.drawCircle(x, y, outer);
        g.lineStyle(0);
      }
      if (settings.showLabels) {
        const pill = this.#pill(band.label, s, geo);
        pill.position.set(x + outer * Math.SQRT1_2 - pill.width, y - outer * Math.SQRT1_2);
        layer.addChild(pill);
      }
    };
    spec.bands.forEach((band, index) => ring(band, index, false));
    spec.overlays.forEach((band, index) => ring(band, index, true));
  }
}
```

`scripts/canvas/TargetBadges.mjs`:
```js
/** Distance/penalty plates above target tokens. */
import { badgeText, classifyTargets } from '../core/targets.mjs';
import { bandStyle } from '../core/theme.mjs';
import { FA_FAMILY } from './geometry.mjs';

export class TargetBadges {
  constructor({ parent, PIXI = globalThis.PIXI, makeText, settings }) {
    Object.assign(this, { PIXI, makeText, settings });
    this.container = new PIXI.Container();
    this.container.eventMode = 'none';
    parent.addChild(this.container);
  }

  destroy() { this.container.destroy({ children: true }); }

  draw(entries, { targets, zoom = 1, blockedFor = () => false }) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    const settings = this.settings();
    const stack = new Map();
    for (const entry of entries) {
      const { pin, token, adapter } = entry;
      if (pin.spec.kind === 'none') continue;
      const list = targets.filter(target => target.id !== token.id && target.id !== pin.tokenId);
      const results = classifyTargets({
        spec: pin.spec,
        targets: list.map(target => ({
          id: target.id,
          distance: adapter.distance(token, target, pin.spec),
          blocked: Boolean(settings.dimBehindWalls && blockedFor(entry, target))
        }))
      });
      results.forEach((result, k) => {
        const target = list[k];
        const level = stack.get(target.id) ?? 0;
        stack.set(target.id, level + 1);
        this.container.addChild(this.#badge(result, target, level, entry, settings, zoom));
      });
    }
  }

  #badge(result, target, level, { pin, tint }, settings, zoom) {
    const band = result.bandIndex === null ? null : pin.spec.bands[result.bandIndex];
    const s = band
      ? bandStyle({ tone: band.tone, index: result.bandIndex, palette: settings.palette, tint })
      : bandStyle({ tone: 'penalty-zone', palette: settings.palette });
    const plate = new this.PIXI.Container();
    const pad = 5;
    const parts = [];
    if (result.blocked) parts.push(this.makeText('\uf070', { fontFamily: FA_FAMILY, fontWeight: '900', fontSize: 13, fill: s.text }));
    parts.push(this.makeText(badgeText(result), { fontSize: 14, fill: s.text }));
    let x = pad;
    const height = Math.max(...parts.map(part => part.height));
    for (const part of parts) { part.position.set(x, pad / 2); x += part.width + 4; }
    const box = new this.PIXI.Graphics();
    box.beginFill(s.halo, pin.preview ? 0.6 : 0.85);
    box.lineStyle(2, s.line, 0.95);
    box.drawRoundedRect(0, 0, x - 4 + pad, height + pad, 7);
    box.endFill();
    plate.addChild(box, ...parts);
    const scale = Math.min(2, Math.max(0.6, 1 / (zoom || 1))) * settings.badgeScale;
    plate.scale.set(scale);
    const width = (x - 4 + pad) * scale, plateHeight = (height + pad) * scale;
    plate.position.set(target.center.x - width / 2, target.y - (plateHeight + 4) * (level + 1));
    return plate;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS. The overlay cache is keyed by the spec object (a rebuilt spec is a new object, so it misses) and by the origin cells (a moved token misses).

- [ ] **Step 6: Commit**

```bash
git add scripts/canvas tests/canvas.test.mjs tests/fake-pixi.mjs
git commit -m "feat: canvas range overlay and target badges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Row buttons, preview key, PF2e row selectors

**Files:**
- Create: `scripts/ui/Triggers.mjs`, `scripts/adapters/pf2e-rows.mjs`
- Modify: `scripts/adapters/pf2e.mjs` (last line: `rows: pf2eRows`)
- Test: `tests/triggers.test.mjs`

**Interfaces:**
- Consumes: `showsButton`, `hasRange` (spec.mjs); `PinManager` API (Task 7: `toggle`, `preview`, `endPreview`, `pinFor`, `previewing`); adapter `specFor` and `rows`.
- Produces:
  - `RowDef = { hooks: string[], selector: string, resolve(el, app) → { actor, item, actionIndex } | null, host?(el) → Element, persistentHud?: boolean }`
  - `pf2eRows: RowDef[]`
  - `new Triggers({ adapter, pins, resolveToken(actor) → Token|null, notify(message), localize(key), settings: () => Settings, doc })`
  - `decorate(root, app, hookName)`, `refresh(root = doc)`, `keyDown()`, `keyUp()`
  - `WINDOW_SELECTOR = '.application, .app, .window-app'`

PF2e / pf2e-hud DOM to verify before finalizing selectors (read the files, keep the selectors below unless the markup differs — then use what the markup actually has and note it in your report):
- `systems/pf2e/templates/actors/character/partials/strike.hbs` — `li.strike[data-action-index]`
- `systems/pf2e/templates/actors/npc/partials/attack.hbs` — `li.item.action[data-action-index][data-item-id]`
- `systems/pf2e/templates/actors/partials/spell-collection.hbs` — `li.spell[data-item-id]`
- character inventory rows — `li.item[data-item-id]` inside the inventory tab
- `modules/pf2e-hud/templates/sidebar/actions.hbs` — strikes `.item.attack[data-item-id][data-index]`
- `modules/pf2e-hud/templates/sidebar/spells.hbs` — `.item[data-item-type="spell"][data-item-id]`
- `modules/pf2e-hud/templates/shortcuts/slots.hbs` — `.item.shortcut` (item id in `data-item-id`)
- pf2e-hud sidebar apps expose the actor as `app.actor` (confirm in `modules/pf2e-hud/scripts/main.js.map`; fall back to `app.parent?.actor`).
- Hook names: PF2e sheets are AppV1, so `renderCharacterSheetPF2e`, `renderNPCSheetPF2e` and `renderActorSheetPF2e` fire with `(app, html /* jQuery */)`; pf2e-hud apps are AppV2: `renderActionsSidebarPF2eHUD`, `renderSpellsSidebarPF2eHUD`, `renderItemsSidebarPF2eHUD`, `renderPersistentShortcutsPF2eHUD` fire with `(app, element)`.

- [ ] **Step 1: Write the failing tests** — `tests/triggers.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ token = { id: 't1' }, settings = {} } = {}) {
  const dom = new JSDOM(`<div class="application" id="sheet">
      <ul><li class="row" data-id="bow"><span class="name">Bow</span></li>
          <li class="row" data-id="wish"><span class="name">Wish</span></li>
          <li class="row" data-id="rope"><span class="name">Rope</span></li></ul>
    </div>
    <div class="application" id="hud"><div class="slot" data-id="bow"></div></div>`);
  const doc = dom.window.document;
  const items = {
    bow: { uuid: 'Item.bow', spec: makeSpec({ kind: 'radius', bands: singleBand(60) }) },
    wish: { uuid: 'Item.wish', spec: noneSpec('Range: varies') },
    rope: { uuid: 'Item.rope', spec: noneSpec() }
  };
  const actor = { id: 'a1' };
  const adapter = {
    specFor: ({ item }) => item.spec,
    rows: [
      { hooks: ['renderSheet'], selector: 'li.row', resolve: el => ({ actor, item: items[el.dataset.id], actionIndex: null }), host: el => el.querySelector('.name') },
      { hooks: ['renderHud'], selector: '.slot', resolve: el => ({ actor, item: items[el.dataset.id], actionIndex: null }), persistentHud: true }
    ]
  };
  const calls = [], notes = [];
  let pinned = null;
  const pins = {
    previewing: false,
    toggle: req => { calls.push(['toggle', req]); pinned = req; return 'pinned'; },
    preview: req => { calls.push(['preview', req]); pins.previewing = true; return true; },
    endPreview: () => { calls.push(['endPreview']); pins.previewing = false; return true; },
    pinFor: req => (pinned && pinned.itemUuid === req.itemUuid ? { shared: Boolean(pinned.share) } : null)
  };
  const triggers = new Triggers({ adapter, pins, resolveToken: () => token, notify: m => notes.push(m), localize: k => k, settings: () => ({ ghostPersistentHud: false, ...settings }), doc });
  return { doc, dom, triggers, calls, notes };
}

test('adds buttons only to rows with a range or a note', () => {
  const { doc, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const bow = doc.querySelector('[data-id="bow"] .name .range-finder-btn');
  const wish = doc.querySelector('[data-id="wish"] .range-finder-btn');
  assert.ok(bow);
  assert.ok(wish.classList.contains('is-disabled'));
  assert.equal(wish.dataset.tooltip, 'Range: varies');
  assert.equal(doc.querySelector('[data-id="rope"] .range-finder-btn'), null);
});

test('decorate is idempotent and filtered by hook', () => {
  const { doc, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  assert.equal(doc.querySelectorAll('[data-id="bow"] .range-finder-btn').length, 1);
  triggers.decorate(doc.getElementById('hud'), {}, 'renderSheet');
  assert.equal(doc.querySelector('.slot .range-finder-btn'), null);
});

test('click toggles a pin with the source window; shift shares; disabled does nothing', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }));
  assert.equal(calls[0][0], 'toggle');
  assert.deepEqual({ ...calls[0][1], sourceEl: calls[0][1].sourceEl.id }, { tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null, sourceEl: 'sheet', share: true });
  doc.querySelector('[data-id="wish"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls.length, 1);
});

test('no token on scene → notification, no pin (Review Focus 1)', () => {
  const { doc, dom, triggers, calls, notes } = setup({ token: null });
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls, []);
  assert.deepEqual(notes, ['RANGE_FINDER.Notify.NoToken']);
});

test('re-rendered rows show the active state (Review Focus 3)', () => {
  const { doc, dom, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const sheet = doc.getElementById('sheet');
  sheet.innerHTML = '<ul><li class="row" data-id="bow"><span class="name">Bow</span></li></ul>';
  triggers.decorate(sheet, {}, 'renderSheet');
  assert.ok(doc.querySelector('[data-id="bow"] .range-finder-btn').classList.contains('is-active'));
});

test('preview: key held + hover starts once; release ends', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const row = doc.querySelector('[data-id="bow"]');
  row.querySelector('.name').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls, []);
  triggers.keyDown();
  row.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  assert.equal(calls[0][1].sourceEl.id, 'sheet');
  triggers.keyUp();
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview']);
});

test('preview without a token is silent', () => {
  const { doc, dom, triggers, calls, notes } = setup({ token: null });
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"]').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  triggers.keyDown();
  assert.deepEqual(calls, []);
  assert.deepEqual(notes, []);
});

test('persistent HUD rows do not ghost unless the setting is on', () => {
  const off = setup();
  off.triggers.decorate(off.doc.getElementById('hud'), {}, 'renderHud');
  off.doc.querySelector('.slot .range-finder-btn').dispatchEvent(new off.dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(off.calls[0][1].sourceEl, null);
  const on = setup({ settings: { ghostPersistentHud: true } });
  on.triggers.decorate(on.doc.getElementById('hud'), {}, 'renderHud');
  on.doc.querySelector('.slot .range-finder-btn').dispatchEvent(new on.dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(on.calls[0][1].sourceEl.id, 'hud');
});

test('a throwing resolver never breaks decoration of other rows', () => {
  const { doc, triggers } = setup();
  triggers.adapter.rows.unshift({ hooks: ['renderSheet'], selector: 'li.row', resolve: () => { throw new Error('boom'); } });
  const original = console.error;
  console.error = () => {};
  try { triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet'); } finally { console.error = original; }
  assert.ok(doc.querySelector('[data-id="bow"] .range-finder-btn'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scripts/ui/Triggers.mjs`.

- [ ] **Step 3: Implement**

`scripts/ui/Triggers.mjs`:
```js
/** Row buttons (click to pin, Shift+click to share) and the hold-key hover preview. */
import { hasRange, showsButton } from '../core/spec.mjs';

export const WINDOW_SELECTOR = '.application, .app, .window-app';
const ROW_ATTR = 'data-range-finder-row';

export class Triggers {
  #rows = new WeakMap();
  #hovered = null;
  #keyHeld = false;

  constructor({ adapter, pins, resolveToken, notify = () => {}, localize = key => key, settings = () => ({}), doc = globalThis.document }) {
    Object.assign(this, { adapter, pins, resolveToken, notify, localize, settings, doc });
    doc.addEventListener('pointerover', event => this.#onHover(event));
  }

  decorate(root, app, hookName) {
    if (!root?.querySelectorAll) return;
    for (const def of this.adapter.rows ?? []) {
      if (hookName && def.hooks && !def.hooks.includes(hookName)) continue;
      for (const el of root.querySelectorAll(def.selector)) this.#decorateRow(el, def, app);
    }
    this.refresh(root);
  }

  #decorateRow(el, def, app) {
    try {
      if (this.#rows.has(el)) return;
      const ctx = def.resolve(el, app);
      if (!ctx?.actor || !ctx?.item) return;
      const spec = this.adapter.specFor(ctx);
      if (!showsButton(spec)) return;
      this.#rows.set(el, { ctx, def });
      el.setAttribute(ROW_ATTR, '');
      const host = def.host?.(el) ?? el;
      host.append(this.#button(el, spec));
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  #button(row, spec) {
    const button = this.doc.createElement('a');
    button.className = 'range-finder-btn';
    button.setAttribute('role', 'button');
    const active = hasRange(spec);
    if (!active) button.classList.add('is-disabled');
    button.dataset.tooltip = active ? this.localize('RANGE_FINDER.Button.Show') : spec.note;
    button.setAttribute('aria-label', button.dataset.tooltip);
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (active) this.#toggle(row, event.shiftKey);
    });
    return button;
  }

  #request(row, { quiet = false } = {}) {
    const entry = this.#rows.get(row);
    if (!entry) return null;
    const token = this.resolveToken(entry.ctx.actor);
    if (!token) {
      if (!quiet) this.notify(this.localize('RANGE_FINDER.Notify.NoToken'));
      return null;
    }
    const ghostable = !entry.def.persistentHud || this.settings().ghostPersistentHud;
    return {
      tokenId: token.id,
      itemUuid: entry.ctx.item.uuid,
      actionIndex: entry.ctx.actionIndex ?? null,
      sourceEl: ghostable ? row.closest(WINDOW_SELECTOR) : null
    };
  }

  #toggle(row, share) {
    try {
      const request = this.#request(row);
      if (!request) return;
      this.pins.toggle({ ...request, share });
      this.refresh();
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  refresh(root = this.doc) {
    for (const button of root.querySelectorAll?.('.range-finder-btn') ?? []) {
      const row = button.closest(`[${ROW_ATTR}]`);
      const request = row ? this.#request(row, { quiet: true }) : null;
      const pin = request ? this.pins.pinFor(request) : null;
      button.classList.toggle('is-active', Boolean(pin));
      button.classList.toggle('is-shared', Boolean(pin?.shared));
    }
  }

  #onHover(event) {
    const row = event.target?.closest?.(`[${ROW_ATTR}]`) ?? null;
    this.#hovered = row && this.#rows.has(row) ? row : null;
    if (this.#keyHeld && this.#hovered) this.#startPreview();
  }

  #startPreview() {
    if (this.pins.previewing || !this.#hovered?.isConnected) return;
    const request = this.#request(this.#hovered, { quiet: true });
    if (request) this.pins.preview(request);
  }

  keyDown() {
    this.#keyHeld = true;
    this.#startPreview();
  }

  keyUp() {
    this.#keyHeld = false;
    this.pins.endPreview();
  }
}
```

`scripts/adapters/pf2e-rows.mjs`:
```js
/** Where PF2e sheets and pf2e-hud list items, attacks and spells. */
const itemOf = (actor, id) => (id ? actor?.items?.get(id) ?? null : null);

function strikeAt(actor, index, itemId) {
  const i = Number(index);
  const action = Number.isInteger(i) ? actor?.system?.actions?.[i] : null;
  if (action?.item && (!itemId || action.item.id === itemId)) return { item: action.item, actionIndex: i };
  return { item: itemOf(actor, itemId), actionIndex: null };
}

const hudActor = app => app?.actor ?? app?.parent?.actor ?? null;
const controlsHost = el => el.querySelector(':scope .item-controls, :scope .controls') ?? el.querySelector(':scope .item-name, :scope .name, :scope h4') ?? el;

export const pf2eRows = [
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.strike[data-action-index]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, null) }),
    host: controlsHost
  },
  {
    hooks: ['renderNPCSheetPF2e'],
    selector: 'li.item.action[data-action-index][data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, el.dataset.itemId) }),
    host: controlsHost
  },
  {
    hooks: ['renderActorSheetPF2e'],
    selector: 'li.spell[data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, item: itemOf(app.actor, el.dataset.itemId), actionIndex: null }),
    host: controlsHost
  },
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: '.tab.inventory li.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: controlsHost
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.attack[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), ...strikeAt(hudActor(app), el.dataset.index, el.dataset.itemId) }),
    host: controlsHost
  },
  {
    hooks: ['renderSpellsSidebarPF2eHUD'],
    selector: '.item[data-item-type="spell"][data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: itemOf(hudActor(app), el.dataset.itemId), actionIndex: null }),
    host: controlsHost
  },
  {
    hooks: ['renderItemsSidebarPF2eHUD'],
    selector: '.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(hudActor(app), el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: controlsHost
  },
  {
    hooks: ['renderPersistentShortcutsPF2eHUD'],
    selector: '.item.shortcut[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: itemOf(hudActor(app), el.dataset.itemId), actionIndex: null }),
    persistentHud: true
  }
];
```

Modify the last line of `scripts/adapters/pf2e.mjs` and add the import at the top:
```js
import { pf2eRows } from './pf2e-rows.mjs';
// …
export const pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, rows: pf2eRows };
```

- [ ] **Step 4: Verify selectors against the real markup**

Read the template and source-map files listed above. Correct any selector, dataset name, or `app.actor` access that doesn't match, keeping the row shape. Record each confirmation or change in your report.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS (the `pf2eAdapter.rows` array test from Task 5 still passes).

- [ ] **Step 6: Commit**

```bash
git add scripts/ui/Triggers.mjs scripts/adapters/pf2e-rows.mjs scripts/adapters/pf2e.mjs tests/triggers.test.mjs
git commit -m "feat: row buttons, hover preview key and PF2e row selectors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Settings + main wiring

**Files:**
- Create: `scripts/settings.mjs`
- Modify: `main.mjs` (replace placeholder entirely)
- Test: `tests/settings.test.mjs`

**Interfaces:**
- Consumes: everything above — `getAdapter` (Task 6), `PinManager` (7), `Ghost` (8), `RangeOverlay`, `TargetBadges`, `sceneGeometry`, `makeText` (9), `Triggers` (10).
- Produces:
  - `MODULE_ID = 'range-finder'`, `SETTINGS` (definitions), `registerSettings(onChange, settings = game.settings, localize = key => key)`, `readSettings(settings = game.settings) → Settings`
  - Module API: `game.modules.get('range-finder').api = { registerAdapter, clear: () => void }`

- [ ] **Step 1: Write the failing test** — `tests/settings.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULE_ID, SETTINGS, readSettings, registerSettings } from '../scripts/settings.mjs';

function fakeSettings() {
  const registered = new Map(), values = new Map();
  return {
    registered,
    register: (module, key, data) => { assert.equal(module, MODULE_ID); registered.set(key, data); values.set(key, data.default); },
    get: (module, key) => values.get(key)
  };
}

test('registers every setting with the spec defaults and scopes', () => {
  const settings = fakeSettings();
  const onChange = () => {};
  registerSettings(onChange, settings);
  const expected = {
    bandStyle: ['client', 'both'], bandOpacity: ['client', 1], showLabels: ['client', true], badgeScale: ['client', 1],
    palette: ['client', 'default'], dimBehindWalls: ['client', false], ghostMode: ['client', 'fade'],
    ghostPersistentHud: ['client', false], allowSharing: ['world', true], badgesCombatOnly: ['world', false]
  };
  assert.deepEqual([...settings.registered.keys()].sort(), Object.keys(expected).sort());
  for (const [key, [scope, value]] of Object.entries(expected)) {
    const data = settings.registered.get(key);
    assert.equal(data.scope, scope, key);
    assert.equal(data.default, value, key);
    assert.equal(data.config, true, key);
    assert.equal(data.onChange, onChange, key);
    assert.equal(data.name, `RANGE_FINDER.Settings.${key}.Name`);
  }
  assert.deepEqual(Object.keys(settings.registered.get('ghostMode').choices), ['fade', 'minimize', 'off']);
  assert.equal(settings.registered.get('ghostMode').choices.fade, 'RANGE_FINDER.Settings.ghostMode.Choices.fade');
  assert.deepEqual(settings.registered.get('bandOpacity').range, { min: 0.3, max: 1.5, step: 0.1 });
});

test('readSettings returns every key', () => {
  const settings = fakeSettings();
  registerSettings(() => {}, settings);
  const values = readSettings(settings);
  assert.deepEqual(Object.keys(values).sort(), Object.keys(SETTINGS).sort());
  assert.equal(values.ghostMode, 'fade');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scripts/settings.mjs`.

- [ ] **Step 3: Implement settings** — `scripts/settings.mjs`:

```js
export const MODULE_ID = 'range-finder';

const choices = (key, values) => Object.fromEntries(values.map(value => [value, `RANGE_FINDER.Settings.${key}.Choices.${value}`]));

export const SETTINGS = {
  bandStyle: { scope: 'client', type: String, default: 'both', choices: choices('bandStyle', ['fill', 'outline', 'both']) },
  bandOpacity: { scope: 'client', type: Number, default: 1, range: { min: 0.3, max: 1.5, step: 0.1 } },
  showLabels: { scope: 'client', type: Boolean, default: true },
  badgeScale: { scope: 'client', type: Number, default: 1, range: { min: 0.6, max: 1.6, step: 0.1 } },
  palette: { scope: 'client', type: String, default: 'default', choices: choices('palette', ['default', 'colorblind']) },
  dimBehindWalls: { scope: 'client', type: Boolean, default: false },
  ghostMode: { scope: 'client', type: String, default: 'fade', choices: choices('ghostMode', ['fade', 'minimize', 'off']) },
  ghostPersistentHud: { scope: 'client', type: Boolean, default: false },
  allowSharing: { scope: 'world', type: Boolean, default: true },
  badgesCombatOnly: { scope: 'world', type: Boolean, default: false }
};

export function registerSettings(onChange, settings = game.settings) {
  for (const [key, data] of Object.entries(SETTINGS)) {
    settings.register(MODULE_ID, key, {
      name: `RANGE_FINDER.Settings.${key}.Name`,
      hint: `RANGE_FINDER.Settings.${key}.Hint`,
      config: true,
      ...data,
      onChange
    });
  }
}

export function readSettings(settings = game.settings) {
  return Object.fromEntries(Object.keys(SETTINGS).map(key => [key, settings.get(MODULE_ID, key)]));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement wiring** — replace `main.mjs`:

```js
import { getAdapter, registerAdapter } from './scripts/adapters/index.mjs';
import { RangeOverlay } from './scripts/canvas/RangeOverlay.mjs';
import { TargetBadges } from './scripts/canvas/TargetBadges.mjs';
import { makeText, sceneGeometry } from './scripts/canvas/geometry.mjs';
import { MODULE_ID, readSettings, registerSettings } from './scripts/settings.mjs';
import { Ghost } from './scripts/ui/Ghost.mjs';
import { PinManager } from './scripts/ui/PinManager.mjs';
import { Triggers } from './scripts/ui/Triggers.mjs';

const SOCKET = `module.${MODULE_ID}`;
let adapter, pins, ghost, triggers, overlay, badges;
let frame = null;
const dragging = new Map();
const report = error => console.error('Range Finder |', error);

const userColor = id => {
  const color = game.users.get(id)?.color;
  return color === undefined || color === null ? null : Number(color);
};

function tokenFor(id) {
  return dragging.get(id) ?? canvas.tokens?.get(id) ?? null;
}

function resolveToken(actor) {
  if (!canvas?.ready || !actor) return null;
  const matches = token => token.actor === actor || (token.actor?.id === actor.id && !actor.isToken);
  return canvas.tokens.controlled.find(matches) ?? actor.getActiveTokens?.()?.[0] ?? null;
}

function appForElement(el) {
  return foundry.applications.instances?.get(el.id) ?? ui.windows?.[el.dataset?.appid] ?? null;
}

function build({ tokenId, itemUuid, actionIndex }) {
  try {
    const token = canvas.tokens?.get(tokenId);
    const item = fromUuidSync(itemUuid);
    if (!token?.actor || !item) return null;
    return adapter.specFor({ actor: token.actor, token, item, actionIndex });
  } catch (error) {
    report(error);
    return null;
  }
}

function schedule() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => { frame = null; redraw(); });
}

function redraw() {
  try {
    triggers?.refresh();
    if (!canvas?.ready || !overlay || !badges || !pins) return;
    const settings = readSettings();
    const entries = pins.all().map(pin => ({
      pin,
      token: tokenFor(pin.tokenId),
      adapter,
      tint: pin.shared ? userColor(pin.userId) : null,
      ownerName: pin.shared ? game.users.get(pin.userId)?.name ?? null : null
    })).filter(entry => entry.token);
    const geo = sceneGeometry(canvas);
    overlay.draw(entries, geo);
    const combatIds = settings.badgesCombatOnly ? new Set(game.combat?.combatants.map(c => c.tokenId) ?? []) : null;
    const targets = canvas.tokens.placeables.filter(token => token.visible && !token.isPreview && (!combatIds || combatIds.has(token.id)));
    badges.draw(entries, { targets, zoom: canvas.stage.scale.x, blockedFor: (entry, target) => geo.losFor(entry.token).point(target.center) });
  } catch (error) {
    report(error);
    ghost?.releaseAll();
  }
}

function setupCanvas() {
  if (!pins) return;
  try {
    overlay?.destroy();
    badges?.destroy();
    overlay = new RangeOverlay({ parent: canvas.interface.grid, makeText, settings: readSettings });
    badges = new TargetBadges({ parent: canvas.interface, makeText, settings: readSettings });
    schedule();
  } catch (error) { report(error); }
}

function clearLocal() {
  const had = pins?.clearLocal() ?? false;
  ghost?.releaseAll();
  if (had) schedule();
  return had;
}

Hooks.once('init', () => {
  registerSettings(() => schedule());
  game.keybindings.register(MODULE_ID, 'preview', {
    name: 'RANGE_FINDER.Keys.Preview.Name', hint: 'RANGE_FINDER.Keys.Preview.Hint',
    editable: [{ key: 'AltLeft' }],
    onDown: () => { triggers?.keyDown(); return false; },
    onUp: () => { triggers?.keyUp(); return false; },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register(MODULE_ID, 'clear', {
    name: 'RANGE_FINDER.Keys.Clear.Name', hint: 'RANGE_FINDER.Keys.Clear.Hint',
    editable: [{ key: 'Escape' }],
    onDown: () => clearLocal(),
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
  });
  game.keybindings.register(MODULE_ID, 'clearShared', {
    name: 'RANGE_FINDER.Keys.ClearShared.Name', hint: 'RANGE_FINDER.Keys.ClearShared.Hint',
    editable: [], restricted: true,
    onDown: () => { pins?.clearShared(); return true; }
  });
});

Hooks.once('ready', () => {
  adapter = getAdapter(game.system.id);
  ghost = new Ghost({ mode: () => readSettings().ghostMode, appFor: appForElement });
  pins = new PinManager({
    userId: game.user.id,
    build,
    onChange: schedule,
    broadcast: message => game.socket.emit(SOCKET, message),
    allowShare: () => readSettings().allowSharing,
    ghost
  });
  triggers = new Triggers({
    adapter, pins, resolveToken,
    notify: message => ui.notifications.warn(message),
    localize: key => game.i18n.localize(key),
    settings: readSettings
  });
  document.documentElement.style.setProperty('--range-finder-user', game.user.color?.css ?? '#2ec4b6');
  game.socket.on(SOCKET, message => {
    if (message?.action === 'clearAll' && !game.users.get(message.userId)?.isGM) return;
    pins.receive(message);
  });
  for (const hook of new Set((adapter.rows ?? []).flatMap(row => row.hooks ?? []))) {
    Hooks.on(hook, (app, html) => triggers.decorate(html?.[0] ?? html ?? app?.element, app, hook));
  }
  game.modules.get(MODULE_ID).api = { registerAdapter, clear: clearLocal };
  if (canvas?.ready) setupCanvas();
});

Hooks.on('canvasReady', setupCanvas);
Hooks.on('canvasTearDown', () => {
  pins?.reset();
  ghost?.releaseAll();
  overlay?.destroy();
  badges?.destroy();
  overlay = badges = null;
  dragging.clear();
});

Hooks.on('refreshToken', token => {
  if (!pins?.size) return;
  if (token.isPreview && token._original) dragging.set(token._original.id, token);
  schedule();
});
Hooks.on('destroyToken', token => {
  if (token.isPreview && token._original && dragging.get(token._original.id) === token) {
    dragging.delete(token._original.id);
    schedule();
  }
});
Hooks.on('deleteToken', document => pins?.dropToken(document.id));
Hooks.on('deleteItem', item => pins?.dropItem(item.uuid));
for (const hook of ['updateItem', 'updateActor', 'createItem']) Hooks.on(hook, () => pins?.size && pins.rebuild());
for (const hook of ['createWall', 'updateWall', 'deleteWall', 'createToken', 'updateToken', 'canvasPan', 'controlToken', 'updateCombat', 'deleteCombat']) {
  Hooks.on(hook, () => { if (pins?.size) schedule(); });
}

Hooks.on('getSceneControlButtons', controls => {
  if (!game.user?.isGM) return;
  const tokens = Array.isArray(controls) ? controls.find(c => c.name === 'token') : controls.tokens;
  if (!tokens) return;
  const tool = {
    name: 'range-finder-clear', title: 'RANGE_FINDER.Controls.ClearShared', icon: 'fa-solid fa-ruler-combined',
    button: true, visible: true
  };
  if (Array.isArray(tokens.tools)) {
    tokens.tools.push({ ...tool, onClick: () => pins?.clearShared() });
  } else {
    tokens.tools ??= {};
    tokens.tools[tool.name] = { ...tool, order: Object.keys(tokens.tools).length, onChange: (_event, active) => { if (active) pins?.clearShared(); } };
  }
});
```

Verify in Foundry v14 source (`client/canvas/placeables/token.mjs`) that `Token#isPreview` and `Token#_original` exist for drag previews, and that a drag preview's `document` carries the moved position (so `getOccupiedGridSpaceOffsets()` follows the drag). If the names differ, adapt the two token hooks and note it in your report.

- [ ] **Step 6: Syntax check and full test run**

Run: `node --check main.mjs && npm test`
Expected: no syntax errors; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/settings.mjs main.mjs tests/settings.test.mjs
git commit -m "feat: settings, keybindings, socket and canvas wiring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: README and live verification checklist

**Files:**
- Create: `README.md`, `docs/live-checklist.md`

**Interfaces:**
- Consumes: the finished module.
- Produces: user-facing docs and a manual QA checklist the controller runs in Foundry with the user.

- [ ] **Step 1: Write `README.md`**

```markdown
# Range Finder

See an item's, attack's or spell's range right on the canvas.

- **📏 button** on every strike, weapon and spell row — PF2e character and NPC sheets, and PF2e HUD sidebars and shortcuts. Click to pin, click again (or press Esc) to clear.
- **Shift+click** shares the range with everyone, tinted in your player color.
- **Hold Alt** while hovering a row to preview its range without pinning.
- **Penalty bands**: range increments drawn as merged bands labelled `60 ft · –2`, reach for melee weapons (including PF2e's 10 ft reach diagonal), volley zones hatched.
- **Target badges**: every visible token shows `45 ft · –2`, `✓` or `✗`.
- **Gets out of the way**: the window you clicked from fades while the range is shown; hover it to bring it back.
- Optional: hatch squares without line of effect, colorblind palette, outline-only bands.

Works on square grids (per-square bands) and hex/gridless scenes (rings). System-agnostic core with a PF2e adapter; other systems get a basic numeric-range fallback.

## Settings

| Setting | Scope | Default |
|---|---|---|
| Band style | client | Fill and outline |
| Band opacity | client | 1 |
| Band labels | client | on |
| Badge size | client | 1 |
| Colors | client | Default |
| Dim behind walls | client | off |
| Hide windows while showing range | client | Fade |
| Also hide PF2e HUD bar | client | off |
| Allow sharing | world | on |
| Badges only in combat | world | off |

## For developers

`game.modules.get('range-finder').api.registerAdapter(systemId, adapter)` — see `scripts/adapters/generic.mjs` for the adapter shape.

Run tests with `npm test`.
```

- [ ] **Step 2: Write `docs/live-checklist.md`**

```markdown
# Range Finder — live checklist (Foundry v14, PF2e)

Setup: square-grid scene, a PF2e character with longbow, dagger, whip and spells (Electric Arc 30 ft, Shocking Grasp touch, Bless emanation, Wish varies); a few enemy tokens at 20–300 ft; one wall between the character and an enemy. pf2e-hud enabled.

- [ ] Character sheet: 📏 shows on strikes, weapons in inventory, ranged/touch spells; disabled (tooltip) on Wish; absent on Shield/self spells.
- [ ] Longbow pin: 6 bands to 600 ft, labels `100 ft`, `200 ft · –2` … `600 ft · –10`; volley 30 hatch; sheet fades; hovering the faded sheet restores it.
- [ ] Badges: enemies show `NN ft · ✓/–N/✗` matching PF2e's own attack roll range penalty.
- [ ] Dagger: thrown bands + reach outline. Whip: reach 10 includes both 2-square diagonals.
- [ ] Drag the pinned token: bands and badges follow smoothly; drop settles.
- [ ] Hold Alt over a spell row: lighter preview; release clears; sheet restores.
- [ ] Esc clears pins and restores windows.
- [ ] Shift+click: second client sees the range tinted with the sharer's color and the owner label; unpin clears it there; GM "clear shared" tool clears all.
- [ ] pf2e-hud actions/spells sidebars and shortcuts show 📏 and work; persistent bar does not fade unless the setting is on.
- [ ] Settings: outline-only, labels off, colorblind palette, badge size, dim behind walls (hatched squares + eye-slash badge), minimize mode.
- [ ] Hex scene and gridless scene: rings with labels.
- [ ] Open a sheet from the sidebar for an actor without a token on the scene: clicking 📏 warns, nothing breaks.
- [ ] Change scene with a pin active: no errors, windows restored.
- [ ] Console has no `Range Finder |` errors throughout.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/live-checklist.md
git commit -m "docs: README and live verification checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
