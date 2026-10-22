/* settings.js — §9.4 Settings (§12.2 inert Music; §10.4 no theme chips in v1;
   §13 destructive Reset needs double-confirm — main.js owns that dialog). */
import { STR } from '../../data/i18n.js';
import { getStore, setSetting } from '../../data/store.js';

const ROWS = [
  { k: 'sfx', icon: '🔊', label: 'Sound effects' },
  { k: 'music', icon: '🎵', label: 'Music', inert: true },
  { k: 'highlightFree', icon: '💡', label: 'Highlight free tiles' },
  { k: 'reduceMotion', icon: '🌙', label: 'Reduce motion' },
];

export function createSettingsScr(root, onChange, onResetRequest, onBack) {
  root.innerHTML = `
    <header class="scr-head">
      <button class="hbtn" id="set-back" aria-label="${STR.backAria}">←</button>
      <h2 class="scr-title">${STR.setTitle}</h2>
    </header>
    <div id="set-rows"></div>
  `;
  root.querySelector('#set-back').addEventListener('click', onBack);

  const rowsEl = root.querySelector('#set-rows');

  for (const row of ROWS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'setrow' + (row.inert ? ' inert' : '');
    b.dataset.k = row.k;
    b.innerHTML =
      `<span class="ric">${row.icon}</span>` +
      `<span class="lbl"></span>` +
      `<span class="switch" aria-hidden="true"><i></i></span>`;
    rowsEl.appendChild(b);
  }

  // §12.2: the music note sits under the Music row
  const musicNote = document.createElement('p');
  musicNote.className = 'setnote';
  rowsEl.appendChild(musicNote);

  // §13 destructive row (double-confirm lives in main's #dlg-reset)
  const resetRow = document.createElement('button');
  resetRow.type = 'button';
  resetRow.className = 'setrow danger';
  resetRow.innerHTML =
    `<span class="ric">🗑️</span><span class="lbl" id="set-reset"></span>` +
    `<span class="hint"></span>`;
  resetRow.addEventListener('click', onResetRequest);
  rowsEl.appendChild(resetRow);

  rowsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.setrow');
    if (!b?.dataset.k) return; // reset row owns its click
    const k = b.dataset.k;
    if (k === 'music') return; // §12.2 locked: visible but inert in v1
    const next = !getStore().settings[k];
    setSetting(k, next);
    onChange(k, next);
    refresh();
  });

  /** Re-read the store: labels, switch states. */
  function refresh() {
    const s = getStore().settings;
    for (const row of ROWS) {
      const b = rowsEl.querySelector(`.setrow[data-k="${row.k}"]`);
      b.querySelector('.lbl').textContent = row.label;
      const on = !!s[row.k];
      b.querySelector('.switch').setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', `${row.label}: ${on ? 'on' : 'off'}`);
    }
    musicNote.textContent = STR.setMusicNote;
    resetRow.querySelector('#set-reset').textContent = STR.setReset;
    resetRow.querySelector('.hint').textContent = STR.setResetHint;
  }
  refresh();

  return { refresh };
}
