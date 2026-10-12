/** Classify target tokens against a range spec. Pure — distance is computed by the caller. */
import { bandIndexFor, fmtPenalty } from './spec.mjs';

export function classifyTargets({ spec, targets }) {
  return targets.map(({ id, distance, blocked = false }) => {
    const index = Number.isFinite(distance) ? bandIndexFor(spec.bands, distance) : -1;
    const band = spec.bands[index];
    return {
      id, distance,
      bandIndex: band ? index : null,
      penalty: band ? band.penalty : null,
      outOfRange: !band,
      blocked: Boolean(blocked)
    };
  });
}

/** Whole distances stay integers; anything else shows one decimal (1.5 m squares, odd grid distances). */
const fmtDistance = distance => (Number.isInteger(Math.round(distance * 10) / 10) ? String(Math.round(distance)) : String(Math.round(distance * 10) / 10));

export function badgeText({ distance, penalty, outOfRange, mark = null }, units = 'ft') {
  if (!Number.isFinite(distance)) return `— ${units} · ✗`;
  const sign = outOfRange ? '✗' : mark || (penalty ? fmtPenalty(penalty) : '✓');
  return `${fmtDistance(distance)} ${units} · ${sign}`;
}
