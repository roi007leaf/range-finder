import assert from 'node:assert/strict';
import test from 'node:test';
import { GHOST_CLASS, GHOSTABLE_CLASS, Ghost } from '../scripts/ui/Ghost.mjs';

function element(rect = { left: 0, top: 0, right: 100, bottom: 100 }) {
  const classes = new Set();
  return {
    isConnected: true,
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
      contains: name => classes.has(name)
    },
    getBoundingClientRect: () => rect
  };
}
function doc() {
  const listeners = new Map();
  return { listeners, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
}

test('fade: hold adds classes, release removes ghost', () => {
  const d = doc(), el = element(), ghost = new Ghost({ doc: d });
  ghost.hold(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  assert.ok(el.classList.contains(GHOSTABLE_CLASS));
  assert.ok(d.listeners.has('pointermove'));
  ghost.release(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  assert.ok(!d.listeners.has('pointermove'));
});

test('counts holds per element', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.ok(el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.release(el, { sticky: false });
  assert.ok(!ghost.isGhosted(el));
});

test('hover restores a pinned window; leaving re-ghosts it', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.onMove({ clientX: 50, clientY: 50 });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.onMove({ clientX: 500, clientY: 50 });
  assert.ok(el.classList.contains(GHOST_CLASS));
});

test('no hover restore while a preview is active', () => {
  const el = element(), ghost = new Ghost({ doc: doc() });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.onMove({ clientX: 50, clientY: 50 });
  assert.ok(el.classList.contains(GHOST_CLASS));
});

test('minimize mode', () => {
  const calls = [];
  const app = { minimized: false, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.hold(el, { sticky: false });
  ghost.release(el, { sticky: false });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, ['min', 'max']);
  assert.ok(!el.classList.contains(GHOST_CLASS));
});

test('minimize mode leaves an already minimized window alone', () => {
  const calls = [];
  const app = { minimized: true, minimize: () => calls.push('min'), maximize: () => calls.push('max') };
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'minimize', appFor: () => app });
  ghost.hold(el, { sticky: true });
  ghost.release(el, { sticky: true });
  assert.deepEqual(calls, []);
});

test('off mode and null elements are no-ops', () => {
  const el = element(), ghost = new Ghost({ doc: doc(), mode: () => 'off' });
  ghost.hold(el, { sticky: true });
  assert.ok(!el.classList.contains(GHOST_CLASS));
  ghost.hold(null, { sticky: true });
  ghost.release(null, { sticky: true });
});

test('releaseAll restores everything and forgets disconnected elements', () => {
  const d = doc(), a = element(), b = element(), ghost = new Ghost({ doc: d });
  ghost.hold(a, { sticky: true });
  ghost.hold(b, { sticky: true });
  b.isConnected = false;
  ghost.onMove({ clientX: 500, clientY: 500 });
  assert.ok(!ghost.isGhosted(b));
  ghost.releaseAll();
  assert.ok(!a.classList.contains(GHOST_CLASS));
  assert.ok(!d.listeners.has('pointermove'));
});
