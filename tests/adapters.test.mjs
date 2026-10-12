import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenericAdapter, genericAdapter, getPath, readRange } from '../scripts/adapters/generic.mjs';
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
  assert.equal(spec.bands[1].label, '600 ft · Long');
  assert.equal(spec.bands[1].mark, 'Long');
});

test('generic: no range → none', () => {
  assert.equal(genericAdapter.specFor({ item: { name: 'Rope', system: {} } }).kind, 'none');
  assert.equal(genericAdapter.specFor({ item: null }).kind, 'none');
  assert.ok(Number.isNaN(genericAdapter.distance({}, {})));
});

test('generic cellMeasure ignores bands (measured once per cell)', () => {
  const measure = genericAdapter.cellMeasure(null, 5);
  assert.equal(measure.bandSensitive({ tone: 'reach', max: 10 }), false);
  assert.equal(measure({ i: 0, j: 0 }, { i: 2, j: 2 }), 15);
});

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
