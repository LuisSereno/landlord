import { z } from "zod";

import type { RoadCellClass, RoadSegment } from "./domain";
import type { GridCell } from "./time-and-grid";

/**
 * V.l.2 (D-104) · sección transversal de la calzada como dato puro. El eje sigue siendo la verdad de
 * red (`RoadSegment`, `roadSegmentId`, `roadCellsFromSegments` en `domain.ts` no se tocan): aquí se
 * deriva el **corredor** que ocupa ese eje, con aceras, carriles y mediana. Nada de esto decide
 * edificabilidad ni tráfico; V.l.4 lo consume como suelo no edificable y V.l.7 lo pinta por rol.
 */

/** Rol de una celda del corredor. `median` es la mediana central, no un carril. */
export const roadCellRoleSchema = z.enum(["sidewalk", "carriageway", "median"]);
export type RoadCellRole = z.infer<typeof roadCellRoleSchema>;

/**
 * Sentido de un carril respecto al avance `from → to` del segmento. `both` = calzada de doble sentido
 * sin separación (la calle de 3). `null` en `laneSenses` = esa posición no es carril (acera o mediana).
 */
export const laneSenseSchema = z.enum(["forward", "backward", "both"]);
export type LaneSense = z.infer<typeof laneSenseSchema>;

export const roadProfileIdSchema = z.enum(["street", "avenue", "motorway"]);
export type RoadProfileId = z.infer<typeof roadProfileIdSchema>;

export type RoadProfile = {
  id: RoadProfileId;
  /** Ancho total en celdas, aceras incluidas. Impar: la mediana cae en el centro. */
  width: number;
  /** Roles del lado izquierdo al derecho del avance, es decir de offset −half a +half. */
  roles: readonly RoadCellRole[];
  /** Un sentido por posición transversal; `null` donde no hay carril. */
  laneSenses: readonly (LaneSense | null)[];
};

/**
 * Circulación por la derecha: avanzando `from → to`, el lado **derecho** lleva sentido `forward`.
 * El perpendicular es la dirección rotada +90° en retícula con +y hacia abajo, `(dx,dy) → (−dy,dx)`:
 * para +x el lado derecho es +y, y para +y es −x. Así el sentido no depende de la orientación del
 * tramo y la invariante sentido⇄bordillo de V.l.7 se puede comprobar en los cuatro rumbos.
 */
export const ROAD_PROFILES: Readonly<Record<RoadProfileId, RoadProfile>> = {
  street: {
    id: "street",
    width: 3,
    roles: ["sidewalk", "carriageway", "sidewalk"],
    laneSenses: [null, "both", null],
  },
  avenue: {
    id: "avenue",
    width: 5,
    roles: ["sidewalk", "carriageway", "median", "carriageway", "sidewalk"],
    laneSenses: [null, "backward", null, "forward", null],
  },
  motorway: {
    id: "motorway",
    width: 7,
    roles: [
      "sidewalk",
      "carriageway",
      "carriageway",
      "median",
      "carriageway",
      "carriageway",
      "sidewalk",
    ],
    laneSenses: [null, "backward", "backward", null, "forward", "forward", null],
  },
};

/**
 * Exigido por el tipo: si V.l.4 añade una clase a `roadCellClassSchema`, este registro deja de
 * compilar hasta que se le asigne perfil. Es fail-closed deliberado, no un fallback a `street`.
 */
const PROFILE_BY_CLASS: Readonly<Record<RoadCellClass, RoadProfileId>> = {
  street: "street",
  avenue: "avenue",
  motorway: "motorway",
};

export function roadProfileForClass(roadClass: RoadCellClass): RoadProfile {
  return ROAD_PROFILES[PROFILE_BY_CLASS[roadClass]];
}

/**
 * V.l.4 · sección de ancho 1: el corredor coincide exactamente con el eje. Es la geometría con la
 * que se generaron las redes `derivationVersion: 2` y la que siguen usando los perfiles cuya receta
 * no puede permitirse perder suelo (medido: el corredor completo consume ~2,7× el eje y rompe las
 * cuotas de usos en 3 de los 9 perfiles). El id sigue siendo el de la clase, así que una avenida de
 * ancho 1 se sigue llamando avenida.
 */
