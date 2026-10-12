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

const METRIC = new Set(['m', 'km']);
/** Feet round to whole numbers; metric scenes keep one decimal (1.5 m squares). */
const fmtDistance = (distance, units) => (METRIC.has(units) ? Math.round(distance * 10) / 10 : Math.round(distance));

export function badgeText({ distance, penalty, outOfRange, mark = null }, units = 'ft') {
  if (!Number.isFinite(distance)) return `— ${units} · ✗`;
  const sign = outOfRange ? '✗' : mark || (penalty ? fmtPenalty(penalty) : '✓');
  return `${fmtDistance(distance, units)} ${units} · ${sign}`;
}
