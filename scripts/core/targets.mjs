/** Classify target tokens against a range spec. Pure — distance is computed by the caller. */
import { bandIndexFor, fmtPenalty, inBand } from './spec.mjs';

export function classifyTargets({ spec, targets }) {
  return targets.map(({ id, distance, blocked = false }) => {
    const index = Number.isFinite(distance) ? bandIndexFor(spec.bands, distance) : -1;
    const band = spec.bands[index];
    // Penalty zones (e.g. PF2e volley) stack onto the target's own penalty and name themselves on the badge.
    let penalty = band ? band.penalty : null;
    const zones = [];
    if (band) {
      for (const zone of spec.overlays ?? []) {
        if (zone.tone !== 'penalty-zone' || !zone.penalty || !inBand(zone, distance, true)) continue;
        penalty += zone.penalty;
        zones.push(zone.badge ?? zone.label);
      }
    }
    return {
      id, distance,
      bandIndex: band ? index : null,
      penalty,
      outOfRange: !band,
      blocked: Boolean(blocked),
      zones
    };
  });
}

/** Whole distances stay integers; anything else shows one decimal (1.5 m squares, odd grid distances). */
const fmtDistance = distance => (Number.isInteger(Math.round(distance * 10) / 10) ? String(Math.round(distance)) : String(Math.round(distance * 10) / 10));

export function badgeText({ distance, penalty, outOfRange, mark = null, zones = [] }, units = 'ft') {
  if (!Number.isFinite(distance)) return `— ${units} · ✗`;
  if (!outOfRange && zones.length) {
    // In a penalty zone the total penalty is what matters ("20 ft · –2 Volley"); keep a boost mark after it.
    return `${fmtDistance(distance)} ${units} · ${fmtPenalty(penalty)} ${zones.join(' ')}${mark ? ` · ${mark}` : ''}`;
  }
  const sign = outOfRange ? '✗' : mark || (penalty ? fmtPenalty(penalty) : '✓');
  return `${fmtDistance(distance)} ${units} · ${sign}`;
}
