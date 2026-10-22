/* level-select.js — §9.4 M2 slice: chapter-accented headers + a 4-column grid of
   levels (number + best-star pips from §13 store). Sequential unlock (§6); the
   frontier level (id === unlocked) pulses. Tap callbacks go to main.js. */

import { STR } from '../data/i18n.js';

/** @param {HTMLElement} scrollEl #lvl-scroll · @param {HTMLElement} titleEl #lvl-title
 *  @param {(lvl: object) => void} onTap */
export function createLevelSelect(scrollEl, titleEl, onTap) {
  /** @param {{chapter:string, accent:string, levels:Array}} chapters
   *  @param {{progress:{unlocked:number, best:object}}} storeData */
  function render(chapters, storeData) {
    titleEl.textContent = STR.levelsTitle;
    scrollEl.textContent = '';
    const unlocked = storeData.progress.unlocked;
    const best = storeData.progress.best;

    // §9.4: lifetime total stars in the header ( ★ X / 180 )
    let total = 0;
    for (const rec of Object.values(best)) total += rec?.stars ?? 0;
    let starChip = document.getElementById('lvl-stars');
    if (starChip) starChip.textContent = STR.starsTotal(total, chapters.reduce((a, c) => a + c.levels.length, 0) * 3);

    for (const ch of chapters) {
      const block = document.createElement('div');
      block.className = 'chap';
      block.style.setProperty('--chap', ch.accent); // chapter accent on the header (§6)

      const h3 = document.createElement('h3');
      const lo = ch.levels[0]?.id ?? 0, hi = ch.levels[ch.levels.length - 1]?.id ?? 0;
      h3.textContent = STR.chapterHead(ch.chapter, lo, hi);

      const grid = document.createElement('div');
      grid.className = 'lgrid';
      for (const lvl of ch.levels) {
        const locked = lvl.id > unlocked;
        const b = document.createElement('button');
        b.className = 'lbtn' + (locked ? ' locked' : '') + (lvl.id === unlocked ? ' current' : '');
        b.setAttribute('aria-label', STR.levelAria(lvl.id, locked));

        const num = document.createElement('span');
        num.textContent = String(lvl.id);
        b.appendChild(num);

        const rec = best[String(lvl.id)];
        if (rec) {
          const st = document.createElement('span');
          st.className = 'st';
          st.innerHTML = [0, 1, 2]
            .map((i) => `<span${i < rec.stars ? ' class="lit"' : ''}>★</span>`)
            .join('');
          b.appendChild(st);
        }
        if (!locked) b.addEventListener('click', () => onTap(lvl));
        grid.appendChild(b);
      }

      block.appendChild(h3);
      block.appendChild(grid);
      scrollEl.appendChild(block);
    }
  }

  return { render };
}
