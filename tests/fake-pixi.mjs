/** Minimal PIXI stand-in: records Graphics calls, tracks children and destruction. */
export class Container {
  constructor() { this.children = []; this.destroyed = false; this.alpha = 1; this.width = 40; this.height = 16; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set: s => { this.scale.value = s; } }; }
  addChild(...children) { this.children.push(...children); return children[0]; }
  removeChildren() { const old = this.children; this.children = []; return old; }
  destroy() { this.destroyed = true; }
}
export function makeGraphicsClass(log) {
  return class Graphics extends Container {
    constructor() {
      super();
      return new Proxy(this, {
        get(target, key) {
          if (key in target) return target[key];
          return (...args) => { log.push([key, ...args]); return target; };
        }
      });
    }
  };
}
export function fakePIXI() {
  const log = [];
  return { log, PIXI: { Container, Graphics: makeGraphicsClass(log) } };
}
export function fakeGeo({ isSquare = true } = {}) {
  return {
    isSquare, size: 100, unit: 5, bounds: { rows: 50, cols: 50 }, pxPerFoot: 20,
    topLeft: (i, j) => ({ x: j * 100, y: i * 100 }),
    originCells: token => token.cells,
    center: token => token.center,
    tokenRadius: () => 50,
    losFor: () => ({ cell: c => c.j > 12, point: p => p.x > 1200 })
  };
}
export const baseSettings = { bandStyle: 'both', bandOpacity: 1, showLabels: true, badgeScale: 1, palette: 'default', dimBehindWalls: false };
