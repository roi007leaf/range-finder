/** RangeSpec: what an adapter says an item reaches. Pure — no Foundry globals. */
export const KINDS = ['reach', 'increments', 'radius', 'none'];
export const TONES = ['base', 'increment', 'reach', 'penalty-zone'];
export const MAX_INCREMENTS = 6;

export function fmtPenalty(penalty) {
  if (!penalty) return '0';
  return `${penalty < 0 ? '–' : '+'}${Math.abs(penalty)}`;
}

/**
 * The first band includes its min (0, or a minimum range such as Crucible's: anything closer is out of range);
 * later bands exclude their min (it belongs to the band before). A band starting at 0 always includes 0.
 */
export function inBand(band, distance, first = false) {
  return distance <= band.max && (first || band.min === 0 ? distance >= band.min : distance > band.min);
}

/**
 * Index of the band a target distance falls in. A last band flagged `unbounded` (Daggerheart's Very Far) also
 * takes everything past its max: its max is only how far it is drawn, not a range limit.
 */
export function bandIndexFor(bands, distance) {
  const index = bands.findIndex((band, i) => inBand(band, distance, i === 0));
  const last = bands.at(-1);
  if (index < 0 && last?.unbounded && distance > last.max) return bands.length - 1;
  return index;
}

export const DEFAULT_UNITS = 'ft';

export function incrementBands(increment, max = increment * MAX_INCREMENTS, units = DEFAULT_UNITS) {
  const bands = [];
  if (!(increment > 0) || !(max > 0)) return bands;
  for (let k = 0; k < MAX_INCREMENTS; k++) {
    const min = k * increment;
    if (min >= max) break;
    const end = Math.min((k + 1) * increment, max);
    const penalty = k === 0 ? 0 : -2 * k;
    bands.push({
      min, max: end, penalty, tone: k === 0 ? 'base' : 'increment',
      label: penalty ? `${end} ${units} · ${fmtPenalty(penalty)}` : `${end} ${units}`
    });
  }
  return bands;
}

/** One band from 0. `label` defaults to "{max} {units}". */
export function singleBand(max, tone = 'base', label = null, units = DEFAULT_UNITS) {
  return [{ min: 0, max, penalty: 0, tone, label: label ?? `${max} ${units}` }];
}

/** Optional per-band badge mark (e.g. dnd5e "Disadv."); replaces check / penalty on target badges. */
const validMark = mark => mark === undefined || mark === null || typeof mark === 'string';

function validBand(band) {
  return Boolean(band) && Number.isFinite(band.min) && Number.isFinite(band.max) && band.min >= 0 && band.max > band.min
    && Number.isFinite(band.penalty) && TONES.includes(band.tone) && typeof band.label === 'string' && validMark(band.mark);
}

export function makeSpec({ kind, bands = [], overlays = [], note = null, itemName = '' } = {}) {
  if (!KINDS.includes(kind)) return null;
  if (!bands.every(validBand) || !overlays.every(validBand)) return null;
  if (kind !== 'none' && !bands.length) return null;
  return {
    kind,
    bands: bands.map(band => ({ ...band })),
    overlays: overlays.map(band => ({ ...band })),
    note: note ?? null,
    itemName: String(itemName ?? '')
  };
}

export const noneSpec = (note = null, itemName = '') => makeSpec({ kind: 'none', note, itemName });
export const hasRange = spec => Boolean(spec && spec.kind !== 'none' && spec.bands.length);
export const showsButton = spec => Boolean(spec && (hasRange(spec) || spec.note));
export const maxRange = spec => Math.max(0, ...[...(spec?.bands ?? []), ...(spec?.overlays ?? [])].map(band => band.max));

/** Short label for list rows: "80/320 ft", "Reach 10 ft", "30 ft", or the note. */
export function rangeLabel(spec, units = DEFAULT_UNITS) {
  if (!spec) return '';
  if (!hasRange(spec)) return spec.note ?? '';
  const first = spec.bands[0], last = spec.bands.at(-1);
  if (spec.kind === 'increments' && spec.bands.length > 1) return `${first.max}/${last.max} ${units}`;
  return first.label || `${first.max} ${units}`;
}
