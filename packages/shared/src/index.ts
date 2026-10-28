import { z } from "zod";

export * from "./primitives";
export * from "./time-and-grid";
export * from "./money";
export * from "./contracts";
export * from "./responses";
export * from "./domain";
export * from "./urban";
export * from "./assets";
export * from "./projection";
export * from "./snapshot";

export const sharedPackage = "@landlord/shared" as const;

export const packageSmokeSchema = z.literal(sharedPackage);
