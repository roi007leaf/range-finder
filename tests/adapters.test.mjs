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
