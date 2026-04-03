// ==================================================================
// PRINT RASTER RENDERER — DIN A0 @ 300 DPI
// ------------------------------------------------------------------
//
// Produces a PNG suitable for high-quality print at DIN A0 landscape
// (1189 × 841 mm) using the Cahill-Concialdi bat projection.
//
// Usage:  node render.mjs
// Output: cahill-concialdi-a0.png  (14043 × 9933 px, 300 DPI)
//
// Requires: canvas, sharp, complex.js  (npm install)
// ------------------------------------------------------------------

import { Complex }        from 'complex.js';
import { createCanvas }   from 'canvas';
import sharp              from 'sharp';
import { open as openShp } from 'shapefile';

// cahill-conformal.mjs uses Complex as a browser global; provide it here
globalThis.Complex = Complex;

import { Point, LatLon }                           from './data-types.mjs';
import { MAX_COLOR_VALUE, DEGS_IN_CIRCLE, TWO_PI } from './globals.mjs';
import { MAP_AREAS, project,
         MAP_VIEW_ORIGIN, MAP_WIDTH,
         MAP_HEIGHT, MAP_TILT }                    from './concialdi.mjs';

// ------------------------------------------------------------------
// Output dimensions

const DPI          = 300;
const MM_PER_INCH  = 25.4;
const A0_WIDTH_MM  = 1189;   // landscape
const A0_HEIGHT_MM =  841;

const CANVAS_WIDTH  = Math.round(A0_WIDTH_MM  / MM_PER_INCH * DPI); // 14043
const CANVAS_HEIGHT = Math.round(A0_HEIGHT_MM / MM_PER_INCH * DPI); // 9933

const SOURCE_FILE = '../HYP_HR_SR_W_DR.tif';
const OUTPUT_FILE = 'cahill-concialdi-a0.png';

const NUM_DEST_CHANNELS = 4; // RGBA in canvas ImageData

// ================================================================
// CITY RENDERING CONSTANTS — edit these freely
// ================================================================

// Path to the Natural Earth populated places shapefile
const CITY_SHP = '../ne_10m_populated_places.shp';

// --- Dots ---
// Dots are drawn for ALL cities in the shapefile regardless of population.
// Their radius is log-scaled over the full population range of the dataset.
const CITY_DOT_RADIUS_MIN = 2;    // px — for the smallest cities
const CITY_DOT_RADIUS_MAX = 8;    // px — for the largest cities (~35 M)
const CITY_DOT_COLOR      = 'rgba(255, 255, 255, 0.92)';

// --- Label placement ---
// Only cities at or above this population are label candidates.
// The greedy algorithm may further cull labels that can't be placed cleanly.
const CITY_MIN_POPULATION = 500_000;

// Maximum displacement of a label's anchor from its dot edge, in canvas pixels.
// Labels with no clean candidate position within this radius are culled.
const CITY_LABEL_MAX_DISP = 120;  // px

// Minimum gap between the dot edge and the nearest edge of its label, in px.
const CITY_LABEL_GAP = 8;         // px

// Padding added to every side of a label's bounding box before overlap testing.
// Increase for more breathing room between adjacent labels.
const CITY_LABEL_PADDING = 5;     // px per side

// Candidate anchor angles tried for each label, in order of preference.
// 0° = east (right of dot), values in degrees, clockwise positive.
// Standard cartographic preference: right side first, then diagonals, then left.
const CITY_LABEL_ANGLES = [0, -45, 45, -90, 90, 135, -135, 180]
  .map(d => d * Math.PI / 180);

// Number of distance steps tried at each angle, spaced evenly from
// (dotRadius + CITY_LABEL_GAP) up to (dotRadius + CITY_LABEL_MAX_DISP).
const CITY_LABEL_DIST_STEPS = 3;

