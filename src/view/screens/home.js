/* home.js — §9.4 Home: the game's front porch. Play = the frontier level (§3.4:
   a mid-level quit abandons the attempt, so "continue" always means unlocked). */
import { STR } from '../../data/i18n.js';
import { faceFile } from '../../data/assets.js';

const miniTile = (face, deg) =>
  `<div class="logo-tile" style="rotate:${deg}deg" aria-hidden="true">` +
  `<img src="${faceFile(face)}" alt="" draggable="false"></div>`;

export function createHomeScr(root, { play, levels, stats, settings }) {
  root.innerHTML = `
    <div class="home-mid">
      <div class="home-top">
        <div class="logo-tiles">
          ${miniTile('b5', -11)}${miniTile('d3', 8)}${miniTile('drR', -4)}
        </div>
        <h1 class="wordmark">Mahjong<br>Smoosh</h1>
      </div>
      <nav class="home-btns">
        <button class="menu-btn primary" id="hb-play"></button>
        <button class="menu-btn" id="hb-levels"></button>
        <button class="menu-btn" id="hb-stats"></button>
        <button class="menu-btn" id="hb-settings"></button>
      </nav>
    </div>
    <footer class="home-foot">
      <p>${STR.homeFoot}</p>
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
