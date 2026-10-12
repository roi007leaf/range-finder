# Range Finder Multi-system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Range Finder system-agnostic (units, diagonal rules, band marks, Token HUD and item-header triggers, generic `rangeField`), add a D&D 5e adapter, SF2e area-weapon labels, and PF2e/SF2e skill-action ranges with range modifiers.

**Architecture:** The pure core (`scripts/core`) gains band `mark`, unit-aware labels, a default range label and every Foundry diagonal rule. Adapters (`scripts/adapters`) stay the only system-aware code: generic (setting-driven), dnd5e (new), pf2e (+ data table `pf2e-ranges.mjs`, `pf2e-modifiers.mjs`, `pf2e-skills.mjs`). UI gains two universal triggers (`TokenHudList`, `HeaderButton`) built on the existing `Triggers` row machinery, plus an Alt+click per-use "variant" that travels through `PinManager` and the socket.

**Tech Stack:** Foundry VTT v14 ES modules, PIXI (via Foundry), `node --test`, jsdom (dev only).

**Spec:** `docs/superpowers/specs/2026-10-12-range-finder-multisystem-design.md` (builds on `docs/superpowers/specs/2026-10-11-range-finder-design.md`). Data source: `docs/research/pf2e-range-catalog.json` / `.md`.

## Global Constraints

- Foundry VTT v14 only (`module.json` compatibility 14). Systems: `pf2e` 8.6, `sf2e` (same adapter), `dnd5e` 6.x (verified against 6.0.6); everything else uses the generic adapter.
- No runtime dependencies. Tests: `npm test` = `node --test tests/*.test.mjs`; jsdom is a devDependency only. All 107 existing tests stay green (assertions only change where the spec changes behavior; each such change is called out).
- Core stays pure (no Foundry globals) except `scripts/canvas/*` and `main.mjs`.
- Areas: range only. No area shapes are drawn (SF2e area/auto-fire = label suffix only; dnd5e `self` + template = radius of the template size).
- Badge mark precedence: out of range → `✗`; else `band.mark` if set; else `penalty ? fmtPenalty(penalty) : '✓'`. PF2e output unchanged (no marks).
- Labels use scene units: `canvas.scene.grid.units` (fallback `ft`), format `"{n} {units}"`. Adapters return distances in scene units (PF2e/SF2e are feet).
- Default cell measure follows `canvas.grid.diagonals` (`CONST.GRID_DIAGONALS`); default token distance is edge-to-edge over occupied cells. PF2e/SF2e keep alternating + reach-10 rule and `TokenPF2e#distanceTo`.
- New settings exactly: `rangeField` (world, String, default `""`), `tokenHudButton` (client, Boolean, default `true`).
- Token HUD popover is never ghosted; item sheets are ghosted like actor sheets.
- Every DOM injection and hook body is wrapped in try/catch; errors are logged with the `Range Finder |` prefix and never break rendering.
- Out of scope: area-shape previews, dnd5e favorites sidebar rows, Daggerheart/Draw Steel/Crucible adapters, HUD modules other than pf2e-hud, Seek, Force Open / Disable a Device / Pick a Lock buttons.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Metric scenes** (`grid.units = 'm'`, 1.5 m squares): badges must show `7.5 m · ✓`, not a rounded `8 m` — test in Task 1.
2. **Unlinked tokens sharing one actor:** a Token HUD row must pin for the HUD's token, not the actor's first active token — test in Task 12.
3. **dnd5e weapon edge data** (`range.reach` null with `rch`, `long === value`, ranged weapon without a value): correct reach, a single band, a disabled note, no crash — test in Task 4.
4. **Generic `rangeField` pointing at a missing path or a numeric string** (`"30"`): falls back to auto-detect / parses the string — test in Task 3.
5. **Skill-action pin where the pf2e compendium can't be resolved** (SF2e world, `fromUuidSync` null): `resolveItem` returns a stand-in item; an unknown uuid gets no button — test in Task 9.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/core/spec.mjs` | modify | units in labels, band `mark`, `rangeLabel()` |
| `scripts/core/targets.mjs` | modify | `badgeText` marks + units + metric decimals |
| `scripts/core/cells.mjs` | modify | `DIAGONALS`, `diagonalDistance`, `edgeDistance` |
| `scripts/canvas/geometry.mjs` | modify | `sceneUnits()` |
| `scripts/canvas/TargetBadges.mjs` | modify | pass mark + units to `badgeText` |
| `scripts/adapters/measure.mjs` | create | default cell measure + edge-to-edge token distance |
| `scripts/adapters/util.mjs` | create | `itemsOf`, `getPath` |
| `scripts/adapters/generic.mjs` | rewrite | `rangeField`, auto-detect, units, `listItems` |
| `scripts/adapters/dnd5e.mjs` | create | dnd5e specs, rows, `listItems` |
| `scripts/adapters/index.mjs` | modify | register dnd5e |
| `scripts/adapters/pf2e-ranges.mjs` | create | data-only PF2e tables |
| `scripts/adapters/pf2e-util.mjs` | create | PF2e helpers (slug, traits, owned slugs, roll options) |
| `scripts/adapters/pf2e-modifiers.mjs` | create | weapon/reach/spell modifiers, per-use variants |
| `scripts/adapters/pf2e-skills.mjs` | create | skill/feat action rule → spec |
| `scripts/adapters/pf2e.mjs` | modify | SF2e suffix, modifiers, skill dispatch, `altVariant`, `listItems` |
| `scripts/adapters/pf2e-rows.mjs` | modify | skills sidebar + owned action rows |
| `scripts/ui/PinManager.mjs` | modify | `variant` on requests |
| `scripts/ui/Triggers.mjs` | rewrite | Alt variant, preview conflict, whole-row controls, `addRows`, `pinItem`, `ctx.token` |
| `scripts/ui/TokenHudList.mjs` | create | Token HUD 📏 + popover |
| `scripts/ui/HeaderButton.mjs` | create | item-sheet header 📏 (AppV2 + AppV1) |
| `scripts/settings.mjs`, `lang/en.json`, `styles/range-finder.css`, `main.mjs` | modify | wiring |
| `README.md`, `docs/live-checklist.md`, `module.json` | modify | docs |

---

### Task 1: Core — band marks, units in labels and badges, default range label

**Files:**
- Modify: `scripts/core/spec.mjs:20-43` (incrementBands, singleBand, validBand) and append after line 61
- Modify: `scripts/core/targets.mjs:18-22`
- Modify: `scripts/canvas/geometry.mjs` (append after line 56)
- Modify: `scripts/canvas/TargetBadges.mjs:22-56`
- Modify: `main.mjs:4`, `main.mjs:44`, `main.mjs:72`
- Test: `tests/spec.test.mjs`, `tests/targets.test.mjs`, `tests/canvas.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_UNITS = 'ft'`; `incrementBands(increment, max?, units = 'ft')`; `singleBand(max, tone = 'base', label = null, units = 'ft')` (label defaults to `"{max} {units}"`); bands may carry `mark: string` (optional, absent by default); `rangeLabel(spec, units = 'ft') → string`; `badgeText({ distance, penalty, outOfRange, mark = null }, units = 'ft')`; `sceneUnits(canvas = globalThis.canvas) → string`; `TargetBadges#draw(entries, { targets, zoom, blockedFor, units = 'ft' })`; adapters' `specFor` ctx may contain `units`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/spec.test.mjs` (also add `rangeLabel` to the import on line 3):

```js
test('units in labels and optional band marks', () => {
  assert.equal(singleBand(9, 'base', null, 'm')[0].label, '9 m');
  assert.equal(singleBand(30)[0].label, '30 ft');
  assert.deepEqual(incrementBands(10, 20, 'm').map(b => b.label), ['10 m', '20 m · –2']);
  const spec = makeSpec({ kind: 'increments', bands: [...singleBand(150), { min: 150, max: 600, penalty: 0, tone: 'increment', label: '600 ft · Disadv.', mark: 'Disadv.' }] });
  assert.equal(spec.bands[1].mark, 'Disadv.');
  assert.equal('mark' in spec.bands[0], false, 'no mark unless set');
  assert.equal(makeSpec({ kind: 'radius', bands: [{ min: 0, max: 5, penalty: 0, tone: 'base', label: 'x', mark: 3 }] }), null);
});

test('rangeLabel derives a short row label from the spec', () => {
  const bow = makeSpec({ kind: 'increments', bands: [...singleBand(80), { min: 80, max: 320, penalty: 0, tone: 'increment', label: '320 ft · Disadv.', mark: 'Disadv.' }] });
  assert.equal(rangeLabel(bow), '80/320 ft');
  assert.equal(rangeLabel(makeSpec({ kind: 'reach', bands: singleBand(10, 'reach', 'Reach 10 ft') })), 'Reach 10 ft');
  assert.equal(rangeLabel(makeSpec({ kind: 'radius', bands: singleBand(30) })), '30 ft');
  assert.equal(rangeLabel(makeSpec({ kind: 'increments', bands: incrementBands(10, 20, 'm') }), 'm'), '10/20 m');
  assert.equal(rangeLabel(noneSpec('Range: varies')), 'Range: varies');
  assert.equal(rangeLabel(noneSpec()), '');
  assert.equal(rangeLabel(null), '');
});
```

Append to `tests/targets.test.mjs`:

```js
test('badgeText: band mark beats penalty and ✓; ✗ beats the mark; units', () => {
  assert.equal(badgeText({ distance: 200, penalty: 0, outOfRange: false, mark: 'Disadv.' }), '200 ft · Disadv.');
  assert.equal(badgeText({ distance: 700, penalty: null, outOfRange: true, mark: 'Disadv.' }), '700 ft · ✗');
  assert.equal(badgeText({ distance: 45, penalty: -2, outOfRange: false, mark: null }), '45 ft · –2');
  assert.equal(badgeText({ distance: 9, penalty: 0, outOfRange: false }, 'm'), '9 m · ✓');
  assert.equal(badgeText({ distance: NaN, penalty: null, outOfRange: true }, 'm'), '— m · ✗');
});

test('badgeText keeps one decimal on metric scenes (Review Focus 1)', () => {
  assert.equal(badgeText({ distance: 7.5, penalty: 0, outOfRange: false }, 'm'), '7.5 m · ✓');
  assert.equal(badgeText({ distance: 3.0000001, penalty: 0, outOfRange: false }, 'm'), '3 m · ✓');
  assert.equal(badgeText({ distance: 200.4, penalty: null, outOfRange: true }, 'ft'), '200 ft · ✗');
});
```

Append to `tests/canvas.test.mjs` (add `sceneUnits` to the geometry import on line 5):

```js
test('badges use the band mark and the scene units', () => {
  const { PIXI } = fakePIXI();
  const texts = [];
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: text => { texts.push(text); return new Container(); }, settings: () => baseSettings });
  const bow = makeSpec({ kind: 'increments', bands: [...singleBand(45, 'base', null, 'm'), { min: 45, max: 180, penalty: 0, tone: 'increment', label: '180 m · Disadv.', mark: 'Disadv.' }] });
  const goblin = { id: 'g', center: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 100 };
  badges.draw([{ pin: pin(bow), token, adapter: { ...pf2eAdapter, distance: () => 60 }, tint: null, ownerName: null }], { targets: [goblin], zoom: 1, units: 'm' });
  assert.ok(texts.includes('60 m · Disadv.'));
});

test('sceneUnits reads Scene#grid.units with an ft fallback', () => {
  assert.equal(sceneUnits({ scene: { grid: { units: 'm' } } }), 'm');
  assert.equal(sceneUnits({ scene: { grid: { units: '' } } }), 'ft');
  assert.equal(sceneUnits(null), 'ft');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/spec.test.mjs tests/targets.test.mjs tests/canvas.test.mjs`
Expected: FAIL — `rangeLabel` / `sceneUnits` not exported, `'9 ft'` vs `'9 m'`, `'200 ft · ✓'` vs `'200 ft · Disadv.'`.

- [ ] **Step 3: Implement**

In `scripts/core/spec.mjs` replace lines 20-43 (`incrementBands` through `validBand`) with:

```js
export const DEFAULT_UNITS = 'ft';

export function incrementBands(increment, max = increment * MAX_INCREMENTS, units = DEFAULT_UNITS) {
  const bands = [];
  if (!(increment > 0) || !(max > 0)) return bands;
  for (let k = 0; k < MAX_INCREMENTS; k++) {
    const min = k * increment;
    if (min >= max) break;
    const end = Math.min((k + 1) * increment, max);
    const penalty = k === 0 ? 0 : -2 * k;
    bands.push({
      min, max: end, penalty, tone: k === 0 ? 'base' : 'increment',
      label: penalty ? `${end} ${units} · ${fmtPenalty(penalty)}` : `${end} ${units}`
    });
  }
  return bands;
}

/** One band from 0. `label` defaults to "{max} {units}". */
export function singleBand(max, tone = 'base', label = null, units = DEFAULT_UNITS) {
  return [{ min: 0, max, penalty: 0, tone, label: label ?? `${max} ${units}` }];
}

/** Optional per-band badge mark (e.g. dnd5e "Disadv."); replaces ✓ / penalty on target badges. */
const validMark = mark => mark === undefined || mark === null || typeof mark === 'string';

function validBand(band) {
  return Boolean(band) && Number.isFinite(band.min) && Number.isFinite(band.max) && band.min >= 0 && band.max > band.min
    && Number.isFinite(band.penalty) && TONES.includes(band.tone) && typeof band.label === 'string' && validMark(band.mark);
}
```

Append to the end of `scripts/core/spec.mjs`:

```js
/** Short label for list rows: "80/320 ft", "Reach 10 ft", "30 ft", or the note. */
export function rangeLabel(spec, units = DEFAULT_UNITS) {
  if (!spec) return '';
  if (!hasRange(spec)) return spec.note ?? '';
  const first = spec.bands[0], last = spec.bands.at(-1);
  if (spec.kind === 'increments' && spec.bands.length > 1) return `${first.max}/${last.max} ${units}`;
  return first.label || `${first.max} ${units}`;
}
```

In `scripts/core/targets.mjs` replace lines 18-22 with:

```js
const METRIC = new Set(['m', 'km']);
/** Feet round to whole numbers; metric scenes keep one decimal (1.5 m squares). */
const fmtDistance = (distance, units) => (METRIC.has(units) ? Math.round(distance * 10) / 10 : Math.round(distance));

export function badgeText({ distance, penalty, outOfRange, mark = null }, units = 'ft') {
  if (!Number.isFinite(distance)) return `— ${units} · ✗`;
  const sign = outOfRange ? '✗' : mark || (penalty ? fmtPenalty(penalty) : '✓');
  return `${fmtDistance(distance, units)} ${units} · ${sign}`;
}
```

Append to `scripts/canvas/geometry.mjs`:

