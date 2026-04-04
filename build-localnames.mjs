// build-localnames.mjs — one-time build step.
//
// Reads the Natural Earth populated places shapefile (for GeoNames IDs and
// country codes) and streams alternateNamesV2.txt to find the best local name
// for every city, then writes ne-localnames.json.
//
// Priority per city (applied at render time in getCityLabel):
//   1. GeoNames entry with isShortName=1  in the target language   ← stored here
//   2. NE shapefile field for the target language                   ← applied at render time
//   3. GeoNames preferred/any entry, only for languages the NE     ← stored here (no NE field)
//      shapefile does NOT cover (so NE curated short forms win)
//   4. NE NAME field (English)                                      ← applied at render time
//
// Usage:
//   node build-localnames.mjs
// Output:
//   ne-localnames.json  —  { "<geonamesId>": "<localName>", … }

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import shapefile from 'shapefile';
import { COUNTRY_LANG, LANG_NE_FIELD } from './localnames.mjs';

const ALT_NAMES_FILE = '../ne_10m_populated_places.dbf';  // NE shapefile
const GEONAMES_FILE  = `${process.env.HOME}/map/alternateNamesV2.txt`;
const OUTPUT_FILE    = './ne-localnames.json';

// ---------------------------------------------------------------------------
// Step 1: read NE shapefile → { geonamesId → targetLang }
// ---------------------------------------------------------------------------
process.stdout.write('Reading NE shapefile … ');

const src = await shapefile.openDbf(ALT_NAMES_FILE, { encoding: 'utf-8' });

// geonamesId (string) → target ISO 639-1 language code
const needed = new Map();

let rec;
while (!(rec = await src.read()).done) {
  const p    = rec.value;
  const gnId = String(p.GEONAMESID || '');
  if (!gnId || gnId === '0') continue;

  const lang = COUNTRY_LANG[p.ADM0_A3];
  if (!lang || lang === 'en') continue;   // English: NAME field is fine as-is

  needed.set(gnId, lang);
}

console.log(`${needed.size} cities need a localised name lookup.`);

// ---------------------------------------------------------------------------
// Step 2: stream alternateNamesV2.txt, collect candidates
// ---------------------------------------------------------------------------
// candidates: geonamesId → { short: string|null, preferred: string|null, any: string|null }
const candidates = new Map();
for (const [id, lang] of needed) {
  candidates.set(id, { lang, short: null, preferred: null, any: null });
}

process.stdout.write('Scanning alternateNamesV2.txt … ');

const rl = createInterface({
  input:     createReadStream(GEONAMES_FILE),
  crlfDelay: Infinity,
});

let lineCount = 0;
for await (const line of rl) {
  lineCount++;
  if (lineCount % 1_000_000 === 0)
    process.stdout.write(`\r  ${(lineCount / 1_000_000).toFixed(0)}M lines … `);

  const tab1 = line.indexOf('\t');
  const tab2 = line.indexOf('\t', tab1 + 1);
  const tab3 = line.indexOf('\t', tab2 + 1);
  const tab4 = line.indexOf('\t', tab3 + 1);
  const tab5 = line.indexOf('\t', tab4 + 1);
  const tab6 = line.indexOf('\t', tab5 + 1);
  const tab7 = line.indexOf('\t', tab6 + 1);

  const gnId = line.slice(tab1 + 1, tab2);
  const cand = candidates.get(gnId);
  if (!cand) continue;

  const isolang = line.slice(tab2 + 1, tab3);
  // Normalise zh-Hans → zh, zh-Hant → zh-hant, etc.
  const normLang = isolang === 'zh-Hans' ? 'zh'
                 : isolang === 'zh-Hant' ? 'zh-hant'
                 : isolang;
  if (normLang !== cand.lang) continue;

  const altName     = line.slice(tab3 + 1, tab4);
  const isPref      = line[tab4 + 1] === '1';
  const isShort     = line[tab5 + 1] === '1';
  const isColloquial = line[tab6 + 1] === '1';
  const isHistoric   = line[tab7 + 1] === '1';

  if (isColloquial || isHistoric) continue;
  if (!altName) continue;

  if (isShort && !cand.short)       cand.short     = altName;
  if (isPref  && !cand.preferred)   cand.preferred = altName;
  if (!cand.any)                    cand.any       = altName;
}

console.log(`\nScanned ${lineCount.toLocaleString()} lines.`);

// ---------------------------------------------------------------------------
// Step 3: pick best name for each city and write JSON
// ---------------------------------------------------------------------------
const result = {};
let found = 0, missing = 0;

for (const [gnId, cand] of candidates) {
  // Always use the GeoNames short name when one exists.
  // For non-short names, only use GeoNames when the NE shapefile has no field
  // for this language — otherwise NE's curated shorter city names take priority
  // (e.g. NE NAME_DE = "Frankfurt" beats GeoNames preferred = "Frankfurt am Main").
  const hasNEField = Boolean(LANG_NE_FIELD[cand.lang]);
  const name = cand.short ?? (hasNEField ? null : (cand.preferred ?? cand.any));
  if (name) {
    result[gnId] = name;
    found++;
  } else {
    missing++;
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(result));
console.log(`Wrote ${found} names to ${OUTPUT_FILE} (${missing} cities had no GeoNames entry).`);