// --- Font ---
// At 300 DPI: 15 px ≈ 3.6 pt — legible on photo paper for isolated labels.
const CITY_FONT_FAMILY   = 'DejaVu Sans';
const CITY_FONT_SIZE_MIN = 15;    // px — at CITY_MIN_POPULATION
const CITY_FONT_SIZE_MAX = 40;    // px — at ~35 M population

const CITY_LABEL_COLOR = 'rgba(255, 255, 255, 0.92)';
const CITY_HALO_WIDTH  = 2;       // px half-width of dark outline; 0 to disable
const CITY_HALO_COLOR  = 'rgba(0, 0, 0, 0.65)';

// ------------------------------------------------------------------
// Load source TIFF as raw RGB

process.stdout.write('Loading source image … ');
const { data: srcData, info: srcInfo } =
  await sharp(SOURCE_FILE).raw().toBuffer({ resolveWithObject: true });

const SOURCE_PPD = srcInfo.width / DEGS_IN_CIRCLE; // 60 for 21600 px wide
console.log(`${srcInfo.width}×${srcInfo.height} px, ${SOURCE_PPD} PPD`);

// ------------------------------------------------------------------
// Canvas + ImageData setup

const canvasPerSvg  = CANVAS_WIDTH / MAP_WIDTH;
const mapHeightPx   = MAP_HEIGHT * canvasPerSvg;
const yOffsetSvg    = (CANVAS_HEIGHT - mapHeightPx) / 2 / canvasPerSvg;

// Adjusted view origin centres the map vertically within the A0 canvas
const viewOrigin = new Point(MAP_VIEW_ORIGIN.x, MAP_VIEW_ORIGIN.y + yOffsetSvg);

const canvas    = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const ctx       = canvas.getContext('2d');
const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

// White background
imageData.data.fill(255);

// ------------------------------------------------------------------
// MapCell — adapted from map-raster.mjs, closes over canvas/source globals

class MapCell {

  constructor(swLatLon, cellCorners, maskCorners) {
    this.swLatLon    = swLatLon;
    this.cellCorners = cellCorners;
    this.maskCorners = maskCorners;

    const isNorthPolar = cellCorners[2].isEqualTo(cellCorners[3]);
    const isSouthPolar = cellCorners[0].isEqualTo(cellCorners[1]);
    this.isPolar      = isNorthPolar || isSouthPolar;
    this.isNorthPolar = isNorthPolar;
  }

