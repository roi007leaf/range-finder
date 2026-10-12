/**
 * Draw Steel adapter: an ability's distance (`item.system.distance = { type, primary, secondary, tertiary }`).
 *
 * Distances are counted in squares (the system's grid is 1 sq, equidistant diagonals); a band reaches
 * N × the scene's grid distance. Owned abilities have their formulas evaluated to numbers during the
 * system's data prep (with kit / effect distance bonuses applied); source data still holds formula
 * strings, evaluated here with `ds.utils.evaluateFormula` and the item's roll data.
 *
 *   melee N        → reach band "Melee N"
 *   ranged N       → radius band "Ranged N"
 *   meleeRanged    → ranged band (secondary) + melee reach overlay (primary)
 *   aura / burst N → radius N (self-centred area)
 *   cube / wall    → radius of "within" (secondary); line → radius of "within" (tertiary); shape not drawn
 *   special        → disabled button, "Range: special"; self → nothing
 *
 * Labels use the system's DistanceEmbed strings ("Cube 3 within 10"). No banes are marked: Draw Steel's
 * range-related bane (ranged strike while adjacent to an enemy) depends on other creatures, not the
 * target's distance.
 */
import { makeSpec, noneSpec, showsButton } from '../core/spec.mjs';
import { itemsOf } from './util.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';

const EMBED = 'DRAW_STEEL.Item.ability.DistanceEmbed.';
const ENGLISH = {
  Melee: 'Melee {primary}', Ranged: 'Ranged {primary}', MeleeRanged: 'Melee {primary} or ranged {secondary}',
  Aura: 'Aura {primary}', Burst: 'Burst {primary}', Cube: 'Cube {primary} within {secondary}',
  Line: '{primary} x {secondary} line within {tertiary}', Wall: '{primary} wall within {secondary}'
};
/** Distance type → [embed key, field holding the reach in squares]. */
const TYPES = {
  melee: ['Melee', 'primary'], ranged: ['Ranged', 'primary'], aura: ['Aura', 'primary'], burst: ['Burst', 'primary'],
  cube: ['Cube', 'secondary'], wall: ['Wall', 'secondary'], line: ['Line', 'tertiary']
};
const FIELDS = ['primary', 'secondary', 'tertiary'];

const systemGridDistance = () => globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.grid?.distance ?? 1;
const systemUnits = () => globalThis.canvas?.scene?.grid?.units || 'sq';
const systemFormat = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key;
const systemEvaluate = (formula, rollData, contextName) => {
  const evaluate = globalThis.ds?.utils?.evaluateFormula;
  return evaluate ? evaluate(formula, rollData, { contextName }) : NaN;
};
const round = n => Math.round(n * 100) / 100;

/** The ability's distance with every measurement as a number (NaN when it cannot be evaluated). */
export function distanceOf(item, evaluate = systemEvaluate) {
  const distance = item?.system?.distance;
  if (!distance || typeof distance !== 'object') return null;
  const out = { type: distance.type ?? 'self' };
  for (const field of FIELDS) {
    const raw = distance[field];
    if (typeof raw === 'number') out[field] = raw;
    else if (raw === undefined || raw === null || String(raw).trim() === '') out[field] = NaN;
    else if (Number.isFinite(Number(raw))) out[field] = Number(raw);
    else {
      let value = NaN;
      try { value = Number(evaluate(String(raw), item.getRollData?.() ?? {}, item.uuid ?? item.name ?? 'unknown')); } catch { value = NaN; }
      out[field] = value;
    }
  }
  return out;
}

const keywordsOf = item => {
  const keywords = item?.system?.keywords;
  if (!keywords) return new Set();
  return new Set(typeof keywords === 'string' ? [keywords] : Array.from(keywords));
};

/** Strikes → attacks; other magic / psionic abilities → spells; the rest → other. */
const groupOf = item => {
  const keywords = keywordsOf(item);
  if (keywords.has('strike')) return 'attacks';
  return keywords.has('magic') || keywords.has('psionic') ? 'spells' : 'other';
};

