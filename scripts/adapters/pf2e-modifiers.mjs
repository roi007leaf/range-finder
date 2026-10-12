/** PF2e range modifiers the system doesn't apply itself (pf2e-ranges.mjs), and per-use (Alt+click) variants. */
import { REACH_MODIFIERS, SPELL_MODIFIERS, WEAPON_MODIFIERS } from './pf2e-ranges.mjs';
import { baseReach, ownedSlugs, rollOptionsOf, slugOf, sluggify, traitNumber, traitsOf } from './pf2e-util.mjs';
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

/** Melee reach after passive modifiers (Lunge on reach-N) and the chosen per-use one. */
export function adjustReach(reach, { actor, weapon, variant = null }) {
  const ctx = context(actor, weapon);
  let result = reach, label = null;
  for (const [slug, mod] of Object.entries(REACH_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
    if (!weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    if (mod.set) result = Math.max(result, mod.set);
    if (mod.add) result += mod.add;
    if (mod.perUse) label = mod.label;
  }
  return { reach: result, label };
}

/** Range increment after passive modifiers (Axe Thrower, Harpoon Bolt) and the chosen per-use one. */
export function adjustIncrement(increment, { actor, weapon, variant = null }) {
  const ctx = context(actor, weapon);
  let result = increment, label = null;
  for (const [slug, mod] of Object.entries(WEAPON_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
    if (!mod.add || !weaponMatches(weapon, mod.when) || !modifierPresent(slug, mod, ctx)) continue;
    result += mod.add;
    if (mod.perUse) label = mod.label;
  }
  return { increment: Math.max(5, result), label };
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

/** `base` = { kind: 'feet'|'touch', feet } from SpellPF2e range text. */
export function adjustSpell(base, { actor, spell, variant = null }) {
  const ctx = context(actor);
  const spellSlug = slugOf(spell);
  let { kind, feet } = base, overlay = null, label = null;
  for (const [slug, mod] of Object.entries(SPELL_MODIFIERS)) {
    if (mod.perUse && slug !== variant) continue;
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
    if (mod.perUse) label = mod.label;
  }
  return { kind, feet, overlay, label };
}

const RANGED_SPELL = /^\d+-f(?:ee)?t\b/;

/** The first per-use modifier the actor has for this spell or weapon (Alt+click), or null. */
export function perUseFor(actor, item) {
  if (!item) return null;
  const ctx = context(actor, item);
  if (item.type === 'spell') {
    const range = sluggify(item.system?.range?.value);
    if (range !== 'touch' && !RANGED_SPELL.test(range)) return null;
    for (const [slug, mod] of Object.entries(SPELL_MODIFIERS)) if (mod.perUse && modifierPresent(slug, mod, ctx)) return { id: slug, label: mod.label };
    return null;
  }
  if (item.type !== 'weapon') return null;
  const table = item.isMelee ? REACH_MODIFIERS : WEAPON_MODIFIERS;
  for (const [slug, mod] of Object.entries(table)) {
    if (mod.perUse && weaponMatches(item, mod.when) && modifierPresent(slug, mod, ctx)) return { id: slug, label: mod.label };
  }
  return null;
}
