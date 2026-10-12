/** PF2e helpers shared by the adapter modules. Pure. */
import { itemsOf } from './util.mjs';

/** Like game.pf2e.system.sluggify for our purposes: "You're Next" → "youre-next". */
export const sluggify = text => String(text ?? '').toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const traitsOf = item => item?.system?.traits?.value ?? [];

export function traitNumber(item, slug) {
  for (const trait of traitsOf(item)) {
    const match = String(trait).match(new RegExp(`^${slug}-(\\d+)$`));
    if (match) return Number(match[1]);
  }
  return null;
}

export const slugOf = item => (item ? item.slug ?? item.system?.slug ?? sluggify(item.name) : '');
/** Slugs of everything the actor owns (feats, features, equipment). */
export const ownedSlugs = actor => new Set(itemsOf(actor).map(slugOf).filter(Boolean));

/** The actor's current roll options (toggles such as `lunge`, `hydraulic-maneuvers`). */
export function rollOptionsOf(actor) {
  try { return new Set(actor?.getRollOptions?.() ?? []); } catch { return new Set(); }
}

export const baseReach = actor => Number(actor?.system?.attributes?.reach?.base) || 5;
export const equippedWeapons = actor => itemsOf(actor).filter(item => item?.type === 'weapon' && item.isEquipped !== false);