/** The actor's own item behind a row's data-document-uuid ("…Actor.a.Item.<id>"). */
function itemFor(el, actor) {
  const uuid = el.dataset.documentUuid ?? '';
  const id = /\.Item\.([^.]+)$/.exec(uuid)?.[1];
  return id ? actor.items?.get?.(id) ?? null : null;
}

/** Ability rows on hero / NPC / retainer / object sheets (templates/sheets/actor/shared/abilities.hbs). */
export const drawSteelRows = [
  {
    // AppV2 fires render{Class} for every class in the chain; the shared base covers all actor sheets once.
    hooks: ['renderDrawSteelActorSheet'],
    selector: 'li.item.ability[data-document-uuid]',
    resolve: (el, app) => {
      const actor = app?.actor ?? app?.document ?? null;
      if (!actor?.items) return null;
      const item = itemFor(el, actor);
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .item-row > .item-controls') ?? el.querySelector(':scope .item-controls') ?? el,
    // Plain <a> like the system's own row controls (context menu, expand).
    button: { tag: 'a', classes: [] }
  }
];

export function createDrawSteelAdapter({
  gridDistance = systemGridDistance, units = systemUnits, format = systemFormat, evaluate = systemEvaluate
} = {}) {
  const text = (key, data) => {
    const full = `${EMBED}${key}`;
    const localized = format(full, data);
    const template = localized && localized !== full ? localized : ENGLISH[key];
    return template.replace(/\{(\w+)\}/g, (_, name) => String(data[name] ?? ''));
  };

  function specFor({ item, units: given } = {}) {
    if (!item) return noneSpec();
    const name = item.name ?? '';
    if (item.type && item.type !== 'ability') return noneSpec(null, name);
    const distance = distanceOf(item, evaluate);
    if (!distance) return noneSpec(null, name);
    if (distance.type === 'special') return noneSpec('Range: special', name);
    const grid = Number(gridDistance()) || 1;
    const u = given ?? units();
    const suffix = squares => (grid === 1 ? '' : ` · ${round(squares * grid)} ${u}`);
    const band = (squares, tone, label) => ({ min: 0, max: round(squares * grid), penalty: 0, tone, label: `${label}${suffix(squares)}` });
    const valid = n => Number.isFinite(n) && n > 0;

    if (distance.type === 'meleeRanged') {
      const { primary: melee, secondary: ranged } = distance;
      if (!valid(ranged)) return valid(melee) ? makeSpec({ kind: 'reach', bands: [band(melee, 'reach', text('Melee', { primary: melee }))], itemName: name }) : noneSpec(null, name);
      const overlays = valid(melee) ? [band(melee, 'reach', text('Melee', { primary: melee }))] : [];
      return makeSpec({ kind: 'radius', bands: [band(ranged, 'base', text('Ranged', { primary: ranged }))], overlays, itemName: name });
    }
    const type = TYPES[distance.type];
    if (!type) return noneSpec(null, name);
    const [key, field] = type;
    const reach = distance[field];
    if (!valid(reach)) return noneSpec(null, name);
    const melee = distance.type === 'melee';
    return makeSpec({ kind: melee ? 'reach' : 'radius', bands: [band(reach, melee ? 'reach' : 'base', text(key, distance))], itemName: name });
  }

  /** Token HUD label: the system-style distance ("Melee 1 or ranged 5", "Cube 3 within 10"). */
  function rangeLabel(spec) {
    if (!spec) return '';
    const [overlay] = spec.overlays ?? [];
    const band = spec.bands?.at(-1);
    if (!band) return spec.note ?? '';
    if (!overlay) return band.label;
    return `${overlay.label} or ${band.label.charAt(0).toLowerCase()}${band.label.slice(1)}`;
  }

  function listItems(actor) {
    return itemsOf(actor)
      .filter(item => item?.type === 'ability' && showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
  }

  return {
    id: 'draw-steel', specFor, rangeLabel, listItems,
    cellMeasure: defaultCellMeasure, distance: defaultDistance, rows: drawSteelRows
  };
}

export const drawSteelAdapter = createDrawSteelAdapter();
