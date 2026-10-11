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
