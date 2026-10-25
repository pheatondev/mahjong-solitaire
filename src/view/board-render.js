/* board-render.js — DOM tile grid, bank ("tin") view, and cosmetic flights (§14.2).
   Positioning is translate3d-based; z-index = 100 + layer×10; only targeted class
   updates — never a full board re-render per move (§14.2). Flights/pops are purely
   cosmetic and non-blocking (§14.2 locked ruling). */

import { clamp } from '../util.js';
import { SCHEMA } from '../data/levels.js';
import { faceFile } from '../data/assets.js';
import { faceName } from '../data/i18n.js';

/** Per-layer vertical offset (§14.2, v0.3.4): upper layers shift UP by DY so the
 *  lower tile's baked-in bottom edge peeks out — stacks read at a glance. */
const DY = 7;

/** v0.3.8: in-flight registry (face → flight). Pending minis are face-keyed, so
    the bank reconcile consults this (not slot indices) to spare them; removed on
    every landing/cancel. Shared by the board and bank views. */
const slotFlights = new Map();
let SPREAD = 0; // row-0 baseline shift (headroom for the tallest stack), set by fit()

const imgFace = (face) => `<img src="${faceFile(face)}" alt="" aria-hidden="true" draggable="false">`;
const backFace = () => `<i class="back" aria-hidden="true"></i>`;

/** Fit formula (§14.2, v0.3.5): portrait tiles — sprite-native 5:7 aspect — at a
 *  UNIFORM size across all levels. The fit depends only on the board area and
 *  the global worst case (5 cols × 8 rows × 7-layer stack ⇒ 6 offsets), never
 *  on the level's own shape: th = min((aw·7/5)/5, (ah − 6·DY)/8). At the
 *  390×844 stage this is ≈ 52 × 72.75 design px (1.46× the v0.3.4 fit). */
export function computeFit(areaEl, cols, rows) {
  const padX = 5;
  const padY = 2; // v0.3.7: vertical breathing 5→2 — the 80px portrait tin + 48px HUD
  // consume the box so the height term stays exactly (ah − 4 − 42)/8 = 72.75
  const aw = areaEl.clientWidth - padX * 2;
  const ah = areaEl.clientHeight - padY * 2;
  const LAYERS_MAX = 7; // §6: deepest stack (band F) climbs 7 layers
  const th = clamp(Math.min((aw / SCHEMA.colsMax) * 7 / 5, (ah - (LAYERS_MAX - 1) * DY) / SCHEMA.rowsMax), 26, 84);
  return { w: th * 5 / 7, h: th };
}

