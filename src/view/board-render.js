/* board-render.js — DOM tile grid, bank ("tin") view, and cosmetic flights (§14.2).
   Positioning is translate3d-based; z-index = 100 + layer×10; only targeted class
   updates — never a full board re-render per move (§14.2). Flights/pops are purely
   cosmetic and non-blocking (§14.2 locked ruling). */

import { clamp } from '../util.js';
import { faceName } from '../data/i18n.js';

const KEY_CLASS = { d: 'key-d', b: 'key-b', c: 'key-c', w: 'key-w', drR: 'key-drR', drG: 'key-drG', drW: 'key-drW' };
const keyClass = (face) => KEY_CLASS[face.startsWith('dr') ? face.slice(0, 3) : face[0]];

const svgFace = (face) => `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#tile-${face}"/></svg><i class="chip"></i>`;

/** Locked fit formula (§14.2): T = clamp(min(availW/cols, availH/rows), 26, 72). */
export function computeFit(areaEl, cols, rows) {
  const pad = 12;
  const aw = areaEl.clientWidth - pad * 2;
  const ah = areaEl.clientHeight - pad * 2;
  return clamp(Math.min(aw / cols, ah / rows), 26, 72);
}

/** Create the DOM board view. */
export function createBoardView(gridEl, areaEl) {
  const els = new Map(); // tile id → element
  let tiles = [];

  function buildTileEl(t) {
    const el = document.createElement('div');
    if (t.hidden) {
      el.className = 'tile tface facedown';
      el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#tile-back"/></svg>`;
      // no family chip on a face-down tile: the keyline glaze would leak the face (§3.5)
    } else {
      el.className = `tile tface ${keyClass(t.face)}`;
      el.innerHTML = svgFace(t.face);
    }
    el.dataset.id = t.id;
    els.set(t.id, el);
    return el;
  }

  const flights = new Set(); // { el, cancel } — in-air flights are cosmetic (§14.2)

  return {
    els,

    /** (Re)build all tile nodes for a fresh deal. */
    render(newTiles) {
      tiles = newTiles;
      els.clear();
      gridEl.textContent = '';
      for (const t of tiles) gridEl.appendChild(buildTileEl(t));
    },

    /** Layout pass: grid box + per-tile transform vars. Reads only client sizes
        (batched once per fit — §16 no layout thrash). */
    fit(T, cols, rows) {
      const aw = areaEl.clientWidth, ah = areaEl.clientHeight;
      gridEl.style.setProperty('--t', T + 'px');
      gridEl.style.width = cols * T + 'px';
      gridEl.style.height = rows * T + 'px';
      gridEl.style.left = ((aw - cols * T) / 2 | 0) + 'px';
      gridEl.style.top = ((ah - rows * T) / 2 | 0) + 'px';
      for (const t of tiles) {
        const el = els.get(t.id);
        if (!el) continue;
        el.style.setProperty('--tx', t.col * T + 'px');
        el.style.setProperty('--ty', t.row * T + 'px');
        el.style.setProperty('--z', 100 + t.layer * 10);
      }
    },

    /** Toggle .blocked + ARIA across on-board tiles (§9.5). Face-down tiles must not
        leak their face through ARIA (§3.5) — they announce as covered tiles. */
    refreshFree(freeSet, onBoard) {
      for (const t of onBoard) {
        const el = els.get(t.id);
        if (!el) continue;
        const isFree = freeSet.has(t.id);
        el.classList.toggle('blocked', !isFree);
        el.setAttribute('role', 'button');
        const shown = t.hidden && !el.classList.contains('peeked');
        el.setAttribute('aria-label', `${shown ? 'facedown' : faceName(t.face)} tile, ${isFree ? 'free' : 'blocked'}`);
      }
    },

    /** "Not free" deny feedback: tiny jiggle + dimmed flash (§3.3/§9.5). */
    deny(el) {
      el.classList.remove('deny');
      void el.offsetWidth; // restart the animation
      el.classList.add('deny');
    },

    tileEl(id) {
      return els.get(id);
    },

    /** §3.5: flip a face-down tile face-up in place (peek) — back → real face. */
    peek(t) {
      const el = els.get(t.id);
      if (!el) return;
      el.classList.remove('facedown');
      el.classList.remove('peeked');
      void el.offsetWidth;
      el.classList.add('peeked');
      el.classList.add('flip');
      setTimeout(() => el.classList.remove('flip'), 240);
      el.innerHTML = svgFace(t.face);
      el.setAttribute('aria-label', `${faceName(t.face)} tile, peeked`);
    },

    /** Flip a peeked (or ghost-previewed) tile back to its candy back. */
    unpeek(t) {
      const el = els.get(t.id);
      if (!el || !el.classList.contains('peeked')) return;
      el.classList.remove('peeked');
      el.classList.add('facedown');
      el.classList.add('flip');
      setTimeout(() => el.classList.remove('flip'), 240);
      // t.face must exist — hidden tiles carry their real dealt face in state
      el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#tile-back"/></svg>`;
      el.setAttribute('aria-label', 'facedown tile'); // next refreshFree adds free/blocked
    },

    /** §5.1 ghost-flip preview: show the dealt face briefly with the hint pulse, then
     *  restore the back — unless `keepShowing()` says the tile became a real peek. */
    ghostFlip(t, keepShowing) {
      const el = els.get(t.id);
      if (!el) return;
      this.peek(t);
      this.pulse(el); // 2 pulses then fade (§5.1)
      setTimeout(() => { if (!keepShowing()) this.unpeek(t); }, 1150);
    },

    /** Hint pulse: 2 pulses then fade (pure glow — no transform, safe on minis too). */
    pulse(el) {
      if (!el) return;
      el.classList.remove('hint');
      void el.offsetWidth;
      el.classList.add('hint');
      const done = () => { el.classList.remove('hint'); };
      let n = 0;
      const iter = () => { n += 1; if (n < 2) { void el.offsetWidth; } else el.removeEventListener('animationiteration', iter); };
      el.addEventListener('animationiteration', iter);
      setTimeout(done, 1500); // 2 × 700 ms pulses + fade margin (§9.5 ≤ 400 ms rarely held — hint glows are presentation-only)
    },

    /** Purely cosmetic: bank-flight of `el` from its board spot to slot `slot`.
        The board cell is already freed logically (§14.2). Reuses the tile node.
        Coords are stage-design-space (#fx is a child of #stage). */
    flyToBank(el, t, T, slotEl, onLanded) {
      const fx = document.getElementById('fx');
      const sx = areaEl.offsetLeft + gridEl.offsetLeft + t.col * T;
      const sy = areaEl.offsetTop + gridEl.offsetTop + t.row * T;
      const dx = slotEl.offsetLeft + (slotEl.offsetWidth - T) / 2 - sx;
      const dy = slotEl.offsetTop + (slotEl.offsetHeight - T) / 2 - sy;
      // reparent into the fx layer (stage-space coords)
      fx.appendChild(el);
      el.classList.remove('blocked', 'deny');
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      el.style.transform = 'translate3d(0,0,0)';
      el.classList.add('flight');
      void el.offsetWidth; // commit the start pose — inserted elements need one reflow
      requestAnimationFrame(() => {
        el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
      });
      // Landing resolution: transitionend when possible, timer otherwise —
      // prefers-reduced-motion flattens the transition, so the event may never fire.
      let landed = false;
      const land = () => {
        if (landed) return;
        landed = true;
        flights.delete(f);
        // pop/serve logic resolves at landing (§3.3 tap-order ledger)
        onLanded();
        el.remove();
      };
      const f = { cancel: () => { landed = true; el.remove(); } };
      flights.add(f);
      el.addEventListener('transitionend', land, { once: true });
      setTimeout(land, 380); // ≥ the 350 ms flight budget (§16)
    },

    /** Tear down all in-air flights without resolving them (undo / shuffle / new deal
     *  replace the state wholesale — the flight's onLanded must never fire afterwards). */
    cancelFlights() {
      for (const f of flights) f.cancel();
      flights.clear();
      const fx = document.getElementById('fx');
      fx.querySelectorAll('.tile.flight').forEach((el) => el.remove());
    },
  };
}

