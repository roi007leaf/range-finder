import assert from 'node:assert/strict';
import test from 'node:test';
import { altVariant, specFor } from '../scripts/adapters/pf2e.mjs';
import { sluggify } from '../scripts/adapters/pf2e-util.mjs';

const feat = slug => ({ type: 'feat', slug, name: slug });
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
const spell = (name, range) => ({ name, type: 'spell', slug: sluggify(name), system: { range: { value: range } } });
const weapon = (name, { melee = true, traits = [], range = null, group = null, hands = '1', runes = [], ammo = null, slug = null } = {}) => ({
  name, type: 'weapon', slug: slug ?? sluggify(name), isMelee: melee, isEquipped: true, range, hands, ammo,
  system: { traits: { value: traits }, group, runes: { property: runes } }
});
const arc = spell('Electric Arc', '30 feet');
const grasp = spell('Shocking Grasp', 'touch');

test('Reach Spell: Alt variant only when owned; +30 ft, touch → 30 ft (spec rule 7)', () => {
  const caster = makeActor({ items: [feat('reach-spell')] });
  assert.deepEqual(altVariant({ actor: caster, item: arc }), { id: 'reach-spell', label: 'Reach Spell' });
  const reached = specFor({ actor: caster, item: arc, variant: 'reach-spell' });
  assert.deepEqual(reached.bands, [{ min: 0, max: 60, penalty: 0, tone: 'base', label: 'Reach Spell 60 ft' }]);
  assert.equal(reached.itemName, 'Electric Arc · Reach Spell');
  const touch = specFor({ actor: caster, item: grasp, variant: 'reach-spell' });
  assert.equal(touch.kind, 'radius');
  assert.equal(touch.bands[0].max, 30);
  assert.equal(specFor({ actor: caster, item: arc }).bands[0].max, 30, 'no variant → unchanged');
  const plain = makeActor();
  assert.equal(altVariant({ actor: plain, item: arc }), null);
  assert.equal(specFor({ actor: plain, item: arc, variant: 'reach-spell' }).bands[0].max, 30, 'not owned → ignored');
  assert.equal(altVariant({ actor: caster, item: spell('Bless', '') }), null, 'no range → no variant');
  const wand = makeActor({ items: [{ type: 'consumable', slug: 'wand-of-reaching-3rd-rank', name: 'Wand' }] });
  assert.deepEqual(altVariant({ actor: wand, item: arc }), { id: 'wand-of-reaching', label: 'Wand of Reaching' });
});

test('a system-applied modifier (Far Shot) is not double-applied', () => {
  const archer = makeActor({ items: [feat('far-shot')] });
  const longbow = weapon('Longbow', { melee: false, range: { increment: 200, max: 1200 } });
  assert.deepEqual(specFor({ actor: archer, item: longbow }).bands.map(b => b.max), [200, 400, 600, 800, 1000, 1200]);
  assert.equal(altVariant({ actor: archer, item: longbow }), null);
});

test('Lunge adds 5 ft to reach-N weapons only (system handles base/reach)', () => {
  const pike = weapon('Long Pike', { traits: ['reach-15'] });
  assert.equal(specFor({ actor: makeActor(), item: pike }).bands[0].max, 15);
  assert.equal(specFor({ actor: makeActor({ options: ['lunge'] }), item: pike }).bands[0].max, 20);
  const whip = weapon('Whip', { traits: ['reach', 'disarm'] });
  assert.equal(specFor({ actor: makeActor({ options: ['lunge'] }), item: whip }).bands[0].max, 10);
});

