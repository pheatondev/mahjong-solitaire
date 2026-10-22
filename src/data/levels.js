/* levels.js — level JSON fetch + parse + §7.1 validation (GDD §7.1).
   Pure module (no DOM, no globals): also importable by the dev validator runner
   `node scripts/validate.mjs`. The game runtime validates every level and
   console-warns + skips invalid ones in dev (§7.1). */

export const SCHEMA = {
  colsMin: 8,
  colsMax: 14, // locked: 14 × 26 px min tile = 364 px ≤ stage width (§7.1/§14.2)
  rowsMin: 6,
  rowsMax: 12,
};

function tileCountOf(layers) {
  return layers.reduce(
    (n, rows) => n + rows.reduce((m, str) => m + (typeof str === 'string' ? [...str].filter((ch) => ch !== '.').length : 0), 0), 0);
}

/** Validate the structural shape of one level; returns an array of issue strings. */
function validateLevel(l) {
  const issues = [];
  const at = (m) => issues.push(m);
  if (typeof l.id !== 'number' || !Number.isInteger(l.id) || l.id < 1) return [`bad id "${l.id}"`];
  if (typeof l.name !== 'string' || !l.name.trim()) at(`level ${l.id}: missing name`);
  if (l.t2 != null && typeof l.t2 !== 'number') at(`level ${l.id}: t2 must be null or a number`);
  if (l.t3 != null && typeof l.t3 !== 'number') at(`level ${l.id}: t3 must be null or a number`);
  if (!Array.isArray(l.layers) || l.layers.length === 0) { at(`level ${l.id}: no layers`); return issues; }

  // Layers bottom→top; each layer = array of equal-length strings (§7.1). '.' = empty,
  // any visible glyph = a footprint. Whitespace is not "visible" and is rejected loudly.
  let cols = 0, rowsN = 0;
  l.layers.forEach((rows, L) => {
    if (!Array.isArray(rows) || rows.length === 0) { at(`level ${l.id} layer ${L}: empty`); return; }
    rowsN = Math.max(rowsN, rows.length);
    let len = -1;
    rows.forEach((str, r) => {
      if (typeof str !== 'string') { at(`level ${l.id} layer ${L} row ${r}: not a string`); return; }
      if (len === -1) len = str.length;
      else if (str.length !== len) at(`level ${l.id} layer ${L}: ragged row ${r} (${str.length} vs ${len} cols)`);
      cols = Math.max(cols, len);
      if (/ /.test(str)) at(`level ${l.id} layer ${L} row ${r}: blank-space glyphs are invalid (use ".")`);
    });
  });

  // §7.1 board rectangle bounds (cols locked 8–14, rows 6–12)
  if (cols < SCHEMA.colsMin || cols > SCHEMA.colsMax) {
    at(`level ${l.id}: cols=${cols} outside ${SCHEMA.colsMin}–${SCHEMA.colsMax} (locked)`);
  }
  if (rowsN < SCHEMA.rowsMin || rowsN > SCHEMA.rowsMax) {
    at(`level ${l.id}: rows=${rowsN} outside ${SCHEMA.rowsMin}–${SCHEMA.rowsMax}`);
  }

  // Layer L>0 tiles must sit on a layer-(L−1) footprint — no floating tiles (§7.1)
  for (let L = 1; L < l.layers.length; L++) {
    const below = l.layers[L - 1];
    (l.layers[L] || []).forEach((str, r) => {
      if (typeof str !== 'string') return;
      [...str].forEach((ch, c) => {
        if (ch === '.') return;
        if ((below[r]?.[c] ?? '.') === '.') at(`level ${l.id}: floating tile at layer ${L}, row ${r}, col ${c} (§7.1)`);
      });
    });
  }

  // Parity + hidden cap (§7.1): even tiles; 0 ≤ hidden ≤ floor(tiles/4);
  // teaching pacing → hidden = 0 for levels 1–12.
  const tiles = tileCountOf(l.layers);
  if (tiles % 2 !== 0) at(`level ${l.id}: ${tiles} tiles is odd (must be even — pairs)`);
  const hidden = l.hidden ?? 0;
  const cap = Math.floor(tiles / 4);
  if (hidden < 0 || hidden > cap) at(`level ${l.id}: hidden=${hidden} outside 0…${cap} (≤ 25% fog share)`);
  if (hidden !== 0 && l.id <= 12) at(`level ${l.id}: hidden=${hidden} — teaching pacing wants hidden=0 for levels 1–12 (§7.1)`);

  return issues;
}