  drawCell() {
    const xs   = this.maskCorners.map(p => p.x);
    const ys   = this.maskCorners.map(p => p.y);
    const minX = Math.floor(Math.min(...xs));
    const maxX = Math.ceil (Math.max(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil (Math.max(...ys));

    for   (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {

        if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) continue;

        const pixelPos = new Point(x, y);
        if (!this.isInMask(pixelPos)) continue;

        const latLon = this.isPolar
          ? this.getPolarInverseLatLon(pixelPos)
          : this.getInverseLatLon     (pixelPos);

        const srcX = Math.floor(SOURCE_PPD * ((latLon.lon + DEGS_IN_CIRCLE / 2) % DEGS_IN_CIRCLE));
        const srcY = Math.floor(SOURCE_PPD * (DEGS_IN_CIRCLE / 4 - latLon.lat));

        const srcIdx = srcInfo.channels * (srcY * srcInfo.width + srcX);
        const dstIdx = NUM_DEST_CHANNELS * (y   * CANVAS_WIDTH  + x  );

        imageData.data[dstIdx    ] = srcData[srcIdx    ];
        imageData.data[dstIdx + 1] = srcData[srcIdx + 1];
        imageData.data[dstIdx + 2] = srcData[srcIdx + 2];
        imageData.data[dstIdx + 3] = MAX_COLOR_VALUE;
      }
    }
  }

  isInMask(point) {
    let numIntersections = 0;
    for (let i = 0; i < this.maskCorners.length; i++) {
      const a = this.maskCorners[i];
      const b = this.maskCorners[(i + 1) % this.maskCorners.length];
      if (
        point.x >= Math.min(a.x, b.x) &&
        point.x <  Math.max(a.x, b.x)
      ) {
        if (
          point.y >= Math.max(a.y, b.y) ||
          point.y >= Math.min(a.y, b.y) &&
          point.y >= a.y + (point.x - a.x) / (b.x - a.x) * (b.y - a.y)
        ) numIntersections++;
      }
    }
    return numIntersections % 2 === 1;
  }

  getInverseLatLon(point) {
    const c = this.cellCorners;
    const J = point.x - c[0].x,  K = point.y - c[0].y;
    const L = c[1].x  - c[0].x,  M = c[1].y  - c[0].y;
    const N = c[3].x  - c[0].x,  P = c[3].y  - c[0].y;
    const Q = c[0].x  + c[2].x - c[1].x - c[3].x;
    const R = c[0].y  + c[2].y - c[1].y - c[3].y;

    const a =           - L*R + Q*M;
    const b = J*R + N*M - L*P - Q*K;
    const cc = J*P - N*K;

    const disc = Math.sqrt(b*b - 4*a*cc);
    const x1 = (-b + disc) / (2*a),  y1 = (J - L*x1) / (N + Q*x1);
    const x2 = (-b - disc) / (2*a),  y2 = (J - L*x2) / (N + Q*x2);

    const latLon = (0 <= x1 && x1 <= 1 && 0 <= y1 && y1 <= 1)
      ? new LatLon(y1, x1)
      : new LatLon(y2, x2);
    latLon.lat += this.swLatLon.lat;
    latLon.lon += this.swLatLon.lon;
    return latLon;
  }

  getPolarInverseLatLon(point) {
    const c = this.cellCorners;
    const cellHeight = c[2].getDistanceTo(c[1]);
    const relLat = this.isNorthPolar
      ? 1 - c[2].getDistanceTo(point) / cellHeight
      :     c[1].getDistanceTo(point) / cellHeight;

    let cellWidth = this.isNorthPolar
      ? c[2].getAngleTo(c[0]) - c[2].getAngleTo(c[1])
      : c[1].getAngleTo(c[2]) - c[1].getAngleTo(c[3]);
    if (cellWidth < 0) cellWidth += TWO_PI;

    let relLon = this.isNorthPolar
      ? +(c[2].getAngleTo(c[0]) - c[2].getAngleTo(point))
      : -(c[1].getAngleTo(c[3]) - c[1].getAngleTo(point));
    if (relLon < 0) relLon += TWO_PI;
    relLon /= cellWidth;

    return new LatLon(this.swLatLon.lat + relLat, this.swLatLon.lon + relLon);
  }
}

// ------------------------------------------------------------------
// Render

function drawMapArea(area, idx) {
  const antiMeridianAdjust = area.hasAntimeridian ? DEGS_IN_CIRCLE : 0;
  const startLon = Math.floor(area.swCorner.lon);
  const endLon   = Math.ceil (area.neCorner.lon) + antiMeridianAdjust;

  for (let lat = area.swCorner.lat; lat < area.neCorner.lat; lat++) {
    for (let lon = startLon; lon < endLon; lon++) {

      const maskedLonW = Math.max(lon,     area.swCorner.lon);
      const maskedLonE = Math.min(lon + 1, area.neCorner.lon + antiMeridianAdjust);

      const corners = [
        [lat,     lon    ], [lat,     lon + 1],
        [lat + 1, lon + 1], [lat + 1, lon    ],
        [lat,     maskedLonW], [lat,     maskedLonE],
        [lat + 1, maskedLonE], [lat + 1, maskedLonW],
      ]
      .map(([la, lo]) => new LatLon(la, lo))
      .map(latLon =>
        project(latLon, idx)
          .rotate(MAP_TILT)
          .translate(viewOrigin)
          .scale(canvasPerSvg)
      );

      new MapCell(
        new LatLon(lat, lon),
        corners.slice(0, 4),
        corners.slice(4, 8),
      ).drawCell();
    }
  }
}

// ================================================================
// CITY LABEL HOOKS — replace these when adding localised name data
// ================================================================

// Returns the display name for a city given its shapefile property object.
// 'props' contains every field from ne_10m_populated_places.dbf, e.g.:
//   props.NAME, props.NAME_AR, props.NAME_ZH, props.NAME_JA, ...
// Swap in whatever field (or external lookup) suits the target script.
function getCityLabel(props) {
  return props.NAME;
}

// Returns the CSS font-family string for a given city.
// Override this to return a script-appropriate font once you have them installed,
// e.g. 'Noto Sans Arabic' for Arabic cities, 'Noto Sans CJK JP' for Japanese, etc.
function getCityFont(/* props */) {
  return CITY_FONT_FAMILY;
}

// ================================================================
// CITY LABEL RENDERING
// ================================================================

async function drawCityLabels() {

  // Log-scale helpers
  const LOG_MAX       = Math.log(35_676_000);  // POP_MAX of Tokyo in this dataset
  const LOG_MIN_DOT   = Math.log(1);            // dots span the full population range
  const LOG_MIN_LABEL = Math.log(CITY_MIN_POPULATION);
  const logT = (pop, logMin) =>
    Math.min(1, Math.max(0, (Math.log(Math.max(pop, 1)) - logMin) / (LOG_MAX - logMin)));

  // --- Phase 1: load and project all cities ---

  const allCities       = [];  // every city — for dot drawing
  const labelCandidates = [];  // cities at or above CITY_MIN_POPULATION — for label placement

  const source = await openShp(CITY_SHP, CITY_SHP.replace(/\.shp$/i, '.dbf'), { encoding: 'utf-8' });
  for (;;) {
    const { done, value: feature } = await source.read();
    if (done) break;
    if (feature.geometry?.type !== 'Point') continue;

    const props      = feature.properties;
    const pop        = Math.max(props.POP_MAX, 0);
    const [lon, lat] = feature.geometry.coordinates;

    let pt;
    try {
      pt = project(new LatLon(lat, lon))
        .rotate(MAP_TILT)
        .translate(viewOrigin)
        .scale(canvasPerSvg);
    } catch { continue; }

    if (pt.x < 0 || pt.x >= CANVAS_WIDTH || pt.y < 0 || pt.y >= CANVAS_HEIGHT) continue;

    const dotT      = logT(pop, LOG_MIN_DOT);
    const dotRadius = CITY_DOT_RADIUS_MIN + dotT * (CITY_DOT_RADIUS_MAX - CITY_DOT_RADIUS_MIN);

    allCities.push({ pt, dotRadius });

    if (pop < CITY_MIN_POPULATION) continue;

    const labelT   = logT(pop, LOG_MIN_LABEL);
    const fontSize = Math.round(CITY_FONT_SIZE_MIN + labelT * (CITY_FONT_SIZE_MAX - CITY_FONT_SIZE_MIN));
    const label    = getCityLabel(props);
    const font     = getCityFont(props);

    ctx.font = `${fontSize}px ${font}`;
    const labelW = ctx.measureText(label).width;
    const labelH = fontSize;

    labelCandidates.push({ pt, dotRadius, pop, fontSize, font, label, labelW, labelH });
  }

  // --- Phase 2: greedy label placement in descending population order ---
  //
  // Processing high-population cities first means they always claim the cleanest
  // nearby positions. Smaller cities fill remaining gaps or get culled — the
  // "stronger spring / dominance" behaviour requested.
  //
  // For each city we try candidates in order: angles × distances (inner-first).
  // The first candidate with zero bbox overlap is accepted; if none fits within
  // CITY_LABEL_MAX_DISP the label is culled (dot is still drawn).

  labelCandidates.sort((a, b) => b.pop - a.pop);

  const placedBboxes = [];  // bounding boxes of accepted labels (with padding)
  const placements   = [];  // {city, lx, ly} for rendering

  for (const city of labelCandidates) {
    const { pt, dotRadius, labelW, labelH } = city;

    const minDist = dotRadius + CITY_LABEL_GAP;
    const maxDist = dotRadius + CITY_LABEL_MAX_DISP;
    const step    = CITY_LABEL_DIST_STEPS < 2
      ? 0
      : (maxDist - minDist) / (CITY_LABEL_DIST_STEPS - 1);

    let placed = false;

    distLoop: for (let di = 0; di < CITY_LABEL_DIST_STEPS; di++) {
      const dist = minDist + di * step;

      for (const angle of CITY_LABEL_ANGLES) {
        const ax = pt.x + Math.cos(angle) * dist;
        const ay = pt.y + Math.sin(angle) * dist;

        // Align text so it stays on the same side of the dot as the anchor
        const lx = Math.cos(angle) >= 0 ? ax : ax - labelW;
        const ly = ay;  // textBaseline = 'middle' → ly is the vertical centre

        const bbox = {
          x: lx          - CITY_LABEL_PADDING,
          y: ly - labelH / 2 - CITY_LABEL_PADDING,
          w: labelW      + CITY_LABEL_PADDING * 2,
          h: labelH      + CITY_LABEL_PADDING * 2,
        };

        const overlaps = placedBboxes.some(b =>
          bbox.x         < b.x + b.w &&
          bbox.x + bbox.w > b.x      &&
          bbox.y         < b.y + b.h &&
          bbox.y + bbox.h > b.y
        );

        if (!overlaps) {
          placedBboxes.push(bbox);
          placements.push({ city, lx, ly });
          placed = true;
          break distLoop;
        }
      }
    }

    void placed;  // culled cities still get their dot drawn below
  }

  // --- Phase 3: draw all dots ---

  for (const { pt, dotRadius } of allCities) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, dotRadius, 0, TWO_PI);
    ctx.fillStyle = CITY_DOT_COLOR;
    ctx.fill();
  }

  // --- Phase 4: draw placed labels ---

  ctx.textBaseline = 'middle';

  for (const { city, lx, ly } of placements) {
    ctx.font = `${city.fontSize}px ${city.font}`;

    if (CITY_HALO_WIDTH > 0) {
      ctx.lineWidth   = CITY_HALO_WIDTH * 2;
      ctx.strokeStyle = CITY_HALO_COLOR;
      ctx.lineJoin    = 'round';
      ctx.strokeText(city.label, lx, ly);
    }
    ctx.fillStyle = CITY_LABEL_COLOR;
    ctx.fillText(city.label, lx, ly);
  }

  return { dots: allCities.length, labels: placements.length, candidates: labelCandidates.length };
}

// ================================================================

console.log(`Canvas: ${CANVAS_WIDTH}×${CANVAS_HEIGHT} px  (A0 landscape @ ${DPI} DPI)`);
console.log(`Map scale: ${canvasPerSvg.toFixed(2)} px/SVG unit — ` +
            `vertical margin: ${Math.round(yOffsetSvg * canvasPerSvg)} px each side`);

const t0 = Date.now();
MAP_AREAS.forEach((area, idx) => {
  drawMapArea(area, idx);
  process.stdout.write(`\rRendering … area ${idx + 1}/${MAP_AREAS.length}`);
});
console.log(`\nRendered in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ------------------------------------------------------------------
// Write pixel data, then overlay city labels

ctx.putImageData(imageData, 0, 0);

process.stdout.write('Drawing city labels … ');
const { dots, labels, candidates } = await drawCityLabels();
console.log(`${dots} dots drawn, ${labels}/${candidates} labels placed`);

process.stdout.write('Writing PNG … ');
const buf = canvas.toBuffer('image/png');
await sharp(buf)
  .withMetadata({ density: DPI })
  .toFile(OUTPUT_FILE);

console.log(`done → ${OUTPUT_FILE}`);
