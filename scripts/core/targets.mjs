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

export function badgeText({ distance, penalty, outOfRange }) {
  const mark = outOfRange ? '✗' : penalty ? fmtPenalty(penalty) : '✓';
  return `${Math.round(distance)} ft · ${mark}`;
}
