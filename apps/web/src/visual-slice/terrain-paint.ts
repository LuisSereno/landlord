import type { GridCell } from "@landlord/shared";
import { gridToScreen, type IsometricLayout } from "../isometric/coordinates";
import { cellKey, hashCell, type GroundPlan, type GroundSurface } from "./ground";

/**
 * Horneado del lenguaje visual del suelo (WP4.15-V.b0). Todo se pinta una sola vez en una
 * CanvasTexture con Canvas 2D: ni un sprite por celda ni texturas nuevas por loseta. La capa
 * respeta el orden del motor de presentación — terreno base, superficie de parcela, calzada/acera,
 * dressing y decalcos — y queda siempre por debajo de los sprites volumétricos de Blender.
 *
 * El ruido es determinista (semilla fija + hash de celda), así que dos capturas de la misma
 * composición son píxel a píxel idénticas.
 */
export const TERRAIN_STAGES = ["none", "base", "parcels", "full"] as const;
export type TerrainStage = (typeof TERRAIN_STAGES)[number];

export type GroundBounds = { x: number; y: number; width: number; height: number };

/** Semilla del dressing: cambiarla cambia el barrio y deja de reproducir las capturas. */
export const GROUND_DRESSING_SEED = 0x4c5544;

type SurfaceStyle = {
  base: string;
  shade: string;
  light: string;
  grain: number;
  stroke?: string;
};

/**
 * Graphic Civic: valores oscuros y desaturados, sin color brillante.
 *
 * WP4.15-V.b1 baja la escalera entera un 18 % respecto al suelo aprobado en V.b0. No es un cambio
 * de lenguaje — el grano, las juntas y las parcelas siguen igual — sino de jerarquía: con las
 * fachadas de Blender subidas a V≈0.5 de albedo, un pavimento a V 0.25 competía con los edificios
 * y la escena se leía plana. El suelo tiene que quedar por debajo de todo lo demás.
 */
export const SURFACE_STYLE: Record<GroundSurface, SurfaceStyle> = {
  urban: { base: "#1c222c", shade: "#151b23", light: "#222934", grain: 90 },
  grass: { base: "#19241e", shade: "#141c17", light: "#1f2c24", grain: 150, stroke: "#223428" },
  dirt: { base: "#2a241c", shade: "#1e1914", light: "#322b21", grain: 120 },
  gravel: { base: "#24282e", shade: "#1d2025", light: "#2e333a", grain: 230 },
  pavement: { base: "#272c35", shade: "#20252c", light: "#2e343e", grain: 55 },
  asphalt: { base: "#1d2127", shade: "#171a20", light: "#23272e", grain: 40 },
  construction: { base: "#292318", shade: "#1e1a11", light: "#322b1f", grain: 190 },
};

/** Bordillos y juntas: casi imperceptibles a zoom 0.5, firmes a zoom 2.5. */
const EDGE_LIGHT = "rgba(77, 85, 98, 0.32)";
const EDGE_DARK = "rgba(11, 14, 19, 0.5)";
/** Marcaje vial: sigue siendo lo más claro del suelo, pero por debajo de las fachadas iluminadas. */
const MARKING = "#838a93";

/** Tamaño del lienzo de un paso de peatones: cubre las cuatro bocas del cruce. */
export const CROSSING_TEXTURE = { width: 176, height: 88 } as const;

type Context = CanvasRenderingContext2D;
type Point = { x: number; y: number };

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function diamond(context: Context, cx: number, cy: number, hw: number, hh: number): void {
  context.beginPath();
  context.moveTo(cx, cy - hh);
  context.lineTo(cx + hw, cy);
  context.lineTo(cx, cy + hh);
  context.lineTo(cx - hw, cy);
  context.closePath();
}

function blob(context: Context, x: number, y: number, rx: number, ry: number, color: string): void {
  context.save();
  context.translate(x, y);
  context.scale(rx / ry, 1);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, ry);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, ry, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** Patrón 64×64 reutilizable por superficie: grano procedural sin añadir texturas al bundle. */
