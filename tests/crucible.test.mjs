import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { classifyTargets } from '../scripts/core/targets.mjs';
import { createCrucibleAdapter, crucibleAdapter, effectiveRange, baseToBase } from '../scripts/adapters/crucible.mjs';
import { getAdapter } from '../scripts/adapters/index.mjs';
import { DIAGONALS, bandCells } from '../scripts/core/cells.mjs';

const format = (key, data) => (key === 'ITEM.PROPERTIES.Range' ? `Range ${data.range}` : key);
const cr = createCrucibleAdapter({ units: () => 'ft', format });

// CrucibleWeaponItem after prepareBaseData: system.range is derived from the category (reach ×1.5, ambush ×0.5).
const weapon = (id, name, range, ranged = false) => ({
  id, name, type: 'weapon', uuid: `Actor.a.Item.${id}`, img: `${id}.webp`,
  system: { range, config: { category: { ranged } } }
});
// A bound, prepared CrucibleAction (actor.actions[id]): range already includes the weapon's reach when range.weapon.
const action = (id, name, range, { tags = [], item = null, strikes = [], source = {}, weaponRange } = {}) => ({
  id, name, img: `${id}.webp`, item,
  range: { minimum: null, maximum: null, weapon: false, category: 'none', ...range },
  _source: { range: { minimum: range.minimum ?? null, maximum: null, weapon: Boolean(range.weapon), ...source } },
  tags: new Set(tags),
  usage: { strikes, ...(weaponRange === undefined ? {} : { weaponRange }) }
});

const sword = weapon('sword', 'Longsword', 1);
const pike = weapon('pike', 'Pike', 3);
const bow = weapon('bow', 'Longbow', 60, true);
const shield = { id: 'shield', name: 'Buckler', type: 'armor', uuid: 'Actor.a.Item.shield', system: {} };
const talentItem = { id: 'tal', name: 'Hurl', type: 'talent', uuid: 'Actor.a.Item.tal', img: 'tal.webp', system: {} };
const spellItem = { id: 'sp', name: 'Firebolt', type: 'spell', uuid: 'Actor.a.Item.sp', img: 'sp.webp', system: {} };

const strike = action('strike', 'Strike', { weapon: true, maximum: 60, category: 'ranged' }, { tags: ['strike'], strikes: [bow], weaponRange: 60 });
const meleeStrike = action('strike', 'Strike', { weapon: true, maximum: 1, category: 'melee' }, { tags: ['strike'], strikes: [sword], weaponRange: 1 });
const lunge = action('lunge', 'Lunge', { weapon: true, maximum: 6, category: 'melee' }, { tags: ['strike'], strikes: [sword], source: { maximum: 5 }, weaponRange: 1 });
const hurl = action('hurl', 'Hurl Boulder', { minimum: 10, maximum: 60, category: 'ranged' }, { item: talentItem });
const firebolt = action('spell.flame.ray.none', 'Firebolt', { maximum: 30, category: 'ranged' }, { tags: ['spell'], item: spellItem });
const recover = action('recover', 'Recover', { category: 'none' });
const shove = action('shove', 'Shove', { maximum: 1, category: 'melee' });

const actor = {
  id: 'a', uuid: 'Actor.a', name: 'Hero', type: 'hero',
  items: new Map([sword, bow, shield, talentItem, spellItem].map(i => [i.id, i])),
  actions: { strike, lunge, hurl, recover, shove, [firebolt.id]: firebolt }
};
for (const item of actor.items.values()) item.actor = item.parent = actor;

