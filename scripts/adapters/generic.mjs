/** Fallback adapter: reads a plain range number (or {value, long}) from item.system.range. */
import { alternatingDistance } from '../core/cells.mjs';
import { makeSpec, noneSpec, singleBand } from '../core/spec.mjs';

function specFor({ item }) {
  if (!item) return noneSpec();
  const name = item.name ?? '';
  const range = item.system?.range;
  const value = typeof range === 'number' ? range : Number(range?.value) || 0;
  const long = typeof range === 'object' && range ? Number(range.long) || 0 : 0;
  if (!(value > 0)) return noneSpec(null, name);
  const bands = singleBand(value);
  if (long > value) bands.push({ min: value, max: long, penalty: 0, tone: 'increment', label: `${long} ft · long` });
  return makeSpec({ kind: long > value ? 'increments' : 'radius', bands, itemName: name });
}

const cellMeasure = (_spec, unit = 5) => (from, to) => alternatingDistance(from, to, unit);

function distance(source, target) {
  const grid = globalThis.canvas?.grid;
  if (!grid?.measurePath || !source?.center || !target?.center) return NaN;
  return grid.measurePath([source.center, target.center]).distance;
}

export const genericAdapter = { id: 'generic', specFor, cellMeasure, distance, rows: [] };
