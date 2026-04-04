// localnames.mjs — shared tables for localised city-name lookup.
//
// COUNTRY_LANG  : ADM0_A3 (Natural Earth) → ISO 639-1 language code
// LANG_NE_FIELD : lang code → NE shapefile field (for the 25 languages NE includes)
// LANG_FONT     : lang code → CSS font-family (Noto fonts installed on this system)
// RTL_LANGS     : Set of languages written right-to-left

// ---------------------------------------------------------------------------
// ADM0_A3 → primary language used for city names in that country.
// Countries absent from this map default to English (NAME field used as-is).
// ---------------------------------------------------------------------------
export const COUNTRY_LANG = {
  // Arabic (ar)
  ARE: 'ar', BHR: 'ar', COM: 'ar', DJI: 'ar', DZA: 'ar', EGY: 'ar',
  IRQ: 'ar', JOR: 'ar', KWT: 'ar', LBN: 'ar', LBY: 'ar', MAR: 'ar',
  MRT: 'ar', OMN: 'ar', PSX: 'ar', QAT: 'ar', SAH: 'ar', SAU: 'ar',
  SDN: 'ar', SYR: 'ar', TUN: 'ar', YEM: 'ar',
  // Armenian (hy)
  ARM: 'hy',
  // Azerbaijani — Latin script (az)
  AZE: 'az',
  // Bengali (bn)
  BGD: 'bn',
  // Bulgarian (bg) — Cyrillic
  BGR: 'bg',
  // Chinese Simplified (zh)
  CHN: 'zh', HKG: 'zh', MAC: 'zh',
  // Chinese Traditional (zh-hant)
  TWN: 'zh-hant',
  // Czech (cs)
  CZE: 'cs',
  // Danish (da)
  DNK: 'da', FRO: 'da', GRL: 'da',
  // Dutch (nl)
  ABW: 'nl', CUW: 'nl', NLD: 'nl',
  // Estonian (et)
  EST: 'et',
  // Farsi/Persian (fa) — Arabic script
  AFG: 'fa', IRN: 'fa',
  // Finnish (fi)
  FIN: 'fi',
  // French (fr)
  AND: 'fr', BDI: 'fr', BEN: 'fr', BFA: 'fr', CAF: 'fr', CIV: 'fr',
  CMR: 'fr', COD: 'fr', COG: 'fr', FRA: 'fr', GAB: 'fr', GIN: 'fr',
  GNB: 'fr', GNQ: 'fr', HTI: 'fr', LUX: 'fr', MCO: 'fr', MLI: 'fr',
  NER: 'fr', RWA: 'fr', SEN: 'fr', STP: 'fr', TCD: 'fr', TGO: 'fr',
  // German (de)
  AUT: 'de', CHE: 'de', DEU: 'de', LIE: 'de',
  // Georgian (ka)
  GEO: 'ka',
  // Greek (el)
  CYP: 'el', GRC: 'el',
  // Hebrew (he) — RTL
  ISR: 'he',
  // Hindi / Devanagari (hi)
  IND: 'hi',
  // Croatian (hr)
  HRV: 'hr',
  // Hungarian (hu)
  HUN: 'hu',
  // Icelandic (is)
  ISL: 'is',
  // Indonesian (id)
  IDN: 'id',
  // Italian (it)
  ITA: 'it', SMR: 'it', VAT: 'it',
  // Japanese (ja)
  JPN: 'ja',
  // Kazakh (kk) — Cyrillic in Kazakhstan
  KAZ: 'kk',
  // Khmer (km)
  KHM: 'km',
  // Korean (ko)
  KOR: 'ko', PRK: 'ko',
  // Kyrgyz (ky) — Cyrillic
  KGZ: 'ky',
  // Lao (lo)
  LAO: 'lo',
  // Latvian (lv)
  LVA: 'lv',
  // Lithuanian (lt)
  LTU: 'lt',
  // Macedonian (mk) — Cyrillic
  MKD: 'mk',
  // Malay (ms) — Latin
  BRN: 'ms', MYS: 'ms',
  // Mongolian — GeoNames 'mn' entries use traditional vertical script, not
  // Cyrillic; use 'ru' to get NE's NAME_RU Cyrillic transliterations instead.
  MNG: 'ru',
  // Burmese/Myanmar (my)
  MMR: 'my',
  // Nepali (ne) — Devanagari
  NPL: 'ne',
  // Norwegian Bokmål (no)
  NOR: 'no', SJM: 'no',
  // Polish (pl)
  POL: 'pl',
  // Portuguese (pt)
  AGO: 'pt', BRA: 'pt', CPV: 'pt', MOZ: 'pt', PRT: 'pt', TLS: 'pt',
  // Romanian (ro)
  MDA: 'ro', ROU: 'ro',
  // Russian (ru) — Cyrillic
  BLR: 'ru', RUS: 'ru',
  // Serbian (sr) — Cyrillic
  BIH: 'sr', MNE: 'sr', SRB: 'sr',
  // Sinhala (si)
  LKA: 'si',
  // Slovak (sk)
  SVK: 'sk',
  // Slovenian (sl)
  SVN: 'sl',
  // Somali (so)
  SOM: 'so', SOL: 'so',
  // Spanish (es)
  ARG: 'es', BOL: 'es', CHL: 'es', COL: 'es', CRI: 'es', CUB: 'es',
  DOM: 'es', ECU: 'es', ESP: 'es', GTM: 'es', HND: 'es', MEX: 'es',
  NIC: 'es', PAN: 'es', PER: 'es', PRY: 'es', SLV: 'es', URY: 'es',
  VEN: 'es',
  // Swedish (sv)
  ALD: 'sv', SWE: 'sv',
  // Tajik (tg) — Cyrillic
  TJK: 'tg',
  // Thai (th)
  THA: 'th',
  // Turkish (tr)
  CYN: 'tr', TUR: 'tr',
  // Turkmen (tk) — Latin
  TKM: 'tk',
  // Ukrainian (uk) — Cyrillic
  UKR: 'uk',
  // Urdu (ur) — Arabic script, RTL
  PAK: 'ur',
  // Uzbek (uz) — Latin
  UZB: 'uz',
  // Vietnamese (vi)
  VNM: 'vi',
  // Amharic / Ethiopic (am)
  ETH: 'am',
  // Albanian (sq)
  ALB: 'sq', KOS: 'sq',
};

