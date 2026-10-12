import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { RangeOverlay } from '../scripts/canvas/RangeOverlay.mjs';
import { faFamily, fontFamilyOf, sceneGeometry, sceneUnits } from '../scripts/canvas/geometry.mjs';
import { bandCells } from '../scripts/core/cells.mjs';
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

test('labels go to a separate high-zIndex container; fills stay in the grid parent (final 1)', () => {
  const { PIXI } = fakePIXI();
  const parent = new Container(), labelParent = new Container();
  const o = new RangeOverlay({ parent, labelParent, PIXI, makeText: () => new Container(), settings: () => baseSettings });
  o.draw([{ pin: pin(reach, { shared: true, userId: 'ally' }), token, adapter: pf2eAdapter, tint: 0xff0000, ownerName: 'Valeros' }], fakeGeo());
  assert.equal(parent.children[0], o.container);
  assert.equal(labelParent.children[0], o.labels);
  assert.equal(o.labels.zIndex, 1000);
  const labelLayer = o.labels.children[0];
  assert.equal(labelLayer.children.length, 2, 'owner label and band label pill');
  const fillLayer = o.container.children[0];
  assert.ok(fillLayer.children.every(child => child.children.length === 0), 'only graphics in the fill layer');
});

test('badges container sits above tokens in the interface group (final 1)', () => {
  const { PIXI } = fakePIXI();
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: () => new Container(), settings: () => baseSettings });
  assert.equal(badges.container.zIndex, 1000);
});

test('fade-in survives redraws and restarts only for new keys (final 3)', () => {
  const { PIXI } = fakePIXI();
  let time = 0;
  const frames = [];
  const o = new RangeOverlay({ parent: new Container(), PIXI, makeText: () => new Container(), settings: () => baseSettings, now: () => time, requestFrame: fn => { frames.push(fn); return frames.length; } });
  const entry = { pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null };
  o.draw([entry], fakeGeo());
  assert.equal(o.container.children[0].alpha, 0);
  assert.equal(o.labels.children[0].alpha, 0);
  assert.equal(frames.length, 1);
  time = 75;
  o.draw([entry], fakeGeo());
  assert.equal(o.container.children[0].alpha, 0.5);
  assert.equal(frames.length, 1, 'a single frame loop keeps ticking');
  time = 150;
  frames.shift()();
  assert.equal(o.container.children[0].alpha, 1);
  assert.equal(frames.length, 0, 'loop stops when every fade completes');
  o.draw([], fakeGeo());
  o.draw([entry], fakeGeo());
  assert.equal(o.container.children[0].alpha, 0, 'a key that went away fades in again');
});

test('fade-in is skipped under reduced motion (final 3)', () => {
  const { PIXI } = fakePIXI();
  const original = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const o = new RangeOverlay({ parent: new Container(), PIXI, makeText: () => new Container(), settings: () => baseSettings, now: () => 0, requestFrame: () => { throw new Error('no frames'); } });
    o.draw([{ pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null }], fakeGeo());
    assert.equal(o.container.children[0].alpha, 1);
  } finally { globalThis.matchMedia = original; }
});

test('dim behind walls tests each cell once per draw (final 4)', () => {
  const { o } = overlay({ ...baseSettings, dimBehindWalls: true });
  let calls = 0;
  const geo = { ...fakeGeo(), losFor: () => ({ cell: c => { calls++; return c.j > 12; } }) };
  o.draw([{ pin: pin(javelin), token, adapter: pf2eAdapter, tint: null, ownerName: null }], geo);
  const cells = bandCells({ originCells: token.cells, bands: javelin.bands, measure: pf2eAdapter.cellMeasure(javelin, 5), unit: 5, bounds: geo.bounds }).flat().length;
  assert.equal(calls, cells);
});

