#!/usr/bin/env node
/* global Buffer */
/**
 * Factoría procedural de assets runtime (WP4.15). Genera SVG deterministas para cada edificio y sus
 * cuatro estados, y para dos variantes de personaje (8 y 4 direcciones). El manifiesto incluye
 * huella, pivote, hash SHA-256 y provenance. No versióna binarios: las imágenes viajan como data URI.
 *
 * Uso:
 *   node scripts/generate-runtime-assets.mjs           # escribe apps/web/src/generated/runtime-assets.json
 *   node scripts/generate-runtime-assets.mjs --check   # falla si el manifiesto versionado no coincide
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT = "apps/web/src/generated/runtime-assets.json";

const BUILDINGS = [
  {
    type: "courtyard_home",
    name: "Patio compacto",
    footprint: [1, 1],
    palette: ["#c9a77c", "#a9855f", "#8c6a4a"],
  },
  {
    type: "workshop",
    name: "Taller de barrio",
    footprint: [1, 1],
    palette: ["#b9a88f", "#937f66", "#75634d"],
  },
  {
    type: "cement_plant",
    name: "Planta de cemento",
    footprint: [2, 2],
    palette: ["#aeb6bd", "#8a939c", "#6d757d"],
  },
  {
    type: "brickworks",
    name: "Ladrillera",
    footprint: [2, 1],
    palette: ["#c28a72", "#a06a54", "#80523f"],
  },
  {
    type: "steelworks",
    name: "Acería",
    footprint: [2, 2],
    palette: ["#9aa4ae", "#77818c", "#5b636c"],
  },
  {
    type: "town_hall",
    name: "Ayuntamiento",
    footprint: [2, 2],
    palette: ["#d8c9a8", "#b7a482", "#8f7d5f"],
  },
  {
    type: "school_block",
    name: "Colegio",
    footprint: [2, 1],
    palette: ["#cfb18a", "#a98b66", "#82684c"],
  },
  {
    type: "clinic",
    name: "Clínica",
    footprint: [1, 1],
    palette: ["#dfe6e4", "#b8c7c4", "#8da19d"],
  },
  {
    type: "police_station",
    name: "Comisaría",
    footprint: [1, 1],
    palette: ["#aebfd0", "#879caf", "#667d91"],
  },
  {
    type: "fire_station",
    name: "Parque de bomberos",
    footprint: [2, 1],
    palette: ["#c98f7f", "#a56d5f", "#7e5045"],
  },
  {
    type: "market_hall",
    name: "Mercado",
    footprint: [2, 1],
    palette: ["#d8b67a", "#b18e58", "#876a40"],
  },
];

const CHARACTERS = [
  { id: "vecino", name: "Vecino", directions: 8, coat: "#4f7f9e", accent: "#e3c27a" },
  {
    id: "vecino_variante",
    name: "Vecino con abrigo",
    directions: 4,
    coat: "#7a5f9e",
    accent: "#d98f6a",
  },
];

const BUILDING_STATES = ["complete", "construction", "damaged", "burning"];

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function image(svg, width, height) {
  return { src: dataUri(svg), width, height, sha256: hash(svg) };
}

function isometricBase(palette, state) {
  const [wall, roof, shadow] = palette;
  const dark = state === "burning" ? "#3a2f2a" : state === "damaged" ? "#5e5751" : shadow;
  return {
    ground: `<polygon points="64,104 120,80 64,56 8,80" fill="#5c6b4f" stroke="#3f4a37" stroke-width="2"/>`,
    body:
      `<polygon points="28,78 64,94 64,58 28,42" fill="${wall}" stroke="${dark}" stroke-width="2"/>` +
      `<polygon points="64,94 100,78 100,42 64,58" fill="${roof}" stroke="${dark}" stroke-width="2"/>` +
      `<polygon points="28,42 64,58 100,42 64,26" fill="${shadow}" stroke="${dark}" stroke-width="2"/>`,
  };
}

function buildingSvg(building, state) {
  const base = isometricBase(building.palette, state);
  const flames =
    state === "burning"
      ? `<g><polygon points="52,52 60,20 66,44 74,18 80,48 72,62 60,66" fill="#e8592a" opacity="0.92"/>` +
        `<polygon points="58,54 64,32 70,50 66,64" fill="#f6b13b"/>` +
        `<g fill="#6b6b6b" opacity="0.55"><circle cx="48" cy="16" r="9"/><circle cx="62" cy="8" r="7"/><circle cx="76" cy="14" r="8"/></g></g>`
      : "";
  const scaffolding =
    state === "construction"
      ? `<g stroke="#d8c07a" stroke-width="2" opacity="0.95">` +
        `<line x1="30" y1="80" x2="30" y2="34"/><line x1="64" y1="96" x2="64" y2="46"/>` +
        `<line x1="98" y1="80" x2="98" y2="34"/><line x1="22" y1="52" x2="106" y2="34"/>` +
        `<line x1="22" y1="68" x2="106" y2="50"/></g>` +
        `<polygon points="28,78 64,94 64,58 28,42" fill="none" stroke="#8c7a4d" stroke-width="2" stroke-dasharray="5 4"/>`
      : "";
  const damage =
    state === "damaged"
      ? `<polyline points="38,44 46,58 42,72 52,86" fill="none" stroke="#2f2a26" stroke-width="2"/>` +
        `<polyline points="78,46 70,60 76,74" fill="none" stroke="#2f2a26" stroke-width="2"/>` +
        `<polygon points="84,40 100,42 100,30 88,24" fill="#4c4640"/>`
      : "";
  const details =
    `<g stroke="#3c3934" stroke-width="1.5" opacity="0.7">` +
    `<line x1="36" y1="62" x2="56" y2="72"/><line x1="72" y1="72" x2="92" y2="62"/></g>` +
    `<g fill="#f3d98a">` +
    `<rect x="38" y="58" width="8" height="8"/><rect x="52" y="66" width="8" height="8"/>` +
    `<rect x="72" y="66" width="8" height="8"/><rect x="86" y="58" width="8" height="8"/></g>`;

  if (building.type === "town_hall") {
    const civic =
      `<g><polygon points="50,40 64,28 78,40" fill="#f2e6c8" stroke="#7c6c52" stroke-width="2"/>` +
      `<rect x="50" y="40" width="28" height="26" fill="#e7dcc1" stroke="#7c6c52" stroke-width="2"/>` +
      `<g fill="#c9b98f"><rect x="54" y="46" width="4" height="20"/><rect x="62" y="46" width="4" height="20"/><rect x="70" y="46" width="4" height="20"/></g>` +
      `<rect x="61" y="10" width="6" height="20" fill="#8f7d5f"/><polygon points="58,10 64,2 70,10" fill="#b7a482"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${civic}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "school_block" || building.type === "clinic" || building.type === "market_hall") {
    const sign =
      building.type === "school_block"
        ? `<g><rect x="92" y="24" width="3" height="30" fill="#6a5a45"/><polygon points="95,24 114,28 95,32" fill="#d97757"/></g>` +
          `<g fill="#f3d98a"><rect x="38" y="58" width="10" height="8"/><rect x="54" y="66" width="10" height="8"/><rect x="70" y="66" width="10" height="8"/></g>`
        : building.type === "clinic"
          ? `<g><rect x="58" y="34" width="12" height="6" fill="#4db6ac"/><rect x="61" y="31" width="6" height="12" fill="#4db6ac"/></g>` +
            `<g fill="#f3d98a"><rect x="40" y="60" width="8" height="8"/><rect x="80" y="60" width="8" height="8"/></g>`
          : `<g><polygon points="28,50 64,34 100,50 64,66" fill="#e0b04b" stroke="#876a40" stroke-width="2"/>` +
            `<g stroke="#876a40"><line x1="40" y1="48" x2="40" y2="58"/><line x1="56" y1="45" x2="56" y2="55"/><line x1="72" y1="45" x2="72" y2="55"/><line x1="88" y1="48" x2="88" y2="58"/></g></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${sign}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "police_station") {
    const beacon =
      `<g><rect x="52" y="32" width="24" height="6" fill="#667d91"/><rect x="58" y="24" width="12" height="8" fill="#4f7f9e" stroke="#3f5f75" stroke-width="1.5"/><circle cx="64" cy="22" r="3" fill="#9fd4e8"/></g>` +
      `<g fill="#f3d98a"><rect x="38" y="60" width="8" height="8"/><rect x="82" y="60" width="8" height="8"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${beacon}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "fire_station") {
    const station =
      `<g><rect x="40" y="44" width="18" height="30" fill="#6f4a42" stroke="#4f332e" stroke-width="2"/><rect x="70" y="44" width="18" height="30" fill="#6f4a42" stroke="#4f332e" stroke-width="2"/></g>` +
      `<g fill="#d8b67a"><rect x="44" y="52" width="10" height="3"/><rect x="74" y="52" width="10" height="3"/></g>` +
      `<rect x="60" y="16" width="8" height="30" fill="#a56d5f" stroke="#7e5045" stroke-width="2"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${station}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "cement_plant" || building.type === "steelworks") {
    const chimneys =
      building.type === "cement_plant"
        ? `<g><rect x="36" y="18" width="14" height="34" fill="#9aa2a9" stroke="#5b636c" stroke-width="2"/>` +
          `<rect x="78" y="24" width="12" height="28" fill="#9aa2a9" stroke="#5b636c" stroke-width="2"/>` +
          `<ellipse cx="43" cy="18" rx="7" ry="4" fill="#c7cdd2"/><ellipse cx="84" cy="24" rx="6" ry="3" fill="#c7cdd2"/></g>`
        : `<g><rect x="82" y="8" width="10" height="44" fill="#7c868f" stroke="#4d555d" stroke-width="2"/>` +
          `<rect x="34" y="16" width="8" height="36" fill="#7c868f" stroke="#4d555d" stroke-width="2"/>` +
          `<line x1="34" y1="40" x2="96" y2="24" stroke="#4d555d" stroke-width="3"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${chimneys}${details}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "brickworks") {
    const stack =
      `<g><rect x="88" y="10" width="10" height="34" fill="#8a5a45" stroke="#5f3d2f" stroke-width="2"/>` +
      `<rect x="86" y="8" width="14" height="5" fill="#c28a72"/></g>`;
    const shed = `<polygon points="32,52 64,36 96,52 64,68" fill="#a06a54" stroke="#5f3d2f" stroke-width="2"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${shed}${stack}${details}${scaffolding}${damage}${flames}</svg>`;
  }
  if (building.type === "courtyard_home") {
    const courtyard = `<polygon points="58,66 64,69 70,66 64,63" fill="#5c6b4f" stroke="#3f4a37" stroke-width="1.5"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${courtyard}${details}${scaffolding}${damage}${flames}</svg>`;
  }
  const workshopChimney = `<rect x="84" y="20" width="8" height="22" fill="#75634d" stroke="#4d4035" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 112" width="128" height="112" role="img">${base.ground}${base.body}${workshopChimney}${details}${scaffolding}${damage}${flames}</svg>`;
}

function characterSvg(character, direction, animation, frame) {
  const angle = (360 / character.directions) * direction;
  const stride = animation === "walk" ? (frame % 2 === 0 ? 4 : -4) : 0;
  const bob = animation === "idle" ? (frame % 2 === 0 ? 0 : 1) : 0;
  const faceOffset = Math.round(5 * Math.cos((angle * Math.PI) / 180));
  const sideOffset = Math.round(4 * Math.sin((angle * Math.PI) / 180));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64" role="img">` +
    `<ellipse cx="24" cy="59" rx="11" ry="4" fill="#2f3a2c" opacity="0.45"/>` +
    `<g transform="translate(0 ${bob})">` +
    `<rect x="${18 + Math.round(stride / 2)}" y="44" width="5" height="15" rx="2" fill="#3c3c46"/>` +
    `<rect x="${25 - Math.round(stride / 2)}" y="44" width="5" height="15" rx="2" fill="#3c3c46"/>` +
    `<rect x="15" y="24" width="18" height="23" rx="5" fill="${character.coat}" stroke="#2f3540" stroke-width="2"/>` +
    `<rect x="13" y="27" width="4" height="14" rx="2" fill="${character.coat}"/>` +
    `<rect x="31" y="27" width="4" height="14" rx="2" fill="${character.coat}"/>` +
    `<circle cx="${24 + faceOffset}" cy="16" r="8" fill="#e8c49a" stroke="#3a2f2a" stroke-width="2"/>` +
    `<circle cx="${24 + faceOffset - 3}" cy="15" r="1.3" fill="#2f2a26"/>` +
    `<circle cx="${24 + faceOffset + 3}" cy="15" r="1.3" fill="#2f2a26"/>` +
    `<rect x="20" y="32" width="8" height="3" rx="1.5" fill="${character.accent}"/>` +
    `<circle cx="${24 + sideOffset}" cy="25" r="2.5" fill="${character.accent}" opacity="0.9"/>` +
    `</g></svg>`
  );
}

function buildManifest() {
  const buildings = {};
  for (const building of BUILDINGS) {
    const states = {};
    for (const state of BUILDING_STATES) {
      states[state] = image(buildingSvg(building, state), 128, 112);
    }
    buildings[building.type] = {
      type: building.type,
      name: building.name,
      footprint: { width: building.footprint[0], height: building.footprint[1] },
      pivot: { x: 0.5, y: 0.93 },
      states,
    };
  }
  const characters = {};
  for (const character of CHARACTERS) {
    const animations = {};
    for (const animation of ["idle", "walk"]) {
      const frames = [];
      for (let direction = 0; direction < character.directions; direction += 1) {
        for (let frame = 0; frame < 2; frame += 1) {
          frames.push(image(characterSvg(character, direction, animation, frame), 48, 64));
        }
      }
      animations[animation] = { frameDurationMs: animation === "idle" ? 400 : 180, frames };
    }
    characters[character.id] = {
      id: character.id,
      name: character.name,
      directions: character.directions,
      animations,
    };
  }
  return {
    schemaVersion: 1,
    generator: {
      id: "procedural-building-character-factory",
      version: 1,
      method: "procedural_svg",
      source: "scripts/generate-runtime-assets.mjs",
    },
    provenance: {
      license: "original",
      author: "Landlord project",
      notes:
        "Siluetas procedurales de Alpha generadas por el repositorio; sustituibles por renders Blender con el mismo contrato.",
    },
    buildings,
    characters,
  };
}

const manifest = buildManifest();
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
const images = [
  ...Object.values(manifest.buildings).flatMap((building) => Object.values(building.states)),
  ...Object.values(manifest.characters).flatMap((character) =>
    Object.values(character.animations).flatMap((animation) => animation.frames),
  ),
];
const bytes = images.reduce((total, entry) => total + entry.src.length, 0);

if (process.argv.includes("--check")) {
  let committed = "";
  try {
    committed = readFileSync(OUTPUT, "utf8");
  } catch {
    console.error(`falta ${OUTPUT}; ejecuta el generador`);
    process.exit(1);
  }
  if (committed !== serialized) {
    console.error(
      "el manifiesto versionado no coincide con la factoría; regenera y revisa el diff",
    );
    process.exit(1);
  }
  console.log(`manifiesto determinista: ${images.length} imágenes, ${bytes} bytes en data URIs`);
  process.exit(0);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, serialized);
console.log(
  JSON.stringify({
    output: OUTPUT,
    images: images.length,
    dataUriBytes: bytes,
    manifestBytes: Buffer.byteLength(serialized),
    buildings: Object.keys(manifest.buildings).length,
    characters: Object.keys(manifest.characters).length,
  }),
);
