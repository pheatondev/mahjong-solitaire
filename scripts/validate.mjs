#!/usr/bin/env node
/* scripts/validate.mjs — dev runner for the §7.1 validator (no build step: this is a
   verification command, not tooling in the deploy path — §2.1/§2.3).
   Usage:
     node scripts/validate.mjs data/levels-1.json            # structural check
     node scripts/validate.mjs data/levels-1.json 1 --full   # + M2 content shape (12 levels/chapter)
   Exits non-zero if any structural issue is found. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { validateChapter } from '../src/data/levels.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args[0];
const chapterIndex = args[1] ? Number(args[1]) : null;
const full = args.includes('--full');

if (!file) {
  console.error('usage: node scripts/validate.mjs <levels file> [chapterIndex] [--full]');
  process.exit(2);
}

const path = join(here, '..', file);
let json;
try {
  json = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error(`cannot read/parse ${file}: ${e.message}`);
  process.exit(2);
}

const { chapterIssues, levelIssues } = validateChapter(json, { chapterIndex, full });

let count = 0;
for (const m of chapterIssues) { console.error(`CHAPTER: ${m}`); count++; }
levelIssues.forEach((issues, idx) => {
  for (const m of issues) { console.error(`LEVEL idx=${idx}: ${m}`); count++; }
});

if (count === 0) {
  console.log(`OK — ${relative(process.cwd(), path) || file} passes §7.1 (${full ? 'structural + content shape' : 'structural'} checks)`);
} else {
  console.error(`FAIL — ${count} §7.1 issue(s) in ${file}`);
  process.exit(1);
}
