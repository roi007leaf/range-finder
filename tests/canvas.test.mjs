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
  assert.ok(texts.includes(''));
  assert.ok(texts.includes('20 ft · ✓'));
});
