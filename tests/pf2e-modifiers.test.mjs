import assert from 'node:assert/strict';
import test from 'node:test';
import { specFor } from '../scripts/adapters/pf2e.mjs';
import { badgeText, classifyTargets } from '../scripts/core/targets.mjs';
import { rangeLabel } from '../scripts/core/spec.mjs';
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

const boost = (min, max, label, mark) => ({ min, max, penalty: 0, tone: 'boost', label, mark });

test('Reach Spell owned: an outer boost band (30, 60] marked "Reach Spell"', () => {
  const caster = makeActor({ items: [feat('reach-spell')] });
  const spec = specFor({ actor: caster, item: arc });
  assert.deepEqual(spec.bands, [
    { min: 0, max: 30, penalty: 0, tone: 'base', label: '30 ft' },
    boost(30, 60, 'Reach Spell · 60 ft', 'Reach Spell')
  ]);
  assert.equal(spec.itemName, 'Electric Arc');
  assert.equal(rangeLabel(spec), '30 ft');
  const [inside, ring, beyond] = classifyTargets({ spec, targets: [{ id: 'a', distance: 25 }, { id: 'b', distance: 45 }, { id: 'c', distance: 65 }] });
  assert.equal(badgeText({ ...inside, mark: spec.bands[inside.bandIndex].mark }), '25 ft · ✓');
  assert.equal(badgeText({ ...ring, mark: spec.bands[ring.bandIndex].mark }), '45 ft · Reach Spell');
  assert.equal(badgeText(beyond), '65 ft · ✗');
});

test('touch spell + Reach Spell: touch reach band plus an outer band to 30 ft', () => {
  const spec = specFor({ actor: makeActor({ items: [feat('reach-spell')] }), item: grasp });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Touch · 5 ft' },
    boost(5, 30, 'Reach Spell · 30 ft', 'Reach Spell')
  ]);
});

test('no per-use boost owned → spell spec unchanged; several boosts of equal reach → one band', () => {
  assert.deepEqual(specFor({ actor: makeActor(), item: arc }).bands, [{ min: 0, max: 30, penalty: 0, tone: 'base', label: '30 ft' }]);
  assert.equal(specFor({ actor: makeActor({ items: [feat('reach-spell')] }), item: spell('Bless', '') }).kind, 'none');
  const both = makeActor({ items: [feat('reach-spell'), { type: 'consumable', slug: 'wand-of-reaching-3rd-rank', name: 'Wand' }] });
  assert.deepEqual(specFor({ actor: both, item: arc }).bands.slice(1), [boost(30, 60, 'Reach Spell · 60 ft', 'Reach Spell')]);
  const wand = makeActor({ items: [{ type: 'consumable', slug: 'wand-of-reaching-3rd-rank', name: 'Wand' }] });
  assert.deepEqual(specFor({ actor: wand, item: arc }).bands[1], boost(30, 60, 'Wand of Reaching · 60 ft', 'Wand of Reaching'));
});

test('a system-applied modifier (Far Shot) is not double-applied', () => {
  const archer = makeActor({ items: [feat('far-shot')] });
  const longbow = weapon('Longbow', { melee: false, range: { increment: 200, max: 1200 } });
  assert.deepEqual(specFor({ actor: archer, item: longbow }).bands.map(b => b.max), [200, 400, 600, 800, 1000, 1200]);
  assert.equal(specFor({ actor: archer, item: longbow }).bands.some(b => b.tone === 'boost'), false);
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

test('per-use reach boosts (Extending rune, Giant\'s Lunge): reach band plus an outer boost band', () => {
  const glaive = weapon('Glaive', { traits: ['reach', 'forceful'], runes: ['extending'] });
  const spec = specFor({ actor: makeActor(), item: glaive });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands, [
    { min: 0, max: 10, penalty: 0, tone: 'reach', label: 'Reach 10 ft' },
    boost(10, 60, 'Extending · Reach 60 ft', 'Extending')
  ]);
  assert.equal(spec.itemName, 'Glaive');
  const sword = weapon('Longsword', { traits: ['versatile-p'] });
  assert.deepEqual(specFor({ actor: makeActor({ items: [feat('giants-lunge')] }), item: sword }).bands, [
    { min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' },
    boost(5, 10, 'Giant\'s Lunge · Reach 10 ft', 'Giant\'s Lunge')
  ]);
  assert.equal(specFor({ actor: makeActor(), item: sword }).bands.length, 1, 'no boost owned → unchanged');
  assert.equal(specFor({ actor: makeActor({ items: [feat('giants-lunge')] }), item: glaive }).bands.find(b => b.label.startsWith('Giant')), undefined, 'a boost that does not reach further adds nothing');
});

test('several reach boosts: each that extends further, ordered outward', () => {
  const halberd = weapon('Halberd', { traits: [], runes: ['extending'] });
  const spec = specFor({ actor: makeActor({ items: [feat('giants-lunge')] }), item: halberd });
  assert.deepEqual(spec.bands.map(b => [b.min, b.max, b.tone, b.mark ?? null]), [[0, 5, 'reach', null], [5, 10, 'boost', 'Giant\'s Lunge'], [10, 60, 'boost', 'Extending']]);
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

test('thrown boost on a thrown melee weapon (Galloping Launch): thrown bands plus an outer boost band; reach overlay unchanged', () => {
  const actor = makeActor({ items: [feat('galloping-launch')] });
  const dagger = weapon('Dagger', { traits: ['agile', 'thrown-10'] });
  const spec = specFor({ actor, item: dagger });
  assert.equal(spec.kind, 'increments');
  assert.deepEqual(spec.bands.slice(0, -1), specFor({ actor: makeActor(), item: dagger }).bands);
  assert.deepEqual(spec.bands.at(-1), boost(60, 150, 'Galloping Launch · 150 ft', 'Galloping Launch'));
  assert.deepEqual(spec.overlays, [{ min: 0, max: 5, penalty: 0, tone: 'reach', label: 'Reach 5 ft' }]);
  assert.equal(spec.itemName, 'Dagger');
  assert.equal(rangeLabel(spec), '10/60 ft');
  assert.equal(specFor({ actor, item: weapon('Sword', { traits: [] }) }).bands.length, 1);
});

test('Touch Focus + Reach Spell: touch band plus an outer band to 30 ft', () => {
  const actor = makeActor({ items: [feat('touch-focus'), feat('reach-spell')], options: ['touch-focus'] });
  const spec = specFor({ actor, item: arc });
  assert.equal(spec.kind, 'reach');
  assert.deepEqual(spec.bands.map(b => [b.min, b.max, b.tone]), [[0, 5, 'reach'], [5, 30, 'boost']]);
});