test('weapons: radius [0, range] in scene units; melee weapons a reach band', () => {
  const ranged = cr.specFor({ item: bow });
  assert.equal(ranged.kind, 'radius');
  assert.deepEqual(ranged.bands, [{ min: 0, max: 60, penalty: 0, tone: 'base', label: 'Range 60 ft' }]);
  assert.equal(ranged.itemName, 'Longbow');
  const melee = cr.specFor({ item: pike });
  assert.equal(melee.kind, 'reach');
  assert.deepEqual(melee.bands, [{ min: 0, max: 3, penalty: 0, tone: 'reach', label: 'Range 3 ft' }]);
  assert.equal(cr.rangeLabel(melee), 'Range 3 ft');
  assert.equal(cr.specFor({ item: weapon('odd', 'Odd', 0) }).kind, 'none');
});

test('actions: [minimum, maximum]; melee category tones reach; no category / no maximum → none', () => {
  const spec = cr.specFor({ actor, item: talentItem, actionIndex: 'hurl' });
  assert.equal(spec.kind, 'radius');
  assert.deepEqual(spec.bands, [{ min: 10, max: 60, penalty: 0, tone: 'base', label: 'Range 10–60 ft' }]);
  assert.equal(spec.itemName, 'Hurl Boulder');
  const reach = cr.specFor({ actor, item: actor, actionIndex: 'shove' });
  assert.equal(reach.kind, 'reach');
  assert.deepEqual(reach.bands.map(b => [b.min, b.max, b.tone, b.label]), [[0, 1, 'reach', 'Range 1 ft']]);
  assert.equal(cr.specFor({ actor, item: actor, actionIndex: 'recover' }).kind, 'none');
  assert.equal(cr.specFor({ actor, item: actor, actionIndex: 'missing' }).kind, 'none');
  const inverted = action('x', 'X', { minimum: 30, maximum: 30, category: 'ranged' });
  assert.equal(cr.specFor({ actor: { actions: { x: inverted } }, item: actor, actionIndex: 'x' }).kind, 'none');
});

test('minimum range: targets closer than minimum are ✗, minimum itself is in range', () => {
  const spec = cr.specFor({ actor, item: talentItem, actionIndex: 'hurl' });
  const results = classifyTargets({ spec, targets: [{ id: 'adj', distance: 0 }, { id: 'near', distance: 5 }, { id: 'min', distance: 10 }, { id: 'max', distance: 60 }, { id: 'far', distance: 65 }] });
  assert.deepEqual(results.map(r => [r.id, r.outOfRange]), [['adj', true], ['near', true], ['min', false], ['max', false], ['far', true]]);
});

test('weapon-based actions use the system effective range: source maximum + the struck weapon range', () => {
  assert.deepEqual(effectiveRange(lunge), { min: 0, max: 6 });
  assert.deepEqual(effectiveRange(strike), { min: 0, max: 60 });
  // Unprepared maximum: rebuilt from the strike sequence like the strike tag does (min across struck weapons).
  const raw = action('dual', 'Dual Strike', { weapon: true, maximum: null, category: 'melee' }, { strikes: [sword, pike], source: { maximum: 2 } });
  assert.deepEqual(effectiveRange(raw), { min: 0, max: 3 });
  const spec = cr.specFor({ actor, item: actor, actionIndex: 'lunge' });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands.map(b => [b.min, b.max, b.label]), [[0, 6, 'Range 6 ft']]);
  const melee = cr.specFor({ actor: { actions: { strike: meleeStrike } }, item: actor, actionIndex: 'strike' });
  assert.deepEqual(melee.bands.map(b => [b.max, b.tone]), [[1, 'reach']]);
});

test('item rows without actionIndex: weapon range; other items show their first ranged bound action', () => {
  assert.equal(cr.specFor({ actor, item: talentItem }).itemName, 'Hurl Boulder');
  assert.equal(cr.specFor({ item: spellItem }).bands[0].max, 30, 'actor found through item.actor');
  assert.equal(cr.specFor({ actor, item: shield }).kind, 'none');
  assert.equal(cr.specFor({}).kind, 'none');
});

