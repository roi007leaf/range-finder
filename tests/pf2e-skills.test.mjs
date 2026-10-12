import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveItem, specFor } from '../scripts/adapters/pf2e.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS } from '../scripts/adapters/pf2e-ranges.mjs';
import { ruleSpec, skillActionItems, skillEntry, skillItem, skillSpec } from '../scripts/adapters/pf2e-skills.mjs';
import { showsButton } from '../scripts/core/spec.mjs';

const feat = (slug, name = slug) => ({ type: 'feat', slug, name, uuid: `Actor.a.Item.${slug}` });
const weapon = (name, { melee = true, traits = [], range = null, group = null, hands = '1' } = {}) => ({ name, type: 'weapon', isMelee: melee, isEquipped: true, range, hands, system: { traits: { value: traits }, group } });
function makeActor({ items = [], options = [] } = {}) {
  return {
    items,
    system: { attributes: { reach: { base: 5 } }, actions: [] },
    getRollOptions: () => options,
    getReach({ action = 'interact', weapon = null } = {}) {
      if (action !== 'attack') return 5;
      const traits = weapon?.system?.traits?.value ?? [];
      const n = traits.map(t => t.match(/^reach-(\d+)$/)).find(Boolean);
      return n ? Number(n[1]) : traits.includes('reach') ? 10 : 5;
    }
  };
}
const action = slug => skillItem(SKILL_ACTIONS[slug].uuid);
const band = spec => [spec.kind, spec.bands[0].label, spec.bands[0].max];

