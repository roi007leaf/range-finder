import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { createGenericAdapter } from '../scripts/adapters/generic.mjs';

function setup({ html, enabled = true } = {}) {
  const dom = new JSDOM(`<div class="application" id="sheet">${html}</div>`);
  const doc = dom.window.document;
  const actor = { id: 'a1', uuid: 'Actor.a1' };
  const other = { id: 'a2', uuid: 'Actor.a2' };
  const mk = (id, parent, range) => ({ id, uuid: `${parent.uuid}.Item.${id}`, name: id, type: 'weapon', parent, system: range ? { range } : {} });
  const items = [mk('bow', actor, 60), mk('rope', actor, 0), mk('x', actor, 30), mk('foreign', other, 40)];
  actor.items = new Map(items.filter(i => i.parent === actor).map(i => [i.id, i]));
  globalThis.fromUuidSync = uuid => items.find(i => i.uuid === uuid) ?? null;
  const adapter = createGenericAdapter({ rangeField: () => '', units: () => 'ft', rowsEnabled: () => enabled });
  const calls = [];
  const pins = {
    previewing: false,
    toggle: req => { calls.push(['toggle', req]); return 'pinned'; },
    preview: req => { calls.push(['preview', req]); pins.previewing = true; return true; },
    endPreview: () => { pins.previewing = false; return true; },
    pinFor: () => null
  };
  const triggers = new Triggers({ adapter, pins, resolveToken: () => ({ id: 't1' }), notify() {}, localize: k => k, doc });
  const root = doc.getElementById('sheet');
  const app = { actor, element: root };
  const run = hook => triggers.decorate(root, app, hook);
  return { doc, dom, triggers, calls, run, root };
}
const btn = (el) => el?.querySelector('.range-finder-btn');

test('generic rows: data-item-id rows get a button only with a range, on .item-controls', () => {
  const { doc, run } = setup({ html: `<ul>
    <li class="item" data-item-id="bow"><span class="item-name">Bow</span><div class="item-controls"></div></li>
    <li class="item" data-item-id="rope"><span class="item-name">Rope</span><div class="item-controls"></div></li></ul>` });
  run('renderActorSheetV2');
  assert.ok(doc.querySelector('[data-item-id="bow"] .item-controls > .range-finder-btn'));
  assert.equal(btn(doc.querySelector('[data-item-id="rope"]')), null);
});

test('generic rows: also bound for AppV1 renderActorSheet', () => {
  const { doc, run } = setup({ html: `<li data-item-id="bow"><div class="controls"></div></li>` });
  run('renderActorSheet');
  assert.ok(doc.querySelector('.controls > .range-finder-btn'));
});

test('generic rows: uuid attributes resolve to the actor item; another actor item is ignored', () => {
  const { doc, run } = setup({ html: `<div data-uuid="Actor.a1.Item.bow"><span class="name">Bow</span></div>
    <div data-item-uuid="Actor.a2.Item.foreign"><span class="name">F</span></div>
    <div data-document-id="bow" id="d"><h4>D</h4></div>` });
  run('renderActorSheetV2');
  assert.ok(doc.querySelector('[data-uuid] .name > .range-finder-btn'));
  assert.equal(btn(doc.querySelector('[data-item-uuid]')), null);
  assert.ok(doc.querySelector('#d h4 > .range-finder-btn'));
});

test('generic rows: nested matches for the same item yield one button on the inner row', () => {
  const { doc, run } = setup({ html: `<section data-item-id="x" id="outer"><ul><li data-item-id="x" id="inner"></li></ul></section>` });
  run('renderActorSheetV2');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 1);
  assert.ok(doc.querySelector('#inner > .range-finder-btn'));
});

test('generic rows: host falls back to the name element, then the row', () => {
  const { doc, run } = setup({ html: `<li data-item-id="bow" id="a"><span class="item-name">Bow</span></li><li data-item-id="x" id="b">X</li>` });
  run('renderActorSheetV2');
  assert.ok(doc.querySelector('#a .item-name > .range-finder-btn'));
  assert.ok(doc.querySelector('#b > .range-finder-btn'));
});

test('generic rows: the sheet root itself is skipped', () => {
  const { doc, root, run } = setup({ html: `<div class="item-controls"></div>` });
  root.setAttribute('data-item-id', 'bow');
  run('renderActorSheetV2');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 0);
});

test('generic rows: disabled by the setting', () => {
  const { doc, run } = setup({ html: `<li data-item-id="bow"></li>`, enabled: false });
  run('renderActorSheetV2');
  assert.equal(doc.querySelectorAll('.range-finder-btn').length, 0);
});

test('generic rows: holding the preview key over a row previews it', () => {
  const { doc, dom, triggers, calls, run } = setup({ html: `<li data-item-id="bow"><div class="item-controls"></div></li>` });
  run('renderActorSheetV2');
  doc.querySelector('li').dispatchEvent(new dom.window.MouseEvent('pointerover', { bubbles: true }));
  triggers.keyDown();
  assert.equal(calls[0][0], 'preview');
  assert.equal(calls[0][1].itemUuid, 'Actor.a1.Item.bow');
});
