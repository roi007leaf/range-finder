/** Pinned and previewed ranges for this client, plus shared pins from other users. */
import { hasRange } from '../core/spec.mjs';

const sameItem = (a, b) => a.itemUuid === b.itemUuid && (a.actionIndex ?? null) === (b.actionIndex ?? null);
/** Same item and same per-use variant (e.g. "with Reach Spell"). */
const same = (a, b) => sameItem(a, b) && (a.variant ?? null) === (b.variant ?? null);
/** Requests carry `variant` only when set, so plain pins and their socket messages keep their v1 shape. */
const withVariant = (request, variant) => (variant ? { ...request, variant: String(variant) } : request);

export class PinManager {
  #pins = new Map();
  #preview = null;

  constructor({ userId, build, onChange = () => {}, broadcast = () => {}, allowShare = () => true, ghost = null }) {
    Object.assign(this, { userId, build, onChange, broadcast, allowShare, ghost });
  }

  static key(userId, tokenId) { return `${userId}:${tokenId}`; }

  get size() { return this.#pins.size + (this.#preview ? 1 : 0); }
  get previewing() { return Boolean(this.#preview); }

  all() { return [...this.#pins.values(), ...(this.#preview ? [this.#preview] : [])]; }
  tokenIds() { return new Set(this.all().map(pin => pin.tokenId)); }

  /** Button state: any pin of this item on this token, whatever its variant. */
  pinFor(request) {
    const pin = this.#pins.get(PinManager.key(this.userId, request.tokenId));
    return pin && sameItem(pin, request) ? pin : null;
  }

  #spec(request) {
    const spec = this.build({ tokenId: request.tokenId, itemUuid: request.itemUuid, actionIndex: request.actionIndex ?? null, variant: request.variant ?? null });
    return hasRange(spec) ? spec : null;
  }

  toggle({ tokenId, itemUuid, actionIndex = null, variant = null, share = false, sourceEl = null }) {
    const key = PinManager.key(this.userId, tokenId);
    const request = withVariant({ tokenId, itemUuid, actionIndex }, variant);
    const existing = this.#pins.get(key);
    if (existing && same(existing, request)) {
      // Shift+click on an unshared pin upgrades it to shared instead of unpinning.
      if (share && !existing.shared && this.allowShare()) {
        existing.shared = true;
        this.broadcast({ action: 'pin', userId: this.userId, ...request });
        this.onChange();
        return 'shared';
      }
      this.#remove(key);
      return 'unpinned';
    }
    const spec = this.#spec(request);
    if (!spec) return 'unavailable';
    if (existing) this.#remove(key, false);
    const shared = Boolean(share && this.allowShare());
    this.#pins.set(key, { key, userId: this.userId, ...request, spec, shared, preview: false, sourceEl });
    this.ghost?.hold(sourceEl, { sticky: true });
    if (shared) this.broadcast({ action: 'pin', userId: this.userId, ...request });
    this.onChange();
    return 'pinned';
  }

  #remove(key, notify = true) {
    const pin = this.#pins.get(key);
    if (!pin) return false;
    this.#pins.delete(key);
    this.ghost?.release(pin.sourceEl, { sticky: true });
    if (pin.shared && pin.userId === this.userId) this.broadcast({ action: 'unpin', userId: this.userId, tokenId: pin.tokenId });
    if (notify) this.onChange();
    return true;
  }

  preview({ tokenId, itemUuid, actionIndex = null, sourceEl = null }) {
    if (this.#preview) return false;
    const request = { tokenId, itemUuid, actionIndex };
    const spec = this.#spec(request);
    if (!spec) return false;
    this.#preview = { key: `preview:${tokenId}`, userId: this.userId, ...request, spec, shared: false, preview: true, sourceEl };
    this.ghost?.hold(sourceEl, { sticky: false });
    this.onChange();
    return true;
  }

  #dropPreview() {
    const preview = this.#preview;
    if (!preview) return false;
    this.#preview = null;
    this.ghost?.release(preview.sourceEl, { sticky: false });
    return true;
  }

  endPreview() {
    if (!this.#dropPreview()) return false;
    this.onChange();
    return true;
  }

  receive(message) {
    if (!message || message.userId === this.userId) return;
    if (message.action === 'clearAll') {
      let changed = false;
      for (const [key, pin] of [...this.#pins]) {
        if (!pin.shared) continue;
        this.#pins.delete(key);
        this.ghost?.release(pin.sourceEl, { sticky: true });
        changed = true;
      }
      if (changed) this.onChange();
      return;
    }
    const key = PinManager.key(message.userId, message.tokenId);
    if (message.action === 'unpin') {
      if (this.#pins.delete(key)) this.onChange();
      return;
    }
    if (message.action !== 'pin') return;
    const request = withVariant({ tokenId: message.tokenId, itemUuid: message.itemUuid, actionIndex: message.actionIndex ?? null }, message.variant);
    const spec = this.#spec(request);
    if (!spec) return;
    this.#pins.set(key, { key, userId: message.userId, ...request, spec, shared: true, preview: false, sourceEl: null });
    this.onChange();
  }

  clearLocal() {
    let had = this.#dropPreview();
    for (const [key, pin] of [...this.#pins]) if (pin.userId === this.userId) had = this.#remove(key, false) || had;
    if (had) this.onChange();
    return had;
  }

  clearShared() {
    this.broadcast({ action: 'clearAll', userId: this.userId });
    let changed = false;
    for (const [key, pin] of [...this.#pins]) if (pin.shared) changed = this.#remove(key, false) || changed;
    if (changed) this.onChange();
  }

  #dropWhere(test) {
    let changed = false;
    if (this.#preview && test(this.#preview)) changed = this.#dropPreview();
    for (const [key, pin] of [...this.#pins]) if (test(pin)) changed = this.#remove(key, false) || changed;
    if (changed) this.onChange();
  }

  dropToken(tokenId) { this.#dropWhere(pin => pin.tokenId === tokenId); }
  dropItem(itemUuid) { this.#dropWhere(pin => pin.itemUuid === itemUuid); }
  /** A user disconnected: their shared pins can no longer be unpinned by them. */
  dropUser(userId) { this.#dropWhere(pin => pin.userId === userId); }

  rebuild() {
    let changed = false;
    for (const [key, pin] of [...this.#pins]) {
      const spec = this.#spec(pin);
      if (!spec) changed = this.#remove(key, false) || changed;
      else if (spec !== pin.spec) { pin.spec = spec; changed = true; }
    }
    if (this.#preview) {
      const spec = this.#spec(this.#preview);
      if (!spec) changed = this.#dropPreview() || changed;
      else if (spec !== this.#preview.spec) { this.#preview.spec = spec; changed = true; }
    }
    if (changed) this.onChange();
  }

  /** Scene teardown: drop everything locally; only this user's shared pins are unpinned for everyone else. */
  reset() {
    for (const pin of this.all()) {
      this.ghost?.release(pin.sourceEl, { sticky: !pin.preview });
      if (pin.shared && pin.userId === this.userId) this.broadcast({ action: 'unpin', userId: this.userId, tokenId: pin.tokenId });
    }
    this.#pins.clear();
    this.#preview = null;
    this.onChange();
  }
}
