/** Fade (or minimize) the window a range was shown from, so the canvas underneath is visible. */
export const GHOST_CLASS = 'range-finder-ghost';
export const GHOSTABLE_CLASS = 'range-finder-ghostable';

export class Ghost {
  #held = new Map();
  #listening = false;

  constructor({ mode = () => 'fade', doc = globalThis.document, appFor = () => null } = {}) {
    Object.assign(this, { mode, doc, appFor });
    this.onMove = this.onMove.bind(this);
  }

  hold(el, { sticky = false } = {}) {
    if (!el) return;
    let entry = this.#held.get(el);
    if (!entry) {
      const mode = this.mode();
      if (mode === 'off') return;
      entry = { pins: 0, previews: 0, app: null };
      if (mode === 'minimize') {
        const app = this.appFor(el);
        if (app && !app.minimized) { entry.app = app; app.minimize?.(); }
      } else {
        el.classList.add(GHOSTABLE_CLASS, GHOST_CLASS);
      }
      this.#held.set(el, entry);
    }
    if (sticky) entry.pins++;
    else entry.previews++;
    this.#listen();
  }

  release(el, { sticky = false } = {}) {
    const entry = el ? this.#held.get(el) : null;
    if (!entry) return;
    if (sticky) entry.pins = Math.max(0, entry.pins - 1);
    else entry.previews = Math.max(0, entry.previews - 1);
    if (entry.pins + entry.previews > 0) return;
    this.#restore(el, entry);
    this.#held.delete(el);
    if (!this.#held.size) this.#unlisten();
  }

  releaseAll() {
    for (const [el, entry] of this.#held) this.#restore(el, entry);
    this.#held.clear();
    this.#unlisten();
  }

  isGhosted(el) { return this.#held.has(el); }

  onMove(event) {
    for (const [el, entry] of this.#held) {
      if (!el.isConnected) { this.#held.delete(el); continue; }
      if (entry.app || entry.previews > 0) continue;
      const rect = el.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      el.classList.toggle(GHOST_CLASS, !inside);
    }
    if (!this.#held.size) this.#unlisten();
  }

  #restore(el, entry) {
    el.classList.remove(GHOST_CLASS);
    if (entry.app) entry.app.maximize?.();
  }

  #listen() {
    if (this.#listening || !this.doc) return;
    this.doc.addEventListener('pointermove', this.onMove, { passive: true });
    this.#listening = true;
  }

  #unlisten() {
    if (!this.#listening) return;
    this.doc.removeEventListener('pointermove', this.onMove);
    this.#listening = false;
  }
}
