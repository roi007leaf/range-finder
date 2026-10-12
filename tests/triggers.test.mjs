import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ token = { id: 't1' }, settings = {} } = {}) {
  const dom = new JSDOM(`<div class="application" id="sheet">
      <ul><li class="row" data-id="bow"><span class="name">Bow</span></li>
          <li class="row" data-id="wish"><span class="name">Wish</span></li>
          <li class="row" data-id="rope"><span class="name">Rope</span></li></ul>
    </div>
    <div class="application" id="hud"><div class="slot" data-id="bow"></div></div>`);
  const doc = dom.window.document;
  const items = {
    bow: { uuid: 'Item.bow', spec: makeSpec({ kind: 'radius', bands: singleBand(60) }) },
    wish: { uuid: 'Item.wish', spec: noneSpec('Range: varies') },
    rope: { uuid: 'Item.rope', spec: noneSpec() }
  };
  const actor = { id: 'a1' };
  const adapter = {
    specFor: ({ item }) => item.spec,
    rows: [
      { hooks: ['renderSheet'], selector: 'li.row', resolve: el => ({ actor, item: items[el.dataset.id], actionIndex: null }), host: el => el.querySelector('.name') },
      { hooks: ['renderHud'], selector: '.slot', resolve: el => ({ actor, item: items[el.dataset.id], actionIndex: null }), persistentHud: true }
    ]
  };
  const calls = [], notes = [];
  let pinned = null;
  const pins = {
    previewing: false,
    toggle: req => { calls.push(['toggle', req]); pinned = req; return 'pinned'; },
    preview: req => { calls.push(['preview', req]); pins.previewing = true; return true; },
    endPreview: () => { calls.push(['endPreview']); pins.previewing = false; return true; },
    pinFor: req => (pinned && pinned.itemUuid === req.itemUuid ? { shared: Boolean(pinned.share) } : null)
  };
  const triggers = new Triggers({ adapter, pins, resolveToken: () => token, notify: m => notes.push(m), localize: k => k, settings: () => ({ ghostPersistentHud: false, ...settings }), doc });
  return { doc, dom, triggers, calls, notes };
}

test('adds buttons only to rows with a range or a note', () => {
  const { doc, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const bow = doc.querySelector('[data-id="bow"] .name .range-finder-btn');
  const wish = doc.querySelector('[data-id="wish"] .range-finder-btn');
  assert.ok(bow);
  assert.ok(wish.classList.contains('is-disabled'));
  assert.equal(wish.dataset.tooltip, 'Range: varies');
  assert.equal(doc.querySelector('[data-id="rope"] .range-finder-btn'), null);
});

test('decorate is idempotent and filtered by hook', () => {
  const { doc, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  assert.equal(doc.querySelectorAll('[data-id="bow"] .range-finder-btn').length, 1);
  triggers.decorate(doc.getElementById('hud'), {}, 'renderSheet');
  assert.equal(doc.querySelector('.slot .range-finder-btn'), null);
});

test('click toggles a pin with the source window; shift shares; disabled does nothing', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }));
  assert.equal(calls[0][0], 'toggle');
  assert.deepEqual({ ...calls[0][1], sourceEl: calls[0][1].sourceEl.id }, { tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null, sourceEl: 'sheet', share: true });
  doc.querySelector('[data-id="wish"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls.length, 1);
});

test('buttons are keyboard operable; disabled ones are aria-disabled (final 8)', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const bow = doc.querySelector('[data-id="bow"] .range-finder-btn');
  const wish = doc.querySelector('[data-id="wish"] .range-finder-btn');
  assert.equal(bow.getAttribute('tabindex'), '0');
  assert.equal(bow.hasAttribute('aria-disabled'), false);
  assert.equal(wish.getAttribute('aria-disabled'), 'true');
  const enter = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  bow.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true);
  bow.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', shiftKey: true, bubbles: true }));
  bow.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  assert.deepEqual(calls.map(c => [c[0], c[1].share]), [['toggle', false], ['toggle', true]]);
  wish.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(calls.length, 2);
});

test('no token on scene → notification, no pin (Review Focus 1)', () => {
  const { doc, dom, triggers, calls, notes } = setup({ token: null });
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls, []);
  assert.deepEqual(notes, ['RANGE_FINDER.Notify.NoToken']);
});

