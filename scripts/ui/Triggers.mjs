/** Row buttons (click to pin, Shift+click to share, Alt+click for a per-use variant) and the hold-key hover preview. */
import { hasRange, showsButton } from '../core/spec.mjs';

export const WINDOW_SELECTOR = '.application, .app, .window-app';
export const ROW_BUTTON_CLASS = 'range-finder-row-btn';
const ROW_ATTR = 'data-range-finder-row';
/** On controls whose Alt+click pins a variant (adapter.altVariant), e.g. "with Reach Spell". */
const ALT_ATTR = 'data-range-finder-alt';
const ALT_BUTTON = `.range-finder-btn[${ALT_ATTR}]`;
const CONTROLS = `.range-finder-btn, .${ROW_BUTTON_CLASS}`;

export class Triggers {
  #rows = new WeakMap();
  #extraRows = [];
  #hovered = null;
  #keyHeld = false;
  #overAlt = false;
  #altClick = false;
  #restore = null;

  constructor({ adapter, pins, resolveToken, notify = () => {}, localize = key => key, settings = () => ({}), previewKey = () => null, doc = globalThis.document }) {
    Object.assign(this, { adapter, pins, resolveToken, notify, localize, settings, previewKey, doc });
    doc.addEventListener('pointerover', event => this.#onHover(event));
    // Capture phase: runs before the click and before a preview could ghost the window.
    doc.addEventListener('pointerdown', event => this.#onPointerDown(event), true);
  }

  /** Row definitions on top of the adapter's (e.g. the Token HUD list). */
  addRows(defs) {
    this.#extraRows.push(...defs);
  }

  decorate(root, app, hookName) {
    if (!root?.querySelectorAll) return;
    for (const def of [...(this.adapter.rows ?? []), ...this.#extraRows]) {
      if (hookName && def.hooks && !def.hooks.includes(hookName)) continue;
      for (const el of root.querySelectorAll(def.selector)) this.#decorateRow(el, def, app);
    }
    this.refresh(root);
  }

  #decorateRow(el, def, app) {
    try {
      if (this.#rows.has(el)) return;
      const ctx = def.resolve(el, app);
      if (!ctx?.actor || !ctx?.item) return;
      const spec = this.adapter.specFor(ctx);
      if (!showsButton(spec)) return;
      this.#rows.set(el, { ctx, def, app });
      el.setAttribute(ROW_ATTR, '');
      if (def.wholeRow) {
        el.classList.add(ROW_BUTTON_CLASS);
        this.#wire(el, el, spec, ctx);
      } else {
        const host = def.host?.(el) ?? el;
        host.append(this.#button(el, spec, ctx, def));
      }
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  /** A row definition may ask for a different element/classes so the button matches the sheet's own controls. */
  #button(row, spec, ctx, def = {}) {
    const button = this.doc.createElement(def.button?.tag ?? 'a');
    if (button.tagName === 'BUTTON') button.type = 'button';
    button.className = ['range-finder-btn', ...(def.button?.classes ?? [])].join(' ');
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    this.#wire(button, row, spec, ctx);
    return button;
  }

  /** Make `control` (a 📏 button or a whole list row) pin `row`'s range on click / Enter / Space. */
  #wire(control, row, spec, ctx) {
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
    const active = hasRange(spec);
    if (!active) {
      control.classList.add('is-disabled');
      control.setAttribute('aria-disabled', 'true');
    }
    const alt = active ? this.adapter.altVariant?.(ctx) ?? null : null;
    let tooltip = active ? this.localize('RANGE_FINDER.Button.Show') : spec.note;
    // Mention the hold-to-preview key (it's rebindable; omitted when unbound).
    const key = active ? this.previewKey() : null;
    if (key) tooltip = `${tooltip} · ${this.localize('RANGE_FINDER.Button.Preview').replace('{key}', key)}`;
    if (alt) {
      control.setAttribute(ALT_ATTR, alt.id);
      tooltip = `${tooltip} · ${this.localize('RANGE_FINDER.Button.Alt')} ${alt.label}`;
    }
    control.dataset.tooltip = tooltip;
    control.setAttribute('aria-label', tooltip);
    const activate = event => {
      event.preventDefault();
      event.stopPropagation();
      if (active) this.#toggle(row, event.shiftKey, event.altKey && alt ? alt.id : null);
    };
    control.addEventListener('click', activate);
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') activate(event);
    });
  }

  /** ctx.token (e.g. the Token HUD's token) wins over the actor's controlled / first active token. */
  #requestFor(ctx, def, row, { quiet = false } = {}) {
    const token = ctx.token ?? this.resolveToken(ctx.actor);
    if (!token) {
      if (!quiet) this.notify(this.localize('RANGE_FINDER.Notify.NoToken'));
      return null;
    }
    const includeBar = Boolean(this.settings().ghostPersistentHud);
    let sourceEl;
    if (def.sourceEl) sourceEl = def.sourceEl(row);
    else if (def.ghostTargets) sourceEl = def.ghostTargets(row, { includeBar }).filter(Boolean);
    else sourceEl = !def.persistentHud || includeBar ? row?.closest?.(WINDOW_SELECTOR) ?? null : null;
    return { tokenId: token.id, itemUuid: ctx.item.uuid, actionIndex: ctx.actionIndex ?? null, sourceEl };
  }

  #request(row, options) {
    const entry = this.#rows.get(row);
    return entry ? this.#requestFor(entry.ctx, entry.def, row, options) : null;
  }

