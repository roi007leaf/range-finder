/** PF2e/SF2e skill actions and feat actions: table rule → RangeSpec, with the actor's modifiers. */
import { makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { adjustReach } from './pf2e-modifiers.mjs';
import { FEAT_ACTIONS, SKILL_ACTIONS, SKILL_MODIFIERS } from './pf2e-ranges.mjs';
import { baseReach, equippedWeapons, ownedSlugs, rollOptionsOf, slugOf, traitsOf } from './pf2e-util.mjs';
import { itemsOf } from './util.mjs';

const ENTRIES = [
  ...Object.entries(SKILL_ACTIONS).map(([slug, entry]) => ({ ...entry, slug, source: 'skill' })),
  ...Object.entries(FEAT_ACTIONS).map(([slug, entry]) => ({ ...entry, slug, source: 'feat' }))
];
const BY_UUID = new Map();
const BY_SLUG = new Map();
for (const entry of ENTRIES) {
  for (const uuid of [entry.uuid, ...(entry.aliases ?? [])]) if (!BY_UUID.has(uuid)) BY_UUID.set(uuid, entry);
  if (!BY_SLUG.has(entry.slug)) BY_SLUG.set(entry.slug, entry);
}

/** The table entry for an action/feat item, a compendium index entry or a bare `{ uuid }` / `{ slug }`. */
export function skillEntry(item) {
  if (!item) return null;
  for (const uuid of [item.uuid, item.sourceId, item._stats?.compendiumSource]) {
    const hit = uuid ? BY_UUID.get(uuid) : null;
    if (hit) return hit;
  }
  const slug = slugOf(item);
  return slug ? BY_SLUG.get(slug) ?? null : null;
}

/** A stand-in item for a compendium action (pf2e-hud rows, Token HUD list, pins). Unknown uuids try fromUuidSync → slug. */
export function skillItem(uuid) {
  if (!uuid) return null;
  let entry = BY_UUID.get(uuid) ?? null, name = entry?.name, img = null;
  if (!entry) {
    try {
      const doc = globalThis.fromUuidSync?.(uuid) ?? null;
      entry = doc ? skillEntry({ ...doc, uuid: null }) : null;
      name = doc?.name ?? entry?.name;
      img = doc?.img ?? null;
    } catch { entry = null; }
  }
  return entry ? { uuid, name, type: 'action', slug: entry.slug, img } : null;
}

const reachBand = (max, label) => ({ min: 0, max, penalty: 0, tone: 'reach', label });
/** Lunge works for Disarm, Shove and Trip with a weapon that has the trait. */
const LUNGE_MANEUVERS = new Set(['disarm', 'shove', 'trip']);

function maneuverSpec(actor, rule, name) {
  let reach = baseReach(actor);
  for (const weapon of equippedWeapons(actor)) {
    if (weapon.isMelee === false || !traitsOf(weapon).includes(rule.trait)) continue;
    const raw = actor?.getReach?.({ action: 'attack', weapon }) || baseReach(actor);
    reach = Math.max(reach, LUNGE_MANEUVERS.has(rule.trait) ? adjustReach(raw, { actor, weapon }).reach : raw);
  }
  const bands = [reachBand(reach, `Reach ${reach} ft`)];
  const ranged = rule.rangedTrait ? equippedWeapons(actor).find(w => traitsOf(w).includes(rule.rangedTrait) && w.range?.increment > reach) : null;
  if (!ranged) return makeSpec({ kind: 'reach', bands, itemName: name });
  bands.push({ min: reach, max: ranged.range.increment, penalty: -2, tone: 'increment', label: 'Ranged trip · –2' });
  return makeSpec({ kind: 'increments', bands, itemName: name });
}

function weaponRuleSpec(actor, rule, name) {
  const weapon = equippedWeapons(actor).find(w => w.isMelee !== true && w.range?.increment > 0
    && (!rule.group || w.system?.group === rule.group) && (!rule.hands || w.hands === rule.hands));
  if (!weapon) return noneSpec('Range: needs a wielded ranged weapon', name);
  const feet = rule.use === 'max' ? weapon.range.max || weapon.range.increment * 6 : weapon.range.increment;
  return makeSpec({ kind: 'radius', bands: singleBand(feet, 'base', `${feet} ft · ${weapon.name}`), itemName: name });
}

/** A table rule → spec, before the actor's base-action modifiers. */
export function ruleSpec(actor, rule, name = '') {
  switch (rule?.kind) {
    case 'radius': return makeSpec({ kind: 'radius', bands: singleBand(rule.feet, 'base', rule.label ?? `${rule.feet} ft`), itemName: name });
    case 'emanation': return makeSpec({ kind: 'radius', bands: singleBand(rule.feet, 'base', `Emanation ${rule.feet} ft`), itemName: name });
    case 'adjacent': return makeSpec({ kind: 'reach', bands: [reachBand(5, 'Adjacent')], itemName: name });
    case 'touch': {
      const reach = baseReach(actor);
      return makeSpec({ kind: 'reach', bands: [reachBand(reach, `Touch · ${reach} ft`)], itemName: name });
    }
    case 'reach': {
      const reach = actor?.getReach?.({ action: 'attack' }) || baseReach(actor);
      return makeSpec({ kind: 'reach', bands: [reachBand(reach, `Reach ${reach} ft`)], itemName: name });
    }
    case 'maneuver': return maneuverSpec(actor, rule, name);
    case 'weapon': return weaponRuleSpec(actor, rule, name);
    default: return noneSpec(null, name);
  }
}

/** Owned base-action modifiers (Legendary Laugh, Hydraulic Maneuvers while toggled…): the longest range wins. */
function modifiedFeet(slug, owned, options) {
  let feet = 0;
  for (const [featSlug, mod] of Object.entries(SKILL_MODIFIERS)) {
    if (!mod.actions.includes(slug) || !owned.has(featSlug)) continue;
    if (mod.toggle && !options.has(mod.toggle)) continue;
    feet = Math.max(feet, mod.set);
  }
  return feet;
}

export function skillSpec(actor, entry, itemName = entry?.name ?? '') {
  if (!entry) return noneSpec(null, itemName);
  const spec = ruleSpec(actor, entry.range, itemName);
  const feet = modifiedFeet(entry.slug, ownedSlugs(actor), rollOptionsOf(actor));
  if (!spec || !(feet > Math.max(0, ...spec.bands.map(band => band.max)))) return spec;
  return makeSpec({ kind: 'radius', bands: singleBand(feet), itemName });
}

/** Token HUD "Skill actions": every base action (stand-ins) plus the feat actions the actor owns. */
export function skillActionItems(actor) {
  const base = Object.values(SKILL_ACTIONS).map(entry => skillItem(entry.uuid));
  const feats = itemsOf(actor).filter(item => (item?.type === 'feat' || item?.type === 'action') && FEAT_ACTIONS[slugOf(item)] && !SKILL_ACTIONS[slugOf(item)]);
  return [...base, ...feats];
}