test('re-rendered rows show the active state (Review Focus 3)', () => {
  const { doc, dom, triggers } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"] .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const sheet = doc.getElementById('sheet');
  sheet.innerHTML = '<ul><li class="row" data-id="bow"><span class="name">Bow</span></li></ul>';
  triggers.decorate(sheet, {}, 'renderSheet');
  assert.ok(doc.querySelector('[data-id="bow"] .range-finder-btn').classList.contains('is-active'));
});

test('preview: key held + hover starts once; release ends', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const row = doc.querySelector('[data-id="bow"]');
  row.querySelector('.name').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls, []);
  triggers.keyDown();
  row.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  assert.equal(calls[0][1].sourceEl.id, 'sheet');
  triggers.keyUp();
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview']);
});

test('preview without a token is silent', () => {
  const { doc, dom, triggers, calls, notes } = setup({ token: null });
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  doc.querySelector('[data-id="bow"]').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  triggers.keyDown();
  assert.deepEqual(calls, []);
  assert.deepEqual(notes, []);
});

test('persistent HUD rows do not ghost unless the setting is on', () => {
  const off = setup();
  off.triggers.decorate(off.doc.getElementById('hud'), {}, 'renderHud');
  off.doc.querySelector('.slot .range-finder-btn').dispatchEvent(new off.dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(off.calls[0][1].sourceEl, null);
  const on = setup({ settings: { ghostPersistentHud: true } });
  on.triggers.decorate(on.doc.getElementById('hud'), {}, 'renderHud');
  on.doc.querySelector('.slot .range-finder-btn').dispatchEvent(new on.dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(on.calls[0][1].sourceEl.id, 'hud');
});

test('a throwing resolver never breaks decoration of other rows', () => {
  const { doc, triggers } = setup();
  triggers.adapter.rows.unshift({ hooks: ['renderSheet'], selector: 'li.row', resolve: () => { throw new Error('boom'); } });
  const original = console.error;
  console.error = () => {};
  try { triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet'); } finally { console.error = original; }
  assert.ok(doc.querySelector('[data-id="bow"] .range-finder-btn'));
});

test('rows with ghostTargets ghost those elements instead of the closest window', () => {
  const { doc, dom, triggers, calls } = setup({ settings: { ghostPersistentHud: true } });
  triggers.adapter.rows[1].ghostTargets = (row, { includeBar }) => (includeBar ? [doc.getElementById('hud'), doc.getElementById('sheet')] : []);
  triggers.decorate(doc.getElementById('hud'), {}, 'renderHud');
  doc.querySelector('.slot .range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(calls[0][1].sourceEl.map(el => el.id), ['hud', 'sheet']);
});

const reachSpell = ctx => (ctx.item.uuid === 'Item.bow' ? { id: 'reach-spell', label: 'Reach Spell' } : null);

test('Alt+click pins the adapter\'s per-use variant; plain click does not (spec rule 7)', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.adapter.altVariant = reachSpell;
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const bow = doc.querySelector('[data-id="bow"] .range-finder-btn');
  assert.equal(bow.dataset.tooltip, 'RANGE_FINDER.Button.Show · RANGE_FINDER.Button.Alt Reach Spell');
  assert.equal(bow.getAttribute('data-range-finder-alt'), 'reach-spell');
  assert.equal(doc.querySelector('[data-id="wish"] .range-finder-btn').hasAttribute('data-range-finder-alt'), false);
  bow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, altKey: true }));
  bow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0][1].variant, 'reach-spell');
  assert.equal('variant' in calls[1][1], false);
});

test('hold-Alt preview: never over a variant 📏; an Alt press on it ends the preview until Alt is released', () => {
  const { doc, dom, triggers, calls } = setup();
  triggers.adapter.altVariant = reachSpell;
  triggers.decorate(doc.getElementById('sheet'), {}, 'renderSheet');
  const row = doc.querySelector('[data-id="bow"]');
  const button = row.querySelector('.range-finder-btn');
  button.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  triggers.keyDown();
  assert.deepEqual(calls, [], 'pointer on the 📏: no preview');
  row.querySelector('.name').dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  button.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, altKey: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview']);
  row.dispatchEvent(new dom.window.Event('pointerover', { bubbles: true }));
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'endPreview'], 'the click wins');
  triggers.keyUp();
  triggers.keyDown();
  assert.equal(calls.filter(c => c[0] === 'preview').length, 2, 'the next Alt press previews again');
});
