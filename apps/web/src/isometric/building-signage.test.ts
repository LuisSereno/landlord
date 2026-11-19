import { describe, expect, it } from "vitest";
import type { BuildingAssetV2, BuildingType, ViewProjectionV3 } from "@landlord/shared";
import { buildingSpritePlan } from "./building-sprites";
import {
  DEFAULT_SIGNAGE_LOCALE,
  buildingSignagePlan,
  reconcileBuildingSignage,
  resolveSignageLocale,
  signageAnchorFor,
  signageEntryFor,
  signageKeyFor,
  signagePlateStyleFor,
  signageSalienceFor,
  signageTextFor,
  type BuildingSignageEntry,
  type SignageKey,
  type SignagePlanInput,
} from "./building-signage";

const SIGNAGE_TYPES: ReadonlyArray<readonly [BuildingType, string, string]> = [
  ["town_hall", "civic.town_hall", "AYUNTAMIENTO"],
  ["school_block", "civic.school", "COLEGIO"],
  ["clinic", "civic.clinic", "CLÍNICA"],
  ["police_station", "civic.police", "COMISARÍA"],
  ["fire_station", "civic.fire", "BOMBEROS"],
  ["market_hall", "civic.market", "MERCADO"],
  ["workshop", "industry.workshop", "TALLER"],
  ["warehouse", "industry.warehouse", "NAVE LOGÍSTICA"],
  ["cement_plant", "industry.cement", "CEMENTERA"],
  ["brickworks", "industry.brick", "LADRILLERA"],
  ["steelworks", "industry.steel", "ACERÍA"],
];

const BANNER_TYPES: readonly string[] = [
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
];

const NO_SIGNAGE_TYPES = [
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "unknown_type",
  "",
] as const;

const FAKE_ASSET = {
  footprint: { width: 1, height: 1 },
  pivot: { x: 0.5, y: 0.93 },
  states: {},
} as unknown as BuildingAssetV2;

type Economy = Pick<NonNullable<ViewProjectionV3["economy"]>, "buildings" | "constructionSites">;

function building(
  id: string,
  type: string,
  overrides: Partial<{ state: string; condition: number }> = {},
) {
  return {
    id,
    parcelIds: [`p_${id}`],
    districtId: "d1",
    type,
    footprintCells: [{ x: 1, y: 1 }],
    orientation: 0,
    floors: 1,
    form: "block",
    level: 1,
    condition: 100,
    state: "operational",
    ...overrides,
  };
}

function economyWith(buildings: ReturnType<typeof building>[], sites: unknown[] = []): Economy {
  return { buildings, constructionSites: sites } as unknown as Economy;
}

/** El mismo camino que la escena: proyección → plan de sprites (asset resuelto) → señalización. */
function planFor(economy: Economy) {
  return buildingSpritePlan(economy, {
    archetypeFor: (_id, domainType) => domainType,
    resolveVisual: () => ({ key: "resolved", asset: FAKE_ASSET }),
  });
}

function input(overrides: Partial<SignagePlanInput> = {}): SignagePlanInput {
  return {
    id: "building:b1",
    entityKind: "building",
    domainType: "clinic",
    assetState: "complete",
    orientation: 0,
    ...overrides,
  };
}

describe("catálogo semántico de señalización", () => {
  it("todos los tipos oficiales e industriales devuelven una clave estable", () => {
    for (const [type, key] of SIGNAGE_TYPES) {
      expect(signageKeyFor(type)).toBe(key);
    }
  });

  it("viviendas, mixed_tenement y tipos desconocidos devuelven null", () => {
    for (const type of NO_SIGNAGE_TYPES) {
      expect(signageKeyFor(type)).toBeNull();
    }
  });

  it("la clave es semántica y no el texto final", () => {
    const key = signageKeyFor("clinic");
    expect(key).toBe("civic.clinic");
    expect(key).not.toBe("CLÍNICA");
  });
});

describe("resolver de locale", () => {
  it("español devuelve el texto de señalización esperado", () => {
    for (const [, key, text] of SIGNAGE_TYPES) {
      expect(signageTextFor(key as never, "es")).toBe(text);
    }
  });

  it("un locale desconocido cae a español", () => {
    expect(resolveSignageLocale("fr")).toBe(DEFAULT_SIGNAGE_LOCALE);
    expect(resolveSignageLocale("")).toBe(DEFAULT_SIGNAGE_LOCALE);
    expect(resolveSignageLocale("es")).toBe("es");
    expect(signageTextFor("civic.clinic", "fr")).toBe("CLÍNICA");
    expect(signageTextFor("industry.warehouse", "xx-YY")).toBe("NAVE LOGÍSTICA");
  });

  it("el texto por defecto es español", () => {
    expect(signageTextFor("civic.fire")).toBe("BOMBEROS");
  });
});

