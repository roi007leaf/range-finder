import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { pf2eAdapter } from '../scripts/adapters/pf2e.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS } from '../scripts/adapters/pf2e-ranges.mjs';
import { hudSidebarRestore, pf2eRows } from '../scripts/adapters/pf2e-rows.mjs';
import { Triggers } from '../scripts/ui/Triggers.mjs';

const actor = {
  items: new Map([
    ['bm', { id: 'bm', type: 'feat', slug: 'battle-medicine', name: 'Battle Medicine', uuid: 'Actor.a.Item.bm' }],
    ['tough', { id: 'tough', type: 'feat', slug: 'toughness', name: 'Toughness', uuid: 'Actor.a.Item.tough' }]
  ]),
  system: { attributes: { reach: { base: 5 } }, actions: [] },
  getReach: () => 5
};

function setup(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const calls = [];
  const pins = { previewing: false, toggle: req => { calls.push(req); return 'pinned'; }, preview: () => true, endPreview: () => true, pinFor: () => null };
  const triggers = new Triggers({ adapter: pf2eAdapter, pins, resolveToken: () => ({ id: 't1' }), localize: k => k, doc });
  return { dom, doc, triggers, calls };
}
const statistic = uuid => `<div class="statistic-wrapper item-wrapper"><div class="item statistic" data-item-uuid="${uuid}" data-statistic="x"><div class="name"><a>row</a></div><div class="controls"></div></div></div>`;