function createPattern(document: Document, surface: GroundSurface): HTMLCanvasElement {
  const style = SURFACE_STYLE[surface];
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = style.base;
  context.fillRect(0, 0, 64, 64);
  const next = random(hashCell(surface.length, style.grain, 7));
  for (let index = 0; index < style.grain; index += 1) {
    context.fillStyle = next() > 0.48 ? style.shade : style.light;
    context.globalAlpha = 0.28 + next() * 0.4;
    context.beginPath();
    context.ellipse(
      next() * 64,
      next() * 64,
      0.6 + next() * 2.2,
      0.6 + next() * 1.5,
      next() * Math.PI,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
  if (style.stroke) {
    context.lineWidth = 1;
    for (let index = 0; index < 26; index += 1) {
      const x = next() * 64;
      const y = next() * 64;
      context.strokeStyle = style.stroke;
      context.globalAlpha = 0.16 + next() * 0.2;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (next() - 0.5) * 3, y - 2 - next() * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }
  return canvas;
}

export type GroundPaintInput = {
  context: Context;
  document: Document;
  layout: IsometricLayout;
  bounds: GroundBounds;
  plan: GroundPlan | null;
  stage: TerrainStage;
  showGrid: boolean;
};

/**
 * Pinta el suelo completo. `none` reconstruye la loseta plana histórica, así que la evidencia
 * BEFORE/AFTER sale del mismo código y de la misma cámara.
 */
export function paintGround(input: GroundPaintInput): void {
  const { context, layout, bounds, plan, stage, showGrid } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  const local = (cell: GridCell): Point => {
    const point = gridToScreen(cell, layout);
    return { x: point.x - bounds.x, y: point.y - bounds.y };
  };
  const surfaceAt = (cell: GridCell): GroundSurface =>
    stage === "none" || stage === "base" || !plan
      ? "urban"
      : (plan.surfaces.get(cellKey(cell)) ?? "urban");

  context.clearRect(0, 0, bounds.width, bounds.height);
  if (stage === "none") {
    context.fillStyle = "#1f2a39";
    context.fillRect(0, 0, bounds.width, bounds.height);
    if (showGrid) strokeGrid(input, 0.03);
    return;
  }

  const patterns = new Map<GroundSurface, CanvasPattern>();
  const patternFor = (surface: GroundSurface): CanvasPattern | undefined => {
    const cached = patterns.get(surface);
    if (cached) return cached;
    const created = context.createPattern(createPattern(input.document, surface), "repeat");
    if (created) patterns.set(surface, created);
    return created ?? undefined;
  };

  /** 1 · Terreno base: sólo el rombo del mapa, con manchas grandes de valor. */
  context.save();
  clipGround(input);
  context.fillStyle = SURFACE_STYLE.urban.base;
  context.fillRect(0, 0, bounds.width, bounds.height);
  const ambient = random(GROUND_DRESSING_SEED);
  for (let index = 0; index < 120; index += 1) {
    const light = ambient() > 0.5;
    blob(
      context,
      ambient() * bounds.width,
      ambient() * bounds.height,
      (40 + ambient() * 130) * 1.7,
      40 + ambient() * 130,
      light ? "rgba(120, 138, 160, 0.05)" : "rgba(8, 12, 18, 0.09)",
    );
  }
  const urbanPattern = patternFor("urban");
  if (urbanPattern) {
    context.globalAlpha = 0.5;
    context.fillStyle = urbanPattern;
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.globalAlpha = 1;
  }
  context.restore();

  if (stage === "base" || !plan) {
    fadeBorder(
      input,
      local(plan ? plan.zoneCenter : { x: layout.mapWidth / 2, y: layout.mapHeight / 2 }),
    );
    if (showGrid) strokeGrid(input, 0.03);
    return;
  }

  /** 2 · Superficie de parcela, acera y calzada sobre el terreno base. */
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      const surface = surfaceAt({ x, y });
      if (surface === "urban") continue;
      const center = local({ x, y });
      const pattern = patternFor(surface);
      if (pattern) {
        const offsetX = (hashCell(x, y, 3) % 64) - 32;
        const offsetY = (hashCell(x, y, 5) % 64) - 32;
        context.save();
        diamond(context, center.x, center.y, hw, hh);
        context.clip();
        context.translate(offsetX, offsetY);
        context.fillStyle = pattern;
        context.fillRect(center.x - hw - offsetX, center.y - hh - offsetY, hw * 2, hh * 2);
        context.restore();
      }
    }
  }
  /**
   * Variación de valor a escala grande, sin recortar a la celda. El tablero de damas que produce un
   * tono distinto por loseta es justo lo que hace que el suelo parezca un editor de tiles.
   */
  valueNoise(input);

  /** 3 · Bordes: mezcla de transición, juntas de losa y bordillo. */
  blendEdges(input, surfaceAt, local);
  strokeSidewalks(input, surfaceAt, local);
  strokeCurbs(input, surfaceAt, local);
  const border = local(plan.zoneCenter);
  /** `parcels` se detiene aquí: la evidencia muestra el suelo sin dressing por encima. */
  if (stage === "parcels") {
    fadeBorder(input, border);
    if (showGrid) strokeGrid(input, 0.022);
    return;
  }

  /** 4 · Dressing y decalcos. */
  parkPaths(plan, local, context);
  dress(input, plan, surfaceAt, local);
  fadeBorder(input, border);
  if (showGrid) strokeGrid(input, 0.022);
}

/**
 * Camino de tierra que cruza cada parque. Da escala y uso al verde sin añadir un solo sprite: dos
 * trazos consecutivos, uno ancho de tierra y otro más claro y gastado sobre el eje. La curva es una
 * sinusoides suave de media onda — con más vueltas el camino se convierte en un garabato.
 */
function parkPaths(plan: GroundPlan, local: (cell: GridCell) => Point, context: Context): void {
  for (const park of plan.parks) {
    const next = random(hashCell(park.from.x, park.from.y, 17));
    const amplitude = 0.1 + next() * 0.1;
    const phase = next() * Math.PI;
    const offset = 0.44 + next() * 0.12;
    const points: Point[] = [];
    const steps = 24;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      points.push(
        local({
          x: park.from.x + (park.to.x - park.from.x) * t,
          y:
            park.from.y +
            (park.to.y - park.from.y) * (offset + Math.sin(phase + t * Math.PI) * amplitude),
        }),
      );
    }
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const [width, color] of [
      [13, "rgba(45, 39, 30, 0.5)"],
      [7, "rgba(58, 50, 38, 0.42)"],
    ] as const) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      const first = points[0]!;
      context.moveTo(first.x, first.y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }
}

