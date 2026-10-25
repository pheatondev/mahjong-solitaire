/* audio.js — §12 synthesized SFX: pure Web Audio, zero assets, one SfxBus master
   muted by the persisted `settings.sfx` (§12.2: music is v1-inert). The AudioContext
   is created lazily and unlocked on the first user gesture (main.js binds it), per
   the iOS autoplay policy. Every recipe is sub-500 ms and gain-capped so play never
   drowns the game. */
import { clamp } from '../util.js';

export function createAudio(getSfxOn) {
  let ctx = null;
  let master = null;

  /** v0.3.9 user ruling: everything plays ×1.4 through the master bus — uniform,
   *  so the tuned relative mix (pop vs bell vs thock) is preserved. Far below the
   *  clip ceiling even when recipes stack (win arpeggio peaks ≈ 0.28). */
  const SFX_LEVEL = 1.4;

  /** Create/resume the context + master bus. Returns null silently if unsupported. */
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = getSfxOn() ? SFX_LEVEL : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* autoplay-blocked; unlock() will retry on a real gesture */ });
    return ctx;
  }

  /** Live mute flip when settings change (§13 write trigger via setSetting). */
  function applyMute() {
    if (master) master.gain.setTargetAtTime(getSfxOn() ? SFX_LEVEL : 0, ctx?.currentTime ?? 0, 0.01);
  }

  /** One oscillator voice with optional gain envelope + sweep + pre-gain filter. */
  function tone({ type = 'sine', f0, f1 = null, dur = 0.12, gain = 0.06, delay = 0, filter = null }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const flt = filter ? ctx.createBiquadFilter() : null;
    if (flt) {
      flt.type = filter.type ?? 'lowpass';
      flt.frequency.setValueAtTime(filter.f0 ?? 1200, t0);
      flt.Q.value = filter.q ?? 0.8;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    (flt ?? o).connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Filtered white-noise burst (swishes/thumps/sprinkles — no asset). */
  function noise({ dur = 0.2, gain = 0.04, f0 = 1000, f1 = null, type = 'bandpass', q = 1, delay = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t0);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(master);
    src.start(t0);
  }

  // C-major pentatonic bell ladder for combo steps — cap ×8 (§12.1)
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  const stepPitch = (n) => 880 * Math.pow(2, PENTA[clamp(n - 1, 0, 7)] / 12);

  return {
    /** First-gesture unlock (§12): resume ctx, tiny brand jingle. */
    unlock() {
      if (!ensure()) return;
      tone({ type: 'triangle', f0: 659, f1: 784, dur: 0.12, gain: 0.045 });
      tone({ type: 'sine', f0: 1319, dur: 0.14, gain: 0.025, delay: 0.07 });
    },

    applyMute,

    /** Home/menu jingle — plays ONLY if audio is already unlocked+running (§9.4);
     *  it must never create an autoplay-blocked context (that's unlock()'s job). */
    jingle() {
      if (!ctx || ctx.state !== 'running') return;
      [0, 7, 12].forEach((st, i) =>
        tone({ type: 'triangle', f0: 659 * Math.pow(2, st / 12), dur: 0.18, gain: 0.04, delay: i * 0.1 }));
    },

    /** Blocked tap: muted plink (sine 660→520, 60 ms). */
    deny() {
      tone({ f0: 660, f1: 520, dur: 0.06, gain: 0.04, filter: { type: 'lowpass', f0: 1300 } });
    },

    /** Match + combo ladder step (banked auto-pop reuses this, §12.1 note). */
    match(comboN) {
      noise({ dur: 0.06, gain: 0.05, f0: 900, q: 0.7 });        // candy pop
      tone({ type: 'triangle', f0: 180, dur: 0.08, gain: 0.06 }); // thump
      tone({ type: 'sine', f0: stepPitch(comboN ?? 1), dur: 0.12, gain: 0.045, delay: 0.02 }); // bell
    },

    shuffle() { noise({ dur: 0.35, gain: 0.045, f0: 400, f1: 1200, q: 0.6 }); },

    undo() { tone({ f0: 200, f1: 400, dur: 0.12, gain: 0.04 }); },

    dialog() { tone({ type: 'sawtooth', f0: 150, f1: 110, dur: 0.25, gain: 0.04, filter: { type: 'lowpass', f0: 800 } }); },

    /** Win: 6-note major arpeggio + noise sprinkle + sparkle decay. */
    win() {
      [0, 4, 7, 12, 16, 24].forEach((st, i) =>
        tone({ type: 'triangle', f0: 523.25 * Math.pow(2, st / 12), dur: 0.22, gain: 0.06, delay: i * 0.09 }));
      noise({ dur: 0.5, gain: 0.025, f0: 3000, f1: 8000, q: 0.5, delay: 0.1 });
    },

    starPing(i) { tone({ type: 'sine', f0: 880 * Math.pow(2, i / 12), dur: 0.16, gain: 0.05 }); },

    flip() { noise({ dur: 0.2, gain: 0.035, f0: 200, f1: 2000, q: 1.2 }); },
    flipBack() { noise({ dur: 0.12, gain: 0.018, f0: 2000, f1: 200, q: 1.2 }); },

    ghost() { tone({ type: 'sine', f0: 880, dur: 0.1, gain: 0.03 }); },

    flight() { tone({ f0: 300, f1: 700, dur: 0.3, gain: 0.03 }); },
    land() { noise({ dur: 0.08, gain: 0.05, f0: 500, f1: 200, q: 1.4 }); },

    /** Tin seal (fail): playful slide-whistle down (saw 600→180, 500 ms). */
    seal() {
      tone({ type: 'sawtooth', f0: 600, f1: 180, dur: 0.5, gain: 0.04, filter: { type: 'lowpass', f0: 1400 } });
    },
  };
}
