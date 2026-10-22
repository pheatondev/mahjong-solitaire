/* home.js — §9.4 Home: the game's front porch. Play = the frontier level (§3.4:
   a mid-level quit abandons the attempt, so "continue" always means unlocked). */
import { STR } from '../../data/i18n.js';

const miniTile = (face, key, deg) =>
  `<div class="logo-tile tface" style="rotate:${deg}deg" aria-hidden="true">` +
  `<i class="chip ${key}"></i>` +
  `<svg viewBox="0 0 100 100"><use href="#tile-${face}"/></svg></div>`;

export function createHomeScr(root, { play, levels, stats, settings }) {
  root.innerHTML = `
    <div class="home-top">
      <div class="logo-tiles">
        ${miniTile('b5', 'key-b', -11)}${miniTile('d3', 'key-d', 8)}${miniTile('drR', 'key-drR', -4)}
      </div>
      <h1 class="wordmark">Mahjong<br>Lite</h1>
      <p class="tagline">${STR.homeTagline}</p>
    </div>
    <nav class="home-btns">
      <button class="menu-btn primary" id="hb-play"></button>
      <button class="menu-btn" id="hb-levels"></button>
      <button class="menu-btn" id="hb-stats"></button>
      <button class="menu-btn" id="hb-settings"></button>
    </nav>
    <footer class="home-foot">
      <p>${STR.homeFootA}</p>
      <p>${STR.homeFootB}</p>
    </footer>`;

  const $ = (s) => root.querySelector(s);
  $('#hb-play').addEventListener('click', play);
  $('#hb-levels').addEventListener('click', levels);
  $('#hb-stats').addEventListener('click', stats);
  $('#hb-settings').addEventListener('click', settings);

  /** Home copy is static in v1 (labels above); jingle timing is main.js's call. */
  function show() {
    $('#hb-play').textContent = STR.homePlay;
    $('#hb-levels').textContent = STR.homeLevels;
    $('#hb-stats').textContent = STR.homeStats;
    $('#hb-settings').textContent = STR.homeSettings;
  }

  return { show };
}
