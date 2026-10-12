/** D&D 5e (6.x) adapter: weapon normal/long range and reach, spell/feature range, scene-unit conversion. */
import { makeSpec, noneSpec, showsButton, singleBand } from '../core/spec.mjs';
import { itemsOf } from './util.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';

/** CONFIG.DND5E.movementUnits keys. */
const LENGTH_UNITS = ['ft', 'm', 'mi', 'km'];
/** CONFIG.DND5E.areaTargetTypes keys (dnd5e 6.0.6); `radius` is the Emanation type. */
const AREA_LABELS = {
  circle: 'Circle', cone: 'Cone', cube: 'Cube', cylinder: 'Cylinder', line: 'Line',
  radius: 'Emanation', ring: 'Ring', sphere: 'Sphere', square: 'Square', wall: 'Wall'
};

const systemConvert = (value, from, to) => {
  const convert = globalThis.dnd5e?.utils?.convertLength;
  if (typeof convert !== 'function') return value;
  try { return convert(value, from, to, { strict: false }); } catch { return value; }
};
const round = n => Math.round(n * 100) / 100;
const hasProp = (item, key) => {
  const props = item?.system?.properties;
  return Boolean(props?.has?.(key) ?? props?.includes?.(key));
};
const firstActivity = item => {
  const activities = item?.system?.activities;
  if (!activities) return null;
  return (activities.contents ?? Array.from(activities.values?.() ?? activities))[0] ?? null;
};
const capitalize = text => String(text).charAt(0).toUpperCase() + String(text).slice(1);

/** Character/NPC sheet rows (inventory, features, spellbook all render `.inventory-element`). */
export const dnd5eRows = [
  {
    hooks: ['renderCharacterActorSheet', 'renderNPCActorSheet'],
    selector: '.inventory-element li.item[data-item-id]',
    resolve: (el, app) => {
      const actor = app?.actor ?? app?.document ?? null;
      const item = actor?.items?.get?.(el.dataset.itemId) ?? null;
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope .item-controls') ?? el,
    // Same element and classes as dnd5e's own row controls so it lines up; always-interactive keeps it
    // enabled on locked sheets (dnd5e disables plain buttons there).
    button: { tag: 'button', classes: ['unbutton', 'config-button', 'item-control', 'always-interactive'] }
  }
];

const groupOf = item => (item.type === 'weapon' ? 'attacks' : item.type === 'spell' ? 'spells' : 'other');

export function createDnd5eAdapter({ convert = systemConvert, units = sceneUnits } = {}) {
  /** Item units → scene units, only between known length units. */
  const toScene = (value, from, u) => (from && from !== u && LENGTH_UNITS.includes(from) && LENGTH_UNITS.includes(u)
    ? round(convert(value, from, u)) : value);

  function weaponSpec(item, u) {
    const name = item.name ?? '';
    const sys = item.system ?? {};
    const range = sys.range ?? {};
    const from = range.units || 'ft';
    const reach = Number(range.reach) > 0 ? toScene(Number(range.reach), from, u) : toScene(hasProp(item, 'rch') ? 10 : 5, 'ft', u);
    const reachBand = { min: 0, max: reach, penalty: 0, tone: 'reach', label: `Reach ${reach} ${u}` };
    const ranged = sys.hasRange ?? (sys.attackType === 'ranged' || hasProp(item, 'thr'));
    if (ranged && Number(range.value) > 0) {
      const value = toScene(Number(range.value), from, u);
      const long = Number(range.long) > 0 ? toScene(Number(range.long), from, u) : 0;
      const bands = singleBand(value, 'base', null, u);
      if (long > value) bands.push({ min: value, max: long, penalty: 0, tone: 'increment', label: `${long} ${u} · Disadv.`, mark: 'Disadv.' });
      const overlays = sys.attackType === 'melee' && hasProp(item, 'thr') ? [reachBand] : [];
      return makeSpec({ kind: bands.length > 1 ? 'increments' : 'radius', bands, overlays, itemName: name });
    }
    if (sys.attackType === 'ranged') return noneSpec('Range: —', name);
    return makeSpec({ kind: 'reach', bands: [reachBand], itemName: name });
  }

  /** Spells use system.range/target; features (no system.range in 6.x) use their first activity's. */
  function rangedSpec(item, u) {
    const name = item.name ?? '';
    const activity = firstActivity(item);
    const own = item.system?.range;
    const range = own?.units ? own : activity?.range ?? null;
    const target = item.system?.target?.template?.type ? item.system.target : activity?.target ?? item.system?.target ?? null;
    const kind = range?.units ?? '';
    if (LENGTH_UNITS.includes(kind)) {
      const value = Number(range.value) || 0;
      if (!(value > 0)) return noneSpec(null, name);
      return makeSpec({ kind: 'radius', bands: singleBand(toScene(value, kind, u), 'base', null, u), itemName: name });
    }
    if (kind === 'touch') {
      const reach = toScene(5, 'ft', u);
      return makeSpec({ kind: 'reach', bands: singleBand(reach, 'reach', `Touch · ${reach} ${u}`), itemName: name });
    }
    if (kind === 'self') {
      const template = target?.template;
      const size = Number(template?.size) || 0;
      if (!template?.type || !(size > 0)) return noneSpec(null, name);
      const value = toScene(size, template.units || 'ft', u);
      const label = `${AREA_LABELS[template.type] ?? capitalize(template.type)} ${value} ${u}`;
      return makeSpec({ kind: 'radius', bands: singleBand(value, 'base', label, u), itemName: name });
    }
    if (kind === 'spec') return noneSpec('Range: special', name);
    if (kind === 'any') return noneSpec('Range: any', name);
    return noneSpec(null, name);
  }

  function specFor({ item, units: given } = {}) {
    if (!item) return noneSpec();
    const u = given ?? units();
    return item.type === 'weapon' ? weaponSpec(item, u) : rangedSpec(item, u);
  }

  function listItems(actor) {
    return itemsOf(actor)
      .filter(item => showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
  }

  return { id: 'dnd5e', specFor, cellMeasure: defaultCellMeasure, distance: defaultDistance, listItems, rows: dnd5eRows };
}

export const dnd5eAdapter = createDnd5eAdapter();
