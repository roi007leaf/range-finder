/** PF2e range modifiers the system doesn't apply itself (pf2e-ranges.mjs), and per-use boosts (outer 'boost' bands). */
import { REACH_MODIFIERS, SPELL_MODIFIERS, WEAPON_MODIFIERS } from './pf2e-ranges.mjs';
import { baseReach, ownedSlugs, rollOptionsOf, slugOf, traitNumber, traitsOf } from './pf2e-util.mjs';
import { itemsOf } from './util.mjs';

const context = (actor, weapon = null) => ({ actor, weapon, owned: ownedSlugs(actor), options: rollOptionsOf(actor) });

export function weaponMatches(weapon, when = {}) {
  if (!weapon) return false;
  const traits = traitsOf(weapon);
  if (when.group && weapon.system?.group !== when.group) return false;
  if (when.thrown && !(traits.includes('thrown') || traitNumber(weapon, 'thrown'))) return false;
  if (when.hands && weapon.hands !== when.hands) return false;
  if (when.melee !== undefined && Boolean(weapon.isMelee) !== when.melee) return false;
  if (when.reachN && !traitNumber(weapon, 'reach')) return false;
  return true;
}

/** Is the modifier's source there (owned item, rune, ammo, attachment, the weapon itself) and its toggle on? */
export function modifierPresent(slug, mod, { weapon = null, owned, options }) {
  if (mod.toggle && !options.has(mod.toggle)) return false;
  switch (mod.source ?? 'actor') {
    case 'toggle': return true;
    case 'rune': return (weapon?.system?.runes?.property ?? []).includes(slug);
    case 'ammo': return Boolean(weapon?.ammo) && slugOf(weapon.ammo) === slug;
    case 'attachment': return itemsOf({ items: weapon?.subitems }).some(sub => slugOf(sub).startsWith(slug));
    case 'weapon': return slugOf(weapon) === slug;
    default: return mod.prefix ? [...owned].some(have => have.startsWith(slug)) : owned.has(slug);
  }
}

/** Melee reach after passive modifiers (Lunge on reach-N) and, with `boost`, that per-use one. */
export function adjustReach(reach, { actor, weapon, boost = null }) {
  const ctx = context(actor, weapon);
  let result = reach;
  for (const [slug, mod] of Object.entries(REACH_MODIFIERS)) {
    if (mod.perUse && slug !== boost) continue;
    if (!weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    if (mod.set) result = Math.max(result, mod.set);
    if (mod.add) result += mod.add;
  }
  return result;
}

/** Range increment after passive modifiers (Axe Thrower, Harpoon Bolt) and, with `boost`, that per-use one. */
export function adjustIncrement(increment, { actor, weapon, boost = null }) {
  const ctx = context(actor, weapon);
  let result = increment;
  for (const [slug, mod] of Object.entries(WEAPON_MODIFIERS)) {
    if (mod.perUse && slug !== boost) continue;
    if (!mod.add || !weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    result += mod.add;
  }
  return Math.max(5, result);
}

/** A thrown increment granted to a weapon that has none (Axe Thrower on one-handed axes). */
export function grantedThrown(actor, weapon) {
  const ctx = context(actor, weapon);
  let best = 0;
  for (const [slug, mod] of Object.entries(WEAPON_MODIFIERS)) {
    if (mod.grant && weaponMatches(weapon, mod.grant.when) && modifierPresent(slug, mod, ctx)) best = Math.max(best, mod.grant.thrown);
  }
  return best;
}

/** `base` = { kind: 'feet'|'touch', feet } from SpellPF2e range text. With `boost`, that per-use modifier applies too. */
export function adjustSpell(base, { actor, spell, boost = null }) {
  const ctx = context(actor);
  const spellSlug = slugOf(spell);
  let { kind, feet } = base, overlay = null;
  // set / toTouch first, so additive and touch→range modifiers (Reach Spell) apply to the result.
  const ordered = Object.entries(SPELL_MODIFIERS).sort(([, x], [, y]) => Number(Boolean(y.set !== undefined || y.toTouch)) - Number(Boolean(x.set !== undefined || x.toTouch)));
  for (const [slug, mod] of ordered) {
    if (mod.perUse && slug !== boost) continue;
    if (mod.spells && !mod.spells.includes(spellSlug)) continue;
    if (!modifierPresent(slug, mod, ctx)) continue;
    if (mod.toTouch && kind === 'feet') { kind = 'touch'; feet = baseReach(actor); }
    if (typeof mod.set === 'number') { kind = 'feet'; feet = mod.set; }
    if (kind === 'touch') {
      if (mod.touch) { kind = 'feet'; feet = mod.touch; }
      else if (mod.touchReach) feet = Math.max(feet, mod.touchReach);
      else if (mod.touchOverlay) overlay = { min: 0, max: mod.touchOverlay, penalty: 0, tone: 'increment', label: `${mod.label} ${mod.touchOverlay} ft` };
    } else if (mod.add) {
      feet += mod.add;
    }
  }
  return { kind, feet, overlay };
}

const TABLES = { spell: SPELL_MODIFIERS, reach: REACH_MODIFIERS, weapon: WEAPON_MODIFIERS };

/**
 * Per-use boosts (Reach Spell, Giant's Lunge, Galloping Launch…) the actor has for this item, from one table
 * ('spell' | 'reach' | 'weapon'): [{ id, label }]. Only spells and weapons get them.
 */
export function perUseBoosts(actor, item, table) {
  if (item?.type !== (table === 'spell' ? 'spell' : 'weapon')) return [];
  const ctx = context(actor, table === 'spell' ? null : item);
  return Object.entries(TABLES[table])
    .filter(([slug, mod]) => mod.perUse && (table === 'spell' || weaponMatches(item, mod.when)) && modifierPresent(slug, mod, ctx))
    .map(([id, mod]) => ({ id, label: mod.label }));
}

/**
 * Outer "only with the boost" bands beyond `from`: `boosts` = [{ label, max, text }], ordered outward;
 * each one that reaches further than the last gets a band (min = the previous max) marked with its name.
 */
export function boostBands(boosts, from) {
  const bands = [];
  let edge = from;
  for (const boost of [...boosts].sort((a, b) => a.max - b.max)) {
    if (!(boost.max > edge)) continue;
    bands.push({ min: edge, max: boost.max, penalty: 0, tone: 'boost', label: boost.text, mark: boost.label });
    edge = boost.max;
  }
  return bands;
}
