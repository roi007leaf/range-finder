/** Catch-all row definition for systems without a built-in adapter: any element carrying an item id / uuid. */
const ATTRS = ['data-item-id', 'data-item-uuid', 'data-uuid', 'data-document-id', 'data-document-uuid'];
export const GENERIC_ROW_SELECTOR = ATTRS.map(attr => `[${attr}]`).join(',');
const OWN_UI = '[class*="range-finder-"]';

const elementOf = value => {
  const el = value?.[0] ?? value;
  return el && el.nodeType === 1 ? el : null;
};

/** The embedded Item of `actor` that `el` points at (by id or uuid attribute), or null. */
function itemOf(el, actor) {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    let item = null;
    try {
      item = actor.items?.get?.(value) ?? null;
      if (!item && value.includes('.')) {
        const found = globalThis.fromUuidSync?.(value);
        if (found && found.parent === actor) item = found;
      }
    } catch { item = null; }
    if (item) return item;
  }
  return null;
}

export function createGenericRows({ enabled = () => true } = {}) {
  return [{
    hooks: ['renderActorSheet', 'renderActorSheetV2'],
    selector: GENERIC_ROW_SELECTOR,
    resolve: (el, app) => {
      if (!enabled()) return null;
      const actor = app?.actor ?? app?.document ?? null;
      if (!actor?.items) return null;
      if (el === elementOf(app?.element) || el.closest(OWN_UI)) return null;
      const item = itemOf(el, actor);
      if (!item) return null;
      for (const inner of el.querySelectorAll(GENERIC_ROW_SELECTOR)) {
        if (!inner.closest(OWN_UI) && itemOf(inner, actor) === item) return null;
      }
      return { actor, item, actionIndex: null };
    },
    host: el => ['.item-controls', '.controls', '.item-buttons', '.item-name', '.name', 'h4']
      .map(selector => el.querySelector(`:scope ${selector}`)).find(Boolean) ?? el
  }];
}
