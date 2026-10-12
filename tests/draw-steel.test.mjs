import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { createDrawSteelAdapter, drawSteelAdapter, distanceOf } from '../scripts/adapters/draw-steel.mjs';
import { getAdapter } from '../scripts/adapters/index.mjs';

// AbilityModel#distance after preparePostActorPrepData: formulas already evaluated to numbers (owned items).
const ability = (id, name, distance, keywords = []) => ({
  id, name, type: 'ability', uuid: `Actor.a.Item.${id}`, img: `${id}.webp`,
  system: { distance: { type: 'self', primary: 1, secondary: 1, tertiary: 1, ...distance }, keywords: new Set(keywords) }
});

const ds = createDrawSteelAdapter({ gridDistance: () => 1, units: () => 'sq' });

const freeMelee = ability('fm', 'Melee Free Strike', { type: 'melee', primary: 1 }, ['melee', 'strike', 'weapon']);
const freeRanged = ability('fr', 'Ranged Free Strike', { type: 'ranged', primary: 5 }, ['ranged', 'strike', 'weapon']);
const spear = ability('sp', 'Spear Charge', { type: 'meleeRanged', primary: 1, secondary: 5 }, ['melee', 'ranged', 'strike', 'weapon']);
const aura = ability('au', 'Holy Aura', { type: 'aura', primary: 1 }, ['magic']);
const burst = ability('bu', 'Whirlwind', { type: 'burst', primary: 2 }, ['area', 'weapon']);
const cube = ability('cu', 'Fireball', { type: 'cube', primary: 3, secondary: 10 }, ['area', 'magic', 'ranged']);
const line = ability('li', 'Lightning', { type: 'line', primary: 5, secondary: 1, tertiary: 1 }, ['area', 'magic']);
const wall = ability('wa', 'Wall of Stone', { type: 'wall', primary: 10, secondary: 10 }, ['area', 'psionic']);
const special = ability('spc', 'Odd Trick', { type: 'special' });
const self = ability('se', 'Brace', { type: 'self' });
const kit = { id: 'kit', name: 'Panther', type: 'kit', uuid: 'Actor.a.Item.kit', system: { bonuses: {} } };

test('melee N: reach band of N squares, "Melee 1"', () => {
  const spec = ds.specFor({ item: freeMelee });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands, [{ min: 0, max: 1, penalty: 0, tone: 'reach', label: 'Melee 1' }]);
  assert.equal(spec.itemName, 'Melee Free Strike');
  assert.equal(ds.rangeLabel(spec), 'Melee 1');
});

test('ranged N: radius band, "Ranged 5", no marks', () => {
  const spec = ds.specFor({ item: freeRanged });
  assert.equal(spec.kind, 'radius');
  assert.deepEqual(spec.bands, [{ min: 0, max: 5, penalty: 0, tone: 'base', label: 'Ranged 5' }]);
  assert.ok(spec.bands.every(b => !b.mark));
});

test('melee or ranged: ranged band plus the melee reach overlay', () => {
  const spec = ds.specFor({ item: spear });
  assert.equal(spec.kind, 'radius');
  assert.deepEqual(spec.bands, [{ min: 0, max: 5, penalty: 0, tone: 'base', label: 'Ranged 5' }]);
  assert.deepEqual(spec.overlays, [{ min: 0, max: 1, penalty: 0, tone: 'reach', label: 'Melee 1' }]);
  assert.equal(ds.rangeLabel(spec), 'Melee 1 or ranged 5');
});

test('aura / burst: radius of the area size', () => {
  assert.deepEqual(ds.specFor({ item: aura }).bands.map(b => [b.max, b.label]), [[1, 'Aura 1']]);
  assert.deepEqual(ds.specFor({ item: burst }).bands.map(b => [b.max, b.label]), [[2, 'Burst 2']]);
});

test('cube / line / wall: radius of the "within" distance, system wording', () => {
  assert.deepEqual(ds.specFor({ item: cube }).bands.map(b => [b.max, b.label]), [[10, 'Cube 3 within 10']]);
  assert.deepEqual(ds.specFor({ item: line }).bands.map(b => [b.max, b.label]), [[1, '5 x 1 line within 1']]);
  assert.deepEqual(ds.specFor({ item: wall }).bands.map(b => [b.max, b.label]), [[10, '10 wall within 10']]);
  assert.equal(ds.rangeLabel(ds.specFor({ item: cube })), 'Cube 3 within 10');
});