/**
 * El extrarradio se oscurece. Se aplica al final, sobre parcelas y dressing, para que el límite del
 * distrito no sea un corte neto sino una caída de valor; por eso recorta al rombo del mapa — si no,
 * el modo `multiply` pintaría también las esquinas del bounding box.
 */
function fadeBorder(input: GroundPaintInput, center: Point): void {
  const { context, layout } = input;
  context.save();
  clipGround(input);
  context.globalCompositeOperation = "multiply";
  const gradient = context.createRadialGradient(
    center.x,
    center.y,
    layout.tileWidth * 9,
    center.x,
    center.y,
    layout.tileWidth * 31,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.55, "#bcc2ca");
  gradient.addColorStop(1, "#6a707a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.restore();
}

/** Recorta al rombo que ocupa el mapa isométrico completo. */
function clipGround(input: GroundPaintInput): void {
  const { context, layout, bounds } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  const point = (cell: GridCell): Point => {
    const screen = gridToScreen(cell, layout);
    return { x: screen.x - bounds.x, y: screen.y - bounds.y };
  };
  const north = point({ x: 0, y: 0 });
  const east = point({ x: layout.mapWidth - 1, y: 0 });
  const south = point({ x: layout.mapWidth - 1, y: layout.mapHeight - 1 });
  const west = point({ x: 0, y: layout.mapHeight - 1 });
  context.beginPath();
  context.moveTo(north.x, north.y - hh);
  context.lineTo(east.x + hw, east.y);
  context.lineTo(south.x, south.y + hh);
  context.lineTo(west.x - hw, west.y);
  context.closePath();
  context.clip();
}

/** Manchas de valor a escala grande: el suelo deja de ser plano sin convertirse en un tablero. */
function valueNoise(input: GroundPaintInput): void {
  const { context, bounds } = input;
  const next = random(GROUND_DRESSING_SEED ^ 0x2f19);
  for (let index = 0; index < 240; index += 1) {
    const light = next() > 0.45;
    blob(
      context,
      next() * bounds.width,
      next() * bounds.height,
      (26 + next() * 70) * 1.7,
      14 + next() * 30,
      light ? "rgba(150, 168, 190, 0.045)" : "rgba(6, 9, 14, 0.06)",
    );
  }
}

function strokeGrid(input: GroundPaintInput, alpha: number): void {
  const { context, layout, bounds } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  context.strokeStyle = `rgba(126, 148, 176, ${alpha})`;
  context.lineWidth = 1;
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      const point = gridToScreen({ x, y }, layout);
      diamond(context, point.x - bounds.x, point.y - bounds.y, hw, hh);
      context.stroke();
    }
  }
}

