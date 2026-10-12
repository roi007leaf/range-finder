import assert from 'node:assert/strict';
import test from 'node:test';
import { badgeText, classifyTargets } from '../scripts/core/targets.mjs';
import { incrementBands, makeSpec, singleBand } from '../scripts/core/spec.mjs';

const javelin = makeSpec({ kind: 'increments', bands: incrementBands(30) });

test('classifies by band, penalty and range', () => {
  const [a, b, c, d] = classifyTargets({ spec: javelin, targets: [
    { id: 'a', distance: 25 }, { id: 'b', distance: 45 }, { id: 'c', distance: 200 }, { id: 'd', distance: 30, blocked: true }
  ] });
  assert.deepEqual(a, { id: 'a', distance: 25, bandIndex: 0, penalty: 0, outOfRange: false, blocked: false, zones: [] });
  assert.deepEqual(b, { id: 'b', distance: 45, bandIndex: 1, penalty: -2, outOfRange: false, blocked: false, zones: [] });
  assert.deepEqual(c, { id: 'c', distance: 200, bandIndex: null, penalty: null, outOfRange: true, blocked: false, zones: [] });
  assert.equal(d.blocked, true);
});

test('non-finite distance is out of range', () => {
  const [r] = classifyTargets({ spec: makeSpec({ kind: 'reach', bands: singleBand(5, 'reach', 'Reach 5 ft') }), targets: [{ id: 'x', distance: NaN }] });
  assert.equal(r.outOfRange, true);
});

test('badgeText marks', () => {
  assert.equal(badgeText({ distance: 25, penalty: 0, outOfRange: false }), '25 ft · ✓');
  assert.equal(badgeText({ distance: 45, penalty: -2, outOfRange: false }), '45 ft · –2');
  assert.equal(badgeText({ distance: 200.4, penalty: null, outOfRange: true }), '200.4 ft · ✗');
});

test('badgeText: non-finite distance renders a dash (final 10)', () => {
  assert.equal(badgeText({ distance: NaN, penalty: null, outOfRange: true }), '— ft · ✗');
  assert.equal(badgeText({ distance: Infinity, penalty: 0, outOfRange: false }), '— ft · ✗');
});

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
  assert.equal(badgeText({ distance: 200.4, penalty: null, outOfRange: true }, 'ft'), '200.4 ft · ✗');
  assert.equal(badgeText({ distance: 30, penalty: 0, outOfRange: false }, 'ft'), '30 ft · ✓');
});

test('badgeText: one decimal whenever not whole, whatever the units string', () => {
  assert.equal(badgeText({ distance: 7.5, penalty: 0, outOfRange: false }, 'meters'), '7.5 meters · ✓');
  assert.equal(badgeText({ distance: 7.04, penalty: 0, outOfRange: false }, 'meters'), '7 meters · ✓');
  assert.equal(badgeText({ distance: 12.5, penalty: 0, outOfRange: false }, 'squares'), '12.5 squares · ✓');
});

test('penalty zones (PF2e volley) stack onto the target penalty and name themselves', () => {
  const longbow = makeSpec({ kind: 'increments', bands: incrementBands(100, 600), overlays: [{ min: 0, max: 30, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2', badge: 'Volley' }] });
  const [near, edge, far, out] = classifyTargets({ spec: longbow, targets: [{ id: 'n', distance: 20 }, { id: 'e', distance: 30 }, { id: 'f', distance: 35 }, { id: 'o', distance: 700 }] });
  assert.equal(near.penalty, -2); assert.deepEqual(near.zones, ['Volley']);
  assert.equal(edge.penalty, -2, 'within 30 ft includes 30');
  assert.equal(far.penalty, 0); assert.deepEqual(far.zones, []);
  assert.deepEqual(out.zones, []);
  assert.equal(badgeText(near), '20 ft · –2 Volley');
  assert.equal(badgeText(far), '35 ft · ✓');
  assert.equal(badgeText({ ...near, mark: 'Reach Spell' }), '20 ft · –2 Volley · Reach Spell');
});