/**
 * Validate a chapter JSON object per §7.1. Result:
 *   { chapterIssues: string[], levelIssues: Array<Array<string>> }
 * `opts.full` additionally enforces the M2 content shape (exactly 12 consecutive
 * levels per chapter, §6).
 */
export function validateChapter(json, opts = {}) {
  const chapterIssues = [];
  const levelIssues = [];
  if (!json || typeof json !== 'object') return { chapterIssues: ['chapter: not an object'], levelIssues: [] };
  if (typeof json.chapter !== 'string' || !json.chapter.trim()) chapterIssues.push('chapter: missing name');
  if (typeof json.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(json.accent)) chapterIssues.push(`chapter: accent "${json.accent}" is not a #rrggbb hex`);
  if (!Array.isArray(json.levels) || json.levels.length === 0) { chapterIssues.push('levels: missing/empty array'); return { chapterIssues, levelIssues }; }

  if (opts.full && json.levels.length !== 12) {
    chapterIssues.push(`levels: chapter ${opts.chapterIndex ?? '?'} must hold exactly 12 levels (§6), found ${json.levels.length}`);
  }

  const startId = opts.chapterIndex != null ? (opts.chapterIndex - 1) * 12 + 1 : null;
  json.levels.forEach((l, idx) => {
    const issues = validateLevel(l);
    if (opts.full && startId != null && l.id !== startId + idx) {
      issues.push(`level: id ${l.id} out of sequence (expected ${startId + idx})`);
    }
    levelIssues[idx] = issues;
  });
  return { chapterIssues, levelIssues };
}

/**
 * Parse + validate a chapter; invalid levels are console-warned and SKIPPED
 * (§7.1: "validated at runtime, console-warn + skip level in dev").
 */
export function parseChapter(json, opts = {}) {
  const { chapterIssues, levelIssues } = validateChapter(json, opts);
  if (chapterIssues.length) console.warn('[§7.1] chapter issues:', chapterIssues);
  const levels = [];
  if (Array.isArray(json?.levels)) {
    json.levels.forEach((l, idx) => {
      const issues = levelIssues[idx];
      if (issues && issues.length) {
        console.warn(`[§7.1] skipping level ${l?.id}:`, issues);
        return;
      }
      levels.push(finishLevel(l));
    });
  }
  return { chapter: json?.chapter ?? '?', accent: json?.accent ?? '#ff5d8f', levels, issues: chapterIssues };
}

/** Normalize a validated level: tileCount, parsed cells, flat positions list. */
function finishLevel(l) {
  const cells = l.layers.map((rows) => rows.map((str) => [...str]));
  const positions = [];
  cells.forEach((rows, layer) => {
    rows.forEach((rowCells, row) => {
      rowCells.forEach((ch, col) => {
        if (ch !== '.') positions.push({ layer, row, col });
      });
    });
  });
  return {
    id: l.id,
    name: l.name,
    t2: l.t2 ?? null, // null → §4.2 formula defaults, applied by score.js thresholds()
    t3: l.t3 ?? null,
    hidden: l.hidden ?? 0,
    tileCount: tileCountOf(l.layers),
    layers: l.layers, // raw ASCII (§8.1 dealer input)
    cells,
    positions,
  };
}