describe("anclaje integrado por arquetipo", () => {
  it("cada tipo con rótulo declara un anclaje normalizado dentro de la caja del sprite", () => {
    for (const [type] of SIGNAGE_TYPES) {
      const anchor = signageAnchorFor(type, 0);
      expect(anchor.x).toBeGreaterThan(0);
      expect(anchor.x).toBeLessThan(1);
      expect(anchor.y).toBeGreaterThan(0);
      expect(anchor.y).toBeLessThan(1);
    }
  });

  it("el anclaje cae en la banda de fachada, no sobre el solar ni flotando arriba", () => {
    // La fachada/volumen visible vive en la mitad inferior-media de la caja; nunca en y<0.3.
    for (const [type] of SIGNAGE_TYPES) {
      expect(signageAnchorFor(type, 0).y).toBeGreaterThanOrEqual(0.4);
      expect(signageAnchorFor(type, 0).y).toBeLessThanOrEqual(0.75);
    }
  });

  it("180° espeja la fachada en horizontal; 90/270 centran sobre la masa", () => {
    const base = signageAnchorFor("fire_station", 0);
    expect(signageAnchorFor("fire_station", 180)).toEqual({ x: 1 - base.x, y: base.y });
    expect(signageAnchorFor("fire_station", 90).x).toBe(0.5);
    expect(signageAnchorFor("fire_station", 270).x).toBe(0.5);
  });

  it("un tipo sin rótulo usa el anclaje por defecto sin romper", () => {
    const anchor = signageAnchorFor("row_house", 0);
    expect(anchor.x).toBeGreaterThan(0);
    expect(anchor.y).toBeGreaterThan(0);
  });

  it("la entrada del plan arrastra el anclaje de su tipo y orientación", () => {
    const entry = signageEntryFor(input({ domainType: "fire_station", orientation: 180 }));
    expect(entry?.anchor).toEqual(signageAnchorFor("fire_station", 180));
  });

  it("colegio y mercado caen en la cornisa, no en el borde superior del tejado", () => {
    // Dirección artística v3: ambas placas bajaron hacia la fachada (y ≥ 0.55 sobre la caja).
    expect(signageAnchorFor("school_block", 0).y).toBeGreaterThanOrEqual(0.55);
    expect(signageAnchorFor("market_hall", 0).y).toBeGreaterThanOrEqual(0.55);
    expect(signageAnchorFor("school_block", 0).y).toBeLessThanOrEqual(0.7);
    expect(signageAnchorFor("market_hall", 0).y).toBeLessThanOrEqual(0.7);
  });

  it("bomberos y clínica caen sobre la masa del edificio, no rozando el borde izquierdo", () => {
    // Dirección artística v4: en estos dos sprites la masa opaca está a la derecha del centro del
    // frame (la sombra llena la franja izquierda), así que un anclaje ≤ 0,5 dejaba la placa al aire.
    for (const type of ["fire_station", "clinic"] as const) {
      const x = signageAnchorFor(type, 0).x;
      expect(x).toBeGreaterThanOrEqual(0.5);
      expect(x).toBeLessThanOrEqual(0.6);
    }
  });
});

describe("forma de placa por familia", () => {
  it("la industria pesada declara cartel alargado", () => {
    for (const type of BANNER_TYPES) {
      expect(signagePlateStyleFor(type)).toBe("banner");
    }
  });

  it("lo cívico y lo que no tiene rótulo conservan la placa compacta", () => {
    for (const [type] of SIGNAGE_TYPES) {
      if (BANNER_TYPES.includes(type)) continue;
      expect(signagePlateStyleFor(type)).toBe("compact");
    }
    expect(signagePlateStyleFor("row_house")).toBe("compact");
    expect(signagePlateStyleFor("unknown_type")).toBe("compact");
  });

  it("el cartel alargado sólo existe en tipos que llevan rótulo", () => {
    for (const type of NO_SIGNAGE_TYPES) {
      expect(signageKeyFor(type)).toBeNull();
      expect(signagePlateStyleFor(type)).toBe("compact");
    }
    for (const type of BANNER_TYPES) expect(signageKeyFor(type)).not.toBeNull();
  });

  it("la entrada del plan arrastra el estilo de placa de su tipo", () => {
    expect(signageEntryFor(input({ domainType: "warehouse" }))?.plateStyle).toBe("banner");
    expect(signageEntryFor(input({ domainType: "clinic" }))?.plateStyle).toBe("compact");
  });
});

describe("saliencia para la densidad adaptativa", () => {
  it("todo tipo con rótulo declara una saliencia, sin huecos en la tabla", () => {
    for (const [, key] of SIGNAGE_TYPES) {
      expect(["public_service", "commercial"]).toContain(signageSalienceFor(key as SignageKey));
    }
  });

  it("los servicios públicos se destacan; la industria pesada no", () => {
    for (const [, key] of SIGNAGE_TYPES) {
      const expected = key.startsWith("civic.") ? "public_service" : "commercial";
      expect(signageSalienceFor(key as SignageKey)).toBe(expected);
    }
  });

  it("la entrada del plan arrastra la saliencia de su clave", () => {
    expect(signageEntryFor(input({ domainType: "clinic" }))?.salience).toBe("public_service");
    expect(signageEntryFor(input({ domainType: "steelworks" }))?.salience).toBe("commercial");
  });
});