```js
/** The scene's distance units (`Scene#grid.units`), `ft` when unset. */
export function sceneUnits(c = globalThis.canvas) {
  return c?.scene?.grid?.units || 'ft';
}
```

In `scripts/canvas/TargetBadges.mjs`:
- line 22: `draw(entries, { targets, zoom = 1, blockedFor = () => false, units = 'ft' }) {`
- line 42: `this.container.addChild(this.#badge(result, target, level, entry, settings, zoom, units));`
- line 47: `#badge(result, target, level, { pin, tint }, settings, zoom, units) {`
- line 56: `parts.push(this.makeText(badgeText({ ...result, mark: band?.mark ?? null }, units), { fontSize: 14, fill: s.text }));`

In `main.mjs`:
- line 4: `import { makeText, sceneGeometry, sceneUnits } from './scripts/canvas/geometry.mjs';`
- line 44: `return adapter.specFor({ actor: token.actor, token, item, actionIndex, units: sceneUnits() });`
- line 72: `badges.draw(entries, { targets, zoom: canvas.stage.scale.x, units: sceneUnits(), blockedFor: (entry, target) => geo.losFor(entry.token).point(target.center) });`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 0 failures (existing `'200 ft · ✗'`, `'Reach 5 ft'`, `'45 ft · –2'` assertions unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/core/spec.mjs scripts/core/targets.mjs scripts/canvas/geometry.mjs scripts/canvas/TargetBadges.mjs main.mjs tests/spec.test.mjs tests/targets.test.mjs tests/canvas.test.mjs
git commit -m "feat: band marks, scene units in labels and badges, rangeLabel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core — every grid diagonal rule and edge-to-edge token distance

**Verified facts** (`resources/app/common/constants.mjs:621-662`, `common/grid/square.mjs:486-534`): `GRID_DIAGONALS = { EQUIDISTANT: 0, EXACT: 1, APPROXIMATE: 2, RECTILINEAR: 3, ALTERNATING_1: 4, ALTERNATING_2: 5, ILLEGAL: 6 }`. `SquareGrid#measurePath` (2D) cost: EQUIDISTANT `max`; EXACT `max + (√2−1)·min` (octile — *not* true Euclidean); APPROXIMATE `max + 0.5·min`; RECTILINEAR and ILLEGAL `di + dj`; ALTERNATING_1 `max + floor(min/2)`; ALTERNATING_2 starts `nd = 1.5`, which equals `max + ceil(min/2)`. Distances multiply by `grid.distance`.

**Files:**
- Modify: `scripts/core/cells.mjs:6-14`
- Create: `scripts/adapters/measure.mjs`
- Test: `tests/cells.test.mjs`, create `tests/measure.test.mjs`

**Interfaces:**
- Produces: `DIAGONALS` (frozen, Foundry values); `diagonalDistance(a, b, unit = 5, rule = DIAGONALS.ALTERNATING_1) → number`; `edgeDistance(aCells, bCells, unit, rule) → number` (NaN if either list is empty); `alternatingDistance`, `chebyshevDistance` kept (now wrappers); `sceneRule(canvas?)`; `defaultCellMeasure(spec, unit = 5, rule = sceneRule())` (with `bandSensitive: () => false`); `defaultDistance(source, target, spec, canvas = globalThis.canvas)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/cells.test.mjs` (extend the import on line 3 with `DIAGONALS, diagonalDistance, edgeDistance`):

```js
test('diagonalDistance follows every GRID_DIAGONALS rule (matches SquareGrid#measurePath)', () => {
  const o = { i: 0, j: 0 };
  const points = [{ i: 0, j: 1 }, { i: 1, j: 1 }, { i: 2, j: 2 }, { i: 3, j: 1 }];
  const r2 = Math.SQRT2;
  const cases = [
    [DIAGONALS.EQUIDISTANT, [5, 5, 10, 15]],
    [DIAGONALS.EXACT, [5, 5 * r2, 10 * r2, 5 * (3 + r2 - 1)]],
    [DIAGONALS.APPROXIMATE, [5, 7.5, 15, 17.5]],
    [DIAGONALS.RECTILINEAR, [5, 10, 20, 20]],
    [DIAGONALS.ALTERNATING_1, [5, 5, 15, 15]],
    [DIAGONALS.ALTERNATING_2, [5, 10, 15, 20]],
    [DIAGONALS.ILLEGAL, [5, 10, 20, 20]]
  ];
  for (const [rule, expected] of cases) {
    points.forEach((p, k) => assert.ok(Math.abs(diagonalDistance(o, p, 5, rule) - expected[k]) < 1e-9, `rule ${rule} point ${k}`));
  }
  assert.equal(diagonalDistance(o, { i: 3, j: 3 }, 1.5, DIAGONALS.EQUIDISTANT), 4.5, 'metric unit');
  assert.equal(diagonalDistance(o, { i: 2, j: 2 }), 15, 'default is ALTERNATING_1');
});

test('edgeDistance: closest occupied cells for 1x1 and 2x2 tokens', () => {
  const big = [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }];
  assert.equal(edgeDistance([{ i: 0, j: 0 }], [{ i: 0, j: 1 }]), 5);
  assert.equal(edgeDistance(big, [{ i: 1, j: 3 }]), 10);
  assert.equal(edgeDistance(big, [{ i: 3, j: 3 }], 5, DIAGONALS.EQUIDISTANT), 10);
  assert.ok(Number.isNaN(edgeDistance([], big)));
});
```

Create `tests/measure.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { DIAGONALS } from '../scripts/core/cells.mjs';
import { defaultCellMeasure, defaultDistance, sceneRule } from '../scripts/adapters/measure.mjs';

const tokenAt = cells => ({ center: { x: 0, y: 0 }, document: { getOccupiedGridSpaceOffsets: () => cells } });

test('defaultCellMeasure uses the given rule and ignores bands', () => {
  const m = defaultCellMeasure(null, 5, DIAGONALS.EQUIDISTANT);
  assert.equal(m({ i: 0, j: 0 }, { i: 2, j: 2 }), 10);
  assert.equal(m.bandSensitive({ tone: 'reach', max: 10 }), false);
  assert.equal(defaultCellMeasure(null, 5, DIAGONALS.ALTERNATING_2)({ i: 0, j: 0 }, { i: 1, j: 1 }), 10);
});

test('sceneRule reads canvas.grid.diagonals, ALTERNATING_1 without a canvas', () => {
  assert.equal(sceneRule({ grid: { diagonals: DIAGONALS.EXACT } }), DIAGONALS.EXACT);
  assert.equal(sceneRule(null), DIAGONALS.ALTERNATING_1);
});

test('defaultDistance: edge-to-edge on square grids, centers elsewhere', () => {
  const square = { grid: { isSquare: true, distance: 5, diagonals: DIAGONALS.EQUIDISTANT } };
  const big = tokenAt([{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(defaultDistance(big, tokenAt([{ i: 3, j: 3 }]), null, square), 10);
  assert.equal(defaultDistance(tokenAt([{ i: 0, j: 0 }]), tokenAt([{ i: 0, j: 1 }]), null, square), 5);
  const hex = { grid: { isSquare: false, measurePath: () => ({ distance: 42 }) } };
  assert.equal(defaultDistance(big, tokenAt([]), null, hex), 42);
  assert.ok(Number.isNaN(defaultDistance(big, big, null, null)));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cells.test.mjs tests/measure.test.mjs`
Expected: FAIL — `DIAGONALS` / `diagonalDistance` not exported; `measure.mjs` not found.

- [ ] **Step 3: Implement**

In `scripts/core/cells.mjs` replace lines 6-14 with:

```js
/** Foundry's CONST.GRID_DIAGONALS values (v14 common/constants.mjs). */
export const DIAGONALS = Object.freeze({ EQUIDISTANT: 0, EXACT: 1, APPROXIMATE: 2, RECTILINEAR: 3, ALTERNATING_1: 4, ALTERNATING_2: 5, ILLEGAL: 6 });

/** Cell-to-cell distance under a grid diagonal rule; mirrors SquareGrid#measurePath for 2D offsets. */
export function diagonalDistance(a, b, unit = 5, rule = DIAGONALS.ALTERNATING_1) {
  const di = Math.abs(a.i - b.i), dj = Math.abs(a.j - b.j);
  const straight = Math.max(di, dj), diagonal = Math.min(di, dj);
  switch (rule) {
    case DIAGONALS.EQUIDISTANT: return unit * straight;
    case DIAGONALS.EXACT: return unit * (straight + (Math.SQRT2 - 1) * diagonal);
    case DIAGONALS.APPROXIMATE: return unit * (straight + 0.5 * diagonal);
    case DIAGONALS.RECTILINEAR:
    case DIAGONALS.ILLEGAL: return unit * (di + dj);
    case DIAGONALS.ALTERNATING_2: return unit * (straight + Math.ceil(diagonal / 2));
    case DIAGONALS.ALTERNATING_1:
    default: return unit * (straight + Math.floor(diagonal / 2));
  }
}

/** Square grid, diagonals alternate 5/10/5 (PF2e's rule). */
export function alternatingDistance(a, b, unit = 5) {
  return diagonalDistance(a, b, unit, DIAGONALS.ALTERNATING_1);
}

export function chebyshevDistance(a, b, unit = 5) {
  return diagonalDistance(a, b, unit, DIAGONALS.EQUIDISTANT);
}

/** Edge-to-edge distance between two tokens: the closest pair of their occupied cells. */
export function edgeDistance(aCells, bCells, unit = 5, rule = DIAGONALS.ALTERNATING_1) {
  let best = Infinity;
  for (const a of aCells ?? []) for (const b of bCells ?? []) best = Math.min(best, diagonalDistance(a, b, unit, rule));
  return best === Infinity ? NaN : best;
}
```

Create `scripts/adapters/measure.mjs`:

```js
/** Default measuring for adapters without their own rules: the scene's diagonal rule, edge-to-edge tokens. */
import { DIAGONALS, diagonalDistance, edgeDistance } from '../core/cells.mjs';

export const sceneRule = (c = globalThis.canvas) => c?.grid?.diagonals ?? DIAGONALS.ALTERNATING_1;

export function defaultCellMeasure(_spec, unit = 5, rule = sceneRule()) {
  return Object.assign((from, to) => diagonalDistance(from, to, unit, rule), { bandSensitive: () => false });
}

/** Square grids: closest occupied cells (large tokens match the bands). Hex/gridless: center to center. */
export function defaultDistance(source, target, _spec, c = globalThis.canvas) {
  const grid = c?.grid;
  if (!grid || !source || !target) return NaN;
  if (grid.isSquare) {
    const a = source.document?.getOccupiedGridSpaceOffsets?.();
    const b = target.document?.getOccupiedGridSpaceOffsets?.();
    if (a?.length && b?.length) return edgeDistance(a, b, grid.distance, grid.diagonals);
  }
  if (!grid.measurePath || !source.center || !target.center) return NaN;
  return grid.measurePath([source.center, target.center]).distance;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (existing `distances` test still gets 15 / 20 / 15).

- [ ] **Step 5: Commit**

```bash
git add scripts/core/cells.mjs scripts/adapters/measure.mjs tests/cells.test.mjs tests/measure.test.mjs
git commit -m "feat: diagonalDistance for every grid rule, edge-to-edge default distance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Generic adapter — `rangeField` setting, auto-detect, units, `listItems`

**Files:**
- Create: `scripts/adapters/util.mjs`
- Rewrite: `scripts/adapters/generic.mjs` (all 25 lines)
- Modify: `scripts/settings.mjs:15` (add after `badgesCombatOnly`)
- Modify: `lang/en.json:77-80` (add after `badgesCombatOnly`)
- Test: `tests/adapters.test.mjs`, `tests/settings.test.mjs`

**Interfaces:**
- Consumes: `singleBand(max, tone, label, units)`, `showsButton` (Task 1), `sceneUnits` (Task 1), `defaultCellMeasure`, `defaultDistance` (Task 2).
- Produces: `itemsOf(actor) → Item[]` (arrays, Maps and Foundry Collections); `getPath(object, 'a.b.c')`; `readRange(raw) → { value, long } | null`; `createGenericAdapter({ rangeField = () => setting, units = sceneUnits })`; `genericAdapter` (default instance) with `{ id: 'generic', specFor, cellMeasure, distance, listItems, rows: [] }`. Adapter `listItems(actor) → [{ item, actionIndex, group: 'attacks'|'spells'|'other' }]`.

- [ ] **Step 1: Write the failing tests**

In `tests/adapters.test.mjs`, change line 16 (the long label now carries the spec's "Long" mark) to:

```js
  assert.equal(spec.bands[1].label, '600 ft · Long');
  assert.equal(spec.bands[1].mark, 'Long');
```

Change line 3 to `import { createGenericAdapter, genericAdapter, getPath, readRange } from '../scripts/adapters/generic.mjs';` and append:

```js
test('generic: rangeField path wins, missing path / string numbers fall back (Review Focus 4)', () => {
  const custom = createGenericAdapter({ rangeField: () => 'system.attack.range', units: () => 'ft' });
  assert.equal(custom.specFor({ item: { name: 'Sling', system: { attack: { range: 40 }, range: 10 } } }).bands[0].max, 40);
  assert.equal(custom.specFor({ item: { name: 'Sling', system: { attack: { range: '25' } } } }).bands[0].max, 25);
  assert.equal(custom.specFor({ item: { name: 'Bow', system: { range: { value: 60, units: 'ft' } } } }).bands[0].max, 60, 'path yields nothing → auto-detect');
  const longPath = createGenericAdapter({ rangeField: () => 'system.r', units: () => 'ft' });
  const spec = longPath.specFor({ item: { name: 'Bow', system: { r: { value: 80, long: 320 } } } });
  assert.deepEqual(spec.bands.map(b => [b.max, b.mark ?? null]), [[80, null], [320, 'Long']]);
});

test('generic: auto-detect shapes and scene units', () => {
  const metric = createGenericAdapter({ rangeField: () => '', units: () => 'm' });
  assert.equal(metric.specFor({ item: { name: 'Spear', system: { range: 9 } } }).bands[0].label, '9 m');
  assert.equal(metric.specFor({ item: { name: 'Spear', system: { range: { value: 9, units: 'm' } } } }).kind, 'radius');
  assert.equal(metric.specFor({ item: { name: 'Rope', system: { range: { value: 0 } } } }).kind, 'none');
  assert.deepEqual(readRange('12'), { value: 12, long: 0 });
  assert.equal(readRange('abc'), null);
  assert.equal(getPath({ a: { b: 3 } }, 'a.b'), 3);
  assert.equal(getPath({ a: null }, 'a.b'), undefined);
});

test('generic listItems groups by item type and skips items without a range', () => {
  const adapter = createGenericAdapter({ rangeField: () => '', units: () => 'ft' });
  const items = [
    { name: 'Bow', type: 'weapon', system: { range: 60 } },
    { name: 'Bolt', type: 'spell', system: { range: 120 } },
    { name: 'Wand', type: 'gear', system: { range: { value: 30 } } },
    { name: 'Rope', type: 'gear', system: {} }
  ];
  const list = adapter.listItems({ items: new Map(items.map((item, k) => [String(k), item])) });
  assert.deepEqual(list.map(e => [e.item.name, e.group, e.actionIndex]), [['Bow', 'attacks', null], ['Bolt', 'spells', null], ['Wand', 'other', null]]);
});
```

In `tests/settings.test.mjs` line 21 change the expected map's last entry to `ghostPersistentHud: ['client', false], allowSharing: ['world', true], badgesCombatOnly: ['world', false], rangeField: ['world', '']`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/adapters.test.mjs tests/settings.test.mjs`
Expected: FAIL — `createGenericAdapter` not exported; label `'600 ft · long'`; `rangeField` not registered.

- [ ] **Step 3: Implement**

Create `scripts/adapters/util.mjs`:

```js
/** Small helpers shared by adapters. Pure. */

/** An actor's items as an array (arrays, Maps and Foundry Collections). */
export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  return Array.from(items.values?.() ?? items);
}

/** Read a dotted path ("system.range.value"); undefined when any step is missing. */
export function getPath(object, path) {
  return String(path ?? '').split('.').filter(Boolean)
    .reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}
```

Replace `scripts/adapters/generic.mjs` with:

```js
/** Fallback adapter: a GM-chosen data path (world setting `rangeField`) or an auto-detected item.system.range. */
import { makeSpec, noneSpec, showsButton, singleBand } from '../core/spec.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';
import { getPath, itemsOf } from './util.mjs';

export { getPath };

const settingField = () => {
  try { return globalThis.game?.settings?.get?.('range-finder', 'rangeField') ?? ''; } catch { return ''; }
};

/** A number (or numeric string), `{ value, long }` or `{ value, units }` → `{ value, long }`; else null. */
export function readRange(raw) {
  if (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? { value, long: 0 } : null;
  }
  if (raw && typeof raw === 'object') {
    const value = Number(raw.value) || 0;
    return value > 0 ? { value, long: Number(raw.long) || 0 } : null;
  }
  return null;
}

const groupOf = item => (item.type === 'weapon' ? 'attacks' : item.type === 'spell' ? 'spells' : 'other');

export function createGenericAdapter({ rangeField = settingField, units = sceneUnits } = {}) {
  function specFor({ item, units: given } = {}) {
    if (!item) return noneSpec();
    const name = item.name ?? '';
    const u = given ?? units();
    const path = String(rangeField() ?? '').trim();
    const range = (path ? readRange(getPath(item, path)) : null) ?? readRange(item.system?.range);
    if (!range) return noneSpec(null, name);
    const bands = singleBand(range.value, 'base', null, u);
    if (range.long > range.value) {
      bands.push({ min: range.value, max: range.long, penalty: 0, tone: 'increment', label: `${range.long} ${u} · Long`, mark: 'Long' });
    }
    return makeSpec({ kind: bands.length > 1 ? 'increments' : 'radius', bands, itemName: name });
  }

  function listItems(actor) {
    return itemsOf(actor)
      .filter(item => showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
  }

  return { id: 'generic', specFor, cellMeasure: defaultCellMeasure, distance: defaultDistance, listItems, rows: [] };
}

export const genericAdapter = createGenericAdapter();
```

In `scripts/settings.mjs` after line 15 (`badgesCombatOnly`), add a comma to line 15 and:

```js
  rangeField: { scope: 'world', type: String, default: '' }
```

In `lang/en.json` after the `badgesCombatOnly` block (line 80), add a comma and:

```json
      "rangeField": {
        "Name": "Range Finder: range field (other systems)",
        "Hint": "Item data path holding the range, e.g. system.range.value. A number, or { value, long }. Leave empty to auto-detect system.range. Not used by PF2e, SF2e or D&D 5e."
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (the `generic cellMeasure ... 15` test still passes: no canvas → ALTERNATING_1).

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/util.mjs scripts/adapters/generic.mjs scripts/settings.mjs lang/en.json tests/adapters.test.mjs tests/settings.test.mjs
git commit -m "feat: generic adapter reads the rangeField setting, scene units, listItems

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: D&D 5e adapter — range specs and unit conversion

**Verified facts (dnd5e 6.0.6, `systems/dnd5e/dnd5e.mjs`):**
- `convertLength(value, from, to, { strict = true })` (line 896) is exported on `dnd5e.utils` (`globalThis.dnd5e = {…, utils}` line 95976; `utils.convertLength` line 1765). `CONFIG.DND5E.movementUnits` = `ft`, `mi`, `m` (`10/3` per ft, i.e. 1.5 m = 5 ft), `km`. `rangeTypes` = `self`, `touch`, `spec`, `any`.
- `WeaponData` (line 90520): `system.range = { value, long, reach, units }`; `attackType` getter = `"melee"|"ranged"|null`; `hasRange` = ranged, or `thr` property, or natural with a value; `prepareDerivedData` sets `range.reach = convertLength(rch ? 10 : 5, 'ft', range.units)` when null on melee weapons, `null` on ranged; `properties` is a Set.
- `SpellData` (line 33866): `system.range = RangeField { value (formula → number after prep), units (initial "self"), special }`, `system.target.template = { type, size, units, … }`. `FeatData` (line 89313) has **no** `system.range`: features carry range/target only on activities (`system.activities`, a Collection).
- `CONFIG.DND5E.areaTargetTypes` keys: `circle, cone, cube, cylinder, line, radius (Emanation), ring, sphere, square, wall`.

**Files:**
- Create: `scripts/adapters/dnd5e.mjs`
- Modify: `scripts/adapters/index.mjs:1-4`
- Test: create `tests/dnd5e.test.mjs`; modify `tests/adapters.test.mjs:31-38`

**Interfaces:**
- Consumes: `singleBand`, `makeSpec`, `noneSpec` (Task 1), `sceneUnits` (Task 1), `defaultCellMeasure`, `defaultDistance` (Task 2), `itemsOf` (Task 3).
- Produces: `createDnd5eAdapter({ convert = dnd5e.utils.convertLength wrapper, units = sceneUnits })`, `dnd5eAdapter` (`id: 'dnd5e'`), `getAdapter('dnd5e') === dnd5eAdapter`. Long band: `{ tone: 'increment', mark: 'Disadv.', label: '{long} {u} · Disadv.' }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/dnd5e.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDnd5eAdapter, dnd5eAdapter } from '../scripts/adapters/dnd5e.mjs';

const convert = (value, from, to) => (from === to ? value : from === 'm' && to === 'ft' ? value * 10 / 3 : from === 'ft' && to === 'm' ? value * 0.3 : value);
const dnd = createDnd5eAdapter({ convert, units: () => 'ft' });
const weapon = (name, { attackType, hasRange, props = [], range }) => ({ name, type: 'weapon', system: { attackType, hasRange, properties: new Set(props), range } });
const spell = (name, range, template = {}) => ({ name, type: 'spell', system: { range, target: { template } } });
const longbow = weapon('Longbow', { attackType: 'ranged', hasRange: true, props: ['amm', 'hvy', 'two'], range: { value: 150, long: 600, reach: null, units: 'ft' } });
const dagger = weapon('Dagger', { attackType: 'melee', hasRange: true, props: ['fin', 'lgt', 'thr'], range: { value: 20, long: 60, reach: 5, units: 'ft' } });
const glaive = weapon('Glaive', { attackType: 'melee', hasRange: false, props: ['hvy', 'rch', 'two'], range: { value: null, long: null, reach: 10, units: 'ft' } });

test('longbow 150/600: normal band and a long band marked Disadv.', () => {
  const spec = dnd.specFor({ item: longbow });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 150, penalty: 0, tone: 'base', label: '150 ft' },
    { min: 150, max: 600, penalty: 0, tone: 'increment', label: '600 ft · Disadv.', mark: 'Disadv.' }
  ]);
  assert.deepEqual(spec.overlays, []);
});

test('dagger: thrown 20/60 plus a 5 ft reach overlay', () => {
  const spec = dnd.specFor({ item: dagger });
  assert.deepEqual(spec.bands.map(b => b.max), [20, 60]);
  assert.deepEqual(spec.overlays, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }]);
});

test('glaive: reach 10 band', () => {
  assert.deepEqual(dnd.specFor({ item: glaive }), { kind: 'reach', bands: [{ min: 0, max: 10, penalty: 0, tone: 'reach', label: 'Reach 10 ft' }], overlays: [], note: null, itemName: 'Glaive' });
});

test('weapon edge data (Review Focus 3)', () => {
  const raw = weapon('Halberd', { attackType: 'melee', hasRange: false, props: ['rch'], range: { value: null, long: null, reach: null, units: 'ft' } });
  assert.equal(dnd.specFor({ item: raw }).bands[0].max, 10, 'rch default when reach is unprepared');
  const sling = weapon('Sling', { attackType: 'ranged', hasRange: true, range: { value: 30, long: 30, units: 'ft' } });
  const one = dnd.specFor({ item: sling });
  assert.equal(one.kind, 'radius');
  assert.equal(one.bands.length, 1);
  const broken = weapon('Odd Bow', { attackType: 'ranged', hasRange: true, range: { value: null, long: null, units: 'ft' } });
  assert.equal(dnd.specFor({ item: broken }).kind, 'none');
  assert.equal(dnd.specFor({ item: broken }).note, 'Range: —');
  const fist = weapon('Unarmed', { attackType: null, hasRange: false, range: null });
  assert.equal(dnd.specFor({ item: fist }).bands[0].max, 5);
});

test('spells: distance, touch, self + template, self without template, spec, any', () => {
  assert.deepEqual(dnd.specFor({ item: spell('Fire Bolt', { value: 120, units: 'ft' }) }).bands[0], { min: 0, max: 120, penalty: 0, tone: 'base', label: '120 ft' });
  assert.deepEqual(dnd.specFor({ item: spell('Fire Bolt', { value: '120', units: 'ft' }) }).bands[0].max, 120);
  const grasp = dnd.specFor({ item: spell('Shocking Grasp', { units: 'touch' }) });
  assert.equal(grasp.kind, 'reach');
  assert.equal(grasp.bands[0].label, 'Touch · 5 ft');
  const hands = dnd.specFor({ item: spell('Burning Hands', { units: 'self' }, { type: 'cone', size: 15, units: 'ft' }) });
  assert.equal(hands.kind, 'radius');
  assert.equal(hands.bands[0].label, 'Cone 15 ft');
  assert.equal(dnd.specFor({ item: spell('Spirit Guardians', { units: 'self' }, { type: 'radius', size: 15, units: 'ft' }) }).bands[0].label, 'Emanation 15 ft');
  const shield = dnd.specFor({ item: spell('Shield', { units: 'self' }) });
  assert.equal(shield.kind, 'none');
  assert.equal(shield.note, null);
  assert.equal(dnd.specFor({ item: spell('Wish', { units: 'spec' }) }).note, 'Range: special');
  assert.equal(dnd.specFor({ item: spell('Sending', { units: 'any' }) }).note, 'Range: any');
});

test('features read their first activity', () => {
  const breath = { name: 'Breath Weapon', type: 'feat', system: { activities: new Map([['a', { range: { units: 'self' }, target: { template: { type: 'cone', size: 30, units: 'ft' } } }]]) } };
  assert.equal(dnd.specFor({ item: breath }).bands[0].label, 'Cone 30 ft');
  const sling = { name: 'Hurl', type: 'feat', system: { activities: new Map([['a', { range: { value: 30, units: 'ft' }, target: {} }]]) } };
  assert.equal(dnd.specFor({ item: sling }).bands[0].max, 30);
  assert.equal(dnd.specFor({ item: { name: 'Toughness', type: 'feat', system: {} } }).kind, 'none');
});

test('units: metres item on a feet scene, feet item on a metres scene', () => {
  assert.equal(dnd.specFor({ item: spell('Bolt', { value: 9, units: 'm' }) }).bands[0].max, 30);
  const metric = createDnd5eAdapter({ convert, units: () => 'm' });
  const bow = metric.specFor({ item: longbow });
  assert.deepEqual(bow.bands.map(b => [b.max, b.label]), [[45, '45 m'], [180, '180 m · Disadv.']]);
  assert.equal(metric.specFor({ item: glaive }).bands[0].label, 'Reach 3 m');
  assert.equal(dnd.specFor({ item: longbow, units: 'm' }).bands[0].label.endsWith(' m'), true, 'ctx.units wins');
});

test('default instance: no dnd5e global → identity conversion, scene units ft', () => {
  assert.equal(dnd5eAdapter.id, 'dnd5e');
  assert.equal(dnd5eAdapter.specFor({ item: longbow }).bands[0].max, 150);
  assert.ok(Number.isNaN(dnd5eAdapter.distance({}, {})));
});
```

In `tests/adapters.test.mjs` replace the `registry` test (lines 31-38) with:

```js
test('registry', async () => {
  const { dnd5eAdapter } = await import('../scripts/adapters/dnd5e.mjs');
  assert.equal(getAdapter('pf2e'), pf2eAdapter);
  assert.equal(getAdapter('sf2e'), pf2eAdapter);
  assert.equal(getAdapter('dnd5e'), dnd5eAdapter);
  assert.equal(getAdapter('daggerheart'), genericAdapter);
  const custom = { id: 'x', specFor: () => null, cellMeasure: () => () => 0, distance: () => 0, rows: [] };
  registerAdapter('custom-system', custom);
  assert.equal(getAdapter('custom-system'), custom);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/dnd5e.test.mjs tests/adapters.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/adapters/dnd5e.mjs'`.

- [ ] **Step 3: Implement**

Create `scripts/adapters/dnd5e.mjs`:

```js
/** D&D 5e (6.x) adapter: weapon normal/long range and reach, spell/feature range, scene-unit conversion. */
import { makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';

/** CONFIG.DND5E.movementUnits keys. */
const LENGTH_UNITS = ['ft', 'm', 'mi', 'km'];
/** CONFIG.DND5E.areaTargetTypes keys (dnd5e 6.0.6); `radius` is the Emanation type. */
const AREA_LABELS = {
  circle: 'Circle', cone: 'Cone', cube: 'Cube', cylinder: 'Cylinder', line: 'Line',
  radius: 'Emanation', ring: 'Ring', sphere: 'Sphere', square: 'Square', wall: 'Wall'
};

const systemConvert = (value, from, to) => {
  const convert = globalThis.dnd5e?.utils?.convertLength;
  if (typeof convert !== 'function') return value;
  try { return convert(value, from, to, { strict: false }); } catch { return value; }
};
const round = n => Math.round(n * 100) / 100;
const hasProp = (item, key) => {
  const props = item?.system?.properties;
  return Boolean(props?.has?.(key) ?? props?.includes?.(key));
};
const firstActivity = item => {
  const activities = item?.system?.activities;
  if (!activities) return null;
  return (activities.contents ?? Array.from(activities.values?.() ?? activities))[0] ?? null;
};
const capitalize = text => String(text).charAt(0).toUpperCase() + String(text).slice(1);

export function createDnd5eAdapter({ convert = systemConvert, units = sceneUnits } = {}) {
  /** Item units → scene units, only between known length units. */
  const toScene = (value, from, u) => (from && from !== u && LENGTH_UNITS.includes(from) && LENGTH_UNITS.includes(u)
    ? round(convert(value, from, u)) : value);

  function weaponSpec(item, u) {
    const name = item.name ?? '';
    const sys = item.system ?? {};
    const range = sys.range ?? {};
    const from = range.units || 'ft';
    const reach = Number(range.reach) > 0 ? toScene(Number(range.reach), from, u) : toScene(hasProp(item, 'rch') ? 10 : 5, 'ft', u);
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ${u}` };
    const ranged = sys.hasRange ?? (sys.attackType === 'ranged' || hasProp(item, 'thr'));
    if (ranged && Number(range.value) > 0) {
      const value = toScene(Number(range.value), from, u);
      const long = Number(range.long) > 0 ? toScene(Number(range.long), from, u) : 0;
      const bands = singleBand(value, 'base', null, u);
      if (long > value) bands.push({ min: value, max: long, penalty: 0, tone: 'increment', label: `${long} ${u} · Disadv.`, mark: 'Disadv.' });
      const overlays = sys.attackType === 'melee' && hasProp(item, 'thr') ? [reachBand] : [];
      return makeSpec({ kind: bands.length > 1 ? 'increments' : 'radius', bands, overlays, itemName: name });
    }
    if (sys.attackType === 'ranged') return noneSpec('Range: —', name);
    return makeSpec({ kind: 'reach', bands: [reachBand], itemName: name });
  }

  /** Spells use system.range/target; features (no system.range in 6.x) use their first activity's. */
  function rangedSpec(item, u) {
    const name = item.name ?? '';
    const activity = firstActivity(item);
    const own = item.system?.range;
    const range = own?.units ? own : activity?.range ?? null;
    const target = item.system?.target?.template?.type ? item.system.target : activity?.target ?? item.system?.target ?? null;
    const kind = range?.units ?? '';
    if (LENGTH_UNITS.includes(kind)) {
      const value = Number(range.value) || 0;
      if (!(value > 0)) return noneSpec(null, name);
      return makeSpec({ kind: 'radius', bands: singleBand(toScene(value, kind, u), 'base', null, u), itemName: name });
    }
    if (kind === 'touch') {
      const reach = toScene(5, 'ft', u);
      return makeSpec({ kind: 'reach', bands: singleBand(reach, 'reach', `Touch · ${reach} ${u}`), itemName: name });
    }
    if (kind === 'self') {
      const template = target?.template;
      const size = Number(template?.size) || 0;
      if (!template?.type || !(size > 0)) return noneSpec(null, name);
      const value = toScene(size, template.units || 'ft', u);
      const label = `${AREA_LABELS[template.type] ?? capitalize(template.type)} ${value} ${u}`;
      return makeSpec({ kind: 'radius', bands: singleBand(value, 'base', label, u), itemName: name });
    }
    if (kind === 'spec') return noneSpec('Range: special', name);
    if (kind === 'any') return noneSpec('Range: any', name);
    return noneSpec(null, name);
  }

  function specFor({ item, units: given } = {}) {
    if (!item) return noneSpec();
    const u = given ?? units();
    return item.type === 'weapon' ? weaponSpec(item, u) : rangedSpec(item, u);
  }

  return { id: 'dnd5e', specFor, cellMeasure: defaultCellMeasure, distance: defaultDistance, rows: [] };
}

export const dnd5eAdapter = createDnd5eAdapter();
```

Replace `scripts/adapters/index.mjs` lines 1-4 with:

```js
import { dnd5eAdapter } from './dnd5e.mjs';
import { genericAdapter } from './generic.mjs';
import { pf2eAdapter } from './pf2e.mjs';

const adapters = new Map([['pf2e', pf2eAdapter], ['sf2e', pf2eAdapter], ['dnd5e', dnd5eAdapter]]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. (Glaive in metres: `convert(10,'ft','m') = 3` → `'Reach 3 m'`.)

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/dnd5e.mjs scripts/adapters/index.mjs tests/dnd5e.test.mjs tests/adapters.test.mjs
git commit -m "feat: D&D 5e adapter (weapon normal/long, reach, spells, features, units)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: D&D 5e adapter — sheet rows and `listItems`

**Verified facts:** `CharacterActorSheet` (line 66654) and `NPCActorSheet` (line 69194) extend `BaseActorSheet` (AppV2 `ActorSheetV2`), so Foundry fires `renderCharacterActorSheet` / `renderNPCActorSheet` with an `HTMLElement` (`application.mjs:592`, `#callHooks` per class in the chain). Inventory, features and spellbook parts all render `<{{elements.inventory}} class="inventory-element">` (`elements.inventory = "dnd5e-inventory"`, line 64576; templates `inventory/inventory.hbs:1`, `actors/parts/actor-features.hbs:1`, `actors/parts/actor-spellbook.hbs:1`). Rows: `li.item[data-item-id]` (`inventory.hbs:87`) with `div.item-detail.item-controls` (`inventory/columns/controls.hbs:1`).

**Files:**
- Modify: `scripts/adapters/dnd5e.mjs` (imports and the `return` of `createDnd5eAdapter`)
- Test: `tests/dnd5e.test.mjs`

**Interfaces:**
- Consumes: `Triggers#decorate(root, app, hookName)` (existing), `itemsOf` (Task 3), `showsButton`.
- Produces: `dnd5eRows` (exported), `dnd5eAdapter.listItems(actor)`; weapons → `attacks`, spells → `spells`, others → `other`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/dnd5e.test.mjs` (add `import { JSDOM } from 'jsdom';` and `import { Triggers } from '../scripts/ui/Triggers.mjs';` to the imports):

```js
test('sheet rows: 📏 in .item-controls of inventory/feature/spell rows that have a range', () => {
  const dom = new JSDOM(`<div class="application sheet actor" id="sheet"><dnd5e-inventory class="inventory-element"><ol class="item-list">
    <li class="item" data-item-id="bow"><div class="item-row"><div class="item-name">Longbow</div><div class="item-detail item-controls"></div></div></li>
    <li class="item" data-item-id="rope"><div class="item-row"><div class="item-name">Rope</div><div class="item-detail item-controls"></div></div></li>
  </ol></dnd5e-inventory></div>`);
  const doc = dom.window.document;
  const bow = { ...longbow, uuid: 'Actor.a.Item.bow' };
  const actor = { id: 'a', items: new Map([['bow', bow], ['rope', { name: 'Rope', type: 'loot', uuid: 'Actor.a.Item.rope', system: {} }]]) };
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: dnd, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderCharacterActorSheet');
  const button = doc.querySelector('[data-item-id="bow"] .item-controls .range-finder-btn');
  assert.ok(button);
  assert.equal(doc.querySelector('[data-item-id="rope"] .range-finder-btn'), null);
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0].itemUuid, 'Actor.a.Item.bow');
  assert.equal(calls[0].sourceEl.id, 'sheet');
  assert.deepEqual(dnd.rows[0].hooks, ['renderCharacterActorSheet', 'renderNPCActorSheet']);
});