/** Create the DOM board view. */
export function createBoardView(gridEl, areaEl) {
  const els = new Map(); // tile id → element
  let tiles = [];
  let TW = 0, TH = 0; // uniform portrait tile dims (design px), set by fit()

  function buildTileEl(t) {
    const el = document.createElement('div');
    if (t.hidden) {
      // hidden tile (§3.5, v0.3.4): an entirely blank, solid slate tile — clearly
      // "unknown, turn me over", with no face/clue of any kind baked in
      el.className = 'tile facedown';
      el.innerHTML = backFace();
    } else {
      el.className = 'tile';
      el.innerHTML = imgFace(t.face);
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
        (batched once per fit — §16 no layout thrash). `fit` = {w, h} design px.
        Upper layers sit DY px higher — the strip below each upper tile reveals
        the covered tile's baked-in bottom edge (§14.2 v0.3.4). */
    fit(fit, cols, rows) {
      const aw = areaEl.clientWidth, ah = areaEl.clientHeight;
      ({ w: TW, h: TH } = fit);
      let maxLayer = 0;
      for (const t of tiles) if (t.layer > maxLayer) maxLayer = t.layer;
      const stackSpread = maxLayer * DY; // tallest stack rises above row 0
      SPREAD = stackSpread; // remembered for flight start poses (row 0 baseline shift)
      gridEl.style.setProperty('--tw', TW + 'px');
      gridEl.style.setProperty('--th', TH + 'px');
      gridEl.style.width = cols * TW + 'px';
      gridEl.style.height = rows * TH + stackSpread + 'px';
      gridEl.style.left = ((aw - cols * TW) / 2 | 0) + 'px';
      gridEl.style.top = ((ah - rows * TH - stackSpread) / 2 | 0) + 'px';
      for (const t of tiles) {
        const el = els.get(t.id);
        if (!el) continue;
        el.style.setProperty('--tx', t.col * TW + 'px');
        el.style.setProperty('--ty', t.row * TH - t.layer * DY + stackSpread + 'px');
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
      el.innerHTML = imgFace(t.face);
      el.setAttribute('aria-label', `${faceName(t.face)} tile, peeked`);
    },

    /** Flip a peeked (or ghost-previewed) tile back to its candy back.
     *  Returns whether a flip actually happened (an audio cue hangs off it). */
    unpeek(t) {
      const el = els.get(t.id);
      if (!el || !el.classList.contains('peeked')) return false;
      el.classList.remove('peeked');
      el.classList.add('facedown');
      el.classList.add('flip');
      setTimeout(() => el.classList.remove('flip'), 240);
      // t.face must exist — hidden tiles carry their real dealt face in state
      el.innerHTML = backFace();
      el.setAttribute('aria-label', 'facedown tile'); // next refreshFree adds free/blocked
      return true;
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
        Coords are stage-design-space (#fx is a child of #stage). Uses the
        portrait dims and layer offset recorded by the last fit(). */
    flyToBank(el, t, slotEl, onLanded) {
      const fx = document.getElementById('fx');
      const sx = areaEl.offsetLeft + gridEl.offsetLeft + t.col * TW;
      const sy = areaEl.offsetTop + gridEl.offsetTop + SPREAD + t.row * TH - t.layer * DY;
      const dx = slotEl.offsetLeft + (slotEl.offsetWidth - TW) / 2 - sx;
      const dyv = slotEl.offsetTop + (slotEl.offsetHeight - TH) / 2 - sy;
      // reparent into the fx layer (stage-space coords)
      fx.appendChild(el);
      el.classList.remove('blocked', 'deny');
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      // --tw/--th live on #grid and are not inherited into #fx — size the flight explicitly
      el.style.width = TW + 'px';
      el.style.height = TH + 'px';
      el.style.transform = 'translate3d(0,0,0)';
      // arrive at exactly the mini's reveal scale, so the land swap is seamless (§9.5)
      const miniBox = slotEl.clientHeight; // mini fills the slot content box = the tile cell (v0.3.7)
      const s0 = (miniBox * 0.86) / TH; // mini-land 0% keyframe scale
      el.style.transformOrigin = 'center';
      el.classList.add('flight');
      void el.offsetWidth; // commit the start pose — inserted elements need one reflow
      requestAnimationFrame(() => {
        el.style.transform = `translate3d(${dx}px,${dyv}px,0) scale(${s0})`;
      });
      // Landing resolution: transitionend when possible, timer otherwise —
      // prefers-reduced-motion flattens the transition, so the event may never fire.
      let landed = false;
      const land = () => {
        if (landed) return;
        landed = true;
        flights.delete(f);
        slotFlights.delete(t.face);
        // pop/serve logic resolves at landing (§3.3 tap-order ledger)
        onLanded();
        el.remove();
      };
      const f = { cancel: () => { landed = true; slotFlights.delete(t.face); el.remove(); } };
      slotFlights.set(t.face, f); // v0.3.8: the bank reconcile spares in-flight faces
      flights.add(f);
      el.addEventListener('transitionend', land, { once: true });
      setTimeout(land, 380); // ≥ the 350 ms flight budget (§16)
    },

    /** Tear down all in-air flights without resolving them (undo / shuffle / new deal
     *  replace the state wholesale — the flight's onLanded must never fire afterwards). */
    cancelFlights() {
      for (const f of flights) f.cancel();
      flights.clear();
      slotFlights.clear();
      const fx = document.getElementById('fx');
      fx.querySelectorAll('.tile.flight').forEach((el) => el.remove());
    },
  };
}

/** Bank ("tin") view v0.3.8 — face-keyed minis live directly in #bank, absolutely
 *  positioned and gliding between the packed slots (left-pack ruling: no banked
 *  tile keeps an empty slot to its left). Faces are unique in the bank at all
 *  times (identical twins auto-pop instantly), so the face is the mini's identity:
 *  reconcile can never clobber a flying tile's mini, and slot indices are pure
 *  presentation. Landing reveal, auto-pop, pre-seal warning tint (§9.5). */
export function createBankView(bankEl) {
  const slots = [...bankEl.querySelectorAll('.slot')]; // physical slot frames
  const minis = new Map(); // face → [el] (usually 1; a popping pair is 2 transiently)
  const poppingSoon = new Set(); // faces whose pop is resolved but lands later — reconcile spares them

  /** Slot geometry is read lazily and per use — at module-eval time #scr-game is
   *  still hidden (v0.3.6 boot splash), so every offset would be 0. All values
   *  are in the slots' offsetParent space (= #scr-game/stage coords). */
  const geo = () => {
    const s0 = slots[0];
    const bw = parseFloat(getComputedStyle(s0).borderLeftWidth); // 2.5
    return {
      baseX: s0.offsetLeft + bw,
      baseY: bankEl.offsetTop + (bankEl.clientHeight - s0.clientHeight) / 2,
      stride: slots[1].offsetLeft - s0.offsetLeft, // 69
      w: s0.clientWidth, h: s0.clientHeight, // 52 × 73 = the tile cell
    };
  };

  const make = (face, i, pending) => {
    const g = geo();
    const m = document.createElement('div');
    m.className = pending ? 'mini pending' : 'mini landed';
    m.dataset.face = face;
    m.innerHTML = imgFace(face);
    m.style.left = g.baseX + 'px';
    m.style.top = g.baseY + 'px';
    m.style.width = g.w + 'px';
    m.style.height = g.h + 'px';
    m.style.translate = `${i * g.stride}px 0`;
    minis.set(face, [...(minis.get(face) ?? []), m]);
    bankEl.appendChild(m);
    return m;
  };
  const one = (face) => (minis.get(face) ?? [])[0] ?? null;
  const each = (face, fn) => { for (const m of minis.get(face) ?? []) fn(m); };
  const drop = (face, el) => {
    const rest = (minis.get(face) ?? []).filter((x) => x !== el);
    if (rest.length) minis.set(face, rest); else minis.delete(face);
  };
  const firstFree = (bankFaces) => bankFaces.findIndex((f) => !f);
  const homeOf = (i) => { const g = geo(); return `${i * g.stride}px 0`; };

  return {
    slotEls: slots,

    /** Create the pending mini for a banked tile at its (post-pack) slot. */
    bank(face, i) {
      make(face, i, true);
    },

    /** Reveal the mini once its flight touches down (§3.3). */
    land(face) {
      const m = (minis.get(face) ?? []).find((x) => x.classList.contains('pending'));
      if (m) { m.classList.remove('pending'); m.classList.add('landed'); }
    },

    /** A pop resolved in state at tap time; its pair minis hold until touchdown. */
    holdPop(face) { poppingSoon.add(face); },

    /** Pop the pair out of the tin (§9.5): pop animation, then removal. */
    pop(face) {
      poppingSoon.delete(face);
      each(face, (m) => {
        m.classList.remove('landed', 'pending');
        m.classList.add('popping');
        setTimeout(() => { m.remove(); }, 280);
      });
      minis.delete(face);
    },

    /** v0.3.8 staggered left-pack glide: every mini eases to its state index as the
     *  popped pair bursts out. Order = left-first scan; per-tile 60 ms cascade. */
    slide(bankFaces, stagger = 0) {
      let moved = 0;
      bankFaces.forEach((face, i) => {
        if (!face) return;
        face = String(face);
        const el = one(face);
        if (!el) return;
        const target = homeOf(i);
        if (el.style.translate === target) return; // already home
        el.style.transitionDelay = `${moved * stagger}ms`;
        moved += 1;
        el.style.translate = target;
        el.addEventListener('transitionend', () => (el.style.transitionDelay = ''), { once: true });
      });
      return moved;
    },

    /** Clear the tin (e.g. fresh deal). */
    clearAll() {
      minis.forEach((els) => els.forEach((m) => m.remove()));
      minis.clear();
      poppingSoon.clear();
      slots.forEach((s) => s.classList.remove('warn'));
    },

    /** Resync the tin from state (§5.4 undo / §5.2 shuffle keep bank contents). */
    syncBank(bankFaces) {
      slots.forEach((s) => s.classList.remove('warn'));
      for (const [, els] of minis) els.forEach((m) => m.remove());
      minis.clear();
      poppingSoon.clear();
      bankFaces.forEach((face, i) => {
        if (face) make(String(face), i, false);
      });
    },

    /** v0.3.8 state-first reconcile (fixes banked-tile-goes-invisible): the tin DOM
     *  is only ever a projection of `state.bank`, re-asserted on every landing/tap.
     *  A pending mini whose face is in state is preserved (its own flight reveals
     *  it; slotFlights distinguishes an orphaned one — flight gone, never revealed —
     *  and promotes it to landed). Faces absent from state vanish unless their pop
     *  is still scheduled; state faces with no mini are rebuilt. */
    reconcile(bankFaces) {
      for (const [face, els] of [...minis]) {
        if (poppingSoon.has(face)) continue;
        let i = bankFaces.indexOf(face);
        if (i === -1) {
          els.forEach((m) => m.remove());
          minis.delete(face);
          continue;
        }
        for (const m of els) {
          if (m.classList.contains('pending')) {
            if (!slotFlights.has(face)) { m.classList.remove('pending'); m.classList.add('landed'); }
            else m.style.translate = homeOf(i); // invisible pending rides along
          } else if (m.style.translate !== homeOf(i)) {
            m.style.translate = homeOf(i);
            m.addEventListener('transitionend', () => (m.style.transitionDelay = ''), { once: true });
          }
        }
      }
      bankFaces.forEach((face, i) => {
        if (face && !minis.has(String(face))) make(String(face), i, false); // self-heal
      });
    },

    /** Pre-seal telegraph (§3.6/§9.5): when 3 DISTINCT faces are banked, the open
        slot takes a warning tint. bank: array of ids|null per state (use faces). */
    warnStale(bankFaces) {
      const occupied = bankFaces.filter((f) => f);
      const distinct = new Set(occupied).size;
      const open = firstFree(bankFaces);
      slots.forEach((s) => s.classList.remove('warn'));
      if (occupied.length === 3 && distinct === 3 && open !== -1) slots[open].classList.add('warn');
    },

    /** The (first) mini of a banked face — for hint pulses (§5.1). */
    miniEl(face) { return one(String(face)); },
  };
}
