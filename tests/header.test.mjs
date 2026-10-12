import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { headerButtonV1, headerControlV2, headerItem, sheetElement } from '../scripts/ui/HeaderButton.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

const actor = { documentName: 'Actor', id: 'a1' };
const bow = { documentName: 'Item', uuid: 'Actor.a1.Item.bow', name: 'Longbow', actor, parent: actor, spec: makeSpec({ kind: 'radius', bands: singleBand(60) }) };
const wish = { documentName: 'Item', uuid: 'Actor.a1.Item.wish', name: 'Wish', actor, parent: actor, spec: noneSpec('Range: varies') };
const loose = { documentName: 'Item', uuid: 'Item.loose', name: 'Loose Bow', actor: null, parent: null, spec: bow.spec };
const adapter = { specFor: ({ item }) => item.spec };

function deps() {
  const calls = [];
  return { calls, adapter, localize: k => k, triggers: { pinItem: (ctx, options) => { calls.push([ctx.item.uuid, options]); return 'pinned'; } } };
}

test('headerItem: only items embedded in an actor', () => {
  assert.deepEqual(headerItem({ document: bow }), { actor, item: bow, actionIndex: null });
  assert.equal(headerItem({ document: loose }), null);
  assert.equal(headerItem({ document: actor }), null);
  assert.equal(headerItem({}), null);
});

test('sheetElement: AppV2 HTMLElement or AppV1 jQuery wrapper', () => {
  const el = { nodeType: 1 };
  assert.equal(sheetElement({ element: el }), el);
  assert.equal(sheetElement({ element: [el] }), el);
  assert.equal(sheetElement({}), null);
});

test('AppV2 control only when the item has a range; click pins, Shift+click shares, sheet ghosted', () => {
  const d = deps();
  const element = { nodeType: 1, id: 'sheet' };
  const control = headerControlV2({ document: bow, element }, d);
  assert.deepEqual({ ...control, onClick: typeof control.onClick }, { action: 'rangeFinderPin', icon: 'fa-solid fa-ruler-combined', label: 'RANGE_FINDER.Header.Pin', onClick: 'function' });
  control.onClick({ shiftKey: true });
  control.onClick({ shiftKey: false });
  assert.deepEqual(d.calls, [['Actor.a1.Item.bow', { share: true, sourceEl: element }], ['Actor.a1.Item.bow', { share: false, sourceEl: element }]]);
  assert.equal(headerControlV2({ document: wish, element }, d), null, 'note-only: no control');
  assert.equal(headerControlV2({ document: loose, element }, d), null);
  assert.equal(headerControlV2({ document: { documentName: 'Item', actor, specThrows: true } }, { ...d, adapter: { specFor: () => { throw new Error('boom'); } } }), null);
});

test('AppV1 button reads the jQuery-wrapped element', () => {
  const d = deps();
  const el = { nodeType: 1, id: 'pf2e-sheet' };
  const button = headerButtonV1({ item: bow, object: bow, element: [el] }, d);
  assert.equal(button.class, 'range-finder-header');
  assert.equal(button.label, 'RANGE_FINDER.Header.Label');
  button.onclick({ shiftKey: false });
  assert.deepEqual(d.calls[0], ['Actor.a1.Item.bow', { share: false, sourceEl: el }]);
  assert.equal(headerButtonV1({ item: wish, element: [el] }, d), null);
});

test('with the real Triggers: pins the owning actor\'s token, warns when it has none', () => {
  const doc = new JSDOM('<div id="sheet" class="application"></div>').window.document;
  const calls = [], notes = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter, pins, resolveToken: a => (a === actor ? { id: 't1' } : null), notify: m => notes.push(m), localize: k => k, doc });
  const element = doc.getElementById('sheet');
  headerControlV2({ document: bow, element }, { adapter, triggers }).onClick({ shiftKey: true });
  assert.deepEqual(calls[0], { tokenId: 't1', itemUuid: 'Actor.a1.Item.bow', actionIndex: null, sourceEl: element, share: true });
  const stranger = { ...bow, actor: { documentName: 'Actor', id: 'a2' } };
  headerControlV2({ document: stranger, element }, { adapter, triggers }).onClick({});
  assert.deepEqual(notes, ['RANGE_FINDER.Notify.NoToken']);
});