test('pf2e-hud skills sidebar: rows resolve by data-item-uuid; excluded actions get no button', () => {
  const { dom, doc, triggers, calls } = setup(`<section id="pf2e-hud-sidebar">
    ${statistic(SKILL_ACTIONS.demoralize.uuid)}
    ${statistic('Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6')}
    ${statistic(FEAT_ACTIONS['bon-mot'].uuid)}
    ${statistic('Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo')}
  </section>`);
  triggers.decorate(doc.getElementById('pf2e-hud-sidebar'), { actor }, 'renderSkillsSidebarPF2eHUD');
  const buttons = [...doc.querySelectorAll('.item.statistic')].map(row => Boolean(row.querySelector(':scope > .controls > .range-finder-btn')));
  assert.deepEqual(buttons, [true, false, true, false]);
  doc.querySelector('.range-finder-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(calls[0].itemUuid, SKILL_ACTIONS.demoralize.uuid);
  assert.deepEqual(calls[0].sourceEl.map(el => el.id), ['pf2e-hud-sidebar'], 'ghosts the HUD sidebar like other HUD rows');
});

test('owned action rows: character sheet and pf2e-hud actions sidebar, only for table actions', () => {
  const sheet = setup(`<div class="application" id="sheet"><ol class="actions-list">
    <li class="action item" data-item-id="bm"><h4 class="name"><a>Battle Medicine</a></h4><div class="button-group"></div></li>
    <li class="action item" data-item-id="tough"><h4 class="name"><a>Toughness</a></h4><div class="button-group"></div></li>
  </ol></div>`);
  sheet.triggers.decorate(sheet.doc.getElementById('sheet'), { actor }, 'renderCharacterSheetPF2e');
  assert.ok(sheet.doc.querySelector('[data-item-id="bm"] > .button-group > .range-finder-btn'));
  assert.equal(sheet.doc.querySelector('[data-item-id="tough"] .range-finder-btn'), null);
  const hud = setup(`<section id="pf2e-hud-sidebar">
    <div class="item action" data-item-id="bm"><div class="name"><a>Battle Medicine</a></div><div class="controls"></div></div>
    <div class="item action" data-item-id="virtual" data-item-uuid="${SKILL_ACTIONS.demoralize.uuid}"><div class="name"><a>Demoralize</a></div><div class="controls"></div></div>
  </section>`);
  hud.triggers.decorate(hud.doc.getElementById('pf2e-hud-sidebar'), { actor }, 'renderActionsSidebarPF2eHUD');
  assert.equal(hud.doc.querySelectorAll('.item.action > .controls > .range-finder-btn').length, 2);
});

test('listItems: strikes, all spellcasting spells, other weapons, skill actions', () => {
  const longbow = { id: 'bow', name: 'Longbow', type: 'weapon', isMelee: false, range: { increment: 100, max: 600 }, system: { traits: { value: [] } } };
  const sling = { id: 'sling', name: 'Sling', type: 'weapon', isMelee: false, range: { increment: 50, max: 300 }, system: { traits: { value: [] } } };
  const hidden = { id: 'fist', name: 'Fist', type: 'weapon', isMelee: true, system: { traits: { value: [] } } };
  const arc = { uuid: 'Actor.a.Item.arc', name: 'Electric Arc', type: 'spell', system: { range: { value: '30 feet' } } };
  const haste = { uuid: 'Actor.a.Item.haste', name: 'Haste', type: 'spell', system: { range: { value: '30 feet' } } };
  const caster = {
    ...actor,
    type: 'character',
    items: [longbow, sling, { id: 'bm', type: 'feat', slug: 'bon-mot', name: 'Bon Mot', uuid: 'Actor.a.Item.bm' }],
    system: { ...actor.system, actions: [{ item: longbow }, { item: hidden, visible: false }] },
    spellcasting: { collections: new Map([['arcane', new Map([['arc', arc]])], ['wand', new Map([['haste', haste], ['arc', arc]])]]) }
  };
  const list = pf2eAdapter.listItems(caster);
  const byGroup = group => list.filter(e => e.group === group).map(e => e.item.name);
  assert.deepEqual(byGroup('attacks'), ['Longbow']);
  assert.equal(list[0].actionIndex, 0);
  assert.deepEqual(byGroup('spells'), ['Electric Arc', 'Haste']);
  assert.deepEqual(byGroup('other'), ['Sling']);
  assert.ok(byGroup('skills').includes('Demoralize'));
  assert.ok(byGroup('skills').includes('Bon Mot'));
});

function fakeHud({ rendered = true, current = 'actions', parentRendered = true } = {}) {
  const opened = [];
  class Base {
    static current = current;
    static openSidebar(name, parent) { if (this !== Base) throw new TypeError('brand check'); opened.push([name, parent]); }
  }
  class Sub extends Base {}
  const parent = { rendered: parentRendered };
  const instance = Object.assign(new Sub(), { name: 'actions', parent, rendered });
  const registry = new Map([['pf2e-hud-sidebar', instance]]);
  return { registry, opened, parent, Base };
}

test('hudSidebarRestore reopens a closed sidebar via the class owning openSidebar', () => {
  const { registry, opened, parent, Base } = fakeHud({ rendered: false });
  Base.current = null;
  const restore = hudSidebarRestore({}, {}, registry);
  restore();
  assert.deepEqual(opened, [['actions', parent]]);
});

test('hudSidebarRestore leaves a still-open sidebar alone', () => {
  const { registry, opened } = fakeHud();
  hudSidebarRestore({}, {}, registry)();
  assert.deepEqual(opened, []);
});

test('hudSidebarRestore does nothing when the parent HUD is gone, or without a sidebar', () => {
  const { registry, opened } = fakeHud({ rendered: false, parentRendered: false });
  hudSidebarRestore({}, {}, registry)();
  assert.deepEqual(opened, []);
  assert.equal(hudSidebarRestore({}, {}, new Map()), null);
  assert.equal(hudSidebarRestore({}, {}, undefined), null);
});

test('hudSidebarRestore never throws', () => {
  const { registry, Base } = fakeHud({ rendered: false });
  Base.openSidebar = () => { throw new Error('boom'); };
  const quiet = console.error;
  console.error = () => {};
  try { assert.doesNotThrow(() => hudSidebarRestore({}, {}, registry)()); } finally { console.error = quiet; }
});

test('pf2e-hud sidebar rows restore the sidebar; the persistent shortcuts row does not', () => {
  const sidebar = pf2eRows.filter(r => r.hooks.some(h => /Sidebar/.test(h)));
  assert.equal(sidebar.length, 5);
  assert.ok(sidebar.every(r => r.onPreview === hudSidebarRestore));
  assert.equal(pf2eRows.find(r => r.persistentHud).onPreview, undefined);
});