// ---------------------------------------------------------------------------
// Languages already present as named fields in the NE shapefile.
// For these, a GeoNames short-name lookup (build-localnames.mjs) is still run
// so that "short" forms (e.g. 東京 rather than 東京都) take priority.
// ---------------------------------------------------------------------------
export const LANG_NE_FIELD = {
  ar: 'NAME_AR', bn: 'NAME_BN', de: 'NAME_DE', el: 'NAME_EL',
  es: 'NAME_ES', fa: 'NAME_FA', fr: 'NAME_FR', he: 'NAME_HE',
  hi: 'NAME_HI', hu: 'NAME_HU', id: 'NAME_ID', it: 'NAME_IT',
  ja: 'NAME_JA', ko: 'NAME_KO', nl: 'NAME_NL', pl: 'NAME_PL',
  pt: 'NAME_PT', ru: 'NAME_RU', sv: 'NAME_SV', tr: 'NAME_TR',
  uk: 'NAME_UK', ur: 'NAME_UR', vi: 'NAME_VI',
  zh: 'NAME_ZH', 'zh-hant': 'NAME_ZHT',
};

// ---------------------------------------------------------------------------
// CSS font-family for each script (Noto fonts verified installed).
// Languages not listed fall back to CITY_FONT_FAMILY (DejaVu Sans),
// which covers Latin, Greek, and Cyrillic adequately.
// ---------------------------------------------------------------------------
export const LANG_FONT = {
  // Arabic script
  ar: 'Noto Naskh Arabic',
  fa: 'Noto Naskh Arabic',
  ur: 'Noto Naskh Arabic',
  // Armenian
  hy: 'Noto Sans Armenian',
  // Bengali
  bn: 'Noto Sans Bengali',
  // Devanagari
  hi: 'Noto Sans Devanagari',
  ne: 'Noto Sans Devanagari',
  // Ethiopic
  am: 'Noto Sans Ethiopic',
  // Georgian
  ka: 'Noto Sans Georgian',
  // Hebrew
  he: 'Noto Sans Hebrew',
  // Khmer
  km: 'Noto Sans Khmer',
  // Lao
  lo: 'Noto Sans Lao',
  // Sinhala
  si: 'Noto Sans Sinhala',
  // Thai
  th: 'Noto Sans Thai',
  // Burmese/Myanmar  (install: sudo dnf install google-noto-sans-myanmar-vf-fonts)
  my: 'Noto Sans Myanmar',
  // All Latin, Cyrillic, Greek variants (az, bg, cs, da, et, fi, hr, hu,
  // is, kk, ky, lt, lv, mk, mn, ms, no, ro, sk, sl, sq, sr, sv, tg, tk,
  // tr, uz, vi) are handled by DejaVu Sans / Noto Sans fallback.
};

// Languages written right-to-left.
// Affects x-anchor calculation when drawing labels in render.mjs.
export const RTL_LANGS = new Set(['ar', 'fa', 'ur', 'he']);