export function roadAxisProfileForClass(roadClass: RoadCellClass): RoadProfile {
  return {
    id: PROFILE_BY_CLASS[roadClass],
    width: 1,
    roles: ["carriageway"],
    laneSenses: ["both"],
  };
}

/** Mismo tamaño que los literales `width`/`height` de `ViewProjectionV2.map`. */
const MAP_SIZE = 64;

/** Mayor perfil manda cuando dos corredores se pisan (igual que `avenue` domina hoy la clase). */
const PROFILE_RANK: Readonly<Record<RoadProfileId, number>> = {
  street: 0,
  avenue: 1,
  motorway: 2,
};

function roadCellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

/** Orden canónico de segmentos, el mismo que valida `snapshot.ts` y normaliza `urban-fabric.ts`. */
function compareSegments(left: RoadSegment, right: RoadSegment): number {
  return (
    left.from.y - right.from.y ||
    left.from.x - right.from.x ||
    left.class.localeCompare(right.class) ||
    left.to.y - right.to.y ||
    left.to.x - right.to.x
  );
}

type CellAccumulator = {
  /** Orientaciones de los segmentos cuyo eje propio pasa por esta celda (offset 0). */
  axisOrientations: Set<"horizontal" | "vertical">;
  /** Rol central del primer segmento, en orden canónico, cuyo eje pasa por aquí. */
  axisRole: RoadCellRole | null;
  bestRole: RoadCellRole;
  bestRank: number;
  bestOffset: number;
  /** Segmentos cuyo corredor cubre la celda, aunque no la tengan como eje (frentes de parcela). */
  owners: string[];
};

/**
 * Recorrido único del corredor, en orden canónico de segmentos para que el resultado no dependa del
 * orden de entrada. Acumula por celda cuántos ejes la pisan y cuál es el mejor lateral; el rol se
 * resuelve después con las tres reglas de `resolveRole`.
 *
 * Las celdas fuera de `[0,64)` se **recortan**, no se desplazan: los ejes de la retícula caen en 0 y
 * 63, así que media sección se pierde en el borde del distrito.
 */
function crossSectionByCell(
  segments: readonly RoadSegment[],
  profileForClass: (roadClass: RoadCellClass) => RoadProfile,
): Map<string, CellAccumulator> {
  const cells = new Map<string, CellAccumulator>();
  const ordered = [...segments].sort(compareSegments);
  for (const segment of ordered) {
    const dx = Math.sign(segment.to.x - segment.from.x);
    const dy = Math.sign(segment.to.y - segment.from.y);
    if (dx !== 0 && dy !== 0) throw new Error(`Road segment ${segment.id} is not orthogonal`);
    const profile = profileForClass(segment.class);
    const half = (profile.width - 1) / 2;
    if (!Number.isInteger(half)) throw new Error(`Road profile ${profile.id} width must be odd`);
    // Un tramo de una sola celda no tiene avance: se lee como si avanzara en +x.
    const forward = { x: dx === 0 && dy === 0 ? 1 : dx, y: dy };
    const perpendicular = { x: -forward.y, y: forward.x };
    const length = Math.max(
      Math.abs(segment.to.x - segment.from.x),
      Math.abs(segment.to.y - segment.from.y),
    );
    const rank = PROFILE_RANK[profile.id];
    for (let step = 0; step <= length; step += 1) {
      const axis = { x: segment.from.x + dx * step, y: segment.from.y + dy * step };
      for (let index = 0; index < profile.width; index += 1) {
        const signed = index - half;
        const cell = {
          x: axis.x + perpendicular.x * signed,
          y: axis.y + perpendicular.y * signed,
        };
        if (cell.x < 0 || cell.y < 0 || cell.x >= MAP_SIZE || cell.y >= MAP_SIZE) continue;
        const key = roadCellKey(cell);
        const role = profile.roles[index]!;
        const offset = Math.abs(signed);
        const current = cells.get(key);
        if (!current) {
          cells.set(key, {
            axisOrientations:
              offset === 0 ? new Set([dx === 0 ? "vertical" : "horizontal"]) : new Set(),
            axisRole: offset === 0 ? role : null,
            bestRole: role,
            bestRank: rank,
            bestOffset: offset,
            owners: [segment.id],
          });
          continue;
        }
        current.owners.push(segment.id);
        if (offset === 0) {
          current.axisOrientations.add(dx === 0 ? "vertical" : "horizontal");
          current.axisRole ??= role;
        }
        if (rank > current.bestRank || (rank === current.bestRank && offset < current.bestOffset)) {
          current.bestRole = role;
          current.bestRank = rank;
          current.bestOffset = offset;
        }
      }
    }
  }
  return cells;
}

