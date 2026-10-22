/* fx.js — pooled DOM confetti on the #fx layer (§16: ~60 nodes max, no GC churn).
   Bursts are small mark-for-finish spans animated with the Web Animations API; the
   pool is pre-created and absolutely hidden. Reduce motion collapses any burst to
   one gentle sparkle (§17). Pure view module — positions arrive in stage-space px. */

const POOL_N = 60;
const POOL = ['#ff5d8f', '#fffdf7', '#ffd9e8', '#4aa3ff', '#3ec46d', '#ff4d4d', '#7a5cff', '#ffcb3d'];

export function createFx(fxEl, isReduced) {
  const pool = [];
  for (let i = 0; i < POOL_N; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.hidden = true;
    fxEl.appendChild(s);
    pool.push(s);
  }
  let cursor = 0;

  function take() {
    // round-robin steal: the oldest live particle yields its node
    for (let i = 0; i < POOL_N; i++) {
      const s = pool[(cursor + i) % POOL_N];
      if (!s.hidden) { s.hidden = true; return s; }
    }
    return pool[cursor % POOL_N];
  }

  /** One candy burst at (x, y) stage-px. `n` halves on reduce-motion to 1 sparkle. */
  function burst(x, y, { n = 14, spread = 34, colors = POOL } = {}) {
    const reduced = isReduced();
    const count = reduced ? 1 : Math.min(n, POOL_N);
    for (let i = 0; i < count; i++) {
      const s = i === 0 ? take() : findIdle() ?? take();
      const a = reduced ? -Math.PI / 2 : Math.random() * Math.PI * 2;
      const r = reduced ? 30 : radiusRandom(spread);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r + (reduced ? -18 : rand(14, 40)); // gentle fall bias
      const rot = reduced ? 0 : rand(-240, 240);
      const size = reduced ? 9 : rand(4, 9);
      s.hidden = false;
      s.style.left = `${x - size / 2}px`;
      s.style.top = `${y - size / 2}px`;
      s.style.width = `${size}px`;
      s.style.height = `${size}px`;
      s.style.borderRadius = Math.random() < 0.5 ? '50%' : '3px';
      s.style.background = colors[i % colors.length];
      s.animate(
        [
          { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rot}deg) scale(${reduced ? 1.2 : rand(0.4, 1)})`, opacity: 0 },
        ],
        { duration: reduced ? 500 : rand(380, 720), easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' },
      ).onfinish = () => { s.hidden = true; };
    }
    cursor += count;
  }

  function findIdle() {
    for (const s of pool) if (s.hidden) return s;
    return null;
  }

  function clear() {
    for (const s of pool) { s.hidden = true; s.getAnimations().forEach((a) => a.cancel()); }
  }

  return { burst, clear };
}

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const radiusRandom = (spread) => spread * (0.35 + Math.random() * 0.75);
