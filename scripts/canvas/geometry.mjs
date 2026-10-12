/** Runtime adapter from Foundry's canvas to the plain geometry the overlay needs. */
export function sceneGeometry(canvas) {
  const { grid, dimensions } = canvas;
  const sight = new Map();
  const losFor = token => {
    if (!sight.has(token.id)) {
      // Foundry v14: TokenDocument#getVisionOrigin() is the elevated center (elevation + half depth);
      // `document.level` is the Level id and the polygon config takes the Level document.
      const doc = token.document;
      const origin = doc?.getVisionOrigin?.() ?? token.center;
      const level = doc?.level ? doc.parent?.levels?.get?.(doc.level) : null;
      const config = level ? { type: 'sight', level } : { type: 'sight' };
      const polygon = CONFIG.Canvas.polygonBackends.sight.create(origin, config);
      const point = ({ x, y }) => !polygon.contains(x, y);
      sight.set(token.id, { point, cell: ({ i, j }) => point(grid.getCenterPoint({ i, j })) });
    }
    return sight.get(token.id);
  };
  return {
    isSquare: grid.isSquare,
    size: grid.size,
    unit: grid.distance,
    bounds: { rows: dimensions.rows, cols: dimensions.columns },
    pxPerFoot: dimensions.size / dimensions.distance,
    topLeft: (i, j) => grid.getTopLeftPoint({ i, j }),
    originCells: token => token.document.getOccupiedGridSpaceOffsets(),
    center: token => token.center,
    tokenRadius: token => Math.max(token.w, token.h) / 2,
    losFor
  };
}

export function makeText(text, style = {}) {
  const PreciseText = foundry.canvas.containers.PreciseText;
  return new PreciseText(text, PreciseText.getTextStyle({ fontFamily: 'Signika', strokeThickness: 3, ...style }));
}

/** Foundry v14's `--font-awesome` value (css/foundry2.css), used when the variable can't be read. */
export const FA_FALLBACK = 'Font Awesome 7 Pro';

/** First family of a CSS font-family list, unquoted. */
export function fontFamilyOf(value) {
  const first = String(value ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '').trim();
  return first || FA_FALLBACK;
}

/** Font Awesome family for glyph text, read from Foundry's `--font-awesome` CSS variable at runtime. */
export function faFamily() {
  try {
    const root = globalThis.document?.documentElement;
    if (!root || typeof globalThis.getComputedStyle !== 'function') return FA_FALLBACK;
    return fontFamilyOf(globalThis.getComputedStyle(root).getPropertyValue('--font-awesome'));
  } catch {
    return FA_FALLBACK;
  }
}

/** The scene's distance units (`Scene#grid.units`), `ft` when unset. */
export function sceneUnits(c = globalThis.canvas) {
  return c?.scene?.grid?.units || 'ft';
}
