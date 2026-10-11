import { genericAdapter } from './generic.mjs';
import { pf2eAdapter } from './pf2e.mjs';

const adapters = new Map([['pf2e', pf2eAdapter], ['sf2e', pf2eAdapter]]);

export function registerAdapter(systemId, adapter) {
  adapters.set(systemId, adapter);
}

export function getAdapter(systemId) {
  return adapters.get(systemId) ?? genericAdapter;
}