test('each rule kind → spec and label (radius / emanation / adjacent / touch / reach / cone)', () => {
  const actor = makeActor();
  assert.deepEqual(band(specFor({ actor, item: action('demoralize') })), ['radius', '30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: action('administer-first-aid') })), ['reach', 'Adjacent', 5]);
  assert.deepEqual(band(specFor({ actor, item: action('feint') })), ['reach', 'Reach 5 ft', 5]);
  assert.deepEqual(band(specFor({ actor, item: feat('terrifying-howl') })), ['radius', 'Emanation 30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: feat('flash-your-badge') })), ['radius', 'Cone 30 ft', 30]);
  assert.deepEqual(band(specFor({ actor, item: feat('battle-medicine') })), ['reach', 'Adjacent', 5]);
  assert.deepEqual(band(ruleSpec(actor, { kind: 'touch' }, 'Lay on Hands')), ['reach', 'Touch · 5 ft', 5]);
  assert.equal(specFor({ actor, item: feat('toughness') }).kind, 'none');
});

test('every table entry builds a button (range or note)', () => {
  const actor = makeActor();
  for (const slug of [...Object.keys(SKILL_ACTIONS), ...Object.keys(FEAT_ACTIONS)]) {
    assert.ok(showsButton(skillSpec(actor, skillEntry({ slug }))), slug);
  }
});

test('base-action modifiers: Legendary Laugh, Mage\'s Field Dressing, Hydraulic Maneuvers only when toggled', () => {
  assert.equal(specFor({ actor: makeActor({ items: [feat('legendary-laugh')] }), item: action('demoralize') }).bands[0].max, 60);
  const medic = makeActor({ items: [feat('battle-medicine'), feat('mages-field-dressing')] });
  assert.equal(specFor({ actor: medic, item: feat('battle-medicine') }).bands[0].max, 60);
  const hydro = [feat('hydraulic-maneuvers')];
  assert.equal(specFor({ actor: makeActor({ items: hydro }), item: action('shove') }).bands[0].max, 5);
  const on = specFor({ actor: makeActor({ items: hydro, options: ['hydraulic-maneuvers'] }), item: action('shove') });
  assert.deepEqual(band(on), ['radius', '15 ft', 15]);
  assert.equal(specFor({ actor: makeActor({ items: hydro, options: ['hydraulic-maneuvers'] }), item: action('grapple') }).bands[0].max, 5);
});

test('athletics maneuvers: matching weapon trait, best reach, base reach otherwise', () => {
  const whip = weapon('Whip', { traits: ['reach', 'disarm', 'trip'] });
  const hook = weapon('Hook', { traits: ['reach-15', 'trip'] });
  const actor = makeActor({ items: [whip] });
  assert.equal(specFor({ actor, item: action('trip') }).bands[0].max, 10);
  assert.equal(specFor({ actor, item: action('disarm') }).bands[0].max, 10);
  assert.equal(specFor({ actor, item: action('grapple') }).bands[0].max, 5);
  assert.equal(specFor({ actor: makeActor({ items: [whip, hook] }), item: action('trip') }).bands[0].max, 15);
  const stowed = { ...hook, isEquipped: false };
  assert.equal(specFor({ actor: makeActor({ items: [stowed] }), item: action('trip') }).bands[0].max, 5);
});

test('Lunge + reach-N on Disarm/Shove/Trip, not Grapple (spec rule 3)', () => {
  const hook = weapon('Hook', { traits: ['reach-15', 'trip', 'grapple'] });
  const lunging = makeActor({ items: [hook], options: ['lunge'] });
  assert.equal(specFor({ actor: lunging, item: action('trip') }).bands[0].max, 20);
  assert.equal(specFor({ actor: lunging, item: action('grapple') }).bands[0].max, 15);
  assert.equal(specFor({ actor: makeActor({ items: [hook] }), item: action('trip') }).bands[0].max, 15);
});

test('ranged trip: first range increment at –2 beyond reach', () => {
  const bola = weapon('Bola', { melee: false, traits: ['nonlethal', 'ranged-trip', 'thrown'], range: { increment: 20, max: 120 } });
  const spec = specFor({ actor: makeActor({ items: [bola] }), item: action('trip') });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' },
    { min: 5, max: 20, penalty: -2, tone: 'increment', label: 'Ranged trip · –2' }
  ]);
});

test('weapon rules: Warning Shot uses the firearm\'s max range; no firearm → note', () => {
  const pistol = weapon('Flintlock Pistol', { melee: false, range: { increment: 30, max: 180 }, group: 'firearm' });
  assert.deepEqual(band(specFor({ actor: makeActor({ items: [pistol] }), item: feat('warning-shot') })), ['radius', '180 ft · Flintlock Pistol', 180]);
  assert.deepEqual(band(specFor({ actor: makeActor({ items: [pistol] }), item: feat('pistol-twirl') })), ['radius', '30 ft · Flintlock Pistol', 30]);
  const none = specFor({ actor: makeActor(), item: feat('warning-shot') });
  assert.equal(none.kind, 'none');
  assert.equal(none.note, 'Range: needs a wielded ranged weapon');
});

test('skillEntry: by uuid (incl. Natural Medicine alias, compendium source) or by name; excluded actions resolve to nothing', () => {
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu' }).slug, 'treat-wounds');
  assert.equal(skillEntry({ uuid: 'Actor.a.Item.x', _stats: { compendiumSource: FEAT_ACTIONS['bon-mot'].uuid } }).slug, 'bon-mot');
  assert.equal(skillEntry({ type: 'feat', name: 'You\'re Next' }).slug, 'youre-next');
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6', name: 'Disable a Device' }), null);
  assert.equal(skillEntry({ uuid: 'Compendium.pf2e.actionspf2e.Item.BlAOM2X92SI6HMtJ', name: 'Seek' }), null);
});

test('compendium uuid pins resolve without the pack (Review Focus 5)', () => {
  const uuid = SKILL_ACTIONS.demoralize.uuid;
  const item = resolveItem({}, uuid);
  assert.deepEqual(item, { uuid, name: 'Demoralize', type: 'action', slug: 'demoralize', img: null });
  assert.equal(specFor({ actor: makeActor(), item }).bands[0].max, 30);
  assert.equal(resolveItem({}, 'Compendium.pf2e.actionspf2e.Item.unknownunknown01'), null);
  const index = { _id: '2u915NdUyQan6uKF', uuid, name: 'Demoralize', type: 'action', pack: 'pf2e.actionspf2e' };
  assert.equal(specFor({ actor: makeActor(), item: index }).bands[0].max, 30, 'fromUuidSync index entry');
});

test('skillActionItems: every base action plus owned feat actions', () => {
  const items = skillActionItems(makeActor({ items: [feat('bon-mot', 'Bon Mot'), feat('toughness')] }));
  assert.deepEqual(items.slice(0, 2).map(i => i.slug), ['demoralize', 'feint']);
  assert.equal(items.length, Object.keys(SKILL_ACTIONS).length + 1);
  assert.equal(items.at(-1).name, 'Bon Mot');
});
