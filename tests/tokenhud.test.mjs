import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { TokenHudList } from '../scripts/ui/TokenHudList.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ owner = true, enabled = true, list = null } = {}) {
  const dom = new JSDOM(`<div id="hud"><div id="token-hud"><div class="col left"></div><div class="col middle"></div><div class="col right"><button class="control-icon" data-action="combat"></button></div></div></div>`);
  const doc = dom.window.document;
  const items = {
    bow: { uuid: 'Item.bow', name: 'Longbow', img: 'bow.webp', spec: makeSpec({ kind: 'increments', bands: [...singleBand(150), { min: 150, max: 600, penalty: 0, tone: 'increment', label: '600 ft · Disadv.', mark: 'Disadv.' }] }) },
    arc: { uuid: 'Item.arc', name: 'Electric Arc', spec: makeSpec({ kind: 'radius', bands: singleBand(30) }) },
    demoralize: { uuid: 'Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF', name: 'Demoralize', spec: makeSpec({ kind: 'radius', bands: singleBand(30) }) },
    wish: { uuid: 'Item.wish', name: 'Wish', spec: noneSpec('Range: varies') },
    rope: { uuid: 'Item.rope', name: 'Rope', spec: noneSpec() }
  };
  const adapter = {
    specFor: ({ item }) => item.spec,
    listItems: () => list ?? [
      { item: items.rope, actionIndex: null, group: 'other' },
      { item: items.wish, actionIndex: null, group: 'other' },
      { item: items.demoralize, actionIndex: null, group: 'skills' },
      { item: items.arc, actionIndex: null, group: 'spells' },
      { item: items.bow, actionIndex: 0, group: 'attacks' }
    ],
    rows: []
  };
  const calls = [];
  let pinned = null;
  const pins = {
    previewing: false,
    toggle: req => { calls.push(['toggle', req]); pinned = req; return 'pinned'; },
    preview: req => { calls.push(['preview', req]); pins.previewing = true; return true; },
    endPreview: () => { calls.push(['endPreview']); pins.previewing = false; return true; },
    pinFor: req => (pinned && pinned.itemUuid === req.itemUuid ? { shared: Boolean(pinned.share) } : null)
  };
  // resolveToken returns a different token on purpose: HUD rows must use the HUD's token.
  const triggers = new Triggers({ adapter, pins, resolveToken: () => ({ id: 'first-active' }), localize: k => k, doc });
  const hudList = new TokenHudList({ adapter, triggers, localize: k => k, units: () => 'ft', enabled: () => enabled, doc });
  const actor = { id: 'a1' };
  const token = { id: 't1', actor, isOwner: owner };
  const hud = { object: token, actor, document: { isOwner: owner } };
  return { dom, doc, hudList, hud, actor, calls, root: doc.getElementById('token-hud') };
}
const click = (s, el, init = {}) => el.dispatchEvent(new s.dom.window.MouseEvent('click', { bubbles: true, ...init }));
const rows = s => [...s.doc.querySelectorAll('#range-finder-hud-list .range-finder-hud-row')];
const rowNamed = (s, name) => rows(s).find(r => r.querySelector('.name').textContent === name);

test('adds one 📏 control to the right column of owned tokens; respects the setting', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  s.hudList.attach(s.hud, s.root);
  assert.equal(s.root.querySelectorAll('.col.right .range-finder-hud-btn').length, 1);
  assert.equal(s.root.querySelector('.range-finder-hud-btn').dataset.tooltip, 'RANGE_FINDER.Hud.Button');
  const other = setup({ owner: false });
  other.hudList.attach(other.hud, other.root);
  assert.equal(other.root.querySelector('.range-finder-hud-btn'), null);
  const off = setup({ enabled: false });
  off.hudList.attach(off.hud, off.root);
  assert.equal(off.root.querySelector('.range-finder-hud-btn'), null);
});

test('popover groups attacks, spells, skill actions, other; range labels; note rows disabled', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  const list = s.doc.getElementById('range-finder-hud-list');
  assert.equal(list.parentElement, s.doc.body);
  assert.deepEqual([...list.querySelectorAll('h4')].map(h => h.textContent), ['RANGE_FINDER.Hud.Groups.attacks', 'RANGE_FINDER.Hud.Groups.spells', 'RANGE_FINDER.Hud.Groups.skills', 'RANGE_FINDER.Hud.Groups.other']);
  assert.deepEqual(rows(s).map(r => r.querySelector('.name').textContent), ['Longbow', 'Electric Arc', 'Demoralize', 'Wish']);
  assert.deepEqual(rows(s).map(r => r.querySelector('.range').textContent), ['150/600 ft', '30 ft', '30 ft', 'Range: varies']);
  const wish = rowNamed(s, 'Wish');
  assert.ok(wish.classList.contains('is-disabled'));
  assert.equal(wish.dataset.tooltip, 'Range: varies');
  assert.equal(rowNamed(s, 'Longbow').dataset.actionIndex, '0');
  assert.equal(s.root.querySelector('.range-finder-hud-btn').getAttribute('aria-expanded'), 'true');
});