test('listItems groups weapons, spells and others with a range or note', () => {
  const items = [longbow, spell('Fire Bolt', { value: 120, units: 'ft' }), spell('Wish', { units: 'spec' }), spell('Shield', { units: 'self' }), { name: 'Rope', type: 'loot', system: {} }];
  const breath = { name: 'Breath Weapon', type: 'feat', system: { activities: new Map([['a', { range: { units: 'self' }, target: { template: { type: 'cone', size: 30, units: 'ft' } } }]]) } };
  const list = dnd.listItems({ items: [...items, breath] });
  assert.deepEqual(list.map(e => [e.item.name, e.group]), [['Longbow', 'attacks'], ['Fire Bolt', 'spells'], ['Wish', 'spells'], ['Breath Weapon', 'other']]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/dnd5e.test.mjs`
Expected: FAIL — no button (`rows: []`), `dnd.listItems is not a function`.

- [ ] **Step 3: Implement**

In `scripts/adapters/dnd5e.mjs` change the core import to `import { makeSpec, noneSpec, showsButton, singleBand } from '../core/spec.mjs';`, add `import { itemsOf } from './util.mjs';`, and add above `createDnd5eAdapter`:

```js
/** Character/NPC sheet rows (inventory, features, spellbook all render `.inventory-element`). */
export const dnd5eRows = [
  {
    hooks: ['renderCharacterActorSheet', 'renderNPCActorSheet'],
    selector: '.inventory-element li.item[data-item-id]',
    resolve: (el, app) => {
      const actor = app?.actor ?? app?.document ?? null;
      const item = actor?.items?.get?.(el.dataset.itemId) ?? null;
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope .item-controls') ?? el
  }
];

const groupOf = item => (item.type === 'weapon' ? 'attacks' : item.type === 'spell' ? 'spells' : 'other');
```

Replace the `return { id: 'dnd5e', … }` line inside `createDnd5eAdapter` with:

```js
  function listItems(actor) {
    return itemsOf(actor)
      .filter(item => showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
  }

  return { id: 'dnd5e', specFor, cellMeasure: defaultCellMeasure, distance: defaultDistance, listItems, rows: dnd5eRows };
```

(`main.mjs` already registers a hook for every `adapter.rows[].hooks` entry in `setup`, `main.mjs:137-143`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/dnd5e.mjs tests/dnd5e.test.mjs
git commit -m "feat: D&D 5e sheet rows and Token HUD item list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: SF2e area-fire / auto-fire label suffix

**Verified facts** (`systems/sf2e/sf2e.mjs:35737-35790`, same code in `pf2e.mjs:35760-35780`): a weapon with `system.traits.config.area` (or a grenade) becomes an `area-fire` action via `prepareAreaAttack`; one with the `automatic` trait gets an `auto-fire` alt usage. The area is `automatic` → cone of `max(5, floor(r/2) − floor(r/2) % 5)` where `r = system.range || actor.getReach({ weapon })`; otherwise `config.area = { type: 'burst'|'cone'|'line', value }` with `value || (burst ? 5 : r)`. `config.area` is parsed from traits `area-burst-N`, `area-cone`, `area-line` (`sf2e.mjs:3309-3322`, `7814-7821`). The action object does not expose the area, so we recompute it.

**Files:**
- Modify: `scripts/adapters/pf2e.mjs:16-35` (`weaponSpec`) and add helpers above it
- Test: `tests/pf2e.test.mjs`

**Interfaces:**
- Produces: `areaSuffix(item, fallback = 0) → string | null` (exported from `pf2e.mjs`); first band label becomes `"{label} · {suffix}"`.

- [ ] **Step 1: Write the failing test**

Append to `tests/pf2e.test.mjs`:

```js
test('SF2e area weapons get an area suffix on the first band (no shape drawn)', async () => {
  const { areaSuffix } = await import('../scripts/adapters/pf2e.mjs');
  const rifle = { ...weapon('Rotolaser', { range: { increment: 30, max: 180 }, traits: ['automatic'] }), system: { range: 30, traits: { value: ['automatic'] } } };
  assert.equal(specFor({ actor, item: rifle }).bands[0].label, '30 ft · Auto-fire cone 15 ft');
  assert.equal(specFor({ actor, item: rifle }).bands[1].label, '60 ft · –2');
  const launcher = { ...weapon('Launcher', { range: { increment: 60, max: 360 } }), system: { range: 60, traits: { value: ['area-burst-10'], config: { area: { type: 'burst', value: 10 } } } } };
  assert.equal(specFor({ actor, item: launcher }).bands[0].label, '60 ft · Area burst 10 ft');
  const flamer = weapon('Flamer', { range: { increment: 30, max: 180 }, traits: ['area-cone'] });
  assert.equal(areaSuffix(flamer), 'Area cone 30 ft');
  assert.equal(areaSuffix(longbow), null);
  assert.equal(specFor({ actor, item: longbow }).bands[0].label, '100 ft');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pf2e.test.mjs`
Expected: FAIL — `areaSuffix` is not exported.

- [ ] **Step 3: Implement**

In `scripts/adapters/pf2e.mjs` insert after line 14 (end of `traitNumber`):

```js
/** SF2e area weapons: "Area burst 10 ft", "Auto-fire cone 15 ft". Mirrors CharacterPF2e#prepareAreaAttack. */
export function areaSuffix(item, fallback = 0) {
  const traits = traitsOf(item);
  const base = Number(item?.system?.range) || item?.range?.increment || fallback || 0;
  if (traits.includes('automatic')) {
    const half = Math.floor(base / 2);
    return `Auto-fire cone ${Math.max(5, half - (half % 5))} ft`;
  }
  let area = item?.system?.traits?.config?.area ?? null;
  if (!area?.type) {
    const match = traits.map(trait => String(trait).match(/^area-(burst|cone|line)(?:-(\d+))?$/)).find(Boolean);
    if (match) area = { type: match[1], value: match[2] ? Number(match[2]) : null };
  }
  if (!area?.type) return null;
  const value = Number(area.value) || (area.type === 'burst' ? 5 : base);
  return value > 0 ? `Area ${area.type} ${value} ft` : `Area ${area.type}`;
}

const withSuffix = (bands, suffix) => (suffix && bands.length ? [{ ...bands[0], label: `${bands[0].label} · ${suffix}` }, ...bands.slice(1)] : bands);
```

Replace `weaponSpec` (lines 16-35 before the insert) with:

```js
function weaponSpec(actor, item) {
  const name = item.name ?? '';
  const range = item.range ?? null;
  const overlays = [];
  const volley = traitNumber(item, 'volley');
  if (volley) overlays.push({ min: 0, max: volley, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2' });
  const melee = item.isMelee ?? !range;
  if (melee) {
    const reach = actor?.getReach?.({ action: 'attack', weapon: item }) || 5;
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ft` };
    const suffix = areaSuffix(item, reach);
    // Real PF2e melee weapons have range null; a thrown melee weapon carries its increment in a thrown-N trait.
    const thrown = traitNumber(item, 'thrown') ?? (range?.increment || null);
    if (thrown) return makeSpec({ kind: 'increments', bands: withSuffix(incrementBands(thrown, thrown * 6), suffix), overlays: [reachBand, ...overlays], itemName: name });
    return makeSpec({ kind: 'reach', bands: withSuffix([reachBand], suffix), overlays, itemName: name });
  }
  const suffix = areaSuffix(item);
  const increments = range?.increment ? incrementBands(range.increment, range.max ?? range.increment * 6) : null;
  if (increments?.length) return makeSpec({ kind: 'increments', bands: withSuffix(increments, suffix), overlays, itemName: name });
  if (range?.max > 0) return makeSpec({ kind: 'radius', bands: withSuffix(singleBand(range.max), suffix), overlays, itemName: name });
  return noneSpec('Range: —', name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all existing PF2e band labels unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e.mjs tests/pf2e.test.mjs
git commit -m "feat: SF2e area-fire and auto-fire label suffix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: PF2e range table (`pf2e-ranges.mjs`, data only)

Curated from `docs/research/pf2e-range-catalog.json` (pf2e 8.6.0) applying the spec's "Rules (decided)":
rule 1 (medicine/thievery hands-on actions → `adjacent`; Force Open, Disable a Device, Pick a Lock dropped), rule 2 (Seek dropped), rule 4 (maneuvers → `maneuver` with weapon trait; Trip knows `ranged-trip`), rule 5 (base-action modifiers in `SKILL_MODIFIERS`, feat actions with their own rows in `FEAT_ACTIONS`), rule 6 (area Demoralize feats → `emanation`). Catalog `cone` (Flash Your Badge) becomes a `radius` with a `"Cone 30 ft"` label (range only, no shape). Catalog entries marked "*(not range)*", stance/trigger-only and origin-changing entries are left out. `WEAPON_MODIFIERS` / `REACH_MODIFIERS` hold only what the catalog marks "NOT reflected" by `WeaponPF2e#range` / `CreaturePF2e#getReach`; per-use ones (`perUse: true`, no system toggle) are offered as Alt+click variants (Task 11), like Reach Spell. pf2e-hud's Natural Medicine row uses the feat uuid `WC4xLBGmBsdOdHWu` under the `treatWounds` key → alias of `treat-wounds`.

Property rune keys are camelCase in PF2e (`extending`, `greaterExtending` — `pf2e.mjs` rune config).

**Files:**
- Create: `scripts/adapters/pf2e-ranges.mjs`
- Test: create `tests/pf2e-ranges.test.mjs`

**Interfaces:**
- Produces (all plain objects keyed by slug):
  - `SKILL_ACTIONS[slug] = { name, uuid, aliases?, range }`, `FEAT_ACTIONS[slug] = { name, uuid, range }`; `range` is one of `{ kind: 'radius', feet, label? }`, `{ kind: 'emanation', feet }`, `{ kind: 'adjacent' }`, `{ kind: 'touch' }`, `{ kind: 'reach' }`, `{ kind: 'maneuver', trait, rangedTrait? }`, `{ kind: 'weapon', use: 'increment'|'max', group?, hands? }`.
  - `SKILL_MODIFIERS[featSlug] = { actions: string[], set: feet, toggle? }`.
  - `SPELL_MODIFIERS[slug] = { label, perUse?, prefix?, toggle?, add?, touch?, touchReach?, touchOverlay?, set?, spells?, toTouch? }`.
  - `WEAPON_MODIFIERS[slug] = { label, source?, perUse?, when?, add?, grant? }`, `REACH_MODIFIERS[slug] = { label, source?, perUse?, toggle?, when?, add?, set? }`; `source` ∈ `'actor'` (default: owned item slug) `| 'toggle' | 'rune' | 'ammo' | 'attachment' | 'weapon'`; `when` ⊆ `{ group, thrown, hands, melee, reachN }`.

- [ ] **Step 1: Write the failing test**

Create `tests/pf2e-ranges.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { FEAT_ACTIONS, REACH_MODIFIERS, SKILL_ACTIONS, SKILL_MODIFIERS, SPELL_MODIFIERS, WEAPON_MODIFIERS } from '../scripts/adapters/pf2e-ranges.mjs';

const KINDS = ['radius', 'emanation', 'adjacent', 'touch', 'reach', 'maneuver', 'weapon'];

test('every action entry has a name, a compendium uuid and a known rule', () => {
  for (const [slug, entry] of Object.entries({ ...SKILL_ACTIONS, ...FEAT_ACTIONS })) {
    assert.equal(typeof entry.name, 'string', slug);
    assert.match(entry.uuid, /^Compendium\.pf2e\.[a-z0-9-]+\.Item\.[A-Za-z0-9]{16}$/, slug);
    assert.ok(KINDS.includes(entry.range.kind), slug);
    if (['radius', 'emanation'].includes(entry.range.kind)) assert.ok(entry.range.feet > 0, slug);
  }
  assert.equal(Object.keys(SKILL_ACTIONS).length, 14);
  assert.equal(Object.keys(FEAT_ACTIONS).length, 76);
});

test('uuids (and aliases) are unique across both tables', () => {
  const all = [...Object.values(SKILL_ACTIONS), ...Object.values(FEAT_ACTIONS)].flatMap(e => [e.uuid, ...(e.aliases ?? [])]);
  assert.equal(new Set(all).size, all.length);
});

test('decided rules: hands-on actions adjacent; interact-only actions and Seek absent', () => {
  for (const slug of ['administer-first-aid', 'treat-wounds', 'treat-poison', 'treat-disease', 'steal', 'palm-an-object']) assert.equal(SKILL_ACTIONS[slug].range.kind, 'adjacent', slug);
  assert.equal(FEAT_ACTIONS['battle-medicine'].range.kind, 'adjacent');
  for (const slug of ['seek', 'force-open', 'disable-a-device', 'disable-device', 'pick-a-lock']) {
    assert.equal(SKILL_ACTIONS[slug], undefined, slug);
    assert.equal(FEAT_ACTIONS[slug], undefined, slug);
  }
  assert.deepEqual(SKILL_ACTIONS.trip.range, { kind: 'maneuver', trait: 'trip', rangedTrait: 'ranged-trip' });
  for (const slug of ['shove', 'disarm', 'grapple', 'reposition']) assert.deepEqual(SKILL_ACTIONS[slug].range, { kind: 'maneuver', trait: slug });
  assert.equal(FEAT_ACTIONS['terrifying-howl'].range.kind, 'emanation');
});

test('skill modifiers target known actions', () => {
  const known = new Set([...Object.keys(SKILL_ACTIONS), ...Object.keys(FEAT_ACTIONS)]);
  for (const [slug, mod] of Object.entries(SKILL_MODIFIERS)) {
    assert.ok(mod.set > 0, slug);
    for (const action of mod.actions) assert.ok(known.has(action), `${slug} → ${action}`);
  }
  assert.equal(SKILL_MODIFIERS['legendary-laugh'].set, 60);
  assert.equal(SKILL_MODIFIERS['hydraulic-maneuvers'].toggle, 'hydraulic-maneuvers');
});

test('modifier tables leave out what PF2e already applies; per-use entries carry a label', () => {
  const all = { ...WEAPON_MODIFIERS, ...REACH_MODIFIERS, ...SPELL_MODIFIERS, ...SKILL_MODIFIERS };
  for (const slug of ['far-shot', 'far-lobber', 'uncanny-bombs', 'strong-arm', 'crossbow-crack-shot', 'favorable-winds', 'advanced-rangefinder', 'featherlight-fletching', 'bomb-launcher', 'enlarge', 'giants-stature', 'bendy-arm-mutagen-lesser', 'widen-spell']) {
    assert.equal(all[slug], undefined, slug);
  }
  for (const [slug, mod] of Object.entries({ ...WEAPON_MODIFIERS, ...REACH_MODIFIERS, ...SPELL_MODIFIERS })) assert.equal(typeof mod.label, 'string', slug);
  assert.deepEqual(SPELL_MODIFIERS['reach-spell'], { label: 'Reach Spell', perUse: true, add: 30, touch: 30 });
  assert.equal(REACH_MODIFIERS.lunge.toggle, 'lunge');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pf2e-ranges.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `scripts/adapters/pf2e-ranges.mjs`:

```js
/**
 * PF2e/SF2e ranges the system doesn't carry. Data only — curated from docs/research/pf2e-range-catalog.json (pf2e 8.6.0).
 * Rules: { kind: 'radius', feet, label? } | { kind: 'emanation', feet } | { kind: 'adjacent' } | { kind: 'touch' } | { kind: 'reach' }
 *        | { kind: 'maneuver', trait, rangedTrait? } (best reach of equipped weapons with `trait`, else base reach)
 *        | { kind: 'weapon', use: 'increment'|'max', group?, hands? } (a wielded ranged weapon's first increment / max range)
 */

/** Base skill actions anyone can take (pf2e-hud skills sidebar, Token HUD "Skill actions"). */
export const SKILL_ACTIONS = {
  demoralize: { name: 'Demoralize', uuid: 'Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF', range: { kind: 'radius', feet: 30 } },
  feint: { name: 'Feint', uuid: 'Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X', range: { kind: 'reach' } },
  shove: { name: 'Shove', uuid: 'Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731', range: { kind: 'maneuver', trait: 'shove' } },
  trip: { name: 'Trip', uuid: 'Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP', range: { kind: 'maneuver', trait: 'trip', rangedTrait: 'ranged-trip' } },
  disarm: { name: 'Disarm', uuid: 'Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9', range: { kind: 'maneuver', trait: 'disarm' } },
  grapple: { name: 'Grapple', uuid: 'Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD', range: { kind: 'maneuver', trait: 'grapple' } },
  reposition: { name: 'Reposition', uuid: 'Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T', range: { kind: 'maneuver', trait: 'reposition' } },
  'administer-first-aid': { name: 'Administer First Aid', uuid: 'Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1', range: { kind: 'adjacent' } },
  // pf2e-hud lists Natural Medicine (feat uuid) under the same treatWounds key.
  'treat-wounds': { name: 'Treat Wounds', uuid: 'Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9', aliases: ['Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu'], range: { kind: 'adjacent' } },
  'treat-poison': { name: 'Treat Poison', uuid: 'Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh', range: { kind: 'adjacent' } },
  'treat-disease': { name: 'Treat Disease', uuid: 'Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN', range: { kind: 'adjacent' } },
  steal: { name: 'Steal', uuid: 'Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k', range: { kind: 'adjacent' } },
  'palm-an-object': { name: 'Palm an Object', uuid: 'Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd', range: { kind: 'adjacent' } },
  'encouraging-words': { name: 'Encouraging Words', uuid: 'Compendium.pf2e.actionspf2e.Item.e2ePMDa7ixbLRryj', range: { kind: 'radius', feet: 30 } }
};

/** Feat / feature actions that are ranged skill checks: shown when the actor owns them (by slug). */
export const FEAT_ACTIONS = {
  'bon-mot': { name: 'Bon Mot', uuid: 'Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf', range: { kind: 'radius', feet: 30 } },
  'scare-to-death': { name: 'Scare to Death', uuid: 'Compendium.pf2e.feats-srd.Item.mZttsiWl1ql5NvrH', range: { kind: 'radius', feet: 30 } },
  'dirty-trick': { name: 'Dirty Trick', uuid: 'Compendium.pf2e.feats-srd.Item.5eNKs6738aykAhK2', range: { kind: 'reach' } },
  'battle-medicine': { name: 'Battle Medicine', uuid: 'Compendium.pf2e.feats-srd.Item.wYerMk6F1RZb0Fwt', range: { kind: 'adjacent' } },
  'terrifying-howl': { name: 'Terrifying Howl', uuid: 'Compendium.pf2e.feats-srd.Item.HjinlKihkadhkQ4Z', range: { kind: 'emanation', feet: 30 } },
  'dazzling-display': { name: 'Dazzling Display', uuid: 'Compendium.pf2e.feats-srd.Item.lk80TBn933RECRD7', range: { kind: 'emanation', feet: 30 } },
  'deimatic-display': { name: 'Deimatic Display', uuid: 'Compendium.pf2e.feats-srd.Item.UFVw57jWNC4UCfyN', range: { kind: 'emanation', feet: 30 } },
  'terrifying-transformation': { name: 'Terrifying Transformation', uuid: 'Compendium.pf2e.feats-srd.Item.rAUNZfiulXh4zcm6', range: { kind: 'emanation', feet: 30 } },
  'majestic-proclamation': { name: 'Majestic Proclamation', uuid: 'Compendium.pf2e.feats-srd.Item.SWkeel82rdttxUD3', range: { kind: 'emanation', feet: 30 } },
  'brandish-authority': { name: 'Brandish Authority', uuid: 'Compendium.pf2e.feats-srd.Item.nkYBSuqCWcIgqjj0', range: { kind: 'emanation', feet: 30 } },
  'reach-for-the-sky': { name: 'Reach for the Sky', uuid: 'Compendium.pf2e.feats-srd.Item.ssrublnppwFSvVcb', range: { kind: 'emanation', feet: 30 } },
  'threatening-pursuit': { name: 'Threatening Pursuit', uuid: 'Compendium.pf2e.feats-srd.Item.DJn652sW7nstvXf5', range: { kind: 'emanation', feet: 30 } },
  'tut-tut': { name: 'Tut-Tut', uuid: 'Compendium.pf2e.feats-srd.Item.0ptK0blZehF3ABha', range: { kind: 'emanation', feet: 30 } },
  'flash-your-badge': { name: 'Flash Your Badge', uuid: 'Compendium.pf2e.feats-srd.Item.qbFRPTHP96Q9kGpk', range: { kind: 'radius', feet: 30, label: 'Cone 30 ft' } },
  'talmandors-shout': { name: 'Talmandor\'s Shout', uuid: 'Compendium.pf2e.feats-srd.Item.j305O6rhKvx4sT38', range: { kind: 'emanation', feet: 60 } },
  'terrifying-croak': { name: 'Terrifying Croak', uuid: 'Compendium.pf2e.feats-srd.Item.T8tNZANOWUZiXuzO', range: { kind: 'radius', feet: 30 } },
  'sudden-terror': { name: 'Sudden Terror', uuid: 'Compendium.pf2e.feats-srd.Item.tXn6fJO3Q2dAvCZC', range: { kind: 'radius', feet: 30 } },
  'terrifying-invocation': { name: 'Terrifying Invocation', uuid: 'Compendium.pf2e.feats-srd.Item.HZE37GeNGeBeutZk', range: { kind: 'radius', feet: 30 } },
  'do-you-know-who-i-am': { name: 'Do You Know Who I Am?', uuid: 'Compendium.pf2e.feats-srd.Item.1Z4ps6u7RtA57ksK', range: { kind: 'radius', feet: 30 } },
  'watch-your-back': { name: 'Watch Your Back', uuid: 'Compendium.pf2e.feats-srd.Item.zZCyJhsaugHB6mZW', range: { kind: 'radius', feet: 30 } },
  'edict-of-mortality': { name: 'Edict of Mortality', uuid: 'Compendium.pf2e.feats-srd.Item.pYYSLNUWGMYxYNkG', range: { kind: 'emanation', feet: 60 } },
  'unfaltering-ranks': { name: 'Unfaltering Ranks', uuid: 'Compendium.pf2e.feats-srd.Item.UseAF1tBCb9O2eO7', range: { kind: 'emanation', feet: 60 } },
  'divine-disharmony': { name: 'Divine Disharmony', uuid: 'Compendium.pf2e.feats-srd.Item.fUR72e3t7p2IcqqG', range: { kind: 'radius', feet: 60 } },
  'feign-innocence': { name: 'Feign Innocence', uuid: 'Compendium.pf2e.feats-srd.Item.UhyoBNQbGP6lKjwE', range: { kind: 'radius', feet: 60 } },
  'fabricate-truth': { name: 'Fabricate Truth', uuid: 'Compendium.pf2e.feats-srd.Item.p2McwseYbPZrL5G3', range: { kind: 'radius', feet: 30 } },
  perplex: { name: 'Perplex', uuid: 'Compendium.pf2e.feats-srd.Item.ctl5zNJC3APlHg9o', range: { kind: 'radius', feet: 30 } },
  'guiding-words': { name: 'Guiding Words', uuid: 'Compendium.pf2e.feats-srd.Item.LmsjuqB3rrZTqqa6', range: { kind: 'radius', feet: 30 } },
  'no-cause-for-alarm': { name: 'No Cause for Alarm', uuid: 'Compendium.pf2e.feats-srd.Item.6ON8DjFXSMITZleX', range: { kind: 'emanation', feet: 10 } },
  'seasoned-command': { name: 'Seasoned Command', uuid: 'Compendium.pf2e.feats-srd.Item.c2hPWQ4zdc4CnrnZ', range: { kind: 'radius', feet: 30 } },
  'commitment-to-equality': { name: 'Commitment to Equality', uuid: 'Compendium.pf2e.feats-srd.Item.TMwqXqqggiblvEGZ', range: { kind: 'radius', feet: 30 } },
  'goblin-song': { name: 'Goblin Song', uuid: 'Compendium.pf2e.feats-srd.Item.QZb0Utg0WFPf2Qg0', range: { kind: 'radius', feet: 30 } },
  'catchy-tune': { name: 'Catchy Tune', uuid: 'Compendium.pf2e.feats-srd.Item.ACXWB7a38ETc32Qj', range: { kind: 'emanation', feet: 30 } },
  'alluring-performance': { name: 'Alluring Performance', uuid: 'Compendium.pf2e.feats-srd.Item.VtFuhfIIw8OoLF6v', range: { kind: 'emanation', feet: 15 } },
  primadonna: { name: 'Primadonna', uuid: 'Compendium.pf2e.feats-srd.Item.pBP8KL1yPU3W1Kmh', range: { kind: 'emanation', feet: 30 } },
  'flourishing-finish': { name: 'Flourishing Finish', uuid: 'Compendium.pf2e.feats-srd.Item.isdTXU8bV7ZVOAuQ', range: { kind: 'emanation', feet: 30 } },
  'dance-of-the-jester': { name: 'Dance of the Jester', uuid: 'Compendium.pf2e.feats-srd.Item.ycmxU7gySnfsO1Se', range: { kind: 'radius', feet: 30 } },
  'dance-of-the-tiger': { name: 'Dance of the Tiger', uuid: 'Compendium.pf2e.feats-srd.Item.3xKOqBaPApgsnRtB', range: { kind: 'adjacent' } },
  'leading-dance': { name: 'Leading Dance', uuid: 'Compendium.pf2e.feats-srd.Item.ZHPSASbvbbshq1zG', range: { kind: 'adjacent' } },
  'gunpowder-gauntlet': { name: 'Gunpowder Gauntlet', uuid: 'Compendium.pf2e.feats-srd.Item.FbzbZc4LGUTcz9tA', range: { kind: 'weapon', use: 'increment', group: 'firearm' } },
  'disturbing-knowledge': { name: 'Disturbing Knowledge', uuid: 'Compendium.pf2e.feats-srd.Item.hkSuxXOc9qBleJbd', range: { kind: 'radius', feet: 30 } },
  'battle-prayer': { name: 'Battle Prayer', uuid: 'Compendium.pf2e.feats-srd.Item.nBlzWZnmYuFHrMyV', range: { kind: 'radius', feet: 30 } },
  'banish-falsehoods-of-flesh': { name: 'Banish Falsehoods of Flesh', uuid: 'Compendium.pf2e.feats-srd.Item.Rp8h8cmFIsfDlw7q', range: { kind: 'radius', feet: 30 } },
  'improvise-strategy': { name: 'Improvise Strategy', uuid: 'Compendium.pf2e.feats-srd.Item.XbMfMJq2sCQHdo1w', range: { kind: 'radius', feet: 30 } },
  'unfazed-assessment': { name: 'Unfazed Assessment', uuid: 'Compendium.pf2e.feats-srd.Item.ZyQYP7i26DWhMNux', range: { kind: 'radius', feet: 30 } },
  'sense-alignment': { name: 'Sense Alignment', uuid: 'Compendium.pf2e.feats-srd.Item.iyXw5PnevT2jT8kU', range: { kind: 'radius', feet: 30 } },
  'battlefront-sabotage': { name: 'Battlefront Sabotage', uuid: 'Compendium.pf2e.feats-srd.Item.FtnFytJxa2ix1r5z', range: { kind: 'reach' } },
  tamper: { name: 'Tamper', uuid: 'Compendium.pf2e.feats-srd.Item.SheifYobjKqyK3Fv', range: { kind: 'reach' } },
  'helpful-tinkering': { name: 'Helpful Tinkering', uuid: 'Compendium.pf2e.feats-srd.Item.qUSWPWxYF8gfhfHM', range: { kind: 'reach' } },
  sabotage: { name: 'Sabotage', uuid: 'Compendium.pf2e.feats-srd.Item.vDeG0N4kzTBDTC2b', range: { kind: 'reach' } },
  'surgical-shock': { name: 'Surgical Shock', uuid: 'Compendium.pf2e.feats-srd.Item.zzjfENthtRBAjqjQ', range: { kind: 'reach' } },
  'treat-condition': { name: 'Treat Condition', uuid: 'Compendium.pf2e.feats-srd.Item.rfnEcjxIFqwlJwJT', range: { kind: 'adjacent' } },
  'catfolk-dance': { name: 'Catfolk Dance', uuid: 'Compendium.pf2e.feats-srd.Item.Iqv8qj7ym63YjexN', range: { kind: 'adjacent' } },
  'log-roll': { name: 'Log Roll', uuid: 'Compendium.pf2e.feats-srd.Item.SjJ8BOy5sc8p2H5E', range: { kind: 'adjacent' } },
  'tumbling-strike': { name: 'Tumbling Strike', uuid: 'Compendium.pf2e.feats-srd.Item.jfsmtOx4QgXB19BL', range: { kind: 'adjacent' } },
  'freeze-it': { name: 'Freeze It!', uuid: 'Compendium.pf2e.feats-srd.Item.LhpE0NsfNwYP6MOz', range: { kind: 'adjacent' } },
  'wing-buffet': { name: 'Wing Buffet', uuid: 'Compendium.pf2e.feats-srd.Item.tPi6FAnHYe6ijuyk', range: { kind: 'adjacent' } },
  'bestial-snarling': { name: 'Bestial Snarling', uuid: 'Compendium.pf2e.feats-srd.Item.nCmsylaV144Pr4TZ', range: { kind: 'adjacent' } },
  'daring-act': { name: 'Daring Act', uuid: 'Compendium.pf2e.feats-srd.Item.cny7ouhsoiNsWJ7X', range: { kind: 'reach' } },
  'lassoing-lash': { name: 'Lassoing Lash', uuid: 'Compendium.pf2e.feats-srd.Item.9O7DLcXVXpwLVXI6', range: { kind: 'reach' } },
  'denounce-tyranny': { name: 'Denounce Tyranny', uuid: 'Compendium.pf2e.feats-srd.Item.ISjnymvdFOPED9um', range: { kind: 'radius', feet: 30 } },
  'pistoleros-challenge': { name: 'Pistolero\'s Challenge', uuid: 'Compendium.pf2e.feats-srd.Item.yOyMlFGAgLfRas8m', range: { kind: 'radius', feet: 30 } },
  'stages-of-fate': { name: 'Stages of Fate', uuid: 'Compendium.pf2e.feats-srd.Item.zJsu5JQGGOpyT6Xk', range: { kind: 'radius', feet: 30 } },
  'encouraging-words': { name: 'Encouraging Words', uuid: 'Compendium.pf2e.feats-srd.Item.dUnT3HWMFD3d2eBJ', range: { kind: 'radius', feet: 30 } },
  'declare-anathema': { name: 'Declare Anathema', uuid: 'Compendium.pf2e.feats-srd.Item.7P5aKtFoPVJJPPEV', range: { kind: 'radius', feet: 30 } },
  'flower-street-infamy': { name: 'Flower Street Infamy', uuid: 'Compendium.pf2e.feats-srd.Item.rgmX9TTthBYo508T', range: { kind: 'radius', feet: 30 } },
  'youre-next': { name: 'You\'re Next', uuid: 'Compendium.pf2e.feats-srd.Item.gjec0ts3wkFbjvHN', range: { kind: 'radius', feet: 60 } },
  'warning-shot': { name: 'Warning Shot', uuid: 'Compendium.pf2e.feats-srd.Item.XQEoKoFtq8n3wgA3', range: { kind: 'weapon', use: 'max', group: 'firearm' } },
  'talent-envy': { name: 'Talent Envy', uuid: 'Compendium.pf2e.feats-srd.Item.RR6p9r8l1trcByl2', range: { kind: 'radius', feet: 60 } },
  'pistol-twirl': { name: 'Pistol Twirl', uuid: 'Compendium.pf2e.feats-srd.Item.A2EBy2L4acrehiAA', range: { kind: 'weapon', use: 'increment', hands: '1' } },
  'distracting-toss': { name: 'Distracting Toss', uuid: 'Compendium.pf2e.feats-srd.Item.lGuoGim7J8Z97kor', range: { kind: 'radius', feet: 30 } },
  'prayer-attack': { name: 'Prayer Attack', uuid: 'Compendium.pf2e.feats-srd.Item.AtpMrGXaMPJtDIDR', range: { kind: 'radius', feet: 30 } },
  'it-was-me-all-along': { name: 'It Was Me All Along!', uuid: 'Compendium.pf2e.feats-srd.Item.hPfqQpiq6W8RPCxz', range: { kind: 'radius', feet: 30 } },
  'wave-spiral': { name: 'Wave Spiral', uuid: 'Compendium.pf2e.feats-srd.Item.fLlCodqKXyXbZR7C', range: { kind: 'emanation', feet: 10 } },
  'clear-the-way': { name: 'Clear the Way', uuid: 'Compendium.pf2e.feats-srd.Item.goFxIDlbWd8GN0kj', range: { kind: 'adjacent' } },
  'one-for-all': { name: 'One for All', uuid: 'Compendium.pf2e.feats-srd.Item.bCizH4ByTwbLcYA1', range: { kind: 'radius', feet: 30 } },
  'dimensional-pilfer': { name: 'Dimensional Pilfer', uuid: 'Compendium.pf2e.feats-srd.Item.g3J3kSfnlYjq34Md', range: { kind: 'radius', feet: 60 } }
};

/** Owned feats that change a base action's range (longest wins). `toggle`: only while that roll option is on. */
export const SKILL_MODIFIERS = {
  'legendary-laugh': { actions: ['demoralize'], set: 60 },
  'cunning-trickster-mask': { actions: ['feint'], set: 30 },
  'hydraulic-maneuvers': { actions: ['disarm', 'shove', 'trip'], set: 15, toggle: 'hydraulic-maneuvers' },
  'mages-field-dressing': { actions: ['battle-medicine'], set: 60 },
  'dimensional-pilfer': { actions: ['steal', 'palm-an-object'], set: 60 },
  'thief-of-moonlight': { actions: ['steal', 'palm-an-object'], set: 30 },
  'loud-singer': { actions: ['goblin-song'], set: 60 }
};

/**
 * Spell range changes SpellPF2e#range ignores. `perUse`: cast-time choice → Alt+click variant.
 * add: +feet to a ranged spell; touch: touch → that many feet; touchReach: touch reach becomes N;
 * touchOverlay: extra outline around touch spells; set: fixed range for `spells`; toTouch: ranged → touch.
 */
export const SPELL_MODIFIERS = {
  'reach-spell': { label: 'Reach Spell', perUse: true, add: 30, touch: 30 },
  'grasping-spirits-spell': { label: 'Grasping Spirits Spell', perUse: true, add: 30, touch: 30 },
  'wand-of-reaching': { label: 'Wand of Reaching', perUse: true, prefix: true, add: 30, touch: 30 },
  'touch-focus': { label: 'Touch Focus', toggle: 'touch-focus', toTouch: true },
  'midnight-illusionist-dedication': { label: 'Midnight Illusionist', touchReach: 10 },
  'witchs-charge': { label: 'Witch\'s Charge', touchOverlay: 30 },
  'seven-part-link': { label: 'Seven-Part Link', touchOverlay: 30 },
  'the-distant-grasp': { label: 'The Distant Grasp', spells: ['telekinetic-projectile'], set: 60 },
  'the-oscillating-wave': { label: 'The Oscillating Wave', spells: ['ignition'], set: 60 },
  'the-silent-whisper': { label: 'The Silent Whisper', spells: ['daze'], set: 120 },
  'the-infinite-eye': { label: 'The Infinite Eye', spells: ['guidance'], set: 120 },
  'the-tangible-dream': { label: 'The Tangible Dream', spells: ['figment'], set: 60 }
};

/** Range-increment changes WeaponPF2e#range doesn't reflect. `grant`: gives a thrown increment to matching weapons. */
export const WEAPON_MODIFIERS = {
  'axe-thrower': { label: 'Axe Thrower', when: { group: 'axe', thrown: true }, add: 10, grant: { when: { group: 'axe', hands: '1', melee: true }, thrown: 10 } },
  'harpoon-bolt': { label: 'Harpoon Bolt', source: 'ammo', add: -10 },
  'magnifying-scope': { label: 'Zoom In', source: 'attachment', perUse: true, add: 5 },
  'galloping-launch': { label: 'Galloping Launch', perUse: true, when: { thrown: true }, add: 15 },
  'throw-and-catch': { label: 'Throw and Catch', perUse: true, when: { thrown: true }, add: 40 },
  'scatter-blast': { label: 'Scatter Blast', perUse: true, when: { group: 'firearm' }, add: 20 }
};

/** Reach changes CreaturePF2e#getReach doesn't reflect. Lunge: the system ignores it for reach-N weapons. */
export const REACH_MODIFIERS = {
  lunge: { label: 'Lunge', source: 'toggle', toggle: 'lunge', when: { reachN: true }, add: 5 },
  'looming-gait': { label: 'Looming Gait', perUse: true, set: 10 },
  'well-armed': { label: 'Well-Armed', perUse: true, when: { hands: '1' }, add: 5 },
  'giants-lunge': { label: 'Giant\'s Lunge', perUse: true, set: 10 },
  'mutate-weapon': { label: 'Mutate Weapon', perUse: true, set: 10 },
  extending: { label: 'Extending', source: 'rune', perUse: true, set: 60 },
  greaterExtending: { label: 'Greater Extending', source: 'rune', perUse: true, set: 120 },
  soulpiercer: { label: 'Soulpiercer', source: 'weapon', perUse: true, set: 15 },
  'tasset-of-flexibility': { label: 'Tasset of Flexibility', perUse: true, add: 5 }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pf2e-ranges.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e-ranges.mjs tests/pf2e-ranges.test.mjs
git commit -m "feat: curated PF2e skill-action and range-modifier table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: PF2e weapon, reach and spell modifiers + per-use variants

**Verified facts** (`systems/pf2e/pf2e.mjs`): `CreaturePF2e#getReach({ action, weapon })` (line 34335) returns `reach.base` for `interact`, `item.reach` for NPC `melee` items, `base + 5` for a `reach` trait and `N` for `reach-N` — so Lunge's `reach.base + 5` is ignored for `reach-N`. `WeaponPF2e#hands` (line 51642) → `'0'|'1'|'1+'|'2'` from `system.usage.value`; `WeaponPF2e#ammo` (line 51699) is the loaded ammo item; `subitems` holds attachments. Roll-option toggles (`lunge`, `hydraulic-maneuvers`, `touch-focus`) appear in `actor.getRollOptions()` (catalog `runtime` notes).

**Files:**
- Create: `scripts/adapters/pf2e-util.mjs`, `scripts/adapters/pf2e-modifiers.mjs`
- Rewrite: `scripts/adapters/pf2e.mjs` (full file below; keeps Task 6's `areaSuffix`)
- Test: create `tests/pf2e-modifiers.test.mjs`

**Interfaces:**
- Consumes: tables from Task 7; `itemsOf` (Task 3).
- Produces:
  - `pf2e-util.mjs`: `sluggify(text)` (drops apostrophes), `traitsOf(item)`, `traitNumber(item, slug)`, `slugOf(item)`, `ownedSlugs(actor) → Set`, `rollOptionsOf(actor) → Set`, `baseReach(actor)`, `equippedWeapons(actor)`.
  - `pf2e-modifiers.mjs`: `weaponMatches(weapon, when)`, `modifierPresent(slug, mod, ctx)`, `adjustReach(reach, { actor, weapon, variant }) → { reach, label }`, `adjustIncrement(increment, { actor, weapon, variant }) → { increment, label }`, `grantedThrown(actor, weapon) → feet`, `adjustSpell({ kind: 'feet'|'touch', feet }, { actor, spell, variant }) → { kind, feet, overlay, label }`, `perUseFor(actor, item) → { id, label } | null`.
  - `pf2e.mjs`: `specFor({ actor, item, actionIndex, variant })`, `altVariant({ actor, item, actionIndex }) → { id, label } | null`, `pf2eAdapter.altVariant`. Variant labels: spell band `"Reach Spell 60 ft"`, itemName `"Electric Arc · Reach Spell"`; weapon band `"Extending · Reach 60 ft"`, itemName `"Glaive · Extending"`.

- [ ] **Step 1: Write the failing tests**

Create `tests/pf2e-modifiers.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { altVariant, specFor } from '../scripts/adapters/pf2e.mjs';
import { sluggify } from '../scripts/adapters/pf2e-util.mjs';

const feat = slug => ({ type: 'feat', slug, name: slug });
function makeActor({ items = [], options = [] } = {}) {
  return {
    items,
    system: { attributes: { reach: { base: 5 } }, actions: [] },
    getRollOptions: () => options,
    getReach({ action = 'interact', weapon = null } = {}) {
      if (action !== 'attack') return 5;
      const traits = weapon?.system?.traits?.value ?? [];
      const n = traits.map(t => t.match(/^reach-(\d+)$/)).find(Boolean);
      return n ? Number(n[1]) : traits.includes('reach') ? 10 : 5;
    }
  };
}
const spell = (name, range) => ({ name, type: 'spell', slug: sluggify(name), system: { range: { value: range } } });
const weapon = (name, { melee = true, traits = [], range = null, group = null, hands = '1', runes = [], ammo = null, slug = null } = {}) => ({
  name, type: 'weapon', slug: slug ?? sluggify(name), isMelee: melee, isEquipped: true, range, hands, ammo,
  system: { traits: { value: traits }, group, runes: { property: runes } }
});
const arc = spell('Electric Arc', '30 feet');
const grasp = spell('Shocking Grasp', 'touch');

test('Reach Spell: Alt variant only when owned; +30 ft, touch → 30 ft (spec rule 7)', () => {
  const caster = makeActor({ items: [feat('reach-spell')] });
  assert.deepEqual(altVariant({ actor: caster, item: arc }), { id: 'reach-spell', label: 'Reach Spell' });
  const reached = specFor({ actor: caster, item: arc, variant: 'reach-spell' });
  assert.deepEqual(reached.bands, [{ min: 0, max: 60, penalty: 0, tone: 'base', label: 'Reach Spell 60 ft' }]);
  assert.equal(reached.itemName, 'Electric Arc · Reach Spell');
  const touch = specFor({ actor: caster, item: grasp, variant: 'reach-spell' });
  assert.equal(touch.kind, 'radius');
  assert.equal(touch.bands[0].max, 30);
  assert.equal(specFor({ actor: caster, item: arc }).bands[0].max, 30, 'no variant → unchanged');
  const plain = makeActor();
  assert.equal(altVariant({ actor: plain, item: arc }), null);
  assert.equal(specFor({ actor: plain, item: arc, variant: 'reach-spell' }).bands[0].max, 30, 'not owned → ignored');
  assert.equal(altVariant({ actor: caster, item: spell('Bless', '') }), null, 'no range → no variant');
  const wand = makeActor({ items: [{ type: 'consumable', slug: 'wand-of-reaching-3rd-rank', name: 'Wand' }] });
  assert.deepEqual(altVariant({ actor: wand, item: arc }), { id: 'wand-of-reaching', label: 'Wand of Reaching' });
});

test('a system-applied modifier (Far Shot) is not double-applied', () => {
  const archer = makeActor({ items: [feat('far-shot')] });
  const longbow = weapon('Longbow', { melee: false, range: { increment: 200, max: 1200 } });
  assert.deepEqual(specFor({ actor: archer, item: longbow }).bands.map(b => b.max), [200, 400, 600, 800, 1000, 1200]);
  assert.equal(altVariant({ actor: archer, item: longbow }), null);
});

test('Lunge adds 5 ft to reach-N weapons only (system handles base/reach)', () => {
  const pike = weapon('Long Pike', { traits: ['reach-15'] });
  assert.equal(specFor({ actor: makeActor(), item: pike }).bands[0].max, 15);
  assert.equal(specFor({ actor: makeActor({ options: ['lunge'] }), item: pike }).bands[0].max, 20);
  const whip = weapon('Whip', { traits: ['reach', 'disarm'] });
  assert.equal(specFor({ actor: makeActor({ options: ['lunge'] }), item: whip }).bands[0].max, 10);
});

test('passive weapon modifiers: Harpoon Bolt ammo, Axe Thrower', () => {
  const crossbow = weapon('Crossbow', { melee: false, range: { increment: 120, max: 720 }, ammo: { slug: 'harpoon-bolt', name: 'Harpoon Bolt' } });
  const spec = specFor({ actor: makeActor(), item: crossbow });
  assert.deepEqual([spec.bands[0].max, spec.bands.at(-1).max], [110, 660]);
  const thrower = makeActor({ items: [feat('axe-thrower')] });
  const hatchet = weapon('Hatchet', { traits: ['agile', 'sweep', 'thrown-10'], group: 'axe' });
  const battleAxe = weapon('Battle Axe', { traits: ['sweep'], group: 'axe' });
  const greataxe = weapon('Greataxe', { traits: ['sweep'], group: 'axe', hands: '2' });
  assert.equal(specFor({ actor: thrower, item: hatchet }).bands[0].max, 20);
  assert.equal(specFor({ actor: thrower, item: battleAxe }).kind, 'increments');
  assert.equal(specFor({ actor: thrower, item: battleAxe }).bands[0].max, 10);
  assert.equal(specFor({ actor: thrower, item: greataxe }).kind, 'reach');
  assert.equal(specFor({ actor: makeActor(), item: battleAxe }).kind, 'reach');
});

test('per-use reach (Extending rune) is an Alt variant', () => {
  const glaive = weapon('Glaive', { traits: ['reach', 'forceful'], runes: ['extending'] });
  const actor = makeActor();
  assert.deepEqual(altVariant({ actor, item: glaive }), { id: 'extending', label: 'Extending' });
  const spec = specFor({ actor, item: glaive, variant: 'extending' });
  assert.deepEqual([spec.bands[0].max, spec.bands[0].label, spec.itemName], [60, 'Extending · Reach 60 ft', 'Glaive · Extending']);
  assert.equal(specFor({ actor, item: glaive }).bands[0].max, 10);
});

test('passive spell modifiers: psychic cantrip, Touch Focus toggle, touch reach, Witch\'s Charge outline', () => {
  assert.equal(specFor({ actor: makeActor({ items: [feat('the-silent-whisper')] }), item: spell('Daze', '60 feet') }).bands[0].max, 120);
  const focus = makeActor({ items: [feat('touch-focus')] });
  assert.equal(specFor({ actor: focus, item: arc }).kind, 'radius');
  const toggled = makeActor({ items: [feat('touch-focus')], options: ['touch-focus'] });
  assert.equal(specFor({ actor: toggled, item: arc }).bands[0].label, 'Touch · 5 ft');
  assert.equal(specFor({ actor: makeActor({ items: [feat('midnight-illusionist-dedication')] }), item: grasp }).bands[0].max, 10);
  const witch = specFor({ actor: makeActor({ items: [feat('witchs-charge')] }), item: grasp });
  assert.deepEqual(witch.overlays, [{ min: 0, max: 30, penalty: 0, tone: 'increment', label: 'Witch\'s Charge 30 ft' }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pf2e-modifiers.test.mjs`
Expected: FAIL — `altVariant` not exported / `pf2e-util.mjs` not found.

- [ ] **Step 3: Implement**

Create `scripts/adapters/pf2e-util.mjs`:

```js
/** PF2e helpers shared by the adapter modules. Pure. */
import { itemsOf } from './util.mjs';

/** Like game.pf2e.system.sluggify for our purposes: "You're Next" → "youre-next". */
export const sluggify = text => String(text ?? '').toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const traitsOf = item => item?.system?.traits?.value ?? [];

export function traitNumber(item, slug) {
  for (const trait of traitsOf(item)) {
    const match = String(trait).match(new RegExp(`^${slug}-(\\d+)$`));
    if (match) return Number(match[1]);
  }
  return null;
}

export const slugOf = item => (item ? item.slug ?? item.system?.slug ?? sluggify(item.name) : '');
/** Slugs of everything the actor owns (feats, features, equipment). */
export const ownedSlugs = actor => new Set(itemsOf(actor).map(slugOf).filter(Boolean));

/** The actor's current roll options (toggles such as `lunge`, `hydraulic-maneuvers`). */
export function rollOptionsOf(actor) {
  try { return new Set(actor?.getRollOptions?.() ?? []); } catch { return new Set(); }
}

export const baseReach = actor => Number(actor?.system?.attributes?.reach?.base) || 5;
export const equippedWeapons = actor => itemsOf(actor).filter(item => item?.type === 'weapon' && item.isEquipped !== false);
```

Create `scripts/adapters/pf2e-modifiers.mjs`:

```js
/** PF2e range modifiers the system doesn't apply itself (pf2e-ranges.mjs), and per-use (Alt+click) variants. */
import { REACH_MODIFIERS, SPELL_MODIFIERS, WEAPON_MODIFIERS } from './pf2e-ranges.mjs';
import { baseReach, ownedSlugs, rollOptionsOf, slugOf, sluggify, traitNumber, traitsOf } from './pf2e-util.mjs';
import { itemsOf } from './util.mjs';

const context = (actor, weapon = null) => ({ actor, weapon, owned: ownedSlugs(actor), options: rollOptionsOf(actor) });

export function weaponMatches(weapon, when = {}) {
  if (!weapon) return false;
  const traits = traitsOf(weapon);
  if (when.group && weapon.system?.group !== when.group) return false;
  if (when.thrown && !(traits.includes('thrown') || traitNumber(weapon, 'thrown'))) return false;
  if (when.hands && weapon.hands !== when.hands) return false;
  if (when.melee !== undefined && Boolean(weapon.isMelee) !== when.melee) return false;
  if (when.reachN && !traitNumber(weapon, 'reach')) return false;
  return true;
}

/** Is the modifier's source there (owned item, rune, ammo, attachment, the weapon itself) and its toggle on? */
export function modifierPresent(slug, mod, { weapon = null, owned, options }) {
  if (mod.toggle && !options.has(mod.toggle)) return false;
  switch (mod.source ?? 'actor') {
    case 'toggle': return true;
    case 'rune': return (weapon?.system?.runes?.property ?? []).includes(slug);
    case 'ammo': return Boolean(weapon?.ammo) && slugOf(weapon.ammo) === slug;
    case 'attachment': return itemsOf({ items: weapon?.subitems }).some(sub => slugOf(sub).startsWith(slug));
    case 'weapon': return slugOf(weapon) === slug;
    default: return mod.prefix ? [...owned].some(have => have.startsWith(slug)) : owned.has(slug);
  }
}

/** Melee reach after passive modifiers (Lunge on reach-N) and the chosen per-use one. */
export function adjustReach(reach, { actor, weapon, variant = null }) {
  const ctx = context(actor, weapon);
  let result = reach, label = null;
  for (const [slug, mod] of Object.entries(REACH_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
    if (!weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    if (mod.set) result = Math.max(result, mod.set);
    if (mod.add) result += mod.add;
    if (mod.perUse) label = mod.label;
  }
  return { reach: result, label };
}

/** Range increment after passive modifiers (Axe Thrower, Harpoon Bolt) and the chosen per-use one. */
export function adjustIncrement(increment, { actor, weapon, variant = null }) {
  const ctx = context(actor, weapon);
  let result = increment, label = null;
  for (const [slug, mod] of Object.entries(WEAPON_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
    if (!mod.add || !weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    result += mod.add;
    if (mod.perUse) label = mod.label;
  }
  return { increment: Math.max(5, result), label };
}

/** A thrown increment granted to a weapon that has none (Axe Thrower on one-handed axes). */
export function grantedThrown(actor, weapon) {
  const ctx = context(actor, weapon);
  let best = 0;
  for (const [slug, mod] of Object.entries(WEAPON_MODIFIERS)) {
    if (mod.grant && weaponMatches(weapon, mod.grant.when) && modifierPresent(slug, mod, ctx)) best = Math.max(best, mod.grant.thrown);
  }
  return best;
}

/** `base` = { kind: 'feet'|'touch', feet } from SpellPF2e range text. */
export function adjustSpell(base, { actor, spell, variant = null }) {
  const ctx = context(actor);
  const spellSlug = slugOf(spell);
  let { kind, feet } = base, overlay = null, label = null;
  for (const [slug, mod] of Object.entries(SPELL_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
    if (mod.spells && !mod.spells.includes(spellSlug)) continue;
    if (!modifierPresent(slug, mod, ctx)) continue;
    if (mod.toTouch && kind === 'feet') { kind = 'touch'; feet = baseReach(actor); }
    if (typeof mod.set === 'number') { kind = 'feet'; feet = mod.set; }
    if (kind === 'touch') {
      if (mod.touch) { kind = 'feet'; feet = mod.touch; }
      else if (mod.touchReach) feet = Math.max(feet, mod.touchReach);
      else if (mod.touchOverlay) overlay = { min: 0, max: mod.touchOverlay, penalty: 0, tone: 'increment', label: `${mod.label} ${mod.touchOverlay} ft` };
    } else if (mod.add) {
      feet += mod.add;
    }
    if (mod.perUse) label = mod.label;
  }
  return { kind, feet, overlay, label };
}

const RANGED_SPELL = /^\d+-f(?:ee)?t\b/;

/** The first per-use modifier the actor has for this spell or weapon (Alt+click), or null. */
export function perUseFor(actor, item) {
  if (!item) return null;
  const ctx = context(actor, item);
  if (item.type === 'spell') {
    const range = sluggify(item.system?.range?.value);
    if (range !== 'touch' && !RANGED_SPELL.test(range)) return null;
    for (const [slug, mod] of Object.entries(SPELL_MODIFIERS)) if (mod.perUse && modifierPresent(slug, mod, ctx)) return { id: slug, label: mod.label };
    return null;
  }
  if (item.type !== 'weapon') return null;
  const table = item.isMelee ? REACH_MODIFIERS : WEAPON_MODIFIERS;
  for (const [slug, mod] of Object.entries(table)) {
    if (mod.perUse && weaponMatches(item, mod.when) && modifierPresent(slug, mod, ctx)) return { id: slug, label: mod.label };
  }
  return null;
}
```

Replace `scripts/adapters/pf2e.mjs` with:

```js
/** PF2e/SF2e adapter: item → RangeSpec, PF2e measuring rules, token distance. */
import { alternatingDistance } from '../core/cells.mjs';
import { incrementBands, makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { adjustIncrement, adjustReach, adjustSpell, grantedThrown, perUseFor } from './pf2e-modifiers.mjs';
import { pf2eRows } from './pf2e-rows.mjs';
import { sluggify, traitNumber, traitsOf } from './pf2e-util.mjs';

/** SF2e area weapons: "Area burst 10 ft", "Auto-fire cone 15 ft". Mirrors CharacterPF2e#prepareAreaAttack. */
export function areaSuffix(item, fallback = 0) {
  const traits = traitsOf(item);
  const base = Number(item?.system?.range) || item?.range?.increment || fallback || 0;
  if (traits.includes('automatic')) {
    const half = Math.floor(base / 2);
    return `Auto-fire cone ${Math.max(5, half - (half % 5))} ft`;
  }
  let area = item?.system?.traits?.config?.area ?? null;
  if (!area?.type) {
    const match = traits.map(trait => String(trait).match(/^area-(burst|cone|line)(?:-(\d+))?$/)).find(Boolean);
    if (match) area = { type: match[1], value: match[2] ? Number(match[2]) : null };
  }
  if (!area?.type) return null;
  const value = Number(area.value) || (area.type === 'burst' ? 5 : base);
  return value > 0 ? `Area ${area.type} ${value} ft` : `Area ${area.type}`;
}

const withSuffix = (bands, suffix) => (suffix && bands.length ? [{ ...bands[0], label: `${bands[0].label} · ${suffix}` }, ...bands.slice(1)] : bands);
const named = (name, label) => (label ? `${name} · ${label}` : name);

function weaponSpec(actor, item, variant = null) {
  const name = item.name ?? '';
  const range = item.range ?? null;
  const overlays = [];
  const volley = traitNumber(item, 'volley');
  if (volley) overlays.push({ min: 0, max: volley, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2' });
  const melee = item.isMelee ?? !range;
  if (melee) {
    const { reach, label } = adjustReach(actor?.getReach?.({ action: 'attack', weapon: item }) || 5, { actor, weapon: item, variant });
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: label ? `${label} · Reach ${reach} ft` : `Reach ${reach} ft` };
    const suffix = areaSuffix(item, reach);
    // Real PF2e melee weapons have range null; a thrown melee weapon carries its increment in a thrown-N trait.
    const native = traitNumber(item, 'thrown') ?? (range?.increment || null);
    const thrown = native ? adjustIncrement(native, { actor, weapon: item }).increment : grantedThrown(actor, item) || null;
    if (thrown) return makeSpec({ kind: 'increments', bands: withSuffix(incrementBands(thrown, thrown * 6), suffix), overlays: [reachBand, ...overlays], itemName: named(name, label) });
    return makeSpec({ kind: 'reach', bands: withSuffix([reachBand], suffix), overlays, itemName: named(name, label) });
  }
  const suffix = areaSuffix(item);
  if (range?.increment) {
    const { increment, label } = adjustIncrement(range.increment, { actor, weapon: item, variant });
    const max = increment === range.increment ? range.max ?? increment * 6 : increment * 6;
    const bands = incrementBands(increment, max);
    if (bands.length) return makeSpec({ kind: 'increments', bands: withSuffix(bands, suffix), overlays, itemName: named(name, label) });
  }
  if (range?.max > 0) return makeSpec({ kind: 'radius', bands: withSuffix(singleBand(range.max), suffix), overlays, itemName: name });
  return noneSpec('Range: —', name);
}

function spellSpec(actor, spell, variant = null) {
  const name = spell.name ?? '';
  const raw = String(spell.system?.range?.value ?? '').trim();
  const slug = sluggify(raw);
  const feet = slug.match(/^(\d+)-f(?:ee)?t\b/);
  const base = slug === 'touch' ? { kind: 'touch', feet: actor?.system?.attributes?.reach?.base ?? 5 }
    : feet ? { kind: 'feet', feet: Number(feet[1]) } : null;
  if (base) {
    const range = adjustSpell(base, { actor, spell, variant });
    const overlays = range.overlay ? [range.overlay] : [];
    const itemName = named(name, range.label);
    if (range.kind === 'touch') return makeSpec({ kind: 'reach', bands: singleBand(range.feet, 'reach', `Touch · ${range.feet} ft`), overlays, itemName });
    return makeSpec({ kind: 'radius', bands: singleBand(range.feet, 'base', range.label ? `${range.label} ${range.feet} ft` : `${range.feet} ft`), overlays, itemName });
  }
  const area = spell.system?.area;
  if (!raw && area?.type === 'emanation' && Number(area.value) > 0) {
    return makeSpec({ kind: 'radius', bands: singleBand(Number(area.value), 'base', `Emanation ${Number(area.value)} ft`), itemName: name });
  }
  return noneSpec(raw ? `Range: ${raw}` : null, name);
}

/**
 * The strike's item. The index alone identifies synthetic strikes (no item); for a real item the index
 * may be stale (actions reorder when weapons are added), so the item's own strike wins.
 */
function strikeItem(actor, actionIndex, item) {
  const actions = actor?.system?.actions ?? [];
  const atIndex = actions[actionIndex]?.item ?? null;
  if (!item) return atIndex;
  if (atIndex && atIndex.id === item.id) return atIndex;
  return actions.find(action => action?.item && action.item.id === item.id)?.item ?? item;
}

export function specFor({ actor, item, actionIndex = null, variant = null }) {
  if (actionIndex !== null && actionIndex !== undefined) item = strikeItem(actor, actionIndex, item);
  if (!item) return noneSpec();
  if (item.type === 'spell') return spellSpec(actor, item, variant);
  if (item.type === 'weapon' || item.type === 'melee') return weaponSpec(actor, item, variant);
  return noneSpec(null, item.name ?? '');
}

/** Alt+click variant for a row: the first per-use range modifier the actor has for it. */
export function altVariant({ actor, item, actionIndex = null } = {}) {
  if (actionIndex !== null && actionIndex !== undefined) item = strikeItem(actor, actionIndex, item);
  return perUseFor(actor, item);
}

const isReach10 = band => band?.tone === 'reach' && band.max === 10;

/** PF2e: alternating diagonals; reach exactly 10 also covers the 15 ft double diagonal. */
export function cellMeasure(_spec, unit = 5) {
  const measure = (from, to, band) => {
    if (isReach10(band) && Math.abs(from.i - to.i) === 2 && Math.abs(from.j - to.j) === 2) return 10;
    return alternatingDistance(from, to, unit);
  };
  measure.bandSensitive = isReach10;
  return measure;
}

export function distance(source, target, spec) {
  if (typeof source?.distanceTo !== 'function') return NaN;
  const options = spec?.kind === 'reach' ? { reach: spec.bands[0].max } : {};
  return source.distanceTo(target, options);
}

/** Spells cast from scrolls, wands and staves aren't actor items, so their uuids don't resolve: find them in the spellcasting collections. */
export function resolveItem(actor, uuid) {
  for (const collection of actor?.spellcasting?.collections?.values?.() ?? []) {
    for (const spell of collection?.values?.() ?? []) if (spell?.uuid === uuid) return spell;
  }
  return null;
}

export const pf2eAdapter = { id: 'pf2e', specFor, altVariant, cellMeasure, distance, resolveItem, rows: pf2eRows };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including every pre-existing `tests/pf2e.test.mjs` assertion (no owned items → no modifiers; `'Reach 5 ft'`, `'Touch · 5 ft'`, `'30 ft'` labels unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e-util.mjs scripts/adapters/pf2e-modifiers.mjs scripts/adapters/pf2e.mjs tests/pf2e-modifiers.test.mjs
git commit -m "feat: PF2e range modifiers the system doesn't apply, per-use variants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: PF2e skill-action specs (table rules, modifiers, maneuvers, compendium uuids)

**Verified facts:** `fromUuidSync` (`client/utils/helpers.mjs:189-211`) returns a compendium **index entry** for unloaded compendium documents, and index entries carry `uuid` (`documents/collections/compendium-collection.mjs:64`, `356`); it returns `null` when the pack doesn't exist (e.g. an SF2e world without `pf2e.actionspf2e`). `main.mjs` `build()` (lines 35-49) already tries `fromUuidSync` and falls back to `adapter.resolveItem` — no `main.mjs` change is needed; the adapter resolves index entries by uuid, then by slug/name.

**Files:**
- Create: `scripts/adapters/pf2e-skills.mjs`
- Modify: `scripts/adapters/pf2e.mjs` (imports; `specFor`; `resolveItem`)
- Test: create `tests/pf2e-skills.test.mjs`

**Interfaces:**
- Consumes: Task 7 tables, Task 8 `adjustReach` and `pf2e-util` helpers.
- Produces: `skillEntry(item) → { slug, name, uuid, range, source: 'skill'|'feat' } | null` (by `uuid`, `sourceId`, `_stats.compendiumSource`, then slug/name); `skillItem(uuid) → { uuid, name, type: 'action', slug, img } | null` (table uuid, else `fromUuidSync` → slug); `ruleSpec(actor, rule, name, options)`; `skillSpec(actor, entry, itemName)`; `skillActionItems(actor) → item[]` (base actions as stand-ins + owned `FEAT_ACTIONS` items); `pf2e.specFor` handles any non-spell/non-weapon item found by `skillEntry`; `resolveItem(actor, uuid)` falls back to `skillItem(uuid)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/pf2e-skills.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveItem, specFor } from '../scripts/adapters/pf2e.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS } from '../scripts/adapters/pf2e-ranges.mjs';
import { ruleSpec, skillActionItems, skillEntry, skillItem, skillSpec } from '../scripts/adapters/pf2e-skills.mjs';
import { showsButton } from '../scripts/core/spec.mjs';

const feat = (slug, name = slug) => ({ type: 'feat', slug, name, uuid: `Actor.a.Item.${slug}` });
const weapon = (name, { melee = true, traits = [], range = null, group = null, hands = '1' } = {}) => ({ name, type: 'weapon', isMelee: melee, isEquipped: true, range, hands, system: { traits: { value: traits }, group } });
function makeActor({ items = [], options = [] } = {}) {
  return {
    items,
    system: { attributes: { reach: { base: 5 } }, actions: [] },
    getRollOptions: () => options,
    getReach({ action = 'interact', weapon = null } = {}) {
      if (action !== 'attack') return 5;
      const traits = weapon?.system?.traits?.value ?? [];
      const n = traits.map(t => t.match(/^reach-(\d+)$/)).find(Boolean);
      return n ? Number(n[1]) : traits.includes('reach') ? 10 : 5;
    }
  };
}
const action = slug => skillItem(SKILL_ACTIONS[slug].uuid);
const band = spec => [spec.kind, spec.bands[0].label, spec.bands[0].max];

test('each rule kind → spec and label (radius / emanation / adjacent / touch / reach / cone)', () => {
  const actor = makeActor();
  assert.deepEqual(band(specFor({ actor, item: action('demoralize') })), ['radius', '30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: action('administer-first-aid') })), ['reach', 'Adjacent', 5]);
  assert.deepEqual(band(specFor({ actor, item: action('feint') })), ['reach', 'Reach 5 ft', 5]);
  assert.deepEqual(band(specFor({ actor, item: feat('terrifying-howl') })), ['radius', 'Emanation 30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: feat('flash-your-badge') })), ['radius', 'Cone 30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: feat('battle-medicine') })), ['reach', 'Adjacent', 5]);
  assert.deepEqual(band(ruleSpec(actor, { kind: 'touch' }, 'Lay on Hands')), ['reach', 'Touch · 5 ft', 5]);
  assert.equal(specFor({ actor, item: feat('toughness') }).kind, 'none');
});

test('every table entry builds a button (range or note)', () => {
  const actor = makeActor();
  for (const slug of [...Object.keys(SKILL_ACTIONS), ...Object.keys(FEAT_ACTIONS)]) {
    assert.ok(showsButton(skillSpec(actor, skillEntry({ slug }))), slug);
  }
});

test('base-action modifiers: Legendary Laugh, Mage\'s Field Dressing, Hydraulic Maneuvers only when toggled', () => {
  assert.equal(specFor({ actor: makeActor({ items: [feat('legendary-laugh')] }), item: action('demoralize') }).bands[0].max, 60);
  const medic = makeActor({ items: [feat('battle-medicine'), feat('mages-field-dressing')] });
  assert.equal(specFor({ actor: medic, item: feat('battle-medicine') }).bands[0].max, 60);
  const hydro = [feat('hydraulic-maneuvers')];
  assert.equal(specFor({ actor: makeActor({ items: hydro }), item: action('shove') }).bands[0].max, 5);
  const on = specFor({ actor: makeActor({ items: hydro, options: ['hydraulic-maneuvers'] }), item: action('shove') });
  assert.deepEqual(band(on), ['radius', '15 ft', 15]);
  assert.equal(specFor({ actor: makeActor({ items: hydro, options: ['hydraulic-maneuvers'] }), item: action('grapple') }).bands[0].max, 5);
});

test('athletics maneuvers: matching weapon trait, best reach, base reach otherwise', () => {
  const whip = weapon('Whip', { traits: ['reach', 'disarm', 'trip'] });
  const hook = weapon('Hook', { traits: ['reach-15', 'trip'] });
  const actor = makeActor({ items: [whip] });
  assert.equal(specFor({ actor, item: action('trip') }).bands[0].max, 10);
  assert.equal(specFor({ actor, item: action('disarm') }).bands[0].max, 10);
  assert.equal(specFor({ actor, item: action('grapple') }).bands[0].max, 5);
  assert.equal(specFor({ actor: makeActor({ items: [whip, hook] }), item: action('trip') }).bands[0].max, 15);
  const stowed = { ...hook, isEquipped: false };
  assert.equal(specFor({ actor: makeActor({ items: [stowed] }), item: action('trip') }).bands[0].max, 5);
});

test('Lunge + reach-N on Disarm/Shove/Trip, not Grapple (spec rule 3)', () => {
  const hook = weapon('Hook', { traits: ['reach-15', 'trip', 'grapple'] });
  const lunging = makeActor({ items: [hook], options: ['lunge'] });
  assert.equal(specFor({ actor: lunging, item: action('trip') }).bands[0].max, 20);
  assert.equal(specFor({ actor: lunging, item: action('grapple') }).bands[0].max, 15);
  assert.equal(specFor({ actor: makeActor({ items: [hook] }), item: action('trip') }).bands[0].max, 15);
});

test('ranged trip: first range increment at –2 beyond reach', () => {
  const bola = weapon('Bola', { melee: false, traits: ['nonlethal', 'ranged-trip', 'thrown'], range: { increment: 20, max: 120 } });
  const spec = specFor({ actor: makeActor({ items: [bola] }), item: action('trip') });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' },
    { min: 5, max: 20, penalty: -2, tone: 'increment', label: 'Ranged trip · –2' }
  ]);
});

test('weapon rules: Warning Shot uses the firearm\'s max range; no firearm → note', () => {
  const pistol = weapon('Flintlock Pistol', { melee: false, range: { increment: 30, max: 180 }, group: 'firearm' });
  assert.deepEqual(band(specFor({ actor: makeActor({ items: [pistol] }), item: feat('warning-shot') })), ['radius', '180 ft · Flintlock Pistol', 180]);
  assert.deepEqual(band(specFor({ actor: makeActor({ items: [pistol] }), item: feat('pistol-twirl') })), ['radius', '30 ft · Flintlock Pistol', 30]);
  const none = specFor({ actor: makeActor(), item: feat('warning-shot') });
  assert.equal(none.kind, 'none');
  assert.equal(none.note, 'Range: needs a wielded ranged weapon');
});

test('skillEntry: by uuid (incl. Natural Medicine alias, compendium source) or by name; excluded actions resolve to nothing', () => {
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu' }).slug, 'treat-wounds');
  assert.equal(skillEntry({ uuid: 'Actor.a.Item.x', _stats: { compendiumSource: FEAT_ACTIONS['bon-mot'].uuid } }).slug, 'bon-mot');
  assert.equal(skillEntry({ type: 'feat', name: 'You\'re Next' }).slug, 'youre-next');
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6', name: 'Disable a Device' }), null);
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.actionspf2e.Item.BlAOM2X92SI6HMtJ', name: 'Seek' }), null);
});

test('compendium uuid pins resolve without the pack (Review Focus 5)', () => {
  const uuid = SKILL_ACTIONS.demoralize.uuid;
  const item = resolveItem({}, uuid);
  assert.deepEqual(item, { uuid, name: 'Demoralize', type: 'action', slug: 'demoralize', img: null });
  assert.equal(specFor({ actor: makeActor(), item }).bands[0].max, 30);
  assert.equal(resolveItem({}, 'Compendium.pf2e.actionspf2e.Item.unknownunknown01'), null);
  const index = { _id: '2u915NdUyQan6uKF', uuid, name: 'Demoralize', type: 'action', pack: 'pf2e.actionspf2e' };
  assert.equal(specFor({ actor: makeActor(), item: index }).bands[0].max, 30, 'fromUuidSync index entry');
});

test('skillActionItems: every base action plus owned feat actions', () => {
  const items = skillActionItems(makeActor({ items: [feat('bon-mot', 'Bon Mot'), feat('toughness')] }));
  assert.deepEqual(items.slice(0, 2).map(i => i.slug), ['demoralize', 'feint']);
  assert.equal(items.length, Object.keys(SKILL_ACTIONS).length + 1);
  assert.equal(items.at(-1).name, 'Bon Mot');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pf2e-skills.test.mjs`
Expected: FAIL — `pf2e-skills.mjs` not found.

- [ ] **Step 3: Implement**

Create `scripts/adapters/pf2e-skills.mjs`:

```js
/** PF2e/SF2e skill actions and feat actions: table rule → RangeSpec, with the actor's modifiers. */
import { makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { adjustReach } from './pf2e-modifiers.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS, SKILL_MODIFIERS } from './pf2e-ranges.mjs';
import { baseReach, equippedWeapons, ownedSlugs, rollOptionsOf, slugOf, traitsOf } from './pf2e-util.mjs';
import { itemsOf } from './util.mjs';

const ENTRIES = [
  ...Object.entries(SKILL_ACTIONS).map(([slug, entry]) => ({ ...entry, slug, source: 'skill' })),
  ...Object.entries(FEAT_ACTIONS).map(([slug, entry]) => ({ ...entry, slug, source: 'feat' }))
];
const BY_UUID = new Map();
const BY_SLUG = new Map();
for (const entry of ENTRIES) {
  for (const uuid of [entry.uuid, ...(entry.aliases ?? [])]) if (!BY_UUID.has(uuid)) BY_UUID.set(uuid, entry);
  if (!BY_SLUG.has(entry.slug)) BY_SLUG.set(entry.slug, entry);
}

/** The table entry for an action/feat item, a compendium index entry or a bare `{ uuid }` / `{ slug }`. */
export function skillEntry(item) {
  if (!item) return null;
  for (const uuid of [item.uuid, item.sourceId, item._stats?.compendiumSource]) {
    const hit = uuid ? BY_UUID.get(uuid) : null;
    if (hit) return hit;
  }
  const slug = slugOf(item);
  return slug ? BY_SLUG.get(slug) ?? null : null;
}

/** A stand-in item for a compendium action (pf2e-hud rows, Token HUD list, pins). Unknown uuids try fromUuidSync → slug. */
export function skillItem(uuid) {
  if (!uuid) return null;
  let entry = BY_UUID.get(uuid) ?? null, name = entry?.name, img = null;
  if (!entry) {
    try {
      const doc = globalThis.fromUuidSync?.(uuid) ?? null;
      entry = doc ? skillEntry({ ...doc, uuid: null }) : null;
      name = doc?.name ?? entry?.name;
      img = doc?.img ?? null;
    } catch { entry = null; }
  }
  return entry ? { uuid, name, type: 'action', slug: entry.slug, img } : null;
}

const reachBand = (max, label) => ({ min: 0, max, penalty: 0, tone: 'reach', label });
/** Lunge works for Disarm, Shove and Trip with a weapon that has the trait. */
const LUNGE_MANEUVERS = new Set(['disarm', 'shove', 'trip']);

function maneuverSpec(actor, rule, name) {
  let reach = baseReach(actor);
  for (const weapon of equippedWeapons(actor)) {
    if (weapon.isMelee === false || !traitsOf(weapon).includes(rule.trait)) continue;
    const raw = actor?.getReach?.({ action: 'attack', weapon }) || baseReach(actor);
    reach = Math.max(reach, LUNGE_MANEUVERS.has(rule.trait) ? adjustReach(raw, { actor, weapon }).reach : raw);
  }
  const bands = [reachBand(reach, `Reach ${reach} ft`)];
  const ranged = rule.rangedTrait ? equippedWeapons(actor).find(w => traitsOf(w).includes(rule.rangedTrait) && w.range?.increment > reach) : null;
  if (!ranged) return makeSpec({ kind: 'reach', bands, itemName: name });
  bands.push({ min: reach, max: ranged.range.increment, penalty: -2, tone: 'increment', label: 'Ranged trip · –2' });
  return makeSpec({ kind: 'increments', bands, itemName: name });
}

function weaponRuleSpec(actor, rule, name) {
  const weapon = equippedWeapons(actor).find(w => w.isMelee !== true && w.range?.increment > 0
    && (!rule.group || w.system?.group === rule.group) && (!rule.hands || w.hands === rule.hands));
  if (!weapon) return noneSpec('Range: needs a wielded ranged weapon', name);
  const feet = rule.use === 'max' ? weapon.range.max || weapon.range.increment * 6 : weapon.range.increment;
  return makeSpec({ kind: 'radius', bands: singleBand(feet, 'base', `${feet} ft · ${weapon.name}`), itemName: name });
}

/** A table rule → spec, before the actor's base-action modifiers. */
export function ruleSpec(actor, rule, name = '') {
  switch (rule?.kind) {
    case 'radius': return makeSpec({ kind: 'radius', bands: singleBand(rule.feet, 'base', rule.label ?? `${rule.feet} ft`), itemName: name });
    case 'emanation': return makeSpec({ kind: 'radius', bands: singleBand(rule.feet, 'base', `Emanation ${rule.feet} ft`), itemName: name });
    case 'adjacent': return makeSpec({ kind: 'reach', bands: [reachBand(5, 'Adjacent')], itemName: name });
    case 'touch': {
      const reach = baseReach(actor);
      return makeSpec({ kind: 'reach', bands: [reachBand(reach, `Touch · ${reach} ft`)], itemName: name });
    }
    case 'reach': {
      const reach = actor?.getReach?.({ action: 'attack' }) || baseReach(actor);
      return makeSpec({ kind: 'reach', bands: [reachBand(reach, `Reach ${reach} ft`)], itemName: name });
    }
    case 'maneuver': return maneuverSpec(actor, rule, name);
    case 'weapon': return weaponRuleSpec(actor, rule, name);
    default: return noneSpec(null, name);
  }
}

/** Owned base-action modifiers (Legendary Laugh, Hydraulic Maneuvers while toggled…): the longest range wins. */
function modifiedFeet(slug, owned, options) {
  let feet = 0;
  for (const [featSlug, mod] of Object.entries(SKILL_MODIFIERS)) {
    if (!mod.actions.includes(slug) || !owned.has(featSlug)) continue;
    if (mod.toggle && !options.has(mod.toggle)) continue;
    feet = Math.max(feet, mod.set);
  }
  return feet;
}

export function skillSpec(actor, entry, itemName = entry?.name ?? '') {
  if (!entry) return noneSpec(null, itemName);
  const spec = ruleSpec(actor, entry.range, itemName);
  const feet = modifiedFeet(entry.slug, ownedSlugs(actor), rollOptionsOf(actor));
  if (!spec || !(feet > Math.max(0, ...spec.bands.map(band => band.max)))) return spec;
  return makeSpec({ kind: 'radius', bands: singleBand(feet), itemName });
}

/** Token HUD "Skill actions": every base action (stand-ins) plus the feat actions the actor owns. */
export function skillActionItems(actor) {
  const base = Object.values(SKILL_ACTIONS).map(entry => skillItem(entry.uuid));
  const feats = itemsOf(actor).filter(item => (item?.type === 'feat' || item?.type === 'action') && FEAT_ACTIONS[slugOf(item)]);
  return [...base, ...feats];
}
```

In `scripts/adapters/pf2e.mjs`:
- add after the `pf2e-modifiers` import: `import { skillEntry, skillItem, skillSpec } from './pf2e-skills.mjs';`
- in `specFor`, replace the final `return noneSpec(null, item.name ?? '');` with:

```js
  const entry = skillEntry(item);
  if (entry) return skillSpec(actor, entry, item.name ?? entry.name);
  return noneSpec(null, item.name ?? '');
```

- in `resolveItem`, replace the final `return null;` with:

```js
  // Skill-action pins carry the action's compendium uuid; resolve it even when the pack isn't available.
  return skillItem(uuid);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (existing `resolveItem(caster, 'Actor.a.Item.nope') === null` holds: not a table uuid and `fromUuidSync` is undefined in node).

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e-skills.mjs scripts/adapters/pf2e.mjs tests/pf2e-skills.test.mjs
git commit -m "feat: PF2e skill-action and feat-action ranges with modifiers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: PF2e skill-action triggers and `listItems`

**Verified facts:**
- pf2e-hud 2.56.2 `templates/partials/statistic-action.hbs:2`: skills sidebar rows are `.item.statistic[data-item-uuid][data-statistic]` with a `.controls` child; the class is `SkillsSidebarPF2eHUD` (named via `static { a(this, "SkillsSidebarPF2eHUD") }` in `scripts/main.js`), so the hook is `renderSkillsSidebarPF2eHUD`. `data-item-uuid` is the action's `sourceId` (e.g. `disable-device` → `Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6`, Bon Mot → its feat uuid, Natural Medicine → feat `WC4xLBGmBsdOdHWu`); Encouraging Words is not listed.
- pf2e-hud `templates/sidebar/actions.hbs:246-253`: owned action rows `.item.action[data-item-id]` (+ `data-item-uuid` for virtual actions) with `.name` and `.controls`.
- PF2e `templates/actors/partials/action.hbs:1-23` (character sheet Actions tab): `li.action.item[data-item-id][data-uuid]` with `h4.name` and `div.button-group`.

**Files:**
- Modify: `scripts/adapters/pf2e-rows.mjs` (import + 3 row definitions appended to `pf2eRows`, lines 24-83)
- Modify: `scripts/adapters/pf2e.mjs` (add `listItems`, export it on `pf2eAdapter`)
- Test: create `tests/pf2e-rows.test.mjs`

**Interfaces:**
- Consumes: `skillItem`, `skillActionItems` (Task 9), `Triggers#decorate`.
- Produces: `pf2eAdapter.listItems(actor) → [{ item, actionIndex, group: 'attacks'|'spells'|'skills'|'other' }]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/pf2e-rows.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { pf2eAdapter } from '../scripts/adapters/pf2e.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS } from '../scripts/adapters/pf2e-ranges.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';

const actor = {
  items: new Map([
    ['bm', { id: 'bm', type: 'feat', slug: 'battle-medicine', name: 'Battle Medicine', uuid: 'Actor.a.Item.bm' }],
    ['tough', { id: 'tough', type: 'feat', slug: 'toughness', name: 'Toughness', uuid: 'Actor.a.Item.tough' }]
  ]),
  system: { attributes: { reach: { base: 5 } }, actions: [] },
  getReach: () => 5
};

function setup(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: pf2eAdapter, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  return { dom, doc, triggers, calls };
}
const statistic = uuid => `<div class="statistic-wrapper item-wrapper"><div class="item statistic" data-item-uuid="${uuid}" data-statistic="x"><div class="name"><a>row</a></div><div class="controls"></div></div></div>`;

test('pf2e-hud skills sidebar: rows resolve by data-item-uuid; excluded actions get no button', () => {
  const { dom, doc, triggers, calls } = setup(`<section id="pf2e-hud-sidebar">
    ${statistic(SKILL_ACTIONS.demoralize.uuid)}
    ${statistic('Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6')}
    ${statistic(FEAT_ACTIONS['bon-mot'].uuid)}
    ${statistic('Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo')}
  </section>`);
  triggers.decorate(doc.getElementById('pf2e-hud-sidebar'), { actor }, 'renderSkillsSidebarPF2eHUD');
  const buttons = [...doc.querySelectorAll('.item.statistic')].map(row => Boolean(row.querySelector(':scope > .controls > .range-finder-btn')));
  assert.deepEqual(buttons, [true, false, true, false]);
  doc.querySelector('.range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0].itemUuid, SKILL_ACTIONS.demoralize.uuid);
  assert.deepEqual(calls[0].sourceEl.map(el => el.id), ['pf2e-hud-sidebar'], 'ghosts the HUD sidebar like other HUD rows');
});

test('owned action rows: character sheet and pf2e-hud actions sidebar, only for table actions', () => {
  const sheet = setup(`<div class="application" id="sheet"><ol class="actions-list">
    <li class="action item" data-item-id="bm"><h4 class="name"><a>Battle Medicine</a></h4><div class="button-group"></div></li>
    <li class="action item" data-item-id="tough"><h4 class="name"><a>Toughness</a></h4><div class="button-group"></div></li>
  </ol></div>`);
  sheet.triggers.decorate(sheet.doc.getElementById('sheet'), { actor }, 'renderCharacterSheetPF2e');
  assert.ok(sheet.doc.querySelector('[data-item-id="bm"] > .button-group > .range-finder-btn'));
  assert.equal(sheet.doc.querySelector('[data-item-id="tough"] .range-finder-btn'), null);
  const hud = setup(`<section id="pf2e-hud-sidebar">
    <div class="item action" data-item-id="bm"><div class="name"><a>Battle Medicine</a></div><div class="controls"></div></div>
    <div class="item action" data-item-id="virtual" data-item-uuid="${SKILL_ACTIONS.demoralize.uuid}"><div class="name"><a>Demoralize</a></div><div class="controls"></div></div>
  </section>`);
  hud.triggers.decorate(hud.doc.getElementById('pf2e-hud-sidebar'), { actor }, 'renderActionsSidebarPF2eHUD');
  assert.equal(hud.doc.querySelectorAll('.item.action > .controls > .range-finder-btn').length, 2);
});

test('listItems: strikes, all spellcasting spells, other weapons, skill actions', () => {
  const longbow = { id: 'bow', name: 'Longbow', type: 'weapon', isMelee: false, range: { increment: 100, max: 600 }, system: { traits: { value: [] } } };
  const sling = { id: 'sling', name: 'Sling', type: 'weapon', isMelee: false, range: { increment: 50, max: 300 }, system: { traits: { value: [] } } };
  const hidden = { id: 'fist', name: 'Fist', type: 'weapon', isMelee: true, system: { traits: { value: [] } } };
  const arc = { uuid: 'Actor.a.Item.arc', name: 'Electric Arc', type: 'spell', system: { range: { value: '30 feet' } } };
  const haste = { uuid: 'Actor.a.Item.haste', name: 'Haste', type: 'spell', system: { range: { value: '30 feet' } } };
  const caster = {
    ...actor,
    items: [longbow, sling, { id: 'bm', type: 'feat', slug: 'bon-mot', name: 'Bon Mot', uuid: 'Actor.a.Item.bm' }],
    system: { ...actor.system, actions: [{ item: longbow }, { item: hidden, visible: false }] },
    spellcasting: { collections: new Map([['arcane', new Map([['arc', arc]])], ['wand', new Map([['haste', haste], ['arc', arc]])]]) }
  };
  const list = pf2eAdapter.listItems(caster);
  const byGroup = group => list.filter(e => e.group === group).map(e => e.item.name);
  assert.deepEqual(byGroup('attacks'), ['Longbow']);
  assert.equal(list[0].actionIndex, 0);
  assert.deepEqual(byGroup('spells'), ['Electric Arc', 'Haste']);
  assert.deepEqual(byGroup('other'), ['Sling']);
  assert.ok(byGroup('skills').includes('Demoralize'));
  assert.ok(byGroup('skills').includes('Bon Mot'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pf2e-rows.test.mjs`
Expected: FAIL — no buttons on skills rows; `pf2eAdapter.listItems is not a function`.

- [ ] **Step 3: Implement**

In `scripts/adapters/pf2e-rows.mjs` add at the top (line 1, after the doc comment):

```js
import { skillItem } from './pf2e-skills.mjs';
```

and append these entries to the `pf2eRows` array (before its closing `];`, adding a comma after the shortcuts entry):

```js
  {
    // Character sheet Actions tab: owned action/feat items whose slug is a ranged skill action.
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.action.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item && (item.type === 'action' || item.type === 'feat') ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .button-group') ?? controlsHost(el)
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.action[data-item-id]',
    resolve: (el, app) => {
      const actor = hudActor(app);
      const item = itemOf(actor, el.dataset.itemId) ?? skillItem(el.dataset.itemUuid);
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost
  },
  {
    // Skills sidebar: rows carry the action's compendium uuid (avoids pf2e-hud's key mismatches, e.g. disable-device).
    hooks: ['renderSkillsSidebarPF2eHUD'],
    selector: '.item.statistic[data-item-uuid]',
    resolve: (el, app) => {
      const item = skillItem(el.dataset.itemUuid);
      return item ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost
  }
```

In `scripts/adapters/pf2e.mjs` change the skills import to `import { skillActionItems, skillEntry, skillItem, skillSpec } from './pf2e-skills.mjs';`, add `import { itemsOf } from './util.mjs';`, and replace the `pf2eAdapter` line with:

```js
/** Token HUD list: strikes, every spellcasting entry's spells (incl. scrolls/wands/staves), other weapons, skill actions. */
export function listItems(actor) {
  const out = [];
  const strikeIds = new Set();
  (actor?.system?.actions ?? []).forEach((action, index) => {
    if (!action?.item || action.visible === false) return;
    strikeIds.add(action.item.id);
    out.push({ item: action.item, actionIndex: index, group: 'attacks' });
  });
  const spellUuids = new Set();
  for (const collection of actor?.spellcasting?.collections?.values?.() ?? []) {
    for (const spell of collection?.values?.() ?? []) {
      if (!spell?.uuid || spellUuids.has(spell.uuid)) continue;
      spellUuids.add(spell.uuid);
      out.push({ item: spell, actionIndex: null, group: 'spells' });
    }
  }
  for (const item of itemsOf(actor)) {
    if ((item?.type === 'weapon' || item?.type === 'melee') && !strikeIds.has(item.id)) out.push({ item, actionIndex: null, group: 'other' });
  }
  for (const item of skillActionItems(actor)) out.push({ item, actionIndex: null, group: 'skills' });
  return out;
}

export const pf2eAdapter = { id: 'pf2e', specFor, altVariant, cellMeasure, distance, resolveItem, listItems, rows: pf2eRows };
```

Hidden strikes (`visible === false`) are left out of `attacks`; a hidden strike whose item is also an actor weapon would appear under `other`, which is acceptable (it is still a real weapon).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. The existing "every PF2eHUD row has ghostTargets" assertion still holds (both new HUD rows define `ghostTargets`).

- [ ] **Step 5: Commit**

```bash
git add scripts/adapters/pf2e-rows.mjs scripts/adapters/pf2e.mjs tests/pf2e-rows.test.mjs
git commit -m "feat: PF2e skill-action buttons in pf2e-hud and sheets, Token HUD item list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Alt+click variants through pins and sockets; Alt+click vs hold-Alt preview

**Conflict analysis:** the preview key defaults to `AltLeft` (`main.mjs:112`), and a preview ghosts the source window with `pointer-events: none` (`styles/range-finder.css:13`), so a running hover-preview would swallow the Alt+click. Resolution (spec rule 7, "click wins"): (a) hovering a 📏 button that offers a variant never starts the hover-preview; (b) an Alt `pointerdown` (capture phase) on a variant control ends any running preview and blocks new previews until the preview key is released. Rows without a variant behave exactly as before.

**Files:**
- Modify: `scripts/ui/PinManager.mjs:4`, `:22-30`, `:32-34`, `:111-112`
- Rewrite: `scripts/ui/Triggers.mjs` (full file below)
- Modify: `main.mjs:35` and `main.mjs:44` (`build`)
- Modify: `lang/en.json:3-5` (`Button`)
- Test: `tests/pins.test.mjs`, `tests/triggers.test.mjs`

**Interfaces:**
- Consumes: `adapter.altVariant(ctx) → { id, label } | null` (pf2e, Task 8; other adapters omit it).
- Produces: `PinManager#toggle({ tokenId, itemUuid, actionIndex, variant = null, share, sourceEl })`; requests, stored pins and socket `pin` messages carry `variant` **only when set**; `PinManager#pinFor(request)` ignores the variant (button state); `build({ tokenId, itemUuid, actionIndex, variant })` → `adapter.specFor({ …, variant, units })`. Triggers: controls with a variant get `data-range-finder-alt="<id>"` and tooltip `"{Show} · {Alt} {label}"`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/pins.test.mjs`:

```js
test('variant pins (Alt+click) are distinct, broadcast their variant, keep the button active', () => {
  const builds = [];
  const { pins, sent } = setup();
  pins.build = request => { builds.push(request); return makeSpec({ kind: 'radius', bands: singleBand(request.variant ? 60 : 30) }); };
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.arc', variant: 'reach-spell', share: true }), 'pinned');
  assert.equal(pins.all()[0].spec.bands[0].max, 60);
  assert.deepEqual(builds.at(-1), { tokenId: 't1', itemUuid: 'Item.arc', actionIndex: null, variant: 'reach-spell' });
  assert.deepEqual(sent.at(-1), { action: 'pin', userId: 'me', tokenId: 't1', itemUuid: 'Item.arc', actionIndex: null, variant: 'reach-spell' });
  assert.ok(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.arc', actionIndex: null }), 'button active whatever the variant');
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.arc' }), 'pinned', 'plain click switches to the plain range');
  assert.equal(pins.all()[0].spec.bands[0].max, 30);
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.arc' }), 'unpinned');
});

test('receive rebuilds a shared variant pin', () => {
  const { pins } = setup();
  pins.build = request => makeSpec({ kind: 'radius', bands: singleBand(request.variant ? 60 : 30) });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.arc', actionIndex: null, variant: 'reach-spell' });
  assert.equal(pins.all()[0].variant, 'reach-spell');
  assert.equal(pins.all()[0].spec.bands[0].max, 60);
});
```

Append to `tests/triggers.test.mjs`:

```js
const reachSpell = ctx => (ctx.item.uuid === 'Item.bow' ? { id: 'reach-spell', label: 'Reach Spell' } : null);

test('Alt+click pins the adapter\'s per-use variant; plain click does not (spec rule 7)', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.adapter.altVariant = reachSpell;
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const bow = doc.querySelector('[data-id="bow"] .range-finder-btn');
  assert.equal(bow.dataset.tooltip, 'RANGE_FINDER.Button.Show · RANGE_FINDER.Button.Alt Reach Spell');
  assert.equal(bow.getAttribute('data-range-finder-alt'), 'reach-spell');
  assert.equal(doc.querySelector('[data-id="wish"] .range-finder-btn').hasAttribute('data-range-finder-alt'), false);
  bow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, altKey: true }));
  bow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0][1].variant, 'reach-spell');
  assert.equal('variant' in calls[1][1], false);
});

test('hold-Alt preview: never over a variant 📏; an Alt press on it ends the preview until Alt is released', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.adapter.altVariant = reachSpell;
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const row = doc.querySelector('[data-id="bow"]');
  const button = row.querySelector('.range-finder-btn');
  button.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  triggers.keyDown();
  assert.deepEqual(calls, [], 'pointer on the 📏: no preview');
  row.querySelector('.name').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  button.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, altKey: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview']);
  row.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview'], 'the click wins');
  triggers.keyUp();
  triggers.keyDown();
  assert.equal(calls.filter(c => c[0] === 'preview').length, 2, 'the next Alt press previews again');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pins.test.mjs tests/triggers.test.mjs`
Expected: FAIL — `builds.at(-1)` lacks `variant`; tooltip lacks the Alt suffix.

- [ ] **Step 3: Implement**

In `scripts/ui/PinManager.mjs` replace line 4 with:

```js
const sameItem = (a, b) => a.itemUuid === b.itemUuid && (a.actionIndex ?? null) === (b.actionIndex ?? null);
/** Same item and same per-use variant (e.g. "with Reach Spell"). */
const same = (a, b) => sameItem(a, b) && (a.variant ?? null) === (b.variant ?? null);
/** Requests carry `variant` only when set, so plain pins and their socket messages keep their v1 shape. */
const withVariant = (request, variant) => (variant ? { ...request, variant: String(variant) } : request);
```

Replace `pinFor` and `#spec` (lines 22-30) with:

```js
  /** Button state: any pin of this item on this token, whatever its variant. */
  pinFor(request) {
    const pin = this.#pins.get(PinManager.key(this.userId, request.tokenId));
    return pin && sameItem(pin, request) ? pin : null;
  }

  #spec(request) {
    const spec = this.build({ tokenId: request.tokenId, itemUuid: request.itemUuid, actionIndex: request.actionIndex ?? null, variant: request.variant ?? null });
    return hasRange(spec) ? spec : null;
  }
```

Replace lines 32-34 (start of `toggle`) with:

```js
  toggle({ tokenId, itemUuid, actionIndex = null, variant = null, share = false, sourceEl = null }) {
    const key = PinManager.key(this.userId, tokenId);
    const request = withVariant({ tokenId, itemUuid, actionIndex }, variant);
```

Replace line 112 (in `receive`) with:

```js
    const request = withVariant({ tokenId: message.tokenId, itemUuid: message.itemUuid, actionIndex: message.actionIndex ?? null }, message.variant);
```

(`toggle` already spreads `request` into the stored pin and the `pin` broadcast, so the variant travels with both.)

Replace `scripts/ui/Triggers.mjs` with:

```js
/** Row buttons (click to pin, Shift+click to share, Alt+click for a per-use variant) and the hold-key hover preview. */
import { hasRange, showsButton } from '../core/spec.mjs';

export const WINDOW_SELECTOR = '.application, .app, .window-app';
const ROW_ATTR = 'data-range-finder-row';
/** On controls whose Alt+click pins a variant (adapter.altVariant), e.g. "with Reach Spell". */
const ALT_ATTR = 'data-range-finder-alt';
const ALT_BUTTON = `.range-finder-btn[${ALT_ATTR}]`;

export class Triggers {
  #rows = new WeakMap();
  #hovered = null;
  #keyHeld = false;
  #overAlt = false;
  #altClick = false;

  constructor({ adapter, pins, resolveToken, notify = () => {}, localize = key => key, settings = () => ({}), doc = globalThis.document }) {
    Object.assign(this, { adapter, pins, resolveToken, notify, localize, settings, doc });
    doc.addEventListener('pointerover', event => this.#onHover(event));
    // Capture phase: runs before the click and before a preview could ghost the window.
    doc.addEventListener('pointerdown', event => this.#onPointerDown(event), true);
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
      host.append(this.#button(el, spec, ctx));
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  #button(row, spec, ctx) {
    const button = this.doc.createElement('a');
    button.className = 'range-finder-btn';
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    this.#wire(button, row, spec, ctx);
    return button;
  }

  /** Make `control` pin `row`'s range on click / Enter / Space (Shift shares, Alt picks the variant). */
  #wire(control, row, spec, ctx) {
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
    const active = hasRange(spec);
    if (!active) {
      control.classList.add('is-disabled');
      control.setAttribute('aria-disabled', 'true');
    }
    const alt = active ? this.adapter.altVariant?.(ctx) ?? null : null;
    let tooltip = active ? this.localize('RANGE_FINDER.Button.Show') : spec.note;
    if (alt) {
      control.setAttribute(ALT_ATTR, alt.id);
      tooltip = `${tooltip} · ${this.localize('RANGE_FINDER.Button.Alt')} ${alt.label}`;
    }
    control.dataset.tooltip = tooltip;
    control.setAttribute('aria-label', tooltip);
    const activate = event => {
      event.preventDefault();
      event.stopPropagation();
      if (active) this.#toggle(row, event.shiftKey, event.altKey && alt ? alt.id : null);
    };
    control.addEventListener('click', activate);
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') activate(event);
    });
  }

  #request(row, { quiet = false } = {}) {
    const entry = this.#rows.get(row);
    if (!entry) return null;
    const token = this.resolveToken(entry.ctx.actor);
    if (!token) {
      if (!quiet) this.notify(this.localize('RANGE_FINDER.Notify.NoToken'));
      return null;
    }
    const includeBar = Boolean(this.settings().ghostPersistentHud);
    let sourceEl;
    if (entry.def.ghostTargets) sourceEl = entry.def.ghostTargets(row, { includeBar }).filter(Boolean);
    else sourceEl = !entry.def.persistentHud || includeBar ? row.closest(WINDOW_SELECTOR) : null;
    return { tokenId: token.id, itemUuid: entry.ctx.item.uuid, actionIndex: entry.ctx.actionIndex ?? null, sourceEl };
  }

  #toggle(row, share, variant = null) {
    try {
      const request = this.#request(row);
      if (!request) return;
      this.pins.toggle({ ...request, share, ...(variant ? { variant } : {}) });
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
    const target = event.target;
    this.#overAlt = Boolean(target?.closest?.(ALT_BUTTON));
    const row = target?.closest?.(`[${ROW_ATTR}]`) ?? null;
    this.#hovered = row && this.#rows.has(row) ? row : null;
    if (this.#keyHeld && this.#hovered) this.#startPreview();
  }

  /** Alt+click on a variant control: the click wins over the hold-Alt preview. */
  #onPointerDown(event) {
    if (!event.altKey || !event.target?.closest?.(`[${ALT_ATTR}]`)) return;
    this.#altClick = true;
    this.pins.endPreview();
  }

  #startPreview() {
    if (this.pins.previewing || this.#overAlt || this.#altClick || !this.#hovered?.isConnected) return;
    const request = this.#request(this.#hovered, { quiet: true });
    if (request) this.pins.preview(request);
  }

  keyDown() {
    this.#keyHeld = true;
    this.#startPreview();
  }

  keyUp() {
    this.#keyHeld = false;
    this.#altClick = false;
    this.pins.endPreview();
  }
}
```

In `main.mjs` change line 35 to `function build({ tokenId, itemUuid, actionIndex, variant = null }) {` and line 44 to:

```js
    return adapter.specFor({ actor: token.actor, token, item, actionIndex, variant, units: sceneUnits() });
```

In `lang/en.json` replace the `Button` block (lines 3-5) with:

```json
    "Button": {
      "Show": "Show range (Shift+click to share)",
      "Alt": "Alt+click: with"
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — existing pins/triggers `deepEqual`s on requests and socket messages are unchanged (no `variant` key unless set).

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/PinManager.mjs scripts/ui/Triggers.mjs main.mjs lang/en.json tests/pins.test.mjs tests/triggers.test.mjs
git commit -m "feat: Alt+click per-use range variants (Reach Spell), click wins over hold-Alt preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Token HUD 📏 button and popover

**Verified facts** (Foundry v14 client): `TokenHUD` (`applications/hud/token-hud.mjs:18`) is an AppV2 `HandlebarsApplicationMixin(BasePlaceableHUD)` with `id: "token-hud"`, rendered into `#hud` (`placeable-hud.mjs:166-173`); its template `templates/hud/token-hud.hbs` has `div.col.left`, `div.col.middle`, `div.col.right` whose controls are `button.control-icon` (lines 51-101). Render hook `renderTokenHUD(app, element: HTMLElement, context, options)` (`api/application.mjs:592`, one hook per class in the chain); closing fires `closeTokenHUD` (`application.mjs:1040`). `app.object` is the Token placeable, `app.document` the TokenDocument, `app.actor` its actor. There is no separate HUD `clear()` in v14 — dismissal goes through `close()`.

**Files:**
- Rewrite: `scripts/ui/Triggers.mjs` (final version below: adds `addRows`, whole-row controls, `ctx.token`, `pinItem`)
- Create: `scripts/ui/TokenHudList.mjs`
- Modify: `scripts/settings.mjs` (add `tokenHudButton`), `lang/en.json` (`Hud`, `Settings.tokenHudButton`), `styles/range-finder.css` (append), `main.mjs` (imports, `ready`, hooks, teardown)
- Test: create `tests/tokenhud.test.mjs`; modify `tests/triggers.test.mjs`, `tests/settings.test.mjs`

**Interfaces:**
- Consumes: `adapter.listItems`, `adapter.specFor`, optional `adapter.rangeLabel(spec, units)`, core `rangeLabel` (Task 1), `showsButton`.
- Produces:
  - `Triggers#addRows(defs)`; row defs may set `wholeRow: true` (the row itself is the control, class `range-finder-row-btn`) and `sourceEl(row)`; a resolver's ctx may carry `token` (wins over `resolveToken`); `Triggers#pinItem(ctx, { share, variant, sourceEl }) → 'pinned'|'unpinned'|'shared'|'unavailable'|null`.
  - `TokenHudList({ adapter, triggers, localize, units, enabled, doc })` with `attach(hud, root)`, `open(hud, anchor)`, `close()`, `isOpen`; `HUD_HOOK = 'rangeFinderTokenHud'`; `GROUPS = ['attacks', 'spells', 'skills', 'other']`; popover `section#range-finder-hud-list.range-finder-hud-list` in `document.body`, rows `li.range-finder-hud-row[data-key][data-item-uuid][data-action-index]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/tokenhud.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { TokenHudList } from '../scripts/ui/TokenHudList.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ owner = true, enabled = true, list = null } = {}) {
  const dom = new JSDOM(`<div id="hud"><div id="token-hud"><div class="col left"></div><div class="col middle"></div><div class="col right"><button class="control-icon" data-action="combat"></button></div></div></div>`);
  const doc = dom.window.document;
  const items = {
    bow: { uuid: 'Item.bow', name: 'Longbow', img: 'bow.webp', spec: makeSpec({ kind: 'increments', bands: [...singleBand(150), { min: 150, max: 600, penalty: 0, tone: 'increment', label: '600 ft · Disadv.', mark: 'Disadv.' }] }) },
    arc: { uuid: 'Item.arc', name: 'Electric Arc', spec: makeSpec({ kind: 'radius', bands: singleBand(30) }) },
    demoralize: { uuid: 'Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF', name: 'Demoralize', spec: makeSpec({ kind: 'radius', bands: singleBand(30) }) },
    wish: { uuid: 'Item.wish', name: 'Wish', spec: noneSpec('Range: varies') },
    rope: { uuid: 'Item.rope', name: 'Rope', spec: noneSpec() }
  };
  const adapter = {
    specFor: ({ item }) => item.spec,
    listItems: () => list ?? [
      { item: items.rope, actionIndex: null, group: 'other' },
      { item: items.wish, actionIndex: null, group: 'other' },
      { item: items.demoralize, actionIndex: null, group: 'skills' },
      { item: items.arc, actionIndex: null, group: 'spells' },
      { item: items.bow, actionIndex: 0, group: 'attacks' }
    ],
    rows: []
  };
  const calls = [];
  let pinned = null;
  const pins = {
    previewing: false,
    toggle: req => { calls.push(['toggle', req]); pinned = req; return 'pinned'; },
    preview: req => { calls.push(['preview', req]); pins.previewing = true; return true; },
    endPreview: () => { calls.push(['endPreview']); pins.previewing = false; return true; },
    pinFor: req => (pinned && pinned.itemUuid === req.itemUuid ? { shared: Boolean(pinned.share) } : null)
  };
  // resolveToken returns a different token on purpose: HUD rows must use the HUD's token.
  const triggers = new Triggers({ adapter, pins, resolveToken: () => ({ id: 'first-active' }), localize: k => k, doc });
  const hudList = new TokenHudList({ adapter, triggers, localize: k => k, units: () => 'ft', enabled: () => enabled, doc });
  const actor = { id: 'a1' };
  const token = { id: 't1', actor, isOwner: owner };
  const hud = { object: token, actor, document: { isOwner: owner } };
  return { dom, doc, hudList, hud, actor, calls, root: doc.getElementById('token-hud') };
}
const click = (s, el, init = {}) => el.dispatchEvent(new s.dom.window.MouseEvent('click', { bubbles: true, ...init }));
const rows = s => [...s.doc.querySelectorAll('#range-finder-hud-list .range-finder-hud-row')];
const rowNamed = (s, name) => rows(s).find(r => r.querySelector('.name').textContent === name);

test('adds one 📏 control to the right column of owned tokens; respects the setting', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  s.hudList.attach(s.hud, s.root);
  assert.equal(s.root.querySelectorAll('.col.right .range-finder-hud-btn').length, 1);
  assert.equal(s.root.querySelector('.range-finder-hud-btn').dataset.tooltip, 'RANGE_FINDER.Hud.Button');
  const other = setup({ owner: false });
  other.hudList.attach(other.hud, other.root);
  assert.equal(other.root.querySelector('.range-finder-hud-btn'), null);
  const off = setup({ enabled: false });
  off.hudList.attach(off.hud, off.root);
  assert.equal(off.root.querySelector('.range-finder-hud-btn'), null);
});

test('popover groups attacks, spells, skill actions, other; range labels; note rows disabled', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  const list = s.doc.getElementById('range-finder-hud-list');
  assert.equal(list.parentElement, s.doc.body);
  assert.deepEqual([...list.querySelectorAll('h4')].map(h => h.textContent), ['RANGE_FINDER.Hud.Groups.attacks', 'RANGE_FINDER.Hud.Groups.spells', 'RANGE_FINDER.Hud.Groups.skills', 'RANGE_FINDER.Hud.Groups.other']);
  assert.deepEqual(rows(s).map(r => r.querySelector('.name').textContent), ['Longbow', 'Electric Arc', 'Demoralize', 'Wish']);
  assert.deepEqual(rows(s).map(r => r.querySelector('.range').textContent), ['150/600 ft', '30 ft', '30 ft', 'Range: varies']);
  const wish = rowNamed(s, 'Wish');
  assert.ok(wish.classList.contains('is-disabled'));
  assert.equal(wish.dataset.tooltip, 'Range: varies');
  assert.equal(rowNamed(s, 'Longbow').dataset.actionIndex, '0');
  assert.equal(s.root.querySelector('.range-finder-hud-btn').getAttribute('aria-expanded'), 'true');
});

test('row click pins for the HUD token; Shift+click shares; never ghosted; pinned row active (Review Focus 2)', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  click(s, rowNamed(s, 'Longbow'));
  assert.deepEqual(s.calls[0], ['toggle', { tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0, sourceEl: [], share: false }]);
  click(s, rowNamed(s, 'Electric Arc'), { shiftKey: true });
  assert.equal(s.calls[1][1].share, true);
  assert.ok(rowNamed(s, 'Electric Arc').classList.contains('is-active'));
  click(s, rowNamed(s, 'Wish'));
  assert.equal(s.calls.length, 2, 'note rows do nothing');
});

test('holding the preview key over a row previews it for the HUD token', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  s.hudList.triggers.keyDown();
  rowNamed(s, 'Demoralize').dispatchEvent(new s.dom.window.Event('pointerover', { bubbles: true }));
  assert.equal(s.calls[0][0], 'preview');
  assert.equal(s.calls[0][1].tokenId, 't1');
});

test('closes on Esc, with the HUD, on toggle, and when the HUD moves to another token', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  const button = s.root.querySelector('.range-finder-hud-btn');
  click(s, button);
  s.doc.dispatchEvent(new s.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(s.doc.getElementById('range-finder-hud-list'), null);
  click(s, button);
  click(s, button);
  assert.equal(s.hudList.isOpen, false, 'second click closes');
  click(s, button);
  s.hudList.close();
  assert.equal(s.doc.getElementById('range-finder-hud-list'), null);
  click(s, button);
  s.hudList.attach({ ...s.hud, object: { id: 't2', actor: s.actor, isOwner: true } }, s.root);
  assert.equal(s.hudList.isOpen, false);
});

test('empty list shows a hint', () => {
  const s = setup({ list: [] });
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  assert.equal(s.doc.querySelector('#range-finder-hud-list .range-finder-hud-empty').textContent, 'RANGE_FINDER.Hud.Empty');
});
```

Append to `tests/triggers.test.mjs`:

```js
test('pinItem pins outside any row with an explicit source window; warns without a token', () => {
  const { triggers, calls } = setup();
  const sheet = { id: 'item-sheet' };
  assert.equal(triggers.pinItem({ actor: { id: 'a1' }, item: { uuid: 'Item.bow' }, actionIndex: null }, { share: true, sourceEl: sheet }), 'pinned');
  assert.deepEqual(calls[0][1], { tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null, sourceEl: sheet, share: true });
  const none = setup({ token: null });
  assert.equal(none.triggers.pinItem({ actor: {}, item: { uuid: 'Item.bow' } }), null);
  assert.deepEqual(none.notes, ['RANGE_FINDER.Notify.NoToken']);
});

test('whole-row controls via addRows: the row is the button and carries the active state', () => {
  const { doc, dom, triggers, calls } = setup();
  const sheetRow = triggers.adapter.rows[0];
  triggers.addRows([{ ...sheetRow, hooks: ['renderList'], wholeRow: true, ghostTargets: () => [] }]);
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderList');
  const bow = doc.querySelector('[data-id="bow"]');
  assert.ok(bow.classList.contains('range-finder-row-btn'));
  assert.equal(bow.querySelector('.range-finder-btn'), null);
  bow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls[0][1].sourceEl, []);
  assert.ok(bow.classList.contains('is-active'));
});
```

In `tests/settings.test.mjs` extend the expected map (line 21) with `tokenHudButton: ['client', true]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/tokenhud.test.mjs tests/triggers.test.mjs tests/settings.test.mjs`
Expected: FAIL — `TokenHudList.mjs` not found; `triggers.pinItem` / `addRows` not functions; `tokenHudButton` missing.

- [ ] **Step 3: Implement**

Replace `scripts/ui/Triggers.mjs` with (Task 11's version plus `addRows`, whole-row controls, `ctx.token`, `pinItem`):

```js
/** Row buttons (click to pin, Shift+click to share, Alt+click for a per-use variant) and the hold-key hover preview. */
import { hasRange, showsButton } from '../core/spec.mjs';

export const WINDOW_SELECTOR = '.application, .app, .window-app';
export const ROW_BUTTON_CLASS = 'range-finder-row-btn';
const ROW_ATTR = 'data-range-finder-row';
/** On controls whose Alt+click pins a variant (adapter.altVariant), e.g. "with Reach Spell". */
const ALT_ATTR = 'data-range-finder-alt';
const ALT_BUTTON = `.range-finder-btn[${ALT_ATTR}]`;
const CONTROLS = `.range-finder-btn, .${ROW_BUTTON_CLASS}`;

export class Triggers {
  #rows = new WeakMap();
  #extraRows = [];
  #hovered = null;
  #keyHeld = false;
  #overAlt = false;
  #altClick = false;

  constructor({ adapter, pins, resolveToken, notify = () => {}, localize = key => key, settings = () => ({}), doc = globalThis.document }) {
    Object.assign(this, { adapter, pins, resolveToken, notify, localize, settings, doc });
    doc.addEventListener('pointerover', event => this.#onHover(event));
    // Capture phase: runs before the click and before a preview could ghost the window.
    doc.addEventListener('pointerdown', event => this.#onPointerDown(event), true);
  }

  /** Row definitions on top of the adapter's (e.g. the Token HUD list). */
  addRows(defs) {
    this.#extraRows.push(...defs);
  }

  decorate(root, app, hookName) {
    if (!root?.querySelectorAll) return;
    for (const def of [...(this.adapter.rows ?? []), ...this.#extraRows]) {
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
      if (def.wholeRow) {
        el.classList.add(ROW_BUTTON_CLASS);
        this.#wire(el, el, spec, ctx);
      } else {
        const host = def.host?.(el) ?? el;
        host.append(this.#button(el, spec, ctx));
      }
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  #button(row, spec, ctx) {
    const button = this.doc.createElement('a');
    button.className = 'range-finder-btn';
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    this.#wire(button, row, spec, ctx);
    return button;
  }

  /** Make `control` (a 📏 button or a whole list row) pin `row`'s range on click / Enter / Space. */
  #wire(control, row, spec, ctx) {
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
    const active = hasRange(spec);
    if (!active) {
      control.classList.add('is-disabled');
      control.setAttribute('aria-disabled', 'true');
    }
    const alt = active ? this.adapter.altVariant?.(ctx) ?? null : null;
    let tooltip = active ? this.localize('RANGE_FINDER.Button.Show') : spec.note;
    if (alt) {
      control.setAttribute(ALT_ATTR, alt.id);
      tooltip = `${tooltip} · ${this.localize('RANGE_FINDER.Button.Alt')} ${alt.label}`;
    }
    control.dataset.tooltip = tooltip;
    control.setAttribute('aria-label', tooltip);
    const activate = event => {
      event.preventDefault();
      event.stopPropagation();
      if (active) this.#toggle(row, event.shiftKey, event.altKey && alt ? alt.id : null);
    };
    control.addEventListener('click', activate);
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') activate(event);
    });
  }

  /** ctx.token (e.g. the Token HUD's token) wins over the actor's controlled / first active token. */
  #requestFor(ctx, def, row, { quiet = false } = {}) {
    const token = ctx.token ?? this.resolveToken(ctx.actor);
    if (!token) {
      if (!quiet) this.notify(this.localize('RANGE_FINDER.Notify.NoToken'));
      return null;
    }
    const includeBar = Boolean(this.settings().ghostPersistentHud);
    let sourceEl;
    if (def.sourceEl) sourceEl = def.sourceEl(row);
    else if (def.ghostTargets) sourceEl = def.ghostTargets(row, { includeBar }).filter(Boolean);
    else sourceEl = !def.persistentHud || includeBar ? row?.closest?.(WINDOW_SELECTOR) ?? null : null;
    return { tokenId: token.id, itemUuid: ctx.item.uuid, actionIndex: ctx.actionIndex ?? null, sourceEl };
  }

  #request(row, options) {
    const entry = this.#rows.get(row);
    return entry ? this.#requestFor(entry.ctx, entry.def, row, options) : null;
  }

  #toggle(row, share, variant = null) {
    try {
      const request = this.#request(row);
      if (!request) return;
      this.pins.toggle({ ...request, share, ...(variant ? { variant } : {}) });
      this.refresh();
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  /** Pin (or unpin) an item outside any row — e.g. from an item sheet's header. */
  pinItem(ctx, { share = false, variant = null, sourceEl = null } = {}) {
    try {
      const request = this.#requestFor(ctx, { sourceEl: () => sourceEl }, null);
      if (!request) return null;
      const result = this.pins.toggle({ ...request, share, ...(variant ? { variant } : {}) });
      this.refresh();
      return result;
    } catch (error) {
      console.error('Range Finder |', error);
      return null;
    }
  }

  refresh(root = this.doc) {
    for (const control of root.querySelectorAll?.(CONTROLS) ?? []) {
      const row = control.closest(`[${ROW_ATTR}]`);
      const request = row ? this.#request(row, { quiet: true }) : null;
      const pin = request ? this.pins.pinFor(request) : null;
      control.classList.toggle('is-active', Boolean(pin));
      control.classList.toggle('is-shared', Boolean(pin?.shared));
    }
  }

  #onHover(event) {
    const target = event.target;
    this.#overAlt = Boolean(target?.closest?.(ALT_BUTTON));
    const row = target?.closest?.(`[${ROW_ATTR}]`) ?? null;
    this.#hovered = row && this.#rows.has(row) ? row : null;
    if (this.#keyHeld && this.#hovered) this.#startPreview();
  }

  /** Alt+click on a variant control: the click wins over the hold-Alt preview. */
  #onPointerDown(event) {
    if (!event.altKey || !event.target?.closest?.(`[${ALT_ATTR}]`)) return;
    this.#altClick = true;
    this.pins.endPreview();
  }

  #startPreview() {
    if (this.pins.previewing || this.#overAlt || this.#altClick || !this.#hovered?.isConnected) return;
    const request = this.#request(this.#hovered, { quiet: true });
    if (request) this.pins.preview(request);
  }

  keyDown() {
    this.#keyHeld = true;
    this.#startPreview();
  }

  keyUp() {
    this.#keyHeld = false;
    this.#altClick = false;
    this.pins.endPreview();
  }
}
```

(Whole-row HUD rows are not ghosted, so hovering them with Alt may preview; an Alt+click on them still ends the preview and pins the variant.)

Create `scripts/ui/TokenHudList.mjs`:

```js
/** Token HUD 📏 control and its popover: the token's ranged items, grouped. Never ghosted. */
import { rangeLabel as deriveLabel, showsButton } from '../core/spec.mjs';

export const HUD_HOOK = 'rangeFinderTokenHud';
export const GROUPS = ['attacks', 'spells', 'skills', 'other'];
const LIST_ID = 'range-finder-hud-list';

export class TokenHudList {
  #entries = new Map();
  #el = null;
  #button = null;
  #token = null;

  constructor({ adapter, triggers, localize = key => key, units = () => 'ft', enabled = () => true, doc = globalThis.document }) {
    Object.assign(this, { adapter, triggers, localize, units, enabled, doc });
    triggers.addRows([{
      hooks: [HUD_HOOK],
      selector: '.range-finder-hud-row[data-key]',
      resolve: el => this.#entries.get(el.dataset.key) ?? null,
      wholeRow: true,
      ghostTargets: () => []
    }]);
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
  }

  get isOpen() { return Boolean(this.#el?.isConnected); }

  /** `renderTokenHUD`: add the 📏 control to the right column for tokens this user owns. */
  attach(hud, root) {
    const token = hud?.object ?? null;
    if (this.#token && this.#token !== token) this.close();
    if (!this.enabled() || !root?.querySelector || !token) return;
    const actor = hud.actor ?? token.actor;
    if (!actor || !(token.isOwner ?? hud.document?.isOwner)) return;
    const column = root.querySelector('.col.right');
    if (!column || column.querySelector('.range-finder-hud-btn')) return;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.className = 'control-icon range-finder-hud-btn';
    const label = this.localize('RANGE_FINDER.Hud.Button');
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    const open = this.isOpen && this.#token === token;
    button.setAttribute('aria-expanded', String(open));
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (this.isOpen && this.#token === token) this.close();
      else this.open(hud, button);
    });
    column.append(button);
    if (open) this.#button = button; // the HUD re-rendered for the same token
  }

  open(hud, anchor = null) {
    this.close();
    const token = hud?.object ?? null;
    const actor = hud?.actor ?? token?.actor;
    if (!token || !actor) return;
    const el = this.doc.createElement('section');
    el.id = LIST_ID;
    el.className = 'range-finder-hud-list';
    el.setAttribute('aria-label', this.localize('RANGE_FINDER.Hud.Button'));
    const rows = this.#collect(actor, token);
    if (!rows.length) {
      const empty = this.doc.createElement('p');
      empty.className = 'range-finder-hud-empty';
      empty.textContent = this.localize('RANGE_FINDER.Hud.Empty');
      el.append(empty);
    }
    for (const group of GROUPS) {
      const list = rows.filter(row => row.group === group);
      if (!list.length) continue;
      const header = this.doc.createElement('h4');
      header.textContent = this.localize(`RANGE_FINDER.Hud.Groups.${group}`);
      const ol = this.doc.createElement('ol');
      for (const row of list) ol.append(this.#row(row));
      el.append(header, ol);
    }
    this.doc.body.append(el);
    this.#el = el;
    this.#token = token;
    this.#button = anchor;
    anchor?.setAttribute?.('aria-expanded', 'true');
    this.#position(el, anchor);
    this.triggers.decorate(el, hud, HUD_HOOK);
  }

  close() {
    this.#el?.remove();
    this.#button?.setAttribute?.('aria-expanded', 'false');
    this.#el = this.#button = this.#token = null;
    this.#entries.clear();
  }

  #collect(actor, token) {
    const units = this.units();
    const rows = [];
    for (const entry of this.adapter.listItems?.(actor) ?? []) {
      try {
        const ctx = { actor, token, item: entry.item, actionIndex: entry.actionIndex ?? null };
        const spec = this.adapter.specFor(ctx);
        if (!showsButton(spec)) continue;
        const label = this.adapter.rangeLabel?.(spec, units) ?? deriveLabel(spec, units);
        rows.push({ group: GROUPS.includes(entry.group) ? entry.group : 'other', ctx, label });
      } catch (error) {
        console.error('Range Finder |', error);
      }
    }
    return rows;
  }

  #row({ ctx, label }) {
    const key = String(this.#entries.size);
    this.#entries.set(key, ctx);
    const li = this.doc.createElement('li');
    li.className = 'range-finder-hud-row';
    li.dataset.key = key;
    li.dataset.itemUuid = ctx.item.uuid ?? '';
    li.dataset.actionIndex = ctx.actionIndex ?? '';
    if (ctx.item.img) {
      const img = this.doc.createElement('img');
      img.src = ctx.item.img;
      img.alt = '';
      li.append(img);
    }
    const name = this.doc.createElement('span');
    name.className = 'name';
    name.textContent = ctx.item.name ?? '';
    const range = this.doc.createElement('span');
    range.className = 'range';
    range.textContent = label;
    li.append(name, range);
    return li;
  }

  /** Next to the HUD; flips to its left near the screen edge. */
  #position(el, anchor) {
    const box = (anchor?.closest?.('#token-hud') ?? anchor)?.getBoundingClientRect?.();
    if (!box) return;
    const width = el.offsetWidth || 260;
    const viewport = this.doc.defaultView?.innerWidth ?? Infinity;
    const left = box.right + 8 + width > viewport ? Math.max(8, box.left - width - 8) : box.right + 8;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(8, box.top))}px`;
  }
}
```

In `scripts/settings.mjs` add after `rangeField` (add a comma to its line):

```js
  tokenHudButton: { scope: 'client', type: Boolean, default: true }
```

In `lang/en.json`: add after the `Button` block

```json
    "Hud": {
      "Button": "Ranges",
      "Empty": "Nothing with a range.",
      "Groups": {
        "attacks": "Attacks",
        "spells": "Spells",
        "skills": "Skill actions",
        "other": "Other"
      }
    },
```

and after `Settings.rangeField` (add a comma):

```json
      "tokenHudButton": {
        "Name": "Range Finder: Token HUD button",
        "Hint": "Show a 📏 button on the Token HUD that lists the token's ranges."
      }
```

Append to `styles/range-finder.css`:

```css
/* Token HUD popover (appended to <body>, next to #token-hud). */
#token-hud .range-finder-hud-btn[aria-expanded="true"] { color: #2ec4b6; box-shadow: 0 0 6px rgb(46 196 182 / 60%); }
.range-finder-hud-list {
  position: fixed; z-index: 100; min-width: 220px; max-width: 320px; max-height: 60vh; overflow-y: auto;
  padding: 6px; border-radius: 8px; background: rgb(11 15 20 / 92%); border: 1px solid rgb(46 196 182 / 45%);
  box-shadow: 0 4px 16px rgb(0 0 0 / 50%); color: #e6edf3; font-size: 13px;
}
.range-finder-hud-list h4 { margin: 6px 4px 2px; border: none; font-size: .75em; text-transform: uppercase; letter-spacing: .05em; color: #9aa4ad; }
.range-finder-hud-list ol { list-style: none; margin: 0; padding: 0; }
.range-finder-hud-row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 4px; cursor: pointer; }
.range-finder-hud-row img { width: 20px; height: 20px; border: none; flex: 0 0 auto; }
.range-finder-hud-row .name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.range-finder-hud-row .range { flex: 0 0 auto; color: #9aa4ad; font-size: .85em; }
.range-finder-hud-row:hover, .range-finder-hud-row:focus-visible { background: rgb(46 196 182 / 14%); outline: none; }
.range-finder-hud-row.is-active { background: rgb(46 196 182 / 22%); box-shadow: inset 2px 0 0 #2ec4b6; }
.range-finder-hud-row.is-shared { box-shadow: inset 2px 0 0 var(--range-finder-user, #2ec4b6); }
.range-finder-hud-row.is-disabled { opacity: .5; cursor: help; }
.range-finder-hud-empty { margin: 4px 6px; color: #9aa4ad; }
```

In `main.mjs`:
- add import: `import { TokenHudList } from './scripts/ui/TokenHudList.mjs';`
- line 11: `let adapter, pins, ghost, triggers, overlay, badges, hudList;`
- in `Hooks.once('ready', …)` right after the `triggers = new Triggers({…});` statement:

```js
  hudList = new TokenHudList({
    adapter, triggers,
    localize: key => game.i18n.localize(key),
    units: () => sceneUnits(),
    enabled: () => readSettings().tokenHudButton
  });
```

- in the `canvasTearDown` handler add `hudList?.close();` as its first statement.
- after the `canvasTearDown` handler add:

```js
Hooks.on('renderTokenHUD', (app, html) => {
  try { hudList?.attach(app, rootOf(html, app)); } catch (error) { report(error); }
});
Hooks.on('closeTokenHUD', () => hudList?.close());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (Task 11 Alt tests still pass against the final `Triggers`).

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/Triggers.mjs scripts/ui/TokenHudList.mjs scripts/settings.mjs lang/en.json styles/range-finder.css main.mjs tests/tokenhud.test.mjs tests/triggers.test.mjs tests/settings.test.mjs
git commit -m "feat: Token HUD 📏 list for every system (pin, share, preview)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Item-sheet header 📏 (AppV2 controls menu + AppV1 header buttons)

**Verified facts:**
- AppV2: `ApplicationV2#_headerControlButtons` (`api/application.mjs:761-772`) fires `getHeaderControls{Class}` for every class in the chain with `(app, controls)` (`hookResponse`), on a fresh array each time; entries are `ContextMenuEntry & { action }` and `_headerControlContextEntries` calls an entry's own `onClick(event, target)` when present (`application.mjs:783-796`). dnd5e's `ItemSheet5e` extends `PrimarySheetMixin(DocumentSheet5e)` and `DocumentSheet5e extends ApplicationV2Mixin(DocumentSheetV2)` (`dnd5e.mjs:58249`, `60513`) — **not** `ItemSheetV2` — so we hook `getHeaderControlsDocumentSheetV2` and keep only Item documents.
- AppV1: `Application#_getHeaderButtons` (`appv1/api/application-v1.mjs:646-657`) calls `get${className}HeaderButtons` for each class in the chain with `(app, buttons)`; buttons are `{ label, class, icon, onclick }` and `onclick(event)` gets the click event (line 561). PF2e item sheets are `ItemSheetPF2e = class extends foundry.appv1.sheets.ItemSheet`, so `getItemSheetHeaderButtons` fires for every AppV1 item sheet (no need for the broader `getApplicationHeaderButtons`).

**Files:**
- Create: `scripts/ui/HeaderButton.mjs`
- Modify: `main.mjs` (import + two hooks), `lang/en.json` (`Header`)
- Test: create `tests/header.test.mjs`

**Interfaces:**
- Consumes: `Triggers#pinItem(ctx, { share, sourceEl })` (Task 12), `adapter.specFor`, `hasRange`.
- Produces: `headerItem(app) → { actor, item, actionIndex: null } | null`; `sheetElement(app) → HTMLElement | null`; `headerControlV2(app, { adapter, triggers, localize }) → { action: 'rangeFinderPin', icon, label, onClick } | null`; `headerButtonV1(app, deps) → { label, class: 'range-finder-header', icon, onclick } | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/header.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { headerButtonV1, headerControlV2, headerItem, sheetElement } from '../scripts/ui/HeaderButton.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

const actor = { documentName: 'Actor', id: 'a1' };
const bow = { documentName: 'Item', uuid: 'Actor.a1.Item.bow', name: 'Longbow', actor, parent: actor, spec: makeSpec({ kind: 'radius', bands: singleBand(60) }) };
const wish = { documentName: 'Item', uuid: 'Actor.a1.Item.wish', name: 'Wish', actor, parent: actor, spec: noneSpec('Range: varies') };
const loose = { documentName: 'Item', uuid: 'Item.loose', name: 'Loose Bow', actor: null, parent: null, spec: bow.spec };
const adapter = { specFor: ({ item }) => item.spec };

function deps() {
  const calls = [];
  return { calls, adapter, localize: k => k, triggers: { pinItem: (ctx, options) => { calls.push([ctx.item.uuid, options]); return 'pinned'; } } };
}

test('headerItem: only items embedded in an actor', () => {
  assert.deepEqual(headerItem({ document: bow }), { actor, item: bow, actionIndex: null });
  assert.equal(headerItem({ document: loose }), null);
  assert.equal(headerItem({ document: actor }), null);
  assert.equal(headerItem({}), null);
});

test('sheetElement: AppV2 HTMLElement or AppV1 jQuery wrapper', () => {
  const el = { nodeType: 1 };
  assert.equal(sheetElement({ element: el }), el);
  assert.equal(sheetElement({ element: [el] }), el);
  assert.equal(sheetElement({}), null);
});

test('AppV2 control only when the item has a range; click pins, Shift+click shares, sheet ghosted', () => {
  const d = deps();
  const element = { nodeType: 1, id: 'sheet' };
  const control = headerControlV2({ document: bow, element }, d);
  assert.deepEqual({ ...control, onClick: typeof control.onClick }, { action: 'rangeFinderPin', icon: 'fa-solid fa-ruler-combined', label: 'RANGE_FINDER.Header.Pin', onClick: 'function' });
  control.onClick({ shiftKey: true });
  control.onClick({ shiftKey: false });
  assert.deepEqual(d.calls, [['Actor.a1.Item.bow', { share: true, sourceEl: element }], ['Actor.a1.Item.bow', { share: false, sourceEl: element }]]);
  assert.equal(headerControlV2({ document: wish, element }, d), null, 'note-only: no control');
  assert.equal(headerControlV2({ document: loose, element }, d), null);
  assert.equal(headerControlV2({ document: { documentName: 'Item', actor, specThrows: true } }, { ...d, adapter: { specFor: () => { throw new Error('boom'); } } }), null);
});

test('AppV1 button reads the jQuery-wrapped element', () => {
  const d = deps();
  const el = { nodeType: 1, id: 'pf2e-sheet' };
  const button = headerButtonV1({ item: bow, object: bow, element: [el] }, d);
  assert.equal(button.class, 'range-finder-header');
  assert.equal(button.label, 'RANGE_FINDER.Header.Label');
  button.onclick({ shiftKey: false });
  assert.deepEqual(d.calls[0], ['Actor.a1.Item.bow', { share: false, sourceEl: el }]);
  assert.equal(headerButtonV1({ item: wish, element: [el] }, d), null);
});

test('with the real Triggers: pins the owning actor\'s token, warns when it has none', () => {
  const doc = new JSDOM('<div id="sheet" class="application"></div>').window.document;
  const calls = [], notes = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter, pins, resolveToken: a => (a === actor ? { id: 't1' } : null), notify: m => notes.push(m), localize: k => k, doc });
  const element = doc.getElementById('sheet');
  headerControlV2({ document: bow, element }, { adapter, triggers }).onClick({ shiftKey: true });
  assert.deepEqual(calls[0], { tokenId: 't1', itemUuid: 'Actor.a1.Item.bow', actionIndex: null, sourceEl: element, share: true });
  const stranger = { ...bow, actor: { documentName: 'Actor', id: 'a2' } };
  headerControlV2({ document: stranger, element }, { adapter, triggers }).onClick({});
  assert.deepEqual(notes, ['RANGE_FINDER.Notify.NoToken']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/header.test.mjs`
Expected: FAIL — `HeaderButton.mjs` not found.

- [ ] **Step 3: Implement**

Create `scripts/ui/HeaderButton.mjs`:

```js
/** 📏 in item-sheet headers: AppV2 header-controls menu and AppV1 header buttons. */
import { hasRange } from '../core/spec.mjs';

const ICON = 'fa-solid fa-ruler-combined';

/** The embedded item an item sheet shows, with its owning actor; null for anything else. */
export function headerItem(app) {
  const item = app?.document ?? app?.item ?? app?.object ?? null;
  if (!item || item.documentName !== 'Item') return null;
  const actor = item.actor ?? (item.parent?.documentName === 'Actor' ? item.parent : null);
  return actor ? { actor, item, actionIndex: null } : null;
}

/** AppV2 sheets expose an HTMLElement, AppV1 sheets a jQuery wrapper. */
export function sheetElement(app) {
  const el = app?.element;
  if (el?.nodeType === 1) return el;
  return el?.[0]?.nodeType === 1 ? el[0] : null;
}

/** Click handler for items whose spec has a range; null otherwise (no control). */
function pinner(app, { adapter, triggers }) {
  const ctx = headerItem(app);
  if (!ctx) return null;
  let spec = null;
  try { spec = adapter.specFor(ctx); } catch (error) { console.error('Range Finder |', error); }
  if (!hasRange(spec)) return null;
  return event => triggers.pinItem(ctx, { share: Boolean(event?.shiftKey), sourceEl: sheetElement(app) });
}

/** Entry for `getHeaderControlsDocumentSheetV2`, or null. */
export function headerControlV2(app, deps) {
  const onClick = pinner(app, deps);
  if (!onClick) return null;
  const localize = deps.localize ?? (key => key);
  return { action: 'rangeFinderPin', icon: ICON, label: localize('RANGE_FINDER.Header.Pin'), onClick };
}

/** Button for `getItemSheetHeaderButtons`, or null. */
export function headerButtonV1(app, deps) {
  const onclick = pinner(app, deps);
  if (!onclick) return null;
  const localize = deps.localize ?? (key => key);
  return { label: localize('RANGE_FINDER.Header.Label'), class: 'range-finder-header', icon: ICON, onclick };
}
```

In `main.mjs` add the import `import { headerButtonV1, headerControlV2 } from './scripts/ui/HeaderButton.mjs';` and, after the Token HUD hooks:

```js
const headerDeps = () => ({ adapter, triggers, localize: key => game.i18n.localize(key) });
// AppV2 item sheets (dnd5e's ItemSheet5e is a DocumentSheetV2, not an ItemSheetV2): the header controls menu.
Hooks.on('getHeaderControlsDocumentSheetV2', (app, controls) => {
  try {
    if (!triggers) return;
    const control = headerControlV2(app, headerDeps());
    if (control) controls.push(control);
  } catch (error) { report(error); }
});
// AppV1 item sheets (PF2e/SF2e): a header button.
Hooks.on('getItemSheetHeaderButtons', (app, buttons) => {
  try {
    if (!triggers) return;
    const button = headerButtonV1(app, headerDeps());
    if (button) buttons.unshift(button);
  } catch (error) { report(error); }
});
```

In `lang/en.json` add after the `Hud` block:

```json
    "Header": {
      "Pin": "Show range (Shift+click to share)",
      "Label": "Range"
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/HeaderButton.mjs main.mjs lang/en.json tests/header.test.mjs
git commit -m "feat: 📏 on item sheet headers (AppV2 controls and AppV1 buttons)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Docs — README, live checklist, module description

**Files:**
- Rewrite: `README.md` (all 51 lines)
- Modify: `docs/live-checklist.md` (title line 1; append sections after line 31)
- Modify: `module.json:4` (description)

- [ ] **Step 1: Replace `README.md`**

````markdown
# Range Finder

See an item's, attack's, spell's or skill action's range right on the canvas — in any system.

- **📏 on item rows** — PF2e/SF2e character and NPC sheets (strikes, weapons, spells, owned actions and feats), PF2e HUD sidebars (actions, spells, items, skills) and shortcuts, D&D 5e character and NPC sheets (inventory, features, spells). Click to pin, click again (or press Esc) to clear.
- **📏 on the Token HUD** — every system: right-click your token, click 📏 and pick from its attacks, spells, skill actions and other items. Click a row to pin, Shift+click to share, hold Alt over a row to preview. Turn it off with *Token HUD button*.
- **📏 in item sheet headers** — every system: an owned item's sheet gets a 📏 control (in the header menu on V2 sheets) that pins it for the owner's token.
- **Shift+click** shares the range with everyone, tinted in your player color (needs the **Allow sharing** world setting). Shift+click an already pinned range to share it.
- **Hold Alt** while hovering a row to preview its range without pinning. Alt is also Foundry's "highlight objects" key; rebind either in Configure Controls.
- **Alt+click** (PF2e/SF2e) a 📏 to use a per-use range boost you have: a spell *with Reach Spell* (+30 ft, touch → 30 ft; also Grasping Spirits Spell, Wand of Reaching), a strike with Extending, Giant's Lunge, Looming Gait, Galloping Launch… The tooltip names the boost. Point at the 📏 first, then hold Alt and click — the click wins over the preview.
- **Bands**: PF2e range increments `60 ft · –2`, D&D 5e normal/long range (`600 ft · Disadv.`), reach, volley zones. SF2e area and automatic weapons show their area: `30 ft · Auto-fire cone 15 ft`.
- **PF2e skill actions**: Demoralize 30 ft, Feint at your reach, Shove/Trip/Disarm/Grapple/Reposition at your best matching weapon's reach (ranged trip at –2), healing and thievery actions adjacent, 70+ feat actions (Bon Mot, Battle Medicine, Terrifying Howl…). Owned feats that change ranges are applied (Legendary Laugh, Mage's Field Dressing, Hydraulic Maneuvers while toggled, Lunge with reach-N weapons…); ones PF2e already applies (Far Shot, Enlarge…) are read from the system, never doubled.
- **Target badges**: every visible token shows `45 ft · –2`, `✓`, the band's mark (`Disadv.`) or `✗`.
- **Any scene**: labels use the scene's units (`m` scenes show `7.5 m`); distances follow the scene's diagonal rule and measure edge to edge (PF2e/SF2e keep their own rules).
- **Gets out of the way**: the window you clicked from fades while the range is shown; from PF2e HUD only the open sidebar fades (the bar too if you enable it); hover it to bring it back. The Token HUD list never fades.
- Optional: hatch squares without line of effect, colorblind palette, outline-only bands.

Works on square grids (per-square bands) and hex/gridless scenes (rings). Built in: PF2e, SF2e, D&D 5e (6.x). Other systems use a generic adapter (see below). Area shapes (bursts, cones) are not drawn — ranges only.

## Keybindings

Rebindable in **Configure Controls**.

| Action | Default |
|---|---|
| Preview hovered range | Alt |
| Clear my ranges | Esc |
| Clear shared ranges (GM) | unbound |

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
| Token HUD button | client | on |
| Allow sharing | world | on |
| Badges only in combat | world | off |
| Range field (other systems) | world | empty (auto-detect) |

## Other systems

Without a built-in adapter, Range Finder reads `system.range` on items: a number, `{ value, long }` (long range is marked `Long`) or `{ value, units }`, in the scene's units. If your system keeps the range elsewhere, a GM can set **Range field** to that item data path (e.g. `system.attack.range`). Use the Token HUD 📏 or the item sheet 📏 to show it.

## For developers

Register an adapter for your system from the `rangeFinder.registerAdapters` hook. Range Finder calls it during `setup`, before it picks the adapter for the current system:

```js
Hooks.once('rangeFinder.registerAdapters', api => api.registerAdapter('my-system', adapter));
```

An adapter is `{ id, specFor(ctx), cellMeasure(spec, unit), distance(source, target, spec), rows, listItems(actor), rangeLabel?(spec, units), altVariant?(ctx), resolveItem?(actor, uuid) }`. `specFor` receives `{ actor, token, item, actionIndex, variant, units }` and returns distances in scene units; `listItems` feeds the Token HUD list (`[{ item, actionIndex, group: 'attacks'|'spells'|'skills'|'other' }]`). See `scripts/adapters/generic.mjs` and `scripts/adapters/dnd5e.mjs`. `game.modules.get('range-finder').api` exposes the same `registerAdapter` and `clear` functions, but a registration made after `setup` is not picked up.

Run tests with `npm test`.
````

- [ ] **Step 2: Update `docs/live-checklist.md`**

Change line 1 to `# Range Finder — live checklist (Foundry v14: PF2e, SF2e, D&D 5e, other systems)`, and append after line 31:

```markdown

## PF2e — skill actions, modifiers, universal triggers

- [ ] pf2e-hud skills sidebar: 📏 on Demoralize (30 ft), Feint (reach), Shove/Trip/Disarm/Grapple/Reposition, Administer First Aid / Treat Wounds / Steal / Palm an Object (`Adjacent`), Bon Mot (when owned); none on Seek, Force Open, Disable a Device, Pick a Lock, Recall Knowledge.
- [ ] Natural Medicine row (nature) shows Treat Wounds' `Adjacent` range.
- [ ] Character sheet Actions tab and pf2e-hud actions sidebar: 📏 on owned Battle Medicine, Terrifying Howl (`Emanation 30 ft`), You're Next (60 ft); none on Toughness.
- [ ] Legendary Laugh owned → Demoralize 60 ft. Hydraulic Maneuvers: Shove 15 ft only while its toggle is on.
- [ ] Whip equipped: Trip/Disarm at 10 ft, Grapple at 5 ft. Bola equipped: Trip shows reach + a `Ranged trip · –2` band to 20 ft.
- [ ] Reach-N weapon with the Lunge toggle on: strike and Trip reach +5; without the toggle unchanged. Whip + Lunge: the system's value (not +10).
- [ ] Far Shot longbow: bands to 1200 ft (system value), not 2400.
- [ ] Reach Spell owned: spell 📏 tooltip says "Alt+click: with Reach Spell"; point at 📏, hold Alt, click → `Reach Spell 60 ft` for Electric Arc, 30 ft for Shocking Grasp; no preview started while pointing at the 📏; plain click shows the normal range. Second client sees the shared variant.
- [ ] Token HUD 📏: list grouped Attacks / Spells / Skill actions / Other with range labels (`100/600 ft`, `Reach 10 ft`, `30 ft`); Wish disabled with its note; row click pins for *that* token (try two unlinked tokens of one actor); Shift+click shares; Alt held over a row previews; Esc and closing the HUD close the list; the list never fades.
- [ ] PF2e item sheet header shows 📏 for a longbow (pins the owner's token, the sheet fades), not for a ring.
- [ ] "Token HUD button" off → no 📏 on the HUD.

## SF2e world

- [ ] Same sheets/HUD rows as PF2e; skill actions resolve (Demoralize 30 ft) even without the pf2e compendium.
- [ ] Automatic weapon: first band `NN ft · Auto-fire cone MM ft`; area weapon: `NN ft · Area burst 10 ft`; no shape drawn.

## D&D 5e world (6.x)

Setup: square grid (5 ft), a character with a longbow, dagger, glaive, Fire Bolt, Shocking Grasp, Burning Hands, Shield, a feature with a 30 ft activity; enemies at 5–700 ft.

- [ ] Character and NPC sheets: 📏 in the controls column of inventory, features and spell rows that have a range; none on Shield or loot.
- [ ] Longbow: `150 ft` band + `600 ft · Disadv.` band; badges `200 ft · Disadv.`, `700 ft · ✗`.
- [ ] Dagger: 20/60 bands + 5 ft reach outline. Glaive: `Reach 10 ft`.
- [ ] Fire Bolt 120 ft; Shocking Grasp `Touch · 5 ft`; Burning Hands `Cone 15 ft`; a "Special" range spell shows a disabled 📏 with `Range: special`.
- [ ] Scene diagonal rule "Equidistant" vs "Alternating (5/10/5)": bands and badges change accordingly and agree with each other; a large token's badges measure edge to edge.
- [ ] Scene in metres (1.5 m grid): labels and badges in `m` with one decimal.
- [ ] Item sheet header menu has "Show range"; Shift+click shares.
- [ ] Token HUD 📏 list works as in PF2e (Attacks / Spells / Other).

## Other system (generic)

- [ ] A system with `system.range` numbers: Token HUD 📏 and item sheet 📏 show ranges.
- [ ] Set **Range field** to a custom path: ranges come from it; clearing it falls back to auto-detect.
```

- [ ] **Step 3: Update `module.json` description (line 4)**

```json
  "description": "See an item's, attack's, spell's or skill action's range on the canvas: penalty bands, reach, and per-target distance badges. Built-in PF2e, SF2e and D&D 5e support; a Token HUD list and item-sheet button for every system.",
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: PASS (docs only). Then `node -e "JSON.parse(require('fs').readFileSync('module.json','utf8')); JSON.parse(require('fs').readFileSync('lang/en.json','utf8'))"` → no output (both files are valid JSON).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/live-checklist.md module.json
git commit -m "docs: multi-system README and live checklist (PF2e skills, SF2e, D&D 5e)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Band `mark` + badge precedence | 1 |
| Units in labels/badges, `canvas.scene.grid.units` fallback `ft` | 1 (core, badges), 3/4 (adapters) |
| `diagonalDistance` for every `GRID_DIAGONALS` rule; `alternatingDistance` kept | 2 |
| Default edge-to-edge token distance (1×1, 2×2) | 2 |
| Adapter `listItems` / `rangeLabel` default | 1 (`rangeLabel`), 3, 5, 10 |
| Generic: `rangeField` setting + auto-detect + `Long` mark + `listItems` | 3 |
| dnd5e: weapons (normal/long `Disadv.`, thrown reach overlay, `rch`), spells/features (distance, touch, self+template, self, spec, any), conversion, rows, `listItems` | 4, 5 |
| SF2e area-fire/auto-fire label suffix | 6 |
| `pf2e-ranges.mjs` tables (SKILL_ACTIONS, FEAT_ACTIONS, SKILL/SPELL/WEAPON/REACH_MODIFIERS), rules 1, 2, 6 | 7 |
| Rule 3 Lunge + reach-N (strikes and maneuvers) | 8, 9 |
| Rule 4 maneuvers (trait, best reach, ranged trip) | 9 |
| Rule 5 base-action modifiers vs feat-action rows | 7, 9 |
| Rule 7 toggles from roll options; Reach Spell Alt+click only when owned; click wins over hold-Alt preview | 8, 11 |
| Rule 8 / pf2e-hud skills rows by `data-item-uuid`; owned action/feat rows | 10 |
| Compendium uuid resolution in `build`/`resolveItem` | 9 |
| Token HUD 📏 popover (groups incl. Skill actions, pin/share/preview, disabled note rows, close with HUD/Esc, never ghosted) | 12 |
| Item sheet header button (AppV2 + AppV1), ghosted, token warning | 13 |
| Settings `rangeField` (world), `tokenHudButton` (client) | 3, 12 |
| Live checklist dnd5e + SF2e sections | 14 |

Type/name consistency checked: `specFor({ actor, token, item, actionIndex, variant, units })`, `altVariant(ctx) → { id, label }`, `listItems(actor) → { item, actionIndex, group }`, `pinItem(ctx, { share, variant, sourceEl })`, `skillItem(uuid)`, `HUD_HOOK`, `ROW_BUTTON_CLASS`, `data-range-finder-alt`.

