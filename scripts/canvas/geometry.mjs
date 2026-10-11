/** Runtime adapter from Foundry's canvas to the plain geometry the overlay needs. */
export function sceneGeometry(canvas) {
  const { grid, dimensions } = canvas;
  const sight = new Map();
  const losFor = token => {
    if (!sight.has(token.id)) {
      const polygon = CONFIG.Canvas.polygonBackends.sight.create(token.center, { type: 'sight' });
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

/** Font Awesome family for glyph text (Foundry v14 `--font-awesome` in css/foundry2.css). */
export const FA_FAMILY = 'Font Awesome 7 Pro';
