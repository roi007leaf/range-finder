import assert from 'node:assert/strict';
import test from 'node:test';
import { bandIndexFor, rangeLabel, fmtPenalty, hasRange, incrementBands, inBand, makeSpec, maxRange, noneSpec, showsButton, singleBand } from '../scripts/core/spec.mjs';

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