  #toggle(row, share, variant = null) {
    try {
      const request = this.#request(row);
      if (!request) return;
      this.pins.toggle({ ...request, share, ...(variant ? { variant } : {}) });
      this.refresh();
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  /** Pin (or unpin) an item outside any row — e.g. from an item sheet's header. */
  pinItem(ctx, { share = false, variant = null, sourceEl = null } = {}) {
    try {
      const request = this.#requestFor(ctx, { sourceEl: () => sourceEl }, null);
      if (!request) return null;
      const result = this.pins.toggle({ ...request, share, ...(variant ? { variant } : {}) });
      this.refresh();
      return result;
    } catch (error) {
      console.error('Range Finder |', error);
      return null;
    }
  }

  refresh(root = this.doc) {
    for (const control of root.querySelectorAll?.(CONTROLS) ?? []) {
      const row = control.closest(`[${ROW_ATTR}]`);
      const request = row ? this.#request(row, { quiet: true }) : null;
      const pin = request ? this.pins.pinFor(request) : null;
      control.classList.toggle('is-active', Boolean(pin));
      control.classList.toggle('is-shared', Boolean(pin?.shared));
    }
  }

  #onHover(event) {
    const target = event.target;
    this.#overAlt = Boolean(target?.closest?.(ALT_BUTTON));
    const row = target?.closest?.(`[${ROW_ATTR}]`) ?? null;
    this.#hovered = row && this.#rows.has(row) ? row : null;
    if (this.#keyHeld && this.#hovered) this.#startPreview();
  }

  /** Alt+click on a variant control: the click wins over the hold-Alt preview. */
  #onPointerDown(event) {
    if (!event.altKey || !event.target?.closest?.(`[${ALT_ATTR}]`)) return;
    if (!this.#keyHeld) return;
    this.#altClick = true;
    this.pins.endPreview();
  }

  #startPreview() {
    if (this.pins.previewing || this.#overAlt || this.#altClick || !this.#hovered?.isConnected) return;
    const request = this.#request(this.#hovered, { quiet: true });
    if (!request) return;
    this.#restore = null;
    try {
      const { def, app } = this.#rows.get(this.#hovered);
      this.#restore = def.onPreview?.(this.#hovered, app) ?? null;
    } catch (error) {
      console.error('Range Finder |', error);
    }
    this.pins.preview(request);
  }

  keyDown() {
    if (!this.#keyHeld) this.#altClick = false;
    this.#keyHeld = true;
    this.#startPreview();
  }

  keyUp() {
    this.#keyHeld = false;
    this.#altClick = false;
    this.pins.endPreview();
    const restore = this.#restore;
    this.#restore = null;
    try {
      restore?.();
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }
}