test('action handles: name / img / uuid for pins and the Token HUD; resolveItem maps the uuid back', () => {
  const [entry] = cr.listItems(actor).filter(e => e.actionIndex === 'lunge');
  assert.equal(entry.item.name, 'Lunge');
  assert.equal(entry.item.img, 'lunge.webp');
  assert.equal(entry.item.uuid, 'Actor.a.Action.lunge');
  const back = cr.resolveItem(actor, 'Actor.a.Action.spell.flame.ray.none');
  assert.equal(back.name, 'Firebolt');
  assert.equal(cr.specFor({ actor, item: back, actionIndex: 'spell.flame.ray.none' }).bands[0].max, 30);
  assert.equal(cr.resolveItem(actor, 'Actor.b.Action.lunge'), null);
  assert.equal(cr.resolveItem(actor, 'Actor.a.Action.nope'), null);
  assert.equal(cr.resolveItem(null, 'Actor.a.Action.lunge'), null);
});

test('listItems: weapons and strikes → attacks, spell actions → spells, the rest → other; only ranged ones', () => {
  assert.deepEqual(cr.listItems(actor).map(e => [e.item.name, e.group, e.actionIndex]), [
    ['Longsword', 'attacks', null], ['Longbow', 'attacks', null],
    ['Strike', 'attacks', 'strike'], ['Lunge', 'attacks', 'lunge'], ['Hurl Boulder', 'other', 'hurl'],
    ['Shove', 'other', 'shove'], ['Firebolt', 'spells', 'spell.flame.ray.none']
  ]);
  assert.deepEqual(cr.listItems({}), []);
});

test('distance: the system base-to-base range when available; base-to-base fallback on square grids', () => {
  const calls = [];
  const sys = createCrucibleAdapter({ linearRange: (a, b) => { calls.push([a.id, b.id]); return 7; } });
  assert.equal(sys.distance({ id: 's' }, { id: 't' }), 7);
  assert.deepEqual(calls, [['s', 't']]);
  const none = createCrucibleAdapter({ linearRange: () => null });
  const token = cells => ({ document: { getOccupiedGridSpaceOffsets: () => cells } });
  const canvas = { grid: { isSquare: true, distance: 5, diagonals: DIAGONALS.EXACT } };
  assert.equal(none.distance(token([{ i: 0, j: 0 }]), token([{ i: 0, j: 1 }]), null, canvas), 0, 'adjacent');
  assert.equal(none.distance(token([{ i: 0, j: 0 }]), token([{ i: 1, j: 1 }]), null, canvas), 0, 'diagonally adjacent');
  assert.equal(none.distance(token([{ i: 0, j: 0 }]), token([{ i: 0, j: 3 }]), null, canvas), 10);
  assert.ok(Number.isNaN(none.distance({}, {}, null, {})));
  assert.equal(baseToBase([{ i: 0, j: 0 }, { i: 0, j: 1 }], [{ i: 0, j: 1 }], 5), 0, 'overlap');
});

test('cellMeasure: base-to-base between cells (an adjacent cell is 0)', () => {
  const measure = cr.cellMeasure(null, 5, DIAGONALS.EQUIDISTANT);
  assert.equal(measure.bandSensitive({}), false);
  assert.equal(measure({ i: 0, j: 0 }, { i: 0, j: 1 }), 0);
  assert.equal(measure({ i: 0, j: 0 }, { i: 1, j: 1 }), 0);
  assert.equal(measure({ i: 0, j: 0 }, { i: 0, j: 2 }), 5);
  assert.equal(measure({ i: 0, j: 0 }, { i: 3, j: 2 }), 10);
});

test('bands reach as far as distance(): the farthest painted cell is max/unit + 1 out (base-to-base)', () => {
  const measure = cr.cellMeasure(null, 5, DIAGONALS.EQUIDISTANT);
  for (const [max, farthest] of [[5, 2], [10, 3], [30, 7]]) {
    const bands = [{ min: 0, max, penalty: 0, tone: 'base', label: '' }];
    const [cells] = bandCells({ originCells: [{ i: 20, j: 20 }], bands, measure, unit: 5 });
    const reach = Math.max(...cells.map(c => Math.max(Math.abs(c.i - 20), Math.abs(c.j - 20))));
    assert.equal(reach, farthest, `${max} ft`);
  }
});

