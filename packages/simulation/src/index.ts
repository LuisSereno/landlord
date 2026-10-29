export const simulationPackage = "@landlord/simulation" as const;

export * from "./prng";
/** Catálogo de tipos de edificio: dato de dominio que la presentación también necesita validar. */
export { BUILDING_DEFINITIONS } from "./game-data";
export * from "./clock";
export * from "./district-profiles";
export * from "./district-generator";
export * from "./state";
export * from "./commands";
export * from "./runner";
export * from "./projection";
export * from "./worker-runtime";
export * from "./snapshot";
export * from "./benchmark";
