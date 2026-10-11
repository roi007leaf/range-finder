/** Fade (or minimize) the window a range was shown from, so the canvas underneath is visible. */
export const GHOST_CLASS = 'range-finder-ghost';
export const GHOSTABLE_CLASS = 'range-finder-ghostable';

const log = (...args) => console.error('Range Finder |', ...args);

export class Ghost {
  #held = new Map();
  #listening = false;

  constructor({ mode = () => 'fade', doc = globalThis.document, appFor = () => null } = {}) {
    Object.assign(this, { mode, doc, appFor });
    this.onMove = this.onMove.bind(this);
  }

  /** `el` may be one element or a list (e.g. a HUD sidebar together with its bar). */
  hold(el, { sticky = false } = {}) {
    if (Array.isArray(el)) { for (const one of el) this.hold(one, { sticky }); return; }
    if (!el) return;
    try {
      let entry = this.#held.get(el);
      if (!entry) {
        const mode = this.mode();
        if (mode === 'off') return;
        entry = { mode: mode === 'minimize' ? 'minimize' : 'fade', pins: 0, previews: 0, app: null };
        if (entry.mode === 'minimize') {
          const app = this.appFor(el);
          if (app && !app.minimized) { entry.app = app; this.#call(app, 'minimize'); }
        } else {
          el.classList.add(GHOSTABLE_CLASS, GHOST_CLASS);
        }
        this.#held.set(el, entry);
      } else if (!sticky && entry.mode === 'fade') {
        // A preview always ghosts the window, even if hover had restored a pinned one.
        el.classList.add(GHOST_CLASS);
      }
      if (sticky) entry.pins++;
      else entry.previews++;
      this.#listen();
    } catch (error) {
      log(error);
    }
  }

  release(el, { sticky = false } = {}) {
    if (Array.isArray(el)) { for (const one of el) this.release(one, { sticky }); return; }
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
      try {
        if (!el.isConnected) { this.#held.delete(el); continue; }
        if (entry.mode !== 'fade' || entry.previews > 0) continue;
        const rect = el.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        el.classList.toggle(GHOST_CLASS, !inside);
      } catch (error) {
        log(error);
      }
    }
    if (!this.#held.size) this.#unlisten();
  }

  #call(app, method) {
    try {
      // AppV2 minimize/maximize return promises; a rejection must not go unhandled.
      const result = app[method]?.();
      result?.catch?.(error => log(error));
    } catch (error) {
      log(error);
    }
  }

  #restore(el, entry) {
    try {
      el.classList.remove(GHOST_CLASS);
    } catch (error) {
      log(error);
    }
    if (entry.app) this.#call(entry.app, 'maximize');
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