test('pins of unlinked tokens: a world-actor action uuid resolves against the synthetic actor', () => {
  const synthetic = { ...actor, uuid: 'Scene.s.Token.t.Actor.a' };
  assert.equal(cr.resolveItem(synthetic, 'Actor.a.Action.lunge')?.name, 'Lunge');
  assert.equal(cr.resolveItem(synthetic, 'Actor.a.Action.spell.flame.ray.none')?.name, 'Firebolt');
  assert.equal(cr.resolveItem(synthetic, 'Scene.s.Token.t.Actor.a.Action.lunge')?.name, 'Lunge');
  assert.equal(cr.resolveItem(synthetic, 'Actor.b.Action.lunge'), null);
  // No item at all (fromUuidSync and resolveItem both missed): the action id alone is enough.
  assert.equal(cr.specFor({ actor: synthetic, item: null, actionIndex: 'lunge' }).bands[0].max, 6);
  assert.equal(cr.specFor({ actor: synthetic, item: null, actionIndex: 'nope' }).kind, 'none');
  assert.equal(cr.specFor({ item: null }).kind, 'none');
});

test('listItems skips actions hidden from the sheet and movement actions', () => {
  const hidden = { ...action('hidden', 'Hidden', { maximum: 30, category: 'ranged' }), suppressFromSheet: true };
  const charge = { ...action('charge', 'Charge', { weapon: true, maximum: 30, category: 'melee' }, { tags: ['strike'] }), target: { type: 'movement' } };
  const names = cr.listItems({ ...actor, actions: { ...actor.actions, hidden, charge } }).map(e => e.item.name);
  assert.ok(!names.includes('Hidden') && !names.includes('Charge'));
  assert.ok(names.includes('Lunge'));
});

test('default instance and registry', () => {
  assert.equal(getAdapter('crucible'), crucibleAdapter);
  assert.equal(crucibleAdapter.id, 'crucible');
  assert.equal(crucibleAdapter.specFor({ item: bow }).bands[0].label, 'Range 60 ft');
});

// templates/sheets/actor/actions.hbs, inventory.hbs, talents.hbs and sidebar.hbs as rendered.
const SHEET = `<div class="application sheet crucible actor" id="sheet">
<section class="sheet-sidebar flexcol">
  <div class="item-list equipped"><div class="equipped line-item" data-crucible-tooltip="weapon" data-uuid="Actor.a.Item.bow"><img class="icon"><div class="title"><h4>Longbow</h4></div></div></div>
  <div class="item-list actions"><div class="action line-item" data-action-id="lunge" data-crucible-tooltip="action" data-uuid="Actor.a"><img class="icon"><div class="title"><h4 data-action="actionUse"><a>Lunge</a></h4></div></div></div>
</section>
<section class="tab secondary scrollable actions flexcol active" data-tab="actions" data-group="sheet"><div class="sheet-section item-section flexcol"><ol class="items-list">
  <li class="line-item action" data-action-id="hurl" data-uuid="Actor.a" data-crucible-tooltip="action">
    <img class="icon draggable action-drag"><div class="title"><h4 data-action="actionUse"><a>Hurl Boulder</a></h4></div>
    <div class="controls"><a class="button icon fa-solid fa-edit" data-action="actionEdit"></a><a class="button icon favorite fa-regular fa-star" data-action="actionFavorite"></a></div>
  </li>
  <li class="line-item action" data-action-id="recover" data-uuid="Actor.a" data-crucible-tooltip="action">
    <img class="icon"><div class="title"><h4><a>Recover</a></h4></div><div class="controls"></div>
  </li>
</ol></div></section>
<section class="tab secondary flexcol inventory" data-tab="inventory" data-group="sheet"><section class="inventory-sections scrollable flexcol">
  <div class="sheet-section item-section flexcol" data-inventory-section="weapons"><ol class="items-list scrollable">
    <li class="line-item weapon draggable" data-crucible-tooltip="weapons" data-item-id="sword" data-uuid="Actor.a.Item.sword">
      <img class="icon"><div class="title"><h4>Longsword</h4></div>
      <div class="controls"><button type="button" class="icon fa-solid fa-shield" data-action="itemEquip"></button><button type="button" class="icon fa-solid fa-edit" data-action="itemEdit"></button></div>
    </li>
    <li class="line-item armor draggable" data-crucible-tooltip="armor" data-item-id="shield" data-uuid="Actor.a.Item.shield">
      <img class="icon"><div class="title"><h4>Buckler</h4></div><div class="controls"></div>
    </li>
  </ol></div>
</section></section>
<section class="tab secondary talents flexcol scrollable" data-tab="talents" data-group="sheet"><div class="sheet-section item-section flexcol"><ol class="items-list">
  <li class="line-item talent" data-crucible-tooltip="talent" data-uuid="Actor.a.Item.tal" data-item-id="tal">
    <img class="icon"><div class="title"><h4>Hurl</h4></div>
    <div class="controls"><a class="button icon fa-solid fa-edit" data-action="itemEdit"></a></div>
  </li>
</ol></div></section>
</div>`;

