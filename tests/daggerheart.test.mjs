import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { createDaggerheartAdapter, daggerheartAdapter } from '../scripts/adapters/daggerheart.mjs';

// The system's default range thresholds (DhVariantRules.rangeMeasurement / DhScene#rangeSettings), in scene units.
const DEFAULTS = { enabled: true, melee: 5, veryClose: 15, close: 30, far: 60 };
const NAMES = { melee: 'Melee', veryClose: 'Very Close', close: 'Close', far: 'Far', veryFar: 'Very Far' };
const localize = key => NAMES[/DAGGERHEART\.CONFIG\.Range\.(\w+)\.name/.exec(key)?.[1]] ?? key;
const dh = createDaggerheartAdapter({ ranges: () => DEFAULTS, units: () => 'ft', localize });

const action = (id, range, extra = {}) => ({ _id: id, id, name: id, type: 'attack', range, ...extra });
const weapon = (id, name, range, actions = []) => ({
  id, name, type: 'weapon', uuid: `Actor.a.Item.${id}`,
  system: { attack: action(`atk-${id}`, range, { name: 'Attack', systemPath: 'attack' }), actions: new Map(actions.map(a => [a.id, a])) }
});
const card = (id, name, actions) => ({ id, name, type: 'domainCard', uuid: `Actor.a.Item.${id}`, system: { actions: new Map(actions.map(a => [a.id, a])) } });

const longbow = weapon('bow', 'Shortbow', 'close');
const sword = weapon('sword', 'Broadsword', 'melee');
const bolt = card('bolt', 'Arcane Bolt', [action('heal', 'self'), action('blast', 'veryFar')]);
const rope = { id: 'rope', name: 'Rope', type: 'loot', uuid: 'Actor.a.Item.rope', system: { actions: new Map() } };

test('close weapon: nested Melee → Close bands in scene units, no marks', () => {
  const spec = dh.specFor({ item: longbow });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 5, penalty: 0, tone: 'base', label: 'Melee · 5 ft' },
    { min: 5, max: 15, penalty: 0, tone: 'increment', label: 'Very Close · 15 ft' },
    { min: 15, max: 30, penalty: 0, tone: 'increment', label: 'Close · 30 ft' }
  ]);
  assert.equal(spec.itemName, 'Shortbow');
  assert.equal(dh.rangeLabel(spec, 'ft'), 'Close · 30 ft');
});

test('melee weapon: one Melee band', () => {
  const spec = dh.specFor({ item: sword });
  assert.equal(spec.kind, 'radius');
  assert.deepEqual(spec.bands, [{ min: 0, max: 5, penalty: 0, tone: 'base', label: 'Melee · 5 ft' }]);
  assert.equal(dh.rangeLabel(spec, 'ft'), 'Melee · 5 ft');
});

test('very far action: five bands, Very Far open-ended up to 5× Far', () => {
  const spec = dh.specFor({ item: bolt });
  assert.deepEqual(spec.bands.map(b => [b.min, b.max, b.label]), [
    [0, 5, 'Melee · 5 ft'], [5, 15, 'Very Close · 15 ft'], [15, 30, 'Close · 30 ft'], [30, 60, 'Far · 60 ft'], [60, 300, 'Very Far · 60+ ft']
  ]);
  assert.ok(spec.bands.every(b => !b.mark && b.penalty === 0));
});

test('action choice: weapon attack first, else first ranged action, actionIndex picks a specific one', () => {
  const hybrid = weapon('staff', 'Staff', 'melee', [action('zap', 'far')]);
  assert.equal(dh.specFor({ item: hybrid }).bands.length, 1, 'weapon → its attack action');
  assert.equal(dh.specFor({ item: hybrid, actionIndex: 'zap' }).bands.at(-1).label, 'Far · 60 ft');
  assert.equal(dh.specFor({ item: hybrid, actionIndex: 'atk-staff' }).bands.length, 1);
  assert.equal(dh.specFor({ item: bolt, actionIndex: 'heal' }).kind, 'none', 'self has no band');
  const noAttack = weapon('odd', 'Odd', '', [action('throw', 'veryClose')]);
  assert.equal(dh.specFor({ item: noAttack }).bands.at(-1).label, 'Very Close · 15 ft');
});