describe("elegibilidad sobre el plan de sprites", () => {
  it("un edificio terminado elegible produce rótulo; una vivienda no", () => {
    expect(signageEntryFor(input())).toEqual({
      id: "building:b1",
      key: "civic.clinic",
      text: "CLÍNICA",
      anchor: { x: 0.56, y: 0.55 },
      plateStyle: "compact",
      salience: "public_service",
    });
    expect(signageEntryFor(input({ domainType: "row_house" }))).toBeNull();
    expect(signageEntryFor(input({ domainType: "mixed_tenement" }))).toBeNull();
  });

  it("construction, damaged y burning no rotulan", () => {
    expect(signageEntryFor(input({ entityKind: "construction" }))).toBeNull();
    expect(signageEntryFor(input({ assetState: "construction" }))).toBeNull();
    expect(signageEntryFor(input({ assetState: "damaged" }))).toBeNull();
    expect(signageEntryFor(input({ assetState: "burning" }))).toBeNull();
  });

  it("el plan completo sólo rotula los edificios terminados elegibles", () => {
    const economy = economyWith([
      building("clinic1", "clinic"),
      building("market1", "market_hall"),
      building("home1", "row_house"),
      building("home2", "apartment_block"),
      building("clinicDamaged", "clinic", { condition: 40 }),
      building("clinicBurning", "clinic", { state: "burning" }),
      building("clinicRuin", "clinic", { state: "ruin" }),
    ]);
    const entries = buildingSignagePlan(planFor(economy));
    expect(entries.map((entry) => entry.id)).toEqual(["building:clinic1", "building:market1"]);
    expect(entries.map((entry) => entry.text)).toEqual(["CLÍNICA", "MERCADO"]);
  });

  it("una obra en curso (constructionSites) no produce rótulo", () => {
    const economy = economyWith(
      [],
      [
        {
          id: "s1",
          parcelIds: ["p1"],
          districtId: "d1",
          buildingType: "clinic",
          footprintCells: [{ x: 2, y: 2 }],
          orientation: 0,
          floors: 1,
          form: "block",
          progress: 0.5,
          workRequired: 1,
        },
      ],
    );
    expect(buildingSignagePlan(planFor(economy))).toEqual([]);
  });

  it("el plan es determinista y de ids únicos", () => {
    const economy = economyWith([building("c1", "clinic"), building("m1", "market_hall")]);
    const plan = planFor(economy);
    const a = buildingSignagePlan(plan);
    const b = buildingSignagePlan(plan);
    expect(a).toEqual(b);
    expect(new Set(a.map((entry) => entry.id)).size).toBe(a.length);
  });
});

describe("reconciliación entre sincronizaciones (plan de presentación)", () => {
  const economy = economyWith([
    building("clinic1", "clinic"),
    building("market1", "market_hall"),
    building("home1", "row_house"),
  ]);

  it("la primera sincronización crea los rótulos elegibles", () => {
    const result = reconcileBuildingSignage(new Map(), planFor(economy));
    expect(result.created.map((entry) => entry.id)).toEqual([
      "building:clinic1",
      "building:market1",
    ]);
    expect(result.removed).toEqual([]);
    expect(result.next.size).toBe(2);
  });

  it("dos sincronizaciones con el mismo plan no duplican ni destruyen", () => {
    const plan = planFor(economy);
    const first = reconcileBuildingSignage(new Map(), plan);
    const second = reconcileBuildingSignage(first.next, plan);
    expect(second.created).toEqual([]);
    expect(second.removed).toEqual([]);
    expect(second.next.size).toBe(first.next.size);
    expect([...second.next.keys()]).toEqual([...first.next.keys()]);
  });

  it("un edificio que desaparece se elimina y no deja texto fantasma", () => {
    const plan = planFor(economy);
    const first = reconcileBuildingSignage(new Map(), plan);
    const withoutClinic = economyWith([
      building("market1", "market_hall"),
      building("home1", "row_house"),
    ]);
    const second = reconcileBuildingSignage(first.next, planFor(withoutClinic));
    expect(second.removed).toEqual(["building:clinic1"]);
    expect(second.next.has("building:clinic1")).toBe(false);
    expect(second.next.has("building:market1")).toBe(true);
  });

  it("un edificio que pasa a dañado o fuego pierde su rótulo", () => {
    const plan = planFor(economy);
    const first = reconcileBuildingSignage(new Map(), plan);
    const degraded = economyWith([
      building("clinic1", "clinic", { state: "burning" }),
      building("market1", "market_hall", { condition: 30 }),
      building("home1", "row_house"),
    ]);
    const second = reconcileBuildingSignage(first.next, planFor(degraded));
    expect(second.removed.sort()).toEqual(["building:clinic1", "building:market1"]);
    expect(second.next.size).toBe(0);
  });

  it("cambiar de locale actualiza el texto sin recrear la identidad", () => {
    const plan = planFor(economy);
    const first = reconcileBuildingSignage(new Map(), plan, "es");
    const second = reconcileBuildingSignage(first.next, plan, "es");
    const entry: BuildingSignageEntry | undefined = second.next.get("building:clinic1");
    expect(entry?.text).toBe("CLÍNICA");
    expect(second.created).toEqual([]);
  });
});