test('sheet rows: actions resolve by data-action-id; items by data-item-id; buttons match each row\'s controls', () => {
  const dom = new JSDOM(SHEET);
  const doc = dom.window.document;
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: cr, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderCrucibleBaseActorSheet');
  const hurlBtn = doc.querySelector('li[data-action-id="hurl"] > .controls > .range-finder-btn');
  assert.ok(hurlBtn);
  assert.equal(hurlBtn.tagName, 'A');
  assert.ok(hurlBtn.classList.contains('button') && hurlBtn.classList.contains('icon'));
  assert.equal(doc.querySelector('li[data-action-id="recover"] .range-finder-btn'), null);
  const swordBtn = doc.querySelector('li[data-item-id="sword"] > .controls > .range-finder-btn');
  assert.equal(swordBtn.tagName, 'BUTTON');
  assert.ok(swordBtn.classList.contains('icon'));
  assert.equal(doc.querySelector('li[data-item-id="shield"] .range-finder-btn'), null);
  const talentBtn = doc.querySelector('li[data-item-id="tal"] > .controls > .range-finder-btn');
  assert.equal(talentBtn.tagName, 'A');
  assert.ok(doc.querySelector('.sheet-sidebar [data-action-id="lunge"] .range-finder-btn'));
  assert.ok(doc.querySelector('.sheet-sidebar [data-uuid="Actor.a.Item.bow"] .range-finder-btn'));
  for (const btn of [hurlBtn, swordBtn, talentBtn]) btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls.map(c => [c.itemUuid, c.actionIndex]), [
    ['Actor.a.Action.hurl', 'hurl'], ['Actor.a.Item.sword', null], ['Actor.a.Item.tal', null]
  ]);
  assert.deepEqual(cr.rows.flatMap(r => r.hooks), cr.rows.map(() => 'renderCrucibleBaseActorSheet'));
  // Subclass hooks fired on the same render do not decorate twice.
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderHeroSheet');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 5);
});

test('rows: no actor or another actor\'s action → nothing', () => {
  const dom = new JSDOM('<li class="line-item action" data-action-id="hurl" data-uuid="Actor.a"><div class="controls"></div></li>');
  const el = dom.window.document.querySelector('li');
  const def = cr.rows.find(r => el.matches(r.selector));
  assert.equal(def.resolve(el, {}), null);
  assert.equal(def.resolve(el, { document: { uuid: 'Actor.b', actions: {} } }), null);
  assert.equal(def.resolve(el, { document: actor }).actionIndex, 'hurl');
});
