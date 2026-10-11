/** RangeSpec: what an adapter says an item reaches. Pure — no Foundry globals. */
export const KINDS = ['reach', 'increments', 'radius', 'none'];
export const TONES = ['base', 'increment', 'reach', 'penalty-zone'];
export const MAX_INCREMENTS = 6;

export function fmtPenalty(penalty) {
  if (!penalty) return '0';
  return `${penalty < 0 ? '–' : '+'}${Math.abs(penalty)}`;
}

/** The first band starts at 0 inclusive; later bands exclude their min (it belongs to the band before). */
export function inBand(band, distance) {
  return distance <= band.max && (band.min === 0 ? distance >= 0 : distance > band.min);
}

export function bandIndexFor(bands, distance) {
  return bands.findIndex(band => inBand(band, distance));
}

export function incrementBands(increment, max = increment * MAX_INCREMENTS) {
  const bands = [];
  if (!(increment > 0) || !(max > 0)) return bands;
  for (let k = 0; k < MAX_INCREMENTS; k++) {
    const min = k * increment;
    if (min >= max) break;
    const end = Math.min((k + 1) * increment, max);
    const penalty = k === 0 ? 0 : -2 * k;
    bands.push({
      min, max: end, penalty, tone: k === 0 ? 'base' : 'increment',
      label: penalty ? `${end} ft · ${fmtPenalty(penalty)}` : `${end} ft`
    });
  }
  return bands;
}

export function singleBand(max, tone = 'base', label = `${max} ft`) {
  return [{ min: 0, max, penalty: 0, tone, label }];
}

function validBand(band) {
  return Boolean(band) && Number.isFinite(band.min) && Number.isFinite(band.max) && band.min >= 0 && band.max > band.min
    && Number.isFinite(band.penalty) && TONES.includes(band.tone) && typeof band.label === 'string';
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
