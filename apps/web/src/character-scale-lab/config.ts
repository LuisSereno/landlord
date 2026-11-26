import type { GridCell } from "../isometric/coordinates";

export type ScaleConfigId = "A" | "B" | "C" | "D";
export const DEFAULT_CONFIG_ID: ScaleConfigId = "B";

export type ScaleConfig = {
  id: ScaleConfigId;
  label: string;
  cameraZoom: number;
  characterWorldHeight: number;
  expectedScreenHeight: number;
};

export const SCALE_CONFIGS: Record<ScaleConfigId, ScaleConfig> = {
  A: {
    id: "A",
    label: "Referencia",
    cameraZoom: 1,
    characterWorldHeight: 28,
    expectedScreenHeight: 28,
  },
  B: {
    id: "B",
    label: "Personajes mayores",
    cameraZoom: 1,
    characterWorldHeight: 34,
    expectedScreenHeight: 34,
  },
  C: {
    id: "C",
    label: "Ciudad más cercana",
    cameraZoom: 1.25,
    characterWorldHeight: 28,
    expectedScreenHeight: 35,
  },
  D: {
    id: "D",
    label: "Combinación moderada",
    cameraZoom: 1.15,
    characterWorldHeight: 34,
    expectedScreenHeight: 39.1,
  },
};

export type ArrangementId = "street" | "lineup" | "door" | "vehicle" | "dense" | "catalog";

export const ARRANGEMENTS: Record<ArrangementId, Record<string, GridCell>> = {
  street: {
    worker: { x: 6, y: 7 },
    supervisor: { x: 9, y: 7 },
    enforcer: { x: 13, y: 11 },
    police: { x: 17, y: 11 },
    firefighter: { x: 20, y: 7 },
  },
  lineup: {
    worker: { x: 8, y: 12 },
    supervisor: { x: 10, y: 12 },
    enforcer: { x: 12, y: 12 },
    police: { x: 14, y: 12 },
    firefighter: { x: 16, y: 12 },
  },
  door: {
    worker: { x: 5, y: 6 },
  },
  vehicle: {
    worker: { x: 11, y: 10 },
    supervisor: { x: 13, y: 10 },
    enforcer: { x: 15, y: 10 },
    police: { x: 17, y: 10 },
    firefighter: { x: 19, y: 10 },
  },
  dense: {
    worker: { x: 6, y: 7 },
    supervisor: { x: 9, y: 7 },
    enforcer: { x: 13, y: 10 },
    police: { x: 17, y: 10 },
    firefighter: { x: 20, y: 10 },
  },
  catalog: {
    civilian_male_a: { x: 3, y: 7 },
    civilian_male_b: { x: 5, y: 7 },
    civilian_female_a: { x: 7, y: 7 },
    civilian_female_b: { x: 9, y: 7 },
    supervisor: { x: 11, y: 7 },
    construction_worker_a: { x: 13, y: 7 },
    construction_worker_b: { x: 15, y: 7 },
    maintenance_technician: { x: 17, y: 7 },
    enforcer_male: { x: 3, y: 11 },
    enforcer_female: { x: 5, y: 11 },
    police: { x: 7, y: 11 },
    firefighter: { x: 9, y: 11 },
    medical_professional: { x: 11, y: 11 },
    municipal_professional: { x: 13, y: 11 },
  },
};

export const CAMERA_TARGETS: Record<ArrangementId, GridCell> = {
  street: { x: 12, y: 9 },
  lineup: { x: 12, y: 12 },
  door: { x: 5, y: 5 },
  vehicle: { x: 15, y: 9 },
  dense: { x: 12, y: 9 },
  catalog: { x: 10, y: 9 },
};
