import { daggerheartAdapter } from './daggerheart.mjs';
import { drawSteelAdapter } from './draw-steel.mjs';
import { dnd5eAdapter } from './dnd5e.mjs';
import { genericAdapter } from './generic.mjs';
import { pf2eAdapter } from './pf2e.mjs';

const adapters = new Map([['pf2e', pf2eAdapter], ['sf2e', pf2eAdapter], ['dnd5e', dnd5eAdapter], ['daggerheart', daggerheartAdapter], ['draw-steel', drawSteelAdapter]]);

export function registerAdapter(systemId, adapter) {
  adapters.set(systemId, adapter);
}

export function getAdapter(systemId) {
  return adapters.get(systemId) ?? genericAdapter;
}