/**
 * Precedencia del rol, en este orden:
 *
 * 1. **Dos ejes que se cruzan son calzada.** La mediana y las aceras se interrumpen en la
 *    intersección, como en una calle real; si no, el centro del cruce sería mediana y cortaría la vía.
 * 2. **Un eje conserva su rol central** aunque el perfil mayor de otra vía lo alcance como acera o
 *    mediana: el eje es la verdad de red (D-104), lo publica `map.roads.cells` y por ahí circulan
 *    vehículos y A\*. Una avenida no puede convertir el eje de una calle transversal en acera.
 * 3. **Entre celdas que no son eje de nadie**, perfil de mayor rango y, empatado, la más cercana a su
 *    propio eje. El orden canónico del recorrido desempata lo que quede.
 */
function resolveRole(cell: CellAccumulator): RoadCellRole {
  // Los segmentos colineales pueden solaparse en una celda (la retícula generada publica la
  // línea de avenida como `street` y como `avenue`). Es un único eje, no un cruce: se conserva
  // la mediana de la avenida. Sólo los ejes perpendiculares la interrumpen.
  if (cell.axisOrientations.has("horizontal") && cell.axisOrientations.has("vertical")) {
    return "carriageway";
  }
  if (cell.axisOrientations.size === 1) return cell.axisRole!;
  return cell.bestRole;
}

/** Celdas del corredor (eje + aceras + mediana), recortadas al distrito. Incluye siempre el eje. */
export function roadCorridorCellsFromSegments(
  segments: readonly RoadSegment[],
  profileForClass: (roadClass: RoadCellClass) => RoadProfile = roadProfileForClass,
): ReadonlySet<string> {
  return new Set(crossSectionByCell(segments, profileForClass).keys());
}

/** Rol ganador por celda del corredor, con la misma precedencia que `roadCorridorCellsFromSegments`. */
export function roadCellRolesFromSegments(
  segments: readonly RoadSegment[],
  profileForClass: (roadClass: RoadCellClass) => RoadProfile = roadProfileForClass,
): ReadonlyMap<string, RoadCellRole> {
  const roles = new Map<string, RoadCellRole>();
  for (const [key, cell] of crossSectionByCell(segments, profileForClass)) {
    roles.set(key, resolveRole(cell));
  }
  return roles;
}

/**
 * V.l.4 · qué segmentos sirven cada celda del corredor, no sólo las del eje. Es lo que permite que
 * una parcela tenga frente vial contra la **acera** de una avenida, que es su frente real. Orden
 * canónico y sin duplicados, para que `parcelRoadFrontages` siga siendo determinista.
 */
export function roadCorridorSegmentsByCell(
  segments: readonly RoadSegment[],
  profileForClass: (roadClass: RoadCellClass) => RoadProfile = roadProfileForClass,
): ReadonlyMap<string, readonly string[]> {
  const owners = new Map<string, readonly string[]>();
  for (const [key, cell] of crossSectionByCell(segments, profileForClass)) {
    owners.set(key, [...new Set(cell.owners)].sort());
  }
  return owners;
}