test('special → disabled note, self / non-abilities / missing → none', () => {
  const s = ds.specFor({ item: special });
  assert.equal(s.kind, 'none');
  assert.equal(s.note, 'Range: special');
  assert.equal(ds.rangeLabel(s), 'Range: special');
  assert.equal(ds.specFor({ item: self }).kind, 'none');
  assert.equal(ds.specFor({ item: self }).note, null);
  assert.equal(ds.specFor({ item: kit }).kind, 'none');
  assert.equal(ds.specFor({ item: ability('z', 'Zero', { type: 'ranged', primary: 0 }) }).kind, 'none');
  assert.equal(ds.specFor({}).kind, 'none');
});

test('squares → scene units: N × grid distance, label adds the scene distance when a square is not 1 unit', () => {
  const feet = createDrawSteelAdapter({ gridDistance: () => 5, units: () => 'ft' });
  assert.deepEqual(feet.specFor({ item: freeRanged }).bands.map(b => [b.max, b.label]), [[25, 'Ranged 5 · 25 ft']]);
  const s = feet.specFor({ item: spear });
  assert.deepEqual([s.bands[0].max, s.overlays[0].max, s.overlays[0].label], [25, 5, 'Melee 1 · 5 ft']);
  assert.deepEqual(feet.specFor({ item: cube, units: 'm' }).bands.map(b => [b.max, b.label]), [[50, 'Cube 3 within 10 · 50 m']]);
  const metres = createDrawSteelAdapter({ gridDistance: () => 1.5, units: () => 'm' });
  assert.equal(metres.specFor({ item: burst }).bands[0].max, 3);
});

test('unprepared formulas (unowned item, source data) are evaluated with the item roll data', () => {
  const seen = [];
  const evaluate = (formula, rollData) => { seen.push([formula, rollData]); return formula === '5 + @chr' ? 5 + rollData.chr : NaN; };
  const custom = createDrawSteelAdapter({ gridDistance: () => 1, units: () => 'sq', evaluate });
  const item = { ...ability('f', 'Formula', { type: 'ranged', primary: '5 + @chr' }), getRollData: () => ({ chr: 2 }) };
  assert.equal(custom.specFor({ item }).bands[0].label, 'Ranged 7');
  assert.deepEqual(seen, [['5 + @chr', { chr: 2 }]]);
  assert.deepEqual(distanceOf({ system: { distance: { type: 'cube', primary: '3', secondary: '10', tertiary: '1' } } }), { type: 'cube', primary: 3, secondary: 10, tertiary: 1 });
  assert.equal(distanceOf({ system: { distance: { type: 'ranged', primary: '@x' } } }, () => NaN).primary, NaN);
  assert.equal(distanceOf({ system: {} }), null);
});

test('default evaluator: the system ds.utils.evaluateFormula with the item roll data', () => {
  const prev = globalThis.ds;
  globalThis.ds = { utils: { evaluateFormula: (formula, data) => (formula === '2*@level' ? 2 * data.level : 0) } };
  try {
    const item = { ...ability('g', 'Scaling', { type: 'burst', primary: '2*@level' }), getRollData: () => ({ level: 3 }) };
    assert.equal(ds.specFor({ item }).bands[0].label, 'Burst 6');
  } finally {
    if (prev === undefined) delete globalThis.ds; else globalThis.ds = prev;
  }
});

test('localized labels from the system DistanceEmbed strings', () => {
  const format = (key, data) => (key === 'DRAW_STEEL.Item.ability.DistanceEmbed.Ranged' ? `À distance ${data.primary}` : key);
  const fr = createDrawSteelAdapter({ gridDistance: () => 1, units: () => 'sq', format });
  assert.equal(fr.specFor({ item: freeRanged }).bands[0].label, 'À distance 5');
  assert.equal(fr.specFor({ item: freeMelee }).bands[0].label, 'Melee 1', 'missing key → English');
});

test('default instance and registry', () => {
  assert.equal(getAdapter('draw-steel'), drawSteelAdapter);
  assert.equal(drawSteelAdapter.id, 'draw-steel');
  assert.deepEqual(drawSteelAdapter.specFor({ item: freeRanged }).bands.map(b => b.max), [5]);
  assert.ok(Number.isNaN(drawSteelAdapter.distance({}, {})));
  assert.equal(typeof drawSteelAdapter.cellMeasure, 'function');
});