test('no range → none, no button', () => {
  const none = dh.specFor({ item: rope });
  assert.equal(none.kind, 'none');
  assert.equal(none.note, null);
  assert.equal(dh.specFor({ item: card('x', 'Self Buff', [action('a', 'self'), action('b', '')]) }).kind, 'none');
  assert.equal(dh.specFor({ item: { name: 'Bare', type: 'feature', system: {} } }).kind, 'none');
  assert.equal(dh.specFor({}).kind, 'none');
});

test('adversary attack (a bare action on the actor) reads its own range', () => {
  const claws = action('std', 'veryClose', { name: 'Claws', systemPath: 'attack', uuid: 'Actor.b.Action.std' });
  const spec = dh.specFor({ item: claws });
  assert.equal(spec.itemName, 'Claws');
  assert.equal(spec.bands.at(-1).label, 'Very Close · 15 ft');
});

test('units: scene range settings are already scene units (feet, metres); squares fallback from grid distance', () => {
  const metric = createDaggerheartAdapter({ ranges: () => ({ enabled: true, melee: 1.5, veryClose: 4.5, close: 9, far: 18 }), units: () => 'm', localize });
  assert.deepEqual(metric.specFor({ item: longbow }).bands.map(b => b.label), ['Melee · 1.5 m', 'Very Close · 4.5 m', 'Close · 9 m']);
  assert.equal(dh.specFor({ item: longbow, units: 'm' }).bands[0].label, 'Melee · 5 m', 'ctx.units wins for the label');
  // No system settings: the SRD grid (1 / 3 / 6 / 12 squares) times the scene's grid distance.
  const squares = createDaggerheartAdapter({ ranges: () => null, gridDistance: () => 1, units: () => 'sq', localize });
  assert.deepEqual(squares.specFor({ item: bolt }).bands.map(b => b.max), [1, 3, 6, 12, 60]);
  const feet = createDaggerheartAdapter({ ranges: () => null, gridDistance: () => 5, units: () => 'ft', localize });
  assert.deepEqual(feet.specFor({ item: longbow }).bands.map(b => b.max), [5, 15, 30]);
});

test('custom scene thresholds that do not grow are skipped', () => {
  const odd = createDaggerheartAdapter({ ranges: () => ({ melee: 5, veryClose: 5, close: 30, far: 60 }), units: () => 'ft', localize });
  assert.deepEqual(odd.specFor({ item: longbow }).bands.map(b => [b.min, b.max]), [[0, 5], [5, 30]]);
});

test('default instance: no game/canvas → SRD defaults in ft, English names, edge distance', () => {
  assert.equal(daggerheartAdapter.id, 'daggerheart');
  assert.deepEqual(daggerheartAdapter.specFor({ item: longbow }).bands.map(b => b.label), ['Melee · 5 ft', 'Very Close · 15 ft', 'Close · 30 ft']);
  assert.ok(Number.isNaN(daggerheartAdapter.distance({}, {})));
  assert.equal(typeof daggerheartAdapter.cellMeasure, 'function');
});

test('listItems: weapons → attacks, domain cards → spells, others → other; only items with a range', () => {
  const feature = { id: 'f', name: 'Roar', type: 'feature', uuid: 'Actor.a.Item.f', system: { actions: new Map([['r', action('r', 'close')]]) } };
  const list = dh.listItems({ type: 'character', system: {}, items: new Map([[1, longbow], [2, rope], [3, bolt], [4, feature], [5, card('s', 'Shield', [action('a', 'self')])]].map(([k, v]) => [String(k), v])) });
  assert.deepEqual(list.map(e => [e.item.name, e.group, e.actionIndex]), [['Shortbow', 'attacks', null], ['Arcane Bolt', 'spells', null], ['Roar', 'other', null]]);
  const claws = action('std', 'melee', { name: 'Claws', uuid: 'Actor.b.Action.std' });
  const adversary = dh.listItems({ type: 'adversary', system: { attack: claws }, items: new Map() });
  assert.deepEqual(adversary.map(e => [e.item.name, e.group]), [['Claws', 'attacks']]);
  assert.equal(dh.resolveItem({ system: { attack: claws } }, 'Actor.b.Action.std'), claws);
  assert.equal(dh.resolveItem({ system: { attack: claws } }, 'Actor.b.Item.x'), null);
});

