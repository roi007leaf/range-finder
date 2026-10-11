import assert from 'node:assert/strict';
import test from 'node:test';
import { cellMeasure, distance, pf2eAdapter, specFor } from '../scripts/adapters/pf2e.mjs';

const weapon = (name, { melee = false, range = null, traits = [] } = {}) => ({ name, type: 'weapon', isMelee: melee, range, system: { traits: { value: traits } } });
const longbow = weapon('Longbow', { range: { increment: 100, max: 600 }, traits: ['deadly-d10', 'volley-30'] });
const javelin = weapon('Javelin', { range: { increment: 30, max: 180 }, traits: ['thrown'] });
const dagger = weapon('Dagger', { melee: true, traits: ['agile', 'thrown-10'] });
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

test('melee weapon with plain thrown trait and no number or range is reach-only', () => {
  const spec = specFor({ actor, item: weapon('Throwing Knife', { melee: true, traits: ['thrown'] }) });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }]);
  assert.deepEqual(spec.overlays, []);
});

test('ranged NPC melee item with range is increments; max-only range is radius', () => {
  const npcBow = { name: 'Spit', type: 'melee', isMelee: false, range: { increment: 30, max: 180 }, system: { traits: { value: [] } } };
  const npcSpit = specFor({ actor, item: npcBow });
  assert.equal(npcSpit.kind, 'increments');
  assert.deepEqual(npcSpit.bands.map(b => b.max), [30, 60, 90, 120, 150, 180]);
  const maxOnly = { name: 'Gaze', type: 'weapon', isMelee: false, range: { increment: null, max: 60 }, system: { traits: { value: [] } } };
  const gaze = specFor({ actor, item: maxOnly });
  assert.equal(gaze.kind, 'radius');
  assert.equal(gaze.bands[0].max, 60);
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

test('pinned strike keeps its weapon when the actions list reorders (final 5)', () => {
  const bow = { ...longbow, id: 'bow' }, sword = { ...whip, id: 'whip' }, knife = { ...dagger, id: 'knife' };
  const before = { ...actor, system: { ...actor.system, actions: [{ item: bow }, { item: sword }] } };
  assert.equal(specFor({ actor: before, item: sword, actionIndex: 1 }).itemName, 'Whip');
  // A new weapon was added ahead of the pinned one: index 1 now points at the dagger.
  const after = { ...actor, system: { ...actor.system, actions: [{ item: bow }, { item: knife }, { item: sword }] } };
  assert.equal(specFor({ actor: after, item: sword, actionIndex: 1 }).itemName, 'Whip');
  // Same item at the index: the action's (prepared) item is used.
  const prepared = { ...sword, name: 'Whip (prepared)' };
  const same = { ...actor, system: { ...actor.system, actions: [{ item: bow }, { item: prepared }] } };
  assert.equal(specFor({ actor: same, item: sword, actionIndex: 1 }).itemName, 'Whip (prepared)');
  // The weapon has no strike any more: fall back to the item itself.
  const gone = { ...actor, system: { ...actor.system, actions: [{ item: bow }] } };
  assert.equal(specFor({ actor: gone, item: sword, actionIndex: 1 }).itemName, 'Whip');
  // Synthetic strike (no item): the index decides.
  assert.equal(specFor({ actor: after, item: null, actionIndex: 1 }).itemName, 'Dagger');
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

test('resolveItem finds scroll/wand/staff spells in spellcasting collections', async () => {
  const { resolveItem } = await import('../scripts/adapters/pf2e.mjs');
  const haste = { uuid: 'Actor.a.Item.haste', name: 'Haste' };
  const caster = { spellcasting: { collections: new Map([['scroll-entry', new Map([['haste', haste]])]]) } };
  assert.equal(resolveItem(caster, 'Actor.a.Item.haste'), haste);
  assert.equal(resolveItem(caster, 'Actor.a.Item.nope'), null);
  assert.equal(resolveItem({}, 'Actor.a.Item.haste'), null);
});

test('pf2e-hud spell rows resolve consumable spells through their entry', async () => {
  const { pf2eRows } = await import('../scripts/adapters/pf2e-rows.mjs');
  const row = pf2eRows.find(r => r.hooks.includes('renderSpellsSidebarPF2eHUD'));
  const slow = { uuid: 'Actor.a.Item.slow', name: 'Slow' };
  const hudActor = { items: new Map(), spellcasting: { collections: new Map([['wand-entry', new Map([['slow', slow]])]]) } };
  const el = { dataset: { entryId: 'wand-entry', itemId: 'slow' } };
  assert.equal(row.resolve(el, { actor: hudActor }).item, slow);
  const owned = { uuid: 'Actor.a.Item.arc' };
  hudActor.items.set('arc', owned);
  assert.equal(row.resolve({ dataset: { entryId: 'missing', itemId: 'arc' } }, { actor: hudActor }).item, owned);
});

test('pf2e-hud rows fade the sidebar and token HUD, and the bar only when enabled', async () => {
  const { pf2eRows } = await import('../scripts/adapters/pf2e-rows.mjs');
  const els = { 'pf2e-hud-sidebar': { id: 'sidebar' }, 'pf2e-hud-token': null, 'pf2e-hud-persistent': { id: 'bar' } };
  const row = { ownerDocument: { getElementById: id => els[id] ?? null } };
  const spells = pf2eRows.find(r => r.hooks.includes('renderSpellsSidebarPF2eHUD'));
  assert.deepEqual(spells.ghostTargets(row, { includeBar: false }).map(e => e.id), ['sidebar']);
  assert.deepEqual(spells.ghostTargets(row, { includeBar: true }).map(e => e.id), ['sidebar', 'bar']);
  assert.ok(pf2eRows.filter(r => r.hooks.some(h => h.endsWith('PF2eHUD'))).every(r => r.ghostTargets));
});