test('row click pins for the HUD token; Shift+click shares; never ghosted; pinned row active (Review Focus 2)', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  click(s, rowNamed(s, 'Longbow'));
  assert.deepEqual(s.calls[0], ['toggle', { tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0, sourceEl: [], share: false }]);
  click(s, rowNamed(s, 'Electric Arc'), { shiftKey: true });
  assert.equal(s.calls[1][1].share, true);
  assert.ok(rowNamed(s, 'Electric Arc').classList.contains('is-active'));
  click(s, rowNamed(s, 'Wish'));
  assert.equal(s.calls.length, 2, 'note rows do nothing');
});

test('holding the preview key over a row previews it for the HUD token', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  s.hudList.triggers.keyDown();
  rowNamed(s, 'Demoralize').dispatchEvent(new s.dom.window.Event('pointerover', { bubbles: true }));
  assert.equal(s.calls[0][0], 'preview');
  assert.equal(s.calls[0][1].tokenId, 't1');
});

test('closes on Esc, with the HUD, on toggle, and when the HUD moves to another token', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  const button = s.root.querySelector('.range-finder-hud-btn');
  click(s, button);
  s.doc.dispatchEvent(new s.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(s.doc.getElementById('range-finder-hud-list'), null);
  click(s, button);
  click(s, button);
  assert.equal(s.hudList.isOpen, false, 'second click closes');
  click(s, button);
  s.hudList.close();
  assert.equal(s.doc.getElementById('range-finder-hud-list'), null);
  click(s, button);
  s.hudList.attach({ ...s.hud, object: { id: 't2', actor: s.actor, isOwner: true } }, s.root);
  assert.equal(s.hudList.isOpen, false);
});

test('empty list shows a hint', () => {
  const s = setup({ list: [] });
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  assert.equal(s.doc.querySelector('#range-finder-hud-list .range-finder-hud-empty').textContent, 'RANGE_FINDER.Hud.Empty');
});

test('lists only items whose spec shows a button: ranged rows active, note-only rows disabled, items with neither omitted', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  const names = rows(s).map(r => r.querySelector('.name').textContent);
  assert.ok(!names.includes('Rope'), 'no range and no note: not listed');
  assert.deepEqual(rows(s).filter(r => r.classList.contains('is-disabled')).map(r => r.querySelector('.name').textContent), ['Wish']);
  assert.equal(rowNamed(s, 'Wish').dataset.tooltip, 'Range: varies');
  assert.ok(!rowNamed(s, 'Longbow').classList.contains('is-disabled'));
});


test('scheduleReposition defers to the next frame and coalesces', () => {
  const s = setup();
  const frames = [];
  s.hudList.raf = callback => frames.push(callback);
  s.hudList.scheduleReposition();
  assert.equal(frames.length, 0, 'closed: nothing scheduled');
  s.hudList.attach(s.hud, s.root);
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  s.root.getBoundingClientRect = () => ({ left: 100, right: 300, top: 10 });
  s.hudList.reposition();
  s.root.getBoundingClientRect = () => ({ left: 100, right: 300, top: 77 });
  s.hudList.scheduleReposition();
  s.hudList.scheduleReposition();
  assert.equal(frames.length, 1);
  assert.equal(s.doc.getElementById('range-finder-hud-list').style.top, '10px', 'not moved before the frame');
  frames[0]();
  assert.equal(s.doc.getElementById('range-finder-hud-list').style.top, '77px');
  s.hudList.scheduleReposition();
  assert.equal(frames.length, 2, 'a new frame can be scheduled after one ran');
});

test('reposition is a no-op when closed and moves the open popover', () => {
  const s = setup();
  s.hudList.attach(s.hud, s.root);
  s.hudList.reposition();
  click(s, s.root.querySelector('.range-finder-hud-btn'));
  s.root.getBoundingClientRect = () => ({ left: 100, right: 300, top: 50 });
  s.hudList.reposition();
  assert.equal(s.doc.getElementById('range-finder-hud-list').style.top, '50px');
});
