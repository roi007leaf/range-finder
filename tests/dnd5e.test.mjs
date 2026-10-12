import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { createDnd5eAdapter, dnd5eAdapter } from '../scripts/adapters/dnd5e.mjs';

const convert = (value, from, to) => (from === to ? value : from === 'm' && to === 'ft' ? value * 10 / 3 : from === 'ft' && to === 'm' ? value * 0.3 : value);
const dnd = createDnd5eAdapter({ convert, units: () => 'ft' });
const weapon = (name, { attackType, hasRange, props = [], range }) => ({ name, type: 'weapon', system: { attackType, hasRange, properties: new Set(props), range } });
const spell = (name, range, template = {}) => ({ name, type: 'spell', system: { range, target: { template } } });
const longbow = weapon('Longbow', { attackType: 'ranged', hasRange: true, props: ['amm', 'hvy', 'two'], range: { value: 150, long: 600, reach: null, units: 'ft' } });
const dagger = weapon('Dagger', { attackType: 'melee', hasRange: true, props: ['fin', 'lgt', 'thr'], range: { value: 20, long: 60, reach: 5, units: 'ft' } });
const glaive = weapon('Glaive', { attackType: 'melee', hasRange: false, props: ['hvy', 'rch', 'two'], range: { value: null, long: null, reach: 10, units: 'ft' } });

test('longbow 150/600: normal band and a long band marked Disadv.', () => {
  const spec = dnd.specFor({ item: longbow });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 150, penalty: 0, tone: 'base', label: '150 ft' },
    { min: 150, max: 600, penalty: 0, tone: 'increment', label: '600 ft · Disadv.', mark: 'Disadv.' }
  ]);
  assert.deepEqual(spec.overlays, []);
});

test('dagger: thrown 20/60 plus a 5 ft reach overlay', () => {
  const spec = dnd.specFor({ item: dagger });
  assert.deepEqual(spec.bands.map(b => b.max), [20, 60]);
  assert.deepEqual(spec.overlays, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }]);
});

test('glaive: reach 10 band', () => {
  assert.deepEqual(dnd.specFor({ item: glaive }), { kind: 'reach', bands: [{ min: 0, max: 10, penalty: 0, tone: 'reach', label: 'Reach 10 ft' }], overlays: [], note: null, itemName: 'Glaive' });
});

test('weapon edge data (Review Focus 3)', () => {
  const raw = weapon('Halberd', { attackType: 'melee', hasRange: false, props: ['rch'], range: { value: null, long: null, reach: null, units: 'ft' } });
  assert.equal(dnd.specFor({ item: raw }).bands[0].max, 10, 'rch default when reach is unprepared');
  const sling = weapon('Sling', { attackType: 'ranged', hasRange: true, range: { value: 30, long: 30, units: 'ft' } });
  const one = dnd.specFor({ item: sling });
  assert.equal(one.kind, 'radius');
  assert.equal(one.bands.length, 1);
  const broken = weapon('Odd Bow', { attackType: 'ranged', hasRange: true, range: { value: null, long: null, units: 'ft' } });
  assert.equal(dnd.specFor({ item: broken }).kind, 'none');
  assert.equal(dnd.specFor({ item: broken }).note, 'Range: —');
  const fist = weapon('Unarmed', { attackType: null, hasRange: false, range: null });
  assert.equal(dnd.specFor({ item: fist }).bands[0].max, 5);
});

test('spells: distance, touch, self + template, self without template, spec, any', () => {
  assert.deepEqual(dnd.specFor({ item: spell('Fire Bolt', { value: 120, units: 'ft' }) }).bands[0], { min: 0, max: 120, penalty: 0, tone: 'base', label: '120 ft' });
  assert.deepEqual(dnd.specFor({ item: spell('Fire Bolt', { value: '120', units: 'ft' }) }).bands[0].max, 120);
  const grasp = dnd.specFor({ item: spell('Shocking Grasp', { units: 'touch' }) });
  assert.equal(grasp.kind, 'reach');
  assert.equal(grasp.bands[0].label, 'Touch · 5 ft');
  const hands = dnd.specFor({ item: spell('Burning Hands', { units: 'self' }, { type: 'cone', size: 15, units: 'ft' }) });
  assert.equal(hands.kind, 'radius');
  assert.equal(hands.bands[0].label, 'Cone 15 ft');
  assert.equal(dnd.specFor({ item: spell('Spirit Guardians', { units: 'self' }, { type: 'radius', size: 15, units: 'ft' }) }).bands[0].label, 'Emanation 15 ft');
  const shield = dnd.specFor({ item: spell('Shield', { units: 'self' }) });
  assert.equal(shield.kind, 'none');
  assert.equal(shield.note, null);
  assert.equal(dnd.specFor({ item: spell('Wish', { units: 'spec' }) }).note, 'Range: special');
  assert.equal(dnd.specFor({ item: spell('Sending', { units: 'any' }) }).note, 'Range: any');
});

