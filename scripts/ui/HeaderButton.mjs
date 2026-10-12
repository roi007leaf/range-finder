/** 📏 in item-sheet headers: AppV2 header-controls menu and AppV1 header buttons. */
import { hasRange } from '../core/spec.mjs';

const ICON = 'fa-solid fa-ruler-combined';

/** The embedded item an item sheet shows, with its owning actor; null for anything else. */
export function headerItem(app) {
  const item = app?.document ?? app?.item ?? app?.object ?? null;
  if (!item || item.documentName !== 'Item') return null;
  const actor = item.actor ?? (item.parent?.documentName === 'Actor' ? item.parent : null);
  return actor ? { actor, item, actionIndex: null } : null;
}

/** AppV2 sheets expose an HTMLElement, AppV1 sheets a jQuery wrapper. */
export function sheetElement(app) {
  const el = app?.element;
  if (el?.nodeType === 1) return el;
  return el?.[0]?.nodeType === 1 ? el[0] : null;
}

/** Click handler for items whose spec has a range; null otherwise (no control). */
function pinner(app, { adapter, triggers }) {
  const ctx = headerItem(app);
  if (!ctx) return null;
  let spec = null;
  try { spec = adapter.specFor(ctx); } catch (error) { console.error('Range Finder |', error); }
  if (!hasRange(spec)) return null;
  return event => triggers.pinItem(ctx, { share: Boolean(event?.shiftKey), sourceEl: sheetElement(app) });
}

/** Entry for `getHeaderControlsDocumentSheetV2`, or null. */
export function headerControlV2(app, deps) {
  const onClick = pinner(app, deps);
  if (!onClick) return null;
  const localize = deps.localize ?? (key => key);
  return { action: 'rangeFinderPin', icon: ICON, label: localize('RANGE_FINDER.Header.Pin'), onClick };
}

/** Button for `getItemSheetHeaderButtons`, or null. */
export function headerButtonV1(app, deps) {
  const onclick = pinner(app, deps);
  if (!onclick) return null;
  const localize = deps.localize ?? (key => key);
  return { label: localize('RANGE_FINDER.Header.Label'), class: 'range-finder-header', icon: ICON, onclick };
}