test('passive weapon modifiers: Harpoon Bolt ammo, Axe Thrower', () => {
  const crossbow = weapon('Crossbow', { melee: false, range: { increment: 120, max: 720 }, ammo: { slug: 'harpoon-bolt', name: 'Harpoon Bolt' } });
  const spec = specFor({ actor: makeActor(), item: crossbow });
  assert.deepEqual([spec.bands[0].max, spec.bands.at(-1).max], [110, 660]);
  const thrower = makeActor({ items: [feat('axe-thrower')] });
  const hatchet = weapon('Hatchet', { traits: ['agile', 'sweep', 'thrown-10'], group: 'axe' });
  const battleAxe = weapon('Battle Axe', { traits: ['sweep'], group: 'axe' });
  const greataxe = weapon('Greataxe', { traits: ['sweep'], group: 'axe', hands: '2' });
  assert.equal(specFor({ actor: thrower, item: hatchet }).bands[0].max, 20);
  assert.equal(specFor({ actor: thrower, item: battleAxe }).kind, 'increments');
  assert.equal(specFor({ actor: thrower, item: battleAxe }).bands[0].max, 10);
  assert.equal(specFor({ actor: thrower, item: greataxe }).kind, 'reach');
  assert.equal(specFor({ actor: makeActor(), item: battleAxe }).kind, 'reach');
});

test('per-use reach (Extending rune) is an Alt variant', () => {
  const glaive = weapon('Glaive', { traits: ['reach', 'forceful'], runes: ['extending'] });
  const actor = makeActor();
  assert.deepEqual(altVariant({ actor, item: glaive }), { id: 'extending', label: 'Extending' });
  const spec = specFor({ actor, item: glaive, variant: 'extending' });
  assert.deepEqual([spec.bands[0].max, spec.bands[0].label, spec.itemName], [60, 'Extending · Reach 60 ft', 'Glaive · Extending']);
  assert.equal(specFor({ actor, item: glaive }).bands[0].max, 10);
});

test('passive spell modifiers: psychic cantrip, Touch Focus toggle, touch reach, Witch\'s Charge outline', () => {
  assert.equal(specFor({ actor: makeActor({ items: [feat('the-silent-whisper')] }), item: spell('Daze', '60 feet') }).bands[0].max, 120);
  const focus = makeActor({ items: [feat('touch-focus')] });
  assert.equal(specFor({ actor: focus, item: arc }).kind, 'radius');
  const toggled = makeActor({ items: [feat('touch-focus')], options: ['touch-focus'] });
  assert.equal(specFor({ actor: toggled, item: arc }).bands[0].label, 'Touch · 5 ft');
  assert.equal(specFor({ actor: makeActor({ items: [feat('midnight-illusionist-dedication')] }), item: grasp }).bands[0].max, 10);
  const witch = specFor({ actor: makeActor({ items: [feat('witchs-charge')] }), item: grasp });
  assert.deepEqual(witch.overlays, [{ min: 0, max: 30, penalty: 0, tone: 'increment', label: 'Witch\'s Charge 30 ft' }]);
});

test('thrown per-use variant on a thrown melee weapon (Galloping Launch); reach overlay unchanged', () => {
  const actor = makeActor({ items: [feat('galloping-launch')] });
  const dagger = weapon('Dagger', { traits: ['agile', 'thrown-10'] });
  assert.deepEqual(altVariant({ actor, item: dagger }), { id: 'galloping-launch', label: 'Galloping Launch' });
  const base = specFor({ actor, item: dagger });
  const spec = specFor({ actor, item: dagger, variant: 'galloping-launch' });
  assert.equal(base.bands[0].max, 10);
  assert.equal(spec.bands[0].max, 25);
  assert.equal(spec.itemName, 'Dagger · Galloping Launch');
  assert.deepEqual(spec.overlays, base.overlays);
  assert.equal(altVariant({ actor, item: weapon('Sword', { traits: [] }) }), null);
});

test('Touch Focus + Reach Spell variant: touch → 30 ft', () => {
  const actor = makeActor({ items: [feat('touch-focus'), feat('reach-spell')], options: ['touch-focus'] });
  const spec = specFor({ actor, item: arc, variant: 'reach-spell' });
  assert.equal(spec.kind, 'radius');
  assert.equal(spec.bands[0].max, 30);
});
