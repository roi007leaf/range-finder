/** Small helpers shared by adapters. Pure. */

/** An actor's items as an array (arrays, Maps and Foundry Collections). */
export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  return Array.from(items.values?.() ?? items);
}

/** Read a dotted path ("system.range.value"); undefined when any step is missing. */
export function getPath(object, path) {
  return String(path ?? '').split('.').filter(Boolean)
    .reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}