/** Bank ("tin") view: mini tiles, landing reveal, auto-pop, pre-seal warning tint (§9.5). */
export function createBankView(bankEl) {
  const slots = [...bankEl.children];
  const mini = (face) => {
    const m = document.createElement('div');
    m.className = `mini tface ${keyClass(face)}`;
    m.innerHTML = svgFace(face);
    m.classList.add('pending'); // invisible until its flight lands
    return m;
  };

  return {
    slotEls: slots,

    /** Create the pending mini for a banked tile. */
    bank(slot, face) {
      slots[slot].querySelectorAll('.mini').forEach((m) => m.remove());
      slots[slot].appendChild(mini(face));
    },

    /** Reveal the mini once its flight touches down (§3.3). */
    land(slot) {
      const m = slots[slot]?.querySelector('.mini.pending');
      if (m) { m.classList.remove('pending'); m.classList.add('landed'); }
    },

    /** Auto-pop both pair slots (§9.5): pop animations, then clear. */
    popSlots(a, b) {
      for (const s of [a, b]) {
        const m = slots[s]?.querySelector('.mini');
        if (!m) continue;
        m.classList.remove('landed', 'pending');
        m.classList.add('popping');
        setTimeout(() => m.remove(), 280);
      }
    },

    /** Clear the slot (e.g. fresh deal). */
    clearAll() {
      slots.forEach((s) => s.querySelectorAll('.mini').forEach((m) => m.remove()));
      slots.forEach((s) => s.classList.remove('warn'));
    },

    /** Resync the tin from state (§5.4 undo / §5.2 shuffle keep bank contents; undo
     *  restores a previous arrangement). All minis land instantly, no flights. */
    syncBank(bankFaces) {
      slots.forEach((s) => s.querySelectorAll('.mini').forEach((m) => m.remove()));
      slots.forEach((s) => s.classList.remove('warn'));
      bankFaces.forEach((face, i) => {
        if (!face) return;
        const m = mini(face);
        m.classList.remove('pending');
        m.classList.add('landed');
        slots[i].appendChild(m);
      });
    },

    /** Pre-seal telegraph (§3.6/§9.5): when 3 DISTINCT faces are banked, the open
        slot takes a warning tint. bank: array of ids|null per state (use faces). */
    warnStale(bankFaces) {
      const occupied = bankFaces.filter((f) => f);
      const distinct = new Set(occupied).size;
      const open = bankFaces.findIndex((f) => !f);
      slots.forEach((s) => s.classList.remove('warn'));
      if (occupied.length === 3 && distinct === 3 && open !== -1) slots[open].classList.add('warn');

    },
  };
}