// inventory-item-V2.hbs / inventory-item-compact.hbs as rendered for a character / adversary sheet.
const ROWS = `<div class="application sheet actor daggerheart" id="sheet"><section class="tab inventory">
  <ul class="items-list">
    <li class="inventory-item" data-item-id="bow" data-type="weapon" data-item-type="weapon" data-item-uuid="Actor.a.Item.bow">
      <div class="item-main"><div class="inventory-item-header">
        <div class="img-portait" data-action="useItem"><img class="item-img"></div>
        <div class="item-label"><span class="item-name">Shortbow</span></div>
        <div class="controls"><a data-action="toggleEquipItem"><i class="fa-solid fa-hands"></i></a><a data-action="triggerContextMenu"><i class="fa-solid fa-fw fa-ellipsis-vertical"></i></a></div>
      </div><div class="inventory-item-content"><div class="inventory-description"></div></div></div>
      <div class="item-buttons"><div class="item-button"><button type="button" data-action="useItem" data-item-uuid="Actor.a.Item.bow.Action.x">Shoot</button></div></div>
    </li>
    <li class="inventory-item" data-item-id="rope" data-type="loot" data-item-uuid="Actor.a.Item.rope">
      <div class="item-main"><div class="inventory-item-header"><div class="controls"></div></div></div>
    </li>
  </ul>
  <ul class="items-sidebar-list">
    <li class="inventory-item inventory-item-compact" data-item-id="std" data-action-id="std" data-item-uuid="Actor.a.Action.std" data-type="attack">
      <div class="img-portait"></div><span class="item-name">Unarmed</span><div class="controls"></div>
    </li>
    <li class="inventory-item inventory-item-compact" data-item-id="bolt" data-item-uuid="Actor.a.Item.bolt" data-type="domainCard">
      <div class="img-portait"></div><span class="item-name">Arcane Bolt</span><div class="controls"></div>
    </li>
  </ul>
</section></div>`;

test('sheet rows: ruler <a> in the row .controls for ranged items, actor attack rows too', () => {
  const dom = new JSDOM(ROWS);
  const doc = dom.window.document;
  const unarmed = action('std', 'melee', { name: 'Unarmed', uuid: 'Actor.a.Action.std' });
  const actor = { id: 'a', type: 'character', system: { attack: unarmed }, items: new Map([['bow', longbow], ['rope', rope], ['bolt', bolt]]) };
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: dh, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderDHBaseActorSheet');
  const button = doc.querySelector('[data-item-id="bow"] .inventory-item-header > .controls > .range-finder-btn');
  assert.ok(button);
  assert.equal(button.tagName, 'A', 'same element as the system controls');
  assert.equal(doc.querySelectorAll('[data-item-id="bow"] .range-finder-btn').length, 1);
  assert.equal(doc.querySelector('[data-item-id="rope"] .range-finder-btn'), null);
  assert.ok(doc.querySelector('[data-item-id="bolt"] > .controls > .range-finder-btn'));
  assert.ok(doc.querySelector('[data-action-id="std"] > .controls > .range-finder-btn'));
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  doc.querySelector('[data-action-id="std"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls.map(c => [c.itemUuid, c.actionIndex]), [['Actor.a.Item.bow', null], ['Actor.a.Action.std', null]]);
  assert.equal(calls[0].sourceEl.id, 'sheet');
  assert.deepEqual(dh.rows[0].hooks, ['renderDHBaseActorSheet']);
});

test('rows: a data-action-id naming an item action pins that action', () => {
  const dom = new JSDOM(`<div id="sheet"><li class="inventory-item" data-item-id="blast" data-action-id="blast" data-item-uuid="Actor.a.Item.bolt.Action.blast"><div class="controls"></div></li></div>`);
  const actor = { id: 'a', type: 'character', system: {}, items: new Map([['bolt', bolt]]) };
  const ctx = dh.rows[0].resolve(dom.window.document.querySelector('li'), { actor });
  assert.equal(ctx.item, bolt);
  assert.equal(ctx.actionIndex, 'blast');
});
