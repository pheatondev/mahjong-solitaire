/* stats.js — §9.4 Stats screen: six lifetime cards, no charts in v1.
   Semantics (user-ruled): matches = pop events; pairsCleared = 2 × matches. */
import { STR } from '../../data/i18n.js';
import { getStore, totalStars } from '../../data/store.js';

const STARS_TOTAL = 180; // 60 levels × 3 stars (§6)

export function createStatsScr(root, onBack) {
  root.innerHTML = `
    <header class="scr-head">
      <button class="hbtn" id="stats-back" aria-label="${STR.backAria}">←</button>
      <h2 class="scr-title">${STR.statsTitle}</h2>
    </header>
    <div id="stats-grid"></div>
    <p id="stats-foot">${STR.statsFoot}</p>`;

  root.querySelector('#stats-back').addEventListener('click', onBack);

  const grid = root.querySelector('#stats-grid');

  /** Read the store and refill the six cards. */
  function refresh() {
    const s = getStore().stats;
    const cards = [
      { v: String(s.pairsCleared), l: STR.stPaired },
      { v: String(s.matches), l: STR.stMatches },
      { v: `×${s.bestCombo}`, l: STR.stCombo },
      { v: String(s.levelsCompleted), l: STR.stLevels },
      { v: String(s.bankFails), l: STR.stOverflow },
      { v: STR.starCount(totalStars(), STARS_TOTAL), l: STR.stStars, star: true },
    ];
    grid.innerHTML = cards
      .map((c) => `<div class="stcard${c.star ? ' gold' : ''}">` +
        `<span class="stv">${c.v}</span><span class="stl">${c.l}</span></div>`)
      .join('');
  }

  return { refresh };
}
