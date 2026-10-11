/** PF2e adapter: item → RangeSpec, PF2e measuring rules, token distance. */
import { alternatingDistance } from '../core/cells.mjs';
import { incrementBands, makeSpec, noneSpec, singleBand } from '../core/spec.mjs';

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

export function specFor({ actor, item, actionIndex = null }) {
  if (actionIndex !== null && actionIndex !== undefined) item = actor?.system?.actions?.[actionIndex]?.item ?? item;
  if (!item) return noneSpec();
  if (item.type === 'spell') return spellSpec(actor, item);
  if (item.type === 'weapon' || item.type === 'melee') return weaponSpec(actor, item);
  return noneSpec(null, item.name ?? '');
}

/** PF2e: alternating diagonals; reach exactly 10 also covers the 15 ft double diagonal. */
export function cellMeasure(_spec, unit = 5) {
  return (from, to, band) => {
    if (band?.tone === 'reach' && band.max === 10 && Math.abs(from.i - to.i) === 2 && Math.abs(from.j - to.j) === 2) return 10;
    return alternatingDistance(from, to, unit);
  };
}

export function distance(source, target, spec) {
  if (typeof source?.distanceTo !== 'function') return NaN;
  const options = spec?.kind === 'reach' ? { reach: spec.bands[0].max } : {};
  return source.distanceTo(target, options);
}

export const pf2eAdapter = { id: 'pf2e', specFor, cellMeasure, distance, rows: [] };
