import assert from 'node:assert/strict';
import test from 'node:test';
import { PinManager } from '../scripts/ui/PinManager.mjs';
import { makeSpec, noneSpec, singleBand } from '../scripts/core/spec.mjs';

function setup({ specs = {}, allowShare = true } = {}) {
  const sent = [], ghostLog = [];
  let changes = 0;
  const lookup = { 'Item.bow': makeSpec({ kind: 'radius', bands: singleBand(60) }), 'Item.sword': makeSpec({ kind: 'reach', bands: singleBand(5, 'reach', 'Reach 5 ft') }), 'Item.wish': noneSpec('Range: varies'), ...specs };
  const pins = new PinManager({
    userId: 'me',
    build: ({ itemUuid }) => lookup[itemUuid] ?? null,
    onChange: () => { changes++; },
    broadcast: message => sent.push(message),
    allowShare: () => allowShare,
    ghost: { hold: (el, o) => ghostLog.push(['hold', el, o.sticky]), release: (el, o) => ghostLog.push(['release', el, o.sticky]) }
  });
  return { pins, sent, ghostLog, lookup, changes: () => changes };
}

test('toggle pins, replaces and unpins; ghost held and released', () => {
  const { pins, ghostLog } = setup();
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'sheet' }), 'pinned');
  assert.ok(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null }));
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' }), 'pinned');
  assert.equal(pins.size, 1);
  assert.equal(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow' }), null);
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' }), 'unpinned');
  assert.equal(pins.size, 0);
  assert.deepEqual(ghostLog, [['hold', 'sheet', true], ['release', 'sheet', true], ['hold', 'sheet', true], ['release', 'sheet', true]]);
});

test('no range → unavailable', () => {
  const { pins } = setup();
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.wish' }), 'unavailable');
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.missing' }), 'unavailable');
});

test('actionIndex distinguishes strikes of the same item', () => {
  const { pins } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0 });
  assert.ok(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 0 }));
  assert.equal(pins.pinFor({ tokenId: 't1', itemUuid: 'Item.bow', actionIndex: 1 }), null);
});

test('sharing broadcasts pin and unpin; disabled sharing stays local', () => {
  const { pins, sent } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true });
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.deepEqual(sent, [
    { action: 'pin', userId: 'me', tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null },
    { action: 'unpin', userId: 'me', tokenId: 't1' }
  ]);
  const off = setup({ allowShare: false });
  off.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true });
  assert.deepEqual(off.sent, []);
  assert.equal(off.pins.all()[0].shared, false);
});

test('receive builds remote pins; ignores own echo; clearAll removes shared', () => {
  const { pins } = setup();
  pins.receive({ action: 'pin', userId: 'me', tokenId: 't9', itemUuid: 'Item.bow' });
  assert.equal(pins.size, 0);
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow', actionIndex: null });
  assert.equal(pins.all()[0].shared, true);
  assert.equal(pins.all()[0].userId, 'ally');
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.sword' });
  pins.receive({ action: 'clearAll', userId: 'gm' });
  assert.deepEqual(pins.all().map(p => p.itemUuid), ['Item.sword']);
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  pins.receive({ action: 'unpin', userId: 'ally', tokenId: 't2' });
  assert.equal(pins.size, 1);
});

test('preview: one at a time, separate from pins, non-sticky ghost', () => {
  const { pins, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.equal(pins.preview({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'hud' }), true);
  assert.equal(pins.preview({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'hud' }), false);
  assert.equal(pins.previewing, true);
  assert.equal(pins.all().length, 2);
  assert.equal(pins.all()[1].preview, true);
  assert.equal(pins.endPreview(), true);
  assert.equal(pins.endPreview(), false);
  assert.deepEqual(ghostLog.slice(-2), [['hold', 'hud', false], ['release', 'hud', false]]);
});

test('clearLocal clears own pins and preview, keeps remote', () => {
  const { pins } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  pins.preview({ tokenId: 't1', itemUuid: 'Item.sword' });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  assert.equal(pins.clearLocal(), true);
  assert.deepEqual(pins.all().map(p => p.userId), ['ally']);
  assert.equal(pins.clearLocal(), false);
});

test('clearShared broadcasts and drops shared pins', () => {
  const { pins, sent } = setup();
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  pins.clearShared();
  assert.equal(pins.size, 0);
  assert.deepEqual(sent.at(0), { action: 'clearAll', userId: 'me' });
});

test('dropToken / dropItem release ghosts (Review Focus 4)', () => {
  const { pins, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'sheet' });
  pins.preview({ tokenId: 't1', itemUuid: 'Item.sword', sourceEl: 'sheet' });
  pins.dropToken('t1');
  assert.equal(pins.size, 0);
  assert.equal(ghostLog.filter(e => e[0] === 'release').length, 2);
  pins.toggle({ tokenId: 't3', itemUuid: 'Item.sword' });
  pins.dropItem('Item.sword');
  assert.equal(pins.size, 0);
});

test('rebuild refreshes specs and drops pins whose item lost its range (Review Focus 5)', () => {
  const { pins, lookup } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  pins.toggle({ tokenId: 't2', itemUuid: 'Item.sword' });
  lookup['Item.bow'] = makeSpec({ kind: 'radius', bands: singleBand(90) });
  delete lookup['Item.sword'];
  pins.rebuild();
  assert.equal(pins.size, 1);
  assert.equal(pins.all()[0].spec.bands[0].max, 90);
});

test('reset clears everything and only broadcasts unpin for own shared pins (final 2)', () => {
  const { pins, sent, ghostLog } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true, sourceEl: 'sheet' });
  pins.toggle({ tokenId: 't3', itemUuid: 'Item.sword' });
  pins.preview({ tokenId: 't3', itemUuid: 'Item.bow' });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  sent.length = 0;
  pins.reset();
  assert.equal(pins.size, 0);
  assert.deepEqual(sent, [{ action: 'unpin', userId: 'me', tokenId: 't1' }]);
  assert.ok(ghostLog.some(e => e[0] === 'release' && e[1] === 'sheet' && e[2] === true));
});

test('dropUser removes a disconnected user\'s shared pins (final 2)', () => {
  const { pins, sent, changes } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't2', itemUuid: 'Item.bow' });
  pins.receive({ action: 'pin', userId: 'ally', tokenId: 't3', itemUuid: 'Item.sword' });
  pins.receive({ action: 'pin', userId: 'other', tokenId: 't2', itemUuid: 'Item.bow' });
  sent.length = 0;
  const before = changes();
  pins.dropUser('ally');
  assert.deepEqual(pins.all().map(p => p.userId), ['me', 'other']);
  assert.equal(changes(), before + 1);
  assert.deepEqual(sent, []);
  pins.dropUser('nobody');
  assert.equal(changes(), before + 1, 'no change, no redraw');
});

test('shift+click on an unshared pin shares it; plain click still unpins (final 7)', () => {
  const { pins, sent } = setup();
  pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', sourceEl: 'sheet' });
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true }), 'shared');
  assert.equal(pins.all()[0].shared, true);
  assert.equal(pins.all()[0].sourceEl, 'sheet');
  assert.deepEqual(sent, [{ action: 'pin', userId: 'me', tokenId: 't1', itemUuid: 'Item.bow', actionIndex: null }]);
  assert.equal(pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true }), 'unpinned', 'already shared → unpin');
  const off = setup({ allowShare: false });
  off.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.equal(off.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow', share: true }), 'unpinned', 'sharing disabled → plain toggle');
  const plain = setup();
  plain.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' });
  assert.equal(plain.pins.toggle({ tokenId: 't1', itemUuid: 'Item.bow' }), 'unpinned');
});