test('wall check casts from the elevated vision origin in the token level (final 4)', () => {
  const calls = [];
  const original = globalThis.CONFIG;
  globalThis.CONFIG = { Canvas: { polygonBackends: { sight: { create: (origin, config) => { calls.push({ origin, config }); return { contains: () => true }; } } } } };
  try {
    const level = { id: 'L2' };
    const canvas = { grid: { getCenterPoint: ({ i, j }) => ({ x: j, y: i }) }, dimensions: {} };
    const elevated = { id: 'e', center: { x: 1, y: 2 }, document: { level: 'L2', parent: { levels: new Map([['L2', level]]) }, getVisionOrigin: () => ({ x: 1, y: 2, elevation: 30 }) } };
    const geo = sceneGeometry(canvas);
    assert.equal(geo.losFor(elevated).point({ x: 0, y: 0 }), false);
    geo.losFor(elevated).cell({ i: 0, j: 0 });
    assert.equal(calls.length, 1, 'polygon cached per token');
    assert.deepEqual(calls[0].origin, { x: 1, y: 2, elevation: 30 });
    assert.equal(calls[0].config.type, 'sight');
    assert.equal(calls[0].config.level, level);
    sceneGeometry(canvas).losFor({ id: 'plain', center: { x: 5, y: 6 }, document: {} });
    assert.deepEqual(calls[1].origin, { x: 5, y: 6 });
    assert.equal('level' in calls[1].config, false, 'no level → Foundry defaults to the viewed level');
  } finally { globalThis.CONFIG = original; }
});

test('Font Awesome family is read from the CSS variable with a fallback (final 6)', () => {
  assert.equal(fontFamilyOf('"Font Awesome 6 Pro", sans-serif'), 'Font Awesome 6 Pro');
  assert.equal(fontFamilyOf(" 'Font Awesome 7 Free' "), 'Font Awesome 7 Free');
  assert.equal(fontFamilyOf(''), 'Font Awesome 7 Pro');
  assert.equal(fontFamilyOf(undefined), 'Font Awesome 7 Pro');
  assert.equal(faFamily(), 'Font Awesome 7 Pro', 'no document in node → fallback');
});

test('badge glyph uses an escape, x and y share the target center (final 9)', async () => {
  const source = await readFile(new URL('../scripts/canvas/TargetBadges.mjs', import.meta.url), 'utf8');
  assert.ok(!/[\ue000-\uf8ff]/.test(source), 'no literal private-use glyph in source');
  const { PIXI } = fakePIXI();
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: () => new Container(), settings: () => baseSettings });
  // Mid-animation: document x/y lag behind the rendered center.
  const goblin = { id: 'g', center: { x: 550, y: 550 }, x: 0, y: 0, w: 100, h: 100 };
  badges.draw([{ pin: pin(javelin), token, adapter: { ...pf2eAdapter, distance: () => 20 }, tint: null, ownerName: null }], { targets: [goblin], zoom: 1 });
  const plate = badges.container.children[0];
  assert.ok(plate.position.y < 500 && plate.position.y > 400, `plate y ${plate.position.y} follows center`);
});

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

test('band labels keep a constant on-screen size: scale = 1/zoom, clamped to [0.25, 12]', async () => {
  const { labelScale } = await import('../scripts/canvas/RangeOverlay.mjs');
  assert.equal(labelScale(1), 1);
  assert.equal(labelScale(0.5), 2);
  assert.equal(labelScale(2), 0.5);
  assert.equal(labelScale(0.169), 1 / 0.169);
  assert.equal(labelScale(0.05), 12);
  assert.equal(labelScale(8), 0.25);
  assert.equal(labelScale(0), 1);
  assert.equal(labelScale(undefined), 1);
  const { PIXI } = fakePIXI();
  const parent = new Container(), labelParent = new Container();
  const o = new RangeOverlay({ parent, labelParent, PIXI, makeText: () => new Container(), settings: () => baseSettings });
  o.draw([{ pin: pin(reach), token, adapter: pf2eAdapter, tint: null, ownerName: null }], { ...fakeGeo(), zoom: 0.5 });
  const pills = o.labels.children[0].children;
  assert.ok(pills.length > 0);
  assert.ok(pills.every(p => p.scale.value === 2));
});

test('target badges use the same screen-constant scale as band labels (times badge size)', () => {
  const { PIXI } = fakePIXI();
  const badges = new TargetBadges({ parent: new Container(), PIXI, makeText: () => new Container(), settings: () => ({ ...baseSettings, badgeScale: 1.5 }) });
  const goblin = { id: 'g', center: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 100 };
  badges.draw([{ pin: pin(javelin), token, adapter: { ...pf2eAdapter, distance: () => 20 }, tint: null, ownerName: null }], { targets: [goblin], zoom: 0.25 });
  assert.equal(badges.container.children[0].scale.value, 4 * 1.5);
});
