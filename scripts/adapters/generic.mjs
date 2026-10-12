/** Fallback adapter for systems without their own: an auto-detected item.system.range. */
import { makeSpec, noneSpec, showsButton, singleBand } from '../core/spec.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';
import { getPath, itemsOf } from './util.mjs';

export { getPath };

/** A number (or numeric string), `{ value, long }` or `{ value, units }` → `{ value, long }`; else null. */
export function readRange(raw) {
  if (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? { value, long: 0 } : null;
  }
  if (raw && typeof raw === 'object') {
    const value = Number(raw.value) || 0;
    return value > 0 ? { value, long: Number(raw.long) || 0 } : null;
  }
  return null;
}

const groupOf = item => (item.type === 'weapon' ? 'attacks' : item.type === 'spell' ? 'spells' : 'other');

export function createGenericAdapter({ units = sceneUnits } = {}) {
  function specFor({ item, units: given } = {}) {
    if (!item) return noneSpec();
    const name = item.name ?? '';
    const u = given ?? units();
    const range = readRange(item.system?.range);
    if (!range) return noneSpec(null, name);
    const bands = singleBand(range.value, 'base', null, u);
    if (range.long > range.value) {
      bands.push({ min: range.value, max: range.long, penalty: 0, tone: 'increment', label: `${range.long} ${u} · Long`, mark: 'Long' });
    }
    return makeSpec({ kind: bands.length > 1 ? 'increments' : 'radius', bands, itemName: name });
  }

  function listItems(actor) {
    return itemsOf(actor)
      .filter(item => showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
  }

  return { id: 'generic', specFor, cellMeasure: defaultCellMeasure, distance: defaultDistance, listItems, rows: [] };
}

export const genericAdapter = createGenericAdapter();
