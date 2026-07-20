/*
 * AO program sync: reads the AO Fit / AO Strength / AO Power "Monthly Program"
 * pages from Notion and writes program.js (window.AO_PROGRAM).
 *
 * Requires env NOTION_TOKEN (an internal Notion integration token that has been
 * shared on the three program pages). Node 20+ (uses global fetch).
 *
 * If any class is missing one of the four phases, the script exits non-zero and
 * does NOT overwrite program.js, so a bad read never wipes good data.
 */
import { writeFileSync } from 'node:fs';

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error('ERROR: NOTION_TOKEN is not set.'); process.exit(1); }

const NOTION_VERSION = '2022-06-28';

// The three Notion "Monthly Program" pages:
const PAGES = {
  fit:      '24724e77f1c98048a7b4e9c0bc7e9647',
  strength: '24724e77f1c980e5a279d34b024feece',
  power:    '24724e77f1c980ecb15dcad8017eac4b',
};

const PHASES = ['Endurance', 'Hypertrophy', 'Power', 'Max Strength'];

async function api(path) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': NOTION_VERSION },
  });
  if (!res.ok) throw new Error(`Notion API ${res.status} for ${path}: ${await res.text()}`);
  return res.json();
}

async function children(blockId) {
  let out = [], cursor;
  do {
    const qs = new URLSearchParams({ page_size: '100' });
    if (cursor) qs.set('start_cursor', cursor);
    const j = await api(`/blocks/${blockId}/children?${qs}`);
    out = out.concat(j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

const richText = (arr) => (arr || []).map((t) => t.plain_text).join('').trim();

function phaseOf(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('max strength')) return 'Max Strength';
  if (t.includes('hypertrophy')) return 'Hypertrophy';
  if (t.includes('endurance')) return 'Endurance';
  if (t.includes('power')) return 'Power';
  return null;
}

// Normalise off-theme markers: "Speed**" or "Speed*" -> "Speed*" (single trailing star)
function normFocus(v) {
  const m = v.match(/^(.*?)\s*\*+$/);
  return m ? m[1].trim() + '*' : v.trim();
}

// For AO Fit / AO Strength: each phase heading is followed by a table whose
// second column holds the daily focus/split.
async function parseTablePage(pageId) {
  const blocks = await children(pageId);
  const out = {};
  let current = null;
  for (const b of blocks) {
    if (b.type && b.type.startsWith('heading_')) {
      const p = phaseOf(richText(b[b.type].rich_text));
      if (p) current = p;
    } else if (b.type === 'table' && current) {
      const rows = await children(b.id);
      const vals = [];
      rows.forEach((row, i) => {
        if (i === 0) return; // skip header row
        const cells = row.table_row.cells;
        const cell = cells[1] || cells[cells.length - 1];
        const v = richText(cell);
        if (v) vals.push(normFocus(v));
      });
      if (vals.length) out[current] = vals;
      current = null; // one table per phase heading
    }
  }
  return out;
}

// For AO Power: each phase heading is followed by bullets like
// "Strength: EMOM 10-12 reps" and "Conditioning: 4 min @ ...".
async function parsePowerPage(pageId) {
  const blocks = await children(pageId);
  const out = {};
  let current = null;
  for (const b of blocks) {
    if (b.type && b.type.startsWith('heading_')) {
      const p = phaseOf(richText(b[b.type].rich_text));
      if (p) { current = p; out[current] = out[current] || { strength: '', cond: '' }; }
    } else if (current && (b.type === 'bulleted_list_item' || b.type === 'paragraph')) {
      const txt = richText(b[b.type].rich_text);
      if (!txt) continue;
      const low = txt.toLowerCase();
      const val = txt.includes(':') ? txt.slice(txt.indexOf(':') + 1).trim() : txt;
      if (low.startsWith('strength')) out[current].strength = val;
      else if (low.startsWith('condition')) out[current].cond = val;
    }
  }
  return out;
}

function assertAllPhases(label, obj, check) {
  for (const p of PHASES) {
    if (!obj[p] || !check(obj[p])) throw new Error(`${label}: missing or empty phase "${p}"`);
  }
}

const fit = await parseTablePage(PAGES.fit);
const strength = await parseTablePage(PAGES.strength);
const power = await parsePowerPage(PAGES.power);

assertAllPhases('AO Fit', fit, (v) => Array.isArray(v) && v.length);
assertAllPhases('AO Strength', strength, (v) => Array.isArray(v) && v.length);
assertAllPhases('AO Power', power, (v) => v.strength);

const data = {
  fit:      { name: 'AO Fit',      days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], phases: fit },
  strength: { name: 'AO Strength', days: ['Mon','Tue','Wed','Thu','Fri','Sat'],       phases: strength },
  power:    { name: 'AO Power',     week: true,                                        phases: power },
};

const today = new Date().toISOString().slice(0, 10);
const js =
  '/* AO program data, auto-generated from Notion. Do not edit by hand. */\n' +
  'window.AO_PROGRAM = ' + JSON.stringify(data, null, 2) + ';\n' +
  'window.AO_PROGRAM_UPDATED = ' + JSON.stringify(today) + ';\n';

writeFileSync('program.js', js);
console.log('Wrote program.js (' + today + ')');