/**
 * Rompe el rombo perfecto de la cuadrícula: en cada frontera entre dos superficies se salpican
 * manchas de uno y otro lado, de modo que el límite deja de leerse como una línea isométrica recta.
 */
function blendEdges(
  input: GroundPaintInput,
  surfaceAt: (cell: GridCell) => GroundSurface,
  local: (cell: GridCell) => Point,
): void {
  const { context, layout } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  const next = random(GROUND_DRESSING_SEED ^ 0x9e37);
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      const own = surfaceAt({ x, y });
      if (own === "urban") continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const other = surfaceAt({ x: x + dx, y: y + dy });
        if (other === own) continue;
        const center = local({ x, y });
        const from =
          dx === 1 ? { x: center.x + hw, y: center.y } : { x: center.x, y: center.y + hh };
        const to = dx === 1 ? { x: center.x, y: center.y + hh } : { x: center.x - hw, y: center.y };
        for (let index = 0; index < 7; index += 1) {
          const t = 0.1 + next() * 0.8;
          context.fillStyle = SURFACE_STYLE[next() > 0.5 ? other : own].base;
          context.globalAlpha = 0.32 + next() * 0.3;
          context.beginPath();
          context.ellipse(
            from.x + (to.x - from.x) * t + (next() - 0.5) * 11,
            from.y + (to.y - from.y) * t + (next() - 0.5) * 7,
            3 + next() * 6,
            1.8 + next() * 2.8,
            next() * Math.PI,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        context.globalAlpha = 1;
      }
    }
  }
}

/** Juntas de losa perpendiculares al sentido de la acera: hormigón cada cuatro metros. */
function strokeSidewalks(
  input: GroundPaintInput,
  surfaceAt: (cell: GridCell) => GroundSurface,
  local: (cell: GridCell) => Point,
): void {
  const { context, layout } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  context.lineWidth = 1;
  context.strokeStyle = "rgba(18, 23, 30, 0.32)";
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      if (surfaceAt({ x, y }) !== "pavement") continue;
      const center = local({ x, y });
      const alongX =
        surfaceAt({ x: x + 1, y }) === "pavement" || surfaceAt({ x: x - 1, y }) === "pavement";
      const alongY =
        surfaceAt({ x, y: y + 1 }) === "pavement" || surfaceAt({ x, y: y - 1 }) === "pavement";
      if (!alongX && !alongY) continue;
      context.beginPath();
      if (alongX) {
        context.moveTo(center.x + hw, center.y);
        context.lineTo(center.x, center.y + hh);
        context.moveTo(center.x - hw, center.y);
        context.lineTo(center.x, center.y - hh);
      }
      if (alongY) {
        context.moveTo(center.x, center.y + hh);
        context.lineTo(center.x - hw, center.y);
        context.moveTo(center.x, center.y - hh);
        context.lineTo(center.x + hw, center.y);
      }
      context.stroke();
    }
  }
}