test('features read their first activity', () => {
  const breath = { name: 'Breath Weapon', type: 'feat', system: { activities: new Map([['a', { range: { units: 'self' }, target: { template: { type: 'cone', size: 30, units: 'ft' } } }]]) } };
  assert.equal(dnd.specFor({ item: breath }).bands[0].label, 'Cone 30 ft');
  const sling = { name: 'Hurl', type: 'feat', system: { activities: new Map([['a', { range: { value: 30, units: 'ft' }, target: {} }]]) } };
  assert.equal(dnd.specFor({ item: sling }).bands[0].max, 30);
  assert.equal(dnd.specFor({ item: { name: 'Toughness', type: 'feat', system: {} } }).kind, 'none');
});

test('units: metres item on a feet scene, feet item on a metres scene', () => {
  assert.equal(dnd.specFor({ item: spell('Bolt', { value: 9, units: 'm' }) }).bands[0].max, 30);
  const metric = createDnd5eAdapter({ convert, units: () => 'm' });
  const bow = metric.specFor({ item: longbow });
  assert.deepEqual(bow.bands.map(b => [b.max, b.label]), [[45, '45 m'], [180, '180 m · Disadv.']]);
  assert.equal(metric.specFor({ item: glaive }).bands[0].label, 'Reach 3 m');
  assert.equal(dnd.specFor({ item: longbow, units: 'm' }).bands[0].label.endsWith(' m'), true, 'ctx.units wins');
});

test('default instance: no dnd5e global → identity conversion, scene units ft', () => {
  assert.equal(dnd5eAdapter.id, 'dnd5e');
  assert.equal(dnd5eAdapter.specFor({ item: longbow }).bands[0].max, 150);
  assert.ok(Number.isNaN(dnd5eAdapter.distance({}, {})));
});

test('sheet rows: ruler in .item-controls of inventory/feature/spell rows that have a range', () => {
  const dom = new JSDOM(`<div class="application sheet actor" id="sheet"><dnd5e-inventory class="inventory-element"><ol class="item-list">
    <li class="item" data-item-id="bow"><div class="item-row"><div class="item-name">Longbow</div><div class="item-detail item-controls"></div></div></li>
    <li class="item" data-item-id="rope"><div class="item-row"><div class="item-name">Rope</div><div class="item-detail item-controls"></div></div></li>
  </ol></dnd5e-inventory></div>`);
  const doc = dom.window.document;
  const bow = { ...longbow, uuid: 'Actor.a.Item.bow' };
  const actor = { id: 'a', items: new Map([['bow', bow], ['rope', { name: 'Rope', type: 'loot', uuid: 'Actor.a.Item.rope', system: {} }]]) };
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: dnd, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  triggers.decorate(doc.getElementById('sheet'), { actor }, 'renderCharacterActorSheet');
  const button = doc.querySelector('[data-item-id="bow"] .item-controls .range-finder-btn');
  assert.ok(button);
  // Rendered like dnd5e's own row controls so it lines up with them.
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.type, 'button');
  for (const cls of ['unbutton', 'config-button', 'item-control', 'always-interactive']) assert.ok(button.classList.contains(cls), cls);
  assert.equal(doc.querySelector('[data-item-id="rope"] .range-finder-btn'), null);
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0].itemUuid, 'Actor.a.Item.bow');
  assert.equal(calls[0].sourceEl.id, 'sheet');
  assert.deepEqual(dnd.rows[0].hooks, ['renderCharacterActorSheet', 'renderNPCActorSheet']);
});

test('listItems groups weapons, spells and others with a range or note', () => {
  const items = [longbow, spell('Fire Bolt', { value: 120, units: 'ft' }), spell('Wish', { units: 'spec' }), spell('Shield', { units: 'self' }), { name: 'Rope', type: 'loot', system: {} }];
  const breath = { name: 'Breath Weapon', type: 'feat', system: { activities: new Map([['a', { range: { units: 'self' }, target: { template: { type: 'cone', size: 30, units: 'ft' } } }]]) } };
  const list = dnd.listItems({ items: [...items, breath] });
  assert.deepEqual(list.map(e => [e.item.name, e.group]), [['Longbow', 'attacks'], ['Fire Bolt', 'spells'], ['Wish', 'spells'], ['Breath Weapon', 'other']]);
});
