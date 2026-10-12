/** Row buttons (click to pin, Shift+click to share, Alt+click for a per-use variant) and the hold-key hover preview. */
import { hasRange, showsButton } from '../core/spec.mjs';

export const WINDOW_SELECTOR = '.application, .app, .window-app';
const ROW_ATTR = 'data-range-finder-row';
/** On controls whose Alt+click pins a variant (adapter.altVariant), e.g. "with Reach Spell". */
const ALT_ATTR = 'data-range-finder-alt';
const ALT_BUTTON = `.range-finder-btn[${ALT_ATTR}]`;

export class Triggers {
  #rows = new WeakMap();
  #hovered = null;
  #keyHeld = false;
  #overAlt = false;
  #altClick = false;

  constructor({ adapter, pins, resolveToken, notify = () => {}, localize = key => key, settings = () => ({}), doc = globalThis.document }) {
    Object.assign(this, { adapter, pins, resolveToken, notify, localize, settings, doc });
    doc.addEventListener('pointerover', event => this.#onHover(event));
    // Capture phase: runs before the click and before a preview could ghost the window.
    doc.addEventListener('pointerdown', event => this.#onPointerDown(event), true);
  }

  decorate(root, app, hookName) {
    if (!root?.querySelectorAll) return;
    for (const def of this.adapter.rows ?? []) {
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
      this.#rows.set(el, { ctx, def });
      el.setAttribute(ROW_ATTR, '');
      const host = def.host?.(el) ?? el;
      host.append(this.#button(el, spec, ctx));
    } catch (error) {
      console.error('Range Finder |', error);
    }
  }

  #button(row, spec, ctx) {
    const button = this.doc.createElement('a');
    button.className = 'range-finder-btn';
    button.innerHTML = '<i class="fa-solid fa-ruler-combined"></i>';
    this.#wire(button, row, spec, ctx);
    return button;
  }

  /** Make `control` pin `row`'s range on click / Enter / Space (Shift shares, Alt picks the variant). */
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

  #request(row, { quiet = false } = {}) {
    const entry = this.#rows.get(row);
    if (!entry) return null;
    const token = this.resolveToken(entry.ctx.actor);
    if (!token) {
      if (!quiet) this.notify(this.localize('RANGE_FINDER.Notify.NoToken'));
      return null;
    }
    const includeBar = Boolean(this.settings().ghostPersistentHud);
    let sourceEl;
    if (entry.def.ghostTargets) sourceEl = entry.def.ghostTargets(row, { includeBar }).filter(Boolean);
    else sourceEl = !entry.def.persistentHud || includeBar ? row.closest(WINDOW_SELECTOR) : null;
    return { tokenId: token.id, itemUuid: entry.ctx.item.uuid, actionIndex: entry.ctx.actionIndex ?? null, sourceEl };
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

  refresh(root = this.doc) {
    for (const button of root.querySelectorAll?.('.range-finder-btn') ?? []) {
      const row = button.closest(`[${ROW_ATTR}]`);
      const request = row ? this.#request(row, { quiet: true }) : null;
      const pin = request ? this.pins.pinFor(request) : null;
      button.classList.toggle('is-active', Boolean(pin));
      button.classList.toggle('is-shared', Boolean(pin?.shared));
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
    this.#altClick = true;
    this.pins.endPreview();
  }

  #startPreview() {
    if (this.pins.previewing || this.#overAlt || this.#altClick || !this.#hovered?.isConnected) return;
    const request = this.#request(this.#hovered, { quiet: true });
    if (request) this.pins.preview(request);
  }

  keyDown() {
    this.#keyHeld = true;
    this.#startPreview();
  }

  keyUp() {
    this.#keyHeld = false;
    this.#altClick = false;
    this.pins.endPreview();
  }
}