/**
 * Filo del bordillo: junta oscura en el límite y canto claro desplazado hacia la acera. Las aristas
 * siguen a los vecinos isométricos — (x+1,y) comparte E–S, (x,y+1) comparte S–W.
 */
function strokeCurbs(
  input: GroundPaintInput,
  surfaceAt: (cell: GridCell) => GroundSurface,
  local: (cell: GridCell) => Point,
): void {
  const { context, layout } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      if (surfaceAt({ x, y }) !== "pavement") continue;
      const center = local({ x, y });
      const corners: Record<string, Point> = {
        n: { x: center.x, y: center.y - hh },
        e: { x: center.x + hw, y: center.y },
        s: { x: center.x, y: center.y + hh },
        w: { x: center.x - hw, y: center.y },
      };
      const edges: [Point, Point][] = [];
      if (surfaceAt({ x: x + 1, y }) === "asphalt") edges.push([corners.e!, corners.s!]);
      if (surfaceAt({ x, y: y + 1 }) === "asphalt") edges.push([corners.s!, corners.w!]);
      if (surfaceAt({ x: x - 1, y }) === "asphalt") edges.push([corners.w!, corners.n!]);
      if (surfaceAt({ x, y: y - 1 }) === "asphalt") edges.push([corners.n!, corners.e!]);
      for (const [from, to] of edges) {
        context.lineWidth = 1.5;
        context.strokeStyle = EDGE_DARK;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const length = Math.hypot(center.x - mid.x, center.y - mid.y) || 1;
        const ox = ((center.x - mid.x) / length) * 2.5;
        const oy = ((center.y - mid.y) / length) * 2.5;
        context.lineWidth = 1;
        context.strokeStyle = EDGE_LIGHT;
        context.beginPath();
        context.moveTo(from.x + ox, from.y + oy);
        context.lineTo(to.x + ox, to.y + oy);
        context.stroke();
      }
    }
  }
}