test('listItems: strikes → attacks, magic/psionic → spells, other abilities → other; only ranged ones', () => {
  const actor = { items: new Map([freeMelee, kit, aura, self, wall, burst, special, cube].map(i => [i.id, i])) };
  assert.deepEqual(ds.listItems(actor).map(e => [e.item.name, e.group, e.actionIndex]), [
    ['Melee Free Strike', 'attacks', null], ['Holy Aura', 'spells', null], ['Wall of Stone', 'spells', null],
    ['Whirlwind', 'other', null], ['Odd Trick', 'other', null], ['Fireball', 'spells', null]
  ]);
  const arrays = ability('arr', 'Array Keywords', { type: 'ranged', primary: 5 }, []);
  arrays.system.keywords = ['strike'];
  assert.equal(ds.listItems({ items: [arrays] })[0].group, 'attacks');
});

// templates/sheets/actor/shared/abilities.hbs as rendered (hero / NPC / retainer sheets).
const SHEET = `<div class="application sheet draw-steel actor" id="sheet"><section class="tab abilities">
  <section class="item-list-container"><ol class="item-list abilities-list">
    <li class="item ability draggable expandable-document" data-document-uuid="Actor.a.Item.fr">
      <div class="item-row">
        <div class="item-column item-name rollable" data-action="useAbility"><img class="item-image"><div class="name"><div class="label">Ranged Free Strike</div><div class="keywords">Ranged, Strike, Weapon</div></div></div>
        <div class="item-column item-cost"></div>
        <div class="item-column item-distance">Ranged 5</div>
        <div class="item-column item-target">One creature or object</div>
        <div class="item-column item-controls">
          <a class="fa-fw fa-solid fa-ellipsis-vertical" data-action="documentListContext"></a>
          <a class="fa-fw fa-solid fa-angle-right" data-action="toggleDocumentDescription"></a>
        </div>
      </div>
      <div class="document-description item-embed"></div>
    </li>
    <li class="item ability draggable expandable-document" data-document-uuid="Actor.a.Item.se">
      <div class="item-row"><div class="item-column item-controls"></div></div>
    </li>
    <li class="item ability draggable expandable-document" data-document-uuid="Actor.a.Item.spc">
      <div class="item-row"><div class="item-column item-controls"></div></div>
    </li>
  </ol></section>
  <ol class="item-list"><li class="item feature draggable expandable-document" data-document-uuid="Actor.a.Item.kit"><div class="item-row"><div class="item-column item-controls"></div></div></li></ol>
</section></div>`;

test('sheet rows: ruler <a> in the ability row controls; special disabled; self / features skipped', () => {
  const dom = new JSDOM(SHEET);
  const doc = dom.window.document;
  const actor = { id: 'a', items: new Map([freeRanged, self, special, kit].map(i => [i.id, i])) };
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: ds, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderDrawSteelActorSheet');
  const button = doc.querySelector('[data-document-uuid="Actor.a.Item.fr"] > .item-row > .item-controls > .range-finder-btn');
  assert.ok(button);
  assert.equal(button.tagName, 'A');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 2);
  assert.equal(doc.querySelector('[data-document-uuid="Actor.a.Item.se"] .range-finder-btn'), null);
  const disabled = doc.querySelector('[data-document-uuid="Actor.a.Item.spc"] .range-finder-btn');
  assert.ok(disabled.classList.contains('is-disabled'));
  assert.equal(disabled.dataset.tooltip, 'Range: special');
  assert.equal(doc.querySelector('[data-document-uuid="Actor.a.Item.kit"] .range-finder-btn'), null);
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls.map(c => [c.itemUuid, c.actionIndex]), [['Actor.a.Item.fr', null]]);
  assert.deepEqual(ds.rows[0].hooks, ['renderDrawSteelActorSheet']);
  // Other hooks (e.g. the subclass hook fired on the same render) do not decorate twice.
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderDrawSteelHeroSheet');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 2);
});

test('rows: resolve by uuid through the sheet actor; items of other actors are ignored', () => {
  const dom = new JSDOM(`<li class="item ability" data-document-uuid="Scene.s.Token.t.Actor.a.Item.fr"><div class="item-row"><div class="item-column item-controls"></div></div></li>`);
  const actor = { items: new Map([['fr', freeRanged]]) };
  const ctx = ds.rows[0].resolve(dom.window.document.querySelector('li'), { document: actor });
  assert.equal(ctx.item, freeRanged);
  assert.equal(ds.rows[0].resolve(dom.window.document.querySelector('li'), {}), null);
  const other = new JSDOM(`<li class="item ability" data-document-uuid="Actor.b.Item.zz"></li>`);
  assert.equal(ds.rows[0].resolve(other.window.document.querySelector('li'), { actor }), null);
});
