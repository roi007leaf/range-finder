import assert from 'node:assert/strict';
import test from 'node:test';
import { FEAT_ACTIONS, REACH_MODIFIERS, SKILL_ACTIONS, SKILL_MODIFIERS, SPELL_MODIFIERS, WEAPON_MODIFIERS } from '../scripts/adapters/pf2e-ranges.mjs';

const KINDS = ['radius', 'emanation', 'adjacent', 'touch', 'reach', 'maneuver', 'weapon'];

test('every action entry has a name, a compendium uuid and a known rule', () => {
  for (const [slug, entry] of Object.entries({ ...SKILL_ACTIONS, ...FEAT_ACTIONS })) {
    assert.equal(typeof entry.name, 'string', slug);
    assert.match(entry.uuid, /^Compendium\.pf2e\.[a-z0-9-]+\.Item\.[A-Za-z0-9]{16}$/, slug);
    assert.ok(KINDS.includes(entry.range.kind), slug);
    if (['radius', 'emanation'].includes(entry.range.kind)) assert.ok(entry.range.feet > 0, slug);
  }
  assert.equal(Object.keys(SKILL_ACTIONS).length, 14);
  assert.equal(Object.keys(FEAT_ACTIONS).length, 76);
});

test('uuids (and aliases) are unique across both tables', () => {
  const all = [...Object.values(SKILL_ACTIONS), ...Object.values(FEAT_ACTIONS)].flatMap(e => [e.uuid, ...(e.aliases ?? [])]);
  assert.equal(new Set(all).size, all.length);
});

test('decided rules: hands-on actions adjacent; interact-only actions and Seek absent', () => {
  for (const slug of ['administer-first-aid', 'treat-wounds', 'treat-poison', 'treat-disease', 'steal', 'palm-an-object']) assert.equal(SKILL_ACTIONS[slug].range.kind, 'adjacent', slug);
  assert.equal(FEAT_ACTIONS['battle-medicine'].range.kind, 'adjacent');
  for (const slug of ['seek', 'force-open', 'disable-a-device', 'disable-device', 'pick-a-lock']) {
    assert.equal(SKILL_ACTIONS[slug], undefined, slug);
    assert.equal(FEAT_ACTIONS[slug], undefined, slug);
  }
  assert.deepEqual(SKILL_ACTIONS.trip.range, { kind: 'maneuver', trait: 'trip', rangedTrait: 'ranged-trip' });
  for (const slug of ['shove', 'disarm', 'grapple', 'reposition']) assert.deepEqual(SKILL_ACTIONS[slug].range, { kind: 'maneuver', trait: slug });
  assert.equal(FEAT_ACTIONS['terrifying-howl'].range.kind, 'emanation');
});

test('skill modifiers target known actions', () => {
  const known = new Set([...Object.keys(SKILL_ACTIONS), ...Object.keys(FEAT_ACTIONS)]);
  for (const [slug, mod] of Object.entries(SKILL_MODIFIERS)) {
    assert.ok(mod.set > 0, slug);
    for (const action of mod.actions) assert.ok(known.has(action), `${slug} → ${action}`);
  }
  assert.equal(SKILL_MODIFIERS['legendary-laugh'].set, 60);
  assert.equal(SKILL_MODIFIERS['hydraulic-maneuvers'].toggle, 'hydraulic-maneuvers');
});

test('modifier tables leave out what PF2e already applies; per-use entries carry a label', () => {
  const all = { ...WEAPON_MODIFIERS, ...REACH_MODIFIERS, ...SPELL_MODIFIERS, ...SKILL_MODIFIERS };
  for (const slug of ['far-shot', 'far-lobber', 'uncanny-bombs', 'strong-arm', 'crossbow-crack-shot', 'favorable-winds', 'advanced-rangefinder', 'featherlight-fletching', 'bomb-launcher', 'enlarge', 'giants-stature', 'bendy-arm-mutagen-lesser', 'widen-spell']) {
    assert.equal(all[slug], undefined, slug);
  }
  for (const [slug, mod] of Object.entries({ ...WEAPON_MODIFIERS, ...REACH_MODIFIERS, ...SPELL_MODIFIERS })) assert.equal(typeof mod.label, 'string', slug);
  assert.deepEqual(SPELL_MODIFIERS['reach-spell'], { label: 'Reach Spell', perUse: true, add: 30, touch: 30 });
  assert.equal(REACH_MODIFIERS.lunge.toggle, 'lunge');
});