/** Dressing determinista: mechones, tierra, grava, hojarasca, desgaste y rodera de la obra. */
function dress(
  input: GroundPaintInput,
  plan: GroundPlan,
  surfaceAt: (cell: GridCell) => GroundSurface,
  local: (cell: GridCell) => Point,
): void {
  const { context, layout } = input;
  const hw = layout.tileWidth / 2;
  const hh = layout.tileHeight / 2;
  const next = random(GROUND_DRESSING_SEED ^ 0x51ab);
  for (let y = 0; y < layout.mapHeight; y += 1) {
    for (let x = 0; x < layout.mapWidth; x += 1) {
      const surface = surfaceAt({ x, y });
      if (surface === "asphalt") continue;
      const center = local({ x, y });
      const salt = hashCell(x, y, 23);
      if (surface === "grass" || surface === "urban") {
        const tufts = surface === "grass" ? 3 + (salt % 4) : salt % 3;
        for (let index = 0; index < tufts; index += 1) {
          const px = center.x + (next() - 0.5) * hw * 1.5;
          const py = center.y + (next() - 0.5) * hh * 1.5;
          const height = 2 + next() * 2.5;
          context.strokeStyle = next() > 0.4 ? "#33513c" : "#2a4331";
          context.globalAlpha = 0.3 + next() * 0.3;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(px - 1.4, py - height);
          context.moveTo(px, py);
          context.lineTo(px + 1.2, py - height * 0.8);
          context.stroke();
        }
        if (salt % 7 === 0) {
          blob(
            context,
            center.x + (next() - 0.5) * 18,
            center.y + (next() - 0.5) * 9,
            (12 + next() * 12) * 1.7,
            6 + next() * 5,
            "rgba(58, 49, 38, 0.45)",
          );
        }
      }
      if (surface === "dirt" || surface === "construction") {
        for (let index = 0; index < 6 + (salt % 6); index += 1) {
          context.fillStyle = next() > 0.5 ? "#4b4130" : "#2b2419";
          context.globalAlpha = 0.35 + next() * 0.35;
          context.beginPath();
          context.ellipse(
            center.x + (next() - 0.5) * hw * 1.6,
            center.y + (next() - 0.5) * hh * 1.6,
            1 + next() * 2.4,
            0.8 + next() * 1.4,
            next() * Math.PI,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      if (surface === "gravel" || surface === "pavement") {
        for (let index = 0; index < salt % 4; index += 1) {
          context.fillStyle = next() > 0.6 ? "#525a66" : "#262c35";
          context.globalAlpha = 0.25 + next() * 0.3;
          context.beginPath();
          context.ellipse(
            center.x + (next() - 0.5) * hw * 1.6,
            center.y + (next() - 0.5) * hh * 1.6,
            1 + next() * 1.6,
            0.7 + next(),
            next() * Math.PI,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        if (surface === "pavement" && salt % 13 === 0) {
          context.strokeStyle = "rgba(20, 25, 33, 0.5)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(center.x - 6, center.y + (next() - 0.5) * 6);
          context.lineTo(center.x + 4, center.y + (next() - 0.5) * 8);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    }
  }

  /** Bajo el arbolado: tierra removida y hojarasca, para que el árbol no aparezca pegado al suelo. */
  for (const tree of plan.treeCells) {
    const center = local(tree);
    blob(context, center.x, center.y + 2, 17 * 1.7, 9, "rgba(38, 33, 24, 0.5)");
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + next();
      const radius = 8 + next() * 9;
      context.fillStyle = index % 3 === 0 ? "#3d5a3f" : "#4a3f2b";
      context.globalAlpha = 0.25 + next() * 0.3;
      context.beginPath();
      context.ellipse(
        center.x + Math.cos(angle) * radius * 1.8,
        center.y + Math.sin(angle) * radius * 0.7,
        2 + next() * 2,
        1 + next(),
        angle,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** Desgaste de uso: papelera, banco y rodera del acceso de obra. */
  for (const bin of plan.binCells) {
    const center = local(bin);
    blob(context, center.x, center.y + 3, 12 * 1.7, 6, "rgba(12, 16, 22, 0.35)");
  }
  for (const bench of plan.benchCells) {
    const center = local(bench);
    blob(context, center.x, center.y + 4, 16 * 1.7, 7, "rgba(44, 38, 28, 0.35)");
  }
  const access = plan.access;
  context.strokeStyle = "rgba(20, 24, 30, 0.3)";
  context.lineWidth = 3;
  for (const offset of [-4, 4]) {
    const from = local({ x: access.from.x, y: access.from.y });
    const to = local({ x: access.to.x, y: access.to.y + 1 });
    context.beginPath();
    context.moveTo(from.x + offset, from.y);
    context.lineTo(to.x + offset, to.y);
    context.stroke();
  }
}

/**
 * Paso de peatones del cruce. Va en su propia textura porque la calzada es un sprite de Blender por
 * encima del suelo horneado; una sola imagen se reutiliza en los cuatro cruces de la composición.
 */
export function paintCrossing(context: Context, layout: IsometricLayout): void {
  const origin = gridToScreen({ x: 0, y: 0 }, layout);
  const point = (gx: number, gy: number) => {
    const screen = gridToScreen({ x: gx, y: gy }, layout);
    return {
      x: screen.x - origin.x + context.canvas.width / 2,
      y: screen.y - origin.y + context.canvas.height / 2,
    };
  };
  context.fillStyle = MARKING;
  context.globalAlpha = 0.45;
  for (const [alongX, alongY] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    for (let step = 0; step < 4; step += 1) {
      const near = 0.62 + step * 0.2;
      const far = near + 0.1;
      /** `u` avanza por la calzada hacia la boca del cruce; `v` la cruza de bordillo a bordillo. */
      const corner = (u: number, v: number) =>
        point(alongX * u + alongY * v, alongY * u + alongX * v);
      const a = corner(near, -0.42);
      const b = corner(far, -0.42);
      const c = corner(far, 0.42);
      const d = corner(near, 0.42);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.lineTo(d.x, d.y);
      context.closePath();
      context.fill();
    }
  }
  context.globalAlpha = 1;
}
