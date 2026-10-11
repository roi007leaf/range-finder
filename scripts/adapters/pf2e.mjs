/** PF2e adapter: item → RangeSpec, PF2e measuring rules, token distance. */
import { alternatingDistance } from '../core/cells.mjs';
import { incrementBands, makeSpec, noneSpec, singleBand } from '../core/spec.mjs';
import { pf2eRows } from './pf2e-rows.mjs';

const sluggify = text => String(text ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const traitsOf = item => item?.system?.traits?.value ?? [];
function traitNumber(item, slug) {
  for (const trait of traitsOf(item)) {
    const match = String(trait).match(new RegExp(`^${slug}-(\\d+)$`));
    if (match) return Number(match[1]);
  }
  return null;
}

function weaponSpec(actor, item) {
  const name = item.name ?? '';
  const range = item.range ?? null;
  const overlays = [];
  const volley = traitNumber(item, 'volley');
  if (volley) overlays.push({ min: 0, max: volley, penalty: -2, tone: 'penalty-zone', label: 'Volley · –2' });
  const melee = item.isMelee ?? !range;
  if (melee) {
    const reach = actor?.getReach?.({ action: 'attack', weapon: item }) || 5;
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ft` };
    // Real PF2e melee weapons have range null; a thrown melee weapon carries its increment in a thrown-N trait.
    const thrown = traitNumber(item, 'thrown') ?? (range?.increment || null);
    if (thrown) return makeSpec({ kind: 'increments', bands: incrementBands(thrown, thrown * 6), overlays: [reachBand, ...overlays], itemName: name });
    return makeSpec({ kind: 'reach', bands: [reachBand], overlays, itemName: name });
  }
  const increments = range?.increment ? incrementBands(range.increment, range.max ?? range.increment * 6) : null;
  if (increments?.length) return makeSpec({ kind: 'increments', bands: increments, overlays, itemName: name });
  if (range?.max > 0) return makeSpec({ kind: 'radius', bands: singleBand(range.max), overlays, itemName: name });
  return noneSpec('Range: —', name);
}

function spellSpec(actor, spell) {
  const name = spell.name ?? '';
  const raw = String(spell.system?.range?.value ?? '').trim();
  const slug = sluggify(raw);
  if (slug === 'touch') {
    const reach = actor?.system?.attributes?.reach?.base ?? 5;
    return makeSpec({ kind: 'reach', bands: singleBand(reach, 'reach', `Touch · ${reach} ft`), itemName: name });
  }
  const feet = slug.match(/^(\d+)-f(?:ee)?t\b/);
  if (feet) return makeSpec({ kind: 'radius', bands: singleBand(Number(feet[1])), itemName: name });
  const area = spell.system?.area;
  if (!raw && area?.type === 'emanation' && Number(area.value) > 0) {
    return makeSpec({ kind: 'radius', bands: singleBand(Number(area.value), 'base', `Emanation ${Number(area.value)} ft`), itemName: name });
  }
  return noneSpec(raw ? `Range: ${raw}` : null, name);
}

/**
 * The strike's item. The index alone identifies synthetic strikes (no item); for a real item the index
 * may be stale (actions reorder when weapons are added), so the item's own strike wins.
 */
function strikeItem(actor, actionIndex, item) {
  const actions = actor?.system?.actions ?? [];
  const atIndex = actions[actionIndex]?.item ?? null;
  if (!item) return atIndex;
  if (atIndex && atIndex.id === item.id) return atIndex;
  return actions.find(action => action?.item && action.item.id === item.id)?.item ?? item;
}

export function specFor({ actor, item, actionIndex = null }) {
  if (actionIndex !== null && actionIndex !== undefined) item = strikeItem(actor, actionIndex, item);
  if (!item) return noneSpec();
  if (item.type === 'spell') return spellSpec(actor, item);
  if (item.type === 'weapon' || item.type === 'melee') return weaponSpec(actor, item);
  return noneSpec(null, item.name ?? '');
}

const isReach10 = band => band?.tone === 'reach' && band.max === 10;

/** PF2e: alternating diagonals; reach exactly 10 also covers the 15 ft double diagonal. */
export function cellMeasure(_spec, unit = 5) {
  const measure = (from, to, band) => {
    if (isReach10(band) && Math.abs(from.i - to.i) === 2 && Math.abs(from.j - to.j) === 2) return 10;
    return alternatingDistance(from, to, unit);
  };
  measure.bandSensitive = isReach10;
  return measure;
}

export function distance(source, target, spec) {
  if (typeof source?.distanceTo !== 'function') return NaN;
  const options = spec?.kind === 'reach' ? { reach: spec.bands[0].max } : {};
  return source.distanceTo(target, options);
}

/** Spells cast from scrolls, wands and staves aren't actor items, so their uuids don't resolve: find them in the spellcasting collections. */
export function resolveItem(actor, uuid) {
  for (const collection of actor?.spellcasting?.collections?.values?.() ?? []) {
    for (const spell of collection?.values?.() ?? []) if (spell?.uuid === uuid) return spell;
  }
  return null;
}

export const pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, resolveItem, rows: pf2eRows };
