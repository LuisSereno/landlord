#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const STATES = ["complete", "foundation", "structure", "finishing", "damaged", "burning"];
const ORIENTATIONS = [0, 90, 180, 270];
const MOODS = ["day_civic", "night_civic"];
const ZOOMS = [0.5, 1, 1.5];
const SOURCE_DIRS = {
  day_civic: "docs/art/cleaning-depot/candidates-day-v1",
  night_civic: "docs/art/cleaning-depot/candidates-night-v1",
};
const FORBIDDEN_MODULES = new Set([
  "mod_kenney_ind_chimney_basic",
  "mod_kenney_ind_chimney_medium",
  "mod_kenney_ind_chimney_large",
  "mod_kenney_ind_tank_small",
  "mod_kenney_ind_tank_medium",
  "mod_kenney_ind_tank_large",
  "mod_kenney_ind_water_tower",
]);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const keyOf = (candidate) => `${candidate.stateToken}|${candidate.orientation}|${candidate.moodId}`;

function candidateIdFor(stateToken, orientation) {
  const stateSuffix = stateToken === "complete" ? "" : `_${stateToken}`;
  const orientSuffix = orientation === 0 ? "" : `_o${orientation}`;
  return `cd_cleaning_depot_5101${stateSuffix}${orientSuffix}`;
}

export function buildCleaningDepotMatrix(root = REPO_ROOT) {
  const assets = [];
  for (const stateToken of STATES) {
    for (const orientation of ORIENTATIONS) {
      for (const moodId of MOODS) {
        const candidateId = candidateIdFor(stateToken, orientation);
        const directory = SOURCE_DIRS[moodId];
        const metadataPath = `${directory}/${candidateId}.json`;
        const pngPath = `${directory}/${candidateId}.png`;
        const metadata = readJson(join(root, metadataPath));
        assets.push({
          key: keyOf({ stateToken, orientation, moodId }),
          candidateId,
          buildingType: "cleaning_depot",
          stateToken,
          runtimeState: metadata.state,
          constructionStage: metadata.constructionStage,
          orientation,
          moodId,
          pngPath,
          metadataPath,
          pngSha256: sha256(join(root, pngPath)),
          metadataSha256: sha256(join(root, metadataPath)),
          pixelSha256: metadata.pixelSha256,
          compositionSignature: metadata.compositionSignature,
          footprint: metadata.footprint,
          pivot: metadata.pivot,
          pixelsPerMeter: metadata.framing.pixelsPerMeter,
          image: { width: metadata.image.width, height: metadata.image.height },
          triangleCount: metadata.triangleCount,
          licensedGeometryRatio: metadata.metrics.licensedGeometryRatio,
          massingId: metadata.axisChoices.massing,
          roofId: metadata.axisChoices.roof,
          accessId: metadata.axisChoices.access,
          entranceVisibility: {
            anyAccessVisible: metadata.orientationStatus.anyAccessVisible,
            visibleAccessCount: metadata.orientationStatus.visibleAccessCount,
            visibleSides: metadata.orientationStatus.visibleSides,
          },
        });
      }
    }
  }
  const countBy = (field) =>
    Object.fromEntries(
      [...new Set(assets.map((asset) => asset[field]))]
        .sort()
        .map((value) => [value, assets.filter((asset) => asset[field] === value).length]),
    );
  return {
    schemaVersion: 1,
    matrixId: "cleaning-depot-candidate-matrix-v1",
    status: "candidate_only_pending_human_visual_approval",
    totalAssets: assets.length,
    expectedAssets: 48,
    summary: {
      byStateToken: countBy("stateToken"),
      byRuntimeState: countBy("runtimeState"),
      byOrientation: countBy("orientation"),
      byMood: countBy("moodId"),
    },
    assets,
  };
}

function validateCapture(root, matrix, errors, requireLocalAssets) {
  const capturePath = join(
    root,
    "docs/art/cleaning-depot/gameplay-capture-v1/capture-manifest.json",
  );
  if (!existsSync(capturePath)) return { status: "pending", captures: 0, missingLocalFiles: 0 };
  let missingLocalFiles = 0;
  const capture = readJson(capturePath);
  if (capture.captureCount !== 144 || capture.captures.length !== 144) {
    errors.push(`captura: se esperaban 144 entradas, hay ${capture.captures.length}`);
  }
  if (capture.productionRuntimeTouched !== false)
    errors.push("captura: se modificó runtime de producción");
  if (capture.pageErrors.length)
    errors.push(`captura: ${capture.pageErrors.length} errores de página`);
  const expectedKeys = new Set(
    STATES.flatMap((stateToken) =>
      ORIENTATIONS.flatMap((orientation) =>
        MOODS.flatMap((moodId) =>
          ZOOMS.map((zoom) => `${stateToken}|${orientation}|${moodId}|${zoom}`),
        ),
      ),
    ),
  );
  const seen = new Set();
  const byCandidate = new Map(
    matrix.assets.map((asset) => [`${asset.candidateId}|${asset.moodId}`, asset]),
  );
  for (const entry of capture.captures) {
    const key = `${entry.stateToken}|${entry.orientation}|${entry.moodId}|${entry.zoom}`;
    if (seen.has(key)) errors.push(`captura: clave duplicada ${key}`);
    seen.add(key);
    if (!expectedKeys.has(key)) errors.push(`captura: clave fuera de matriz ${key}`);
    const file = join(root, "docs/art/cleaning-depot/gameplay-capture-v1", entry.file);
    if (!existsSync(file)) {
      if (requireLocalAssets) errors.push(`captura: falta ${entry.file}`);
      else missingLocalFiles += 1;
    } else if (sha256(file) !== entry.canvasSha256)
      errors.push(`captura: hash canvas ${entry.file}`);
    const source = byCandidate.get(`${entry.candidateId}|${entry.moodId}`);
    if (!source || source.pngSha256 !== entry.sourcePngSha256) {
      errors.push(`captura: procedencia fuente ${entry.candidateId}`);
    } else if (sha256(join(root, source.metadataPath)) !== entry.sourceMetadataSha256) {
      errors.push(`captura: procedencia metadata ${entry.candidateId}`);
    }
    if (entry.placed.length !== 1) errors.push(`captura: ${entry.file} no muestra un depósito`);
    if (entry.placed.some((sample) => sample.organizationIdentityId !== "municipal_blue")) {
      errors.push(`captura: ${entry.file} no usa identidad municipal`);
    }
    if (!entry.realCity?.observedDistrictId)
      errors.push(`captura: ${entry.file} no usa ciudad real`);
    if (entry.pageErrors.length) errors.push(`captura: ${entry.file} registra pageErrors`);
  }
  for (const key of expectedKeys) if (!seen.has(key)) errors.push(`captura: falta ${key}`);
  return {
    status: seen.size === expectedKeys.size && errors.length === 0 ? "valid" : "failed",
    captures: seen.size,
    missingLocalFiles,
  };
}

export function validateCleaningDepotArt({
  root = REPO_ROOT,
  matrix,
  catalog,
  jobs,
  promotionPlan,
  requireLocalAssets = process.env.DEPOT_REQUIRE_LOCAL_ASSETS === "1",
} = {}) {
  const errors = [];
  let missingLocalAssets = 0;
  catalog ??= readJson(join(root, "docs/art/cleaning-depot/candidate-catalog.json"));
  jobs ??= readJson(join(root, "docs/art/cleaning-depot/candidate-jobs.json"));
  promotionPlan ??= readJson(join(root, "docs/art/cleaning-depot/promotion-plan.json"));
  matrix ??= readJson(join(root, "docs/art/cleaning-depot/candidate-matrix.json"));

  if (
    catalog.schemaVersion !== 1 ||
    catalog.expectedAssetCount !== 48 ||
    catalog.identity?.owner !== "municipality" ||
    catalog.identity?.bakedOrganizationColor !== false
  ) {
    errors.push("catálogo: contrato incorrecto");
  }
  if (jobs.schemaVersion !== 1 || jobs.jobs.length !== 1)
    errors.push("jobs: falta el trabajo del depósito");
  if (
    promotionPlan.approvalStatus !== "pending_human" ||
    promotionPlan.automaticPromotion !== false
  ) {
    errors.push(
      "promoción: el plan debe seguir pendiente de aprobación humana y sin automatización",
    );
  }
  for (const [path, expected] of Object.entries(promotionPlan.protectedRuntime ?? {})) {
    const actual = sha256(join(root, path));
    if (actual !== expected) errors.push(`runtime protegido cambió: ${path} (${actual})`);
  }
  const job = jobs.jobs[0];
  if (
    job?.candidateBuildingType !== "cleaning_depot" ||
    job.expectedCount !== 48 ||
    job.seed !== 5101 ||
    job.target !== "evidence" ||
    JSON.stringify(job.states) !== JSON.stringify(STATES) ||
    JSON.stringify(job.orientations) !== JSON.stringify(ORIENTATIONS) ||
    JSON.stringify(job.moods) !== JSON.stringify(MOODS)
  ) {
    errors.push("jobs: contrato incorrecto cd_cleaning_depot_candidate_v1");
  }
  const proposed = promotionPlan.proposedPromotion;
  if (
    proposed?.candidateBuildingType !== "cleaning_depot" ||
    proposed.approvalStatus !== "pending_human" ||
    proposed.runtimeAction !== "manual only after explicit human approval"
  ) {
    errors.push("promoción: falta candidatura pendiente cleaning_depot");
  }
  if (matrix.totalAssets !== 48 || matrix.assets.length !== 48)
    errors.push("matriz: se esperaban 48 assets");
  const keys = new Set();
  for (const asset of matrix.assets) {
    if (keys.has(asset.key)) errors.push(`matriz: clave duplicada ${asset.key}`);
    keys.add(asset.key);
    if (
      asset.buildingType !== "cleaning_depot" ||
      !STATES.includes(asset.stateToken) ||
      !ORIENTATIONS.includes(asset.orientation) ||
      !MOODS.includes(asset.moodId)
    ) {
      errors.push(`matriz: valor fuera de contrato ${asset.key}`);
    }
    const metadata = readJson(join(root, asset.metadataPath));
    const png = join(root, asset.pngPath);
    if (asset.metadataSha256 !== sha256(join(root, asset.metadataPath))) {
      errors.push(`asset: sha metadata ${asset.candidateId}`);
    }
    if (asset.pngSha256 !== metadata.sha256) errors.push(`asset: sha ${asset.candidateId}`);
    if (!existsSync(png)) {
      if (requireLocalAssets) errors.push(`asset: falta ${asset.pngPath}`);
      else missingLocalAssets += 1;
    } else if (sha256(png) !== asset.pngSha256) errors.push(`asset: sha ${asset.candidateId}`);
    if (metadata.buildingType !== "cleaning_depot" || metadata.family !== "industrial_heavy") {
      errors.push(`asset: procedencia ${asset.candidateId}`);
    }
    if (
      metadata.moodId !== asset.moodId ||
      metadata.orientation !== asset.orientation ||
      metadata.constructionStage !== asset.constructionStage
    ) {
      errors.push(`asset: estado/orientación ${asset.candidateId}`);
    }
    const expectedRuntimeState = ["foundation", "structure", "finishing"].includes(asset.stateToken)
      ? "construction"
      : asset.stateToken;
    if (metadata.state !== expectedRuntimeState)
      errors.push(`asset: runtimeState ${asset.candidateId}`);
    const expectedFootprint = [90, 270].includes(asset.orientation)
      ? { width: 1, height: 3 }
      : { width: 3, height: 1 };
    if (JSON.stringify(metadata.footprint) !== JSON.stringify(expectedFootprint))
      errors.push(`asset: huella ${asset.candidateId}`);
    if (!["three_bay_service_shed", "split_service_bays"].includes(metadata.axisChoices.massing)) {
      errors.push(`asset: massing no municipal ${asset.candidateId}`);
    }
    if (
      !metadata.axisChoices.roof.startsWith("flat_") ||
      !metadata.axisChoices.access.includes("three_loading_bays")
    ) {
      errors.push(`asset: cubierta/acceso de servicio ${asset.candidateId}`);
    }
    if (!metadata.axisChoices.bay_sequence.startsWith("service_bays@")) {
      errors.push(`asset: frente sin ritmo de servicio ${asset.candidateId}`);
    }
    const moduleIds = new Set(metadata.transforms.map((entry) => entry.moduleId));
    if ([...moduleIds].some((id) => FORBIDDEN_MODULES.has(id)))
      errors.push(`asset: módulo industrial prohibido ${asset.candidateId}`);
    const noAccessYet = ["foundation", "structure"].includes(asset.stateToken);
    if (!noAccessYet) {
      if (!moduleIds.has("mod_gn_metal_siding_bay_4m"))
        errors.push(`asset: sin chapa perfilada original ${asset.candidateId}`);
      const roles = new Set(metadata.transforms.map((entry) => entry.role));
      if (!roles.has("wall_panel") || !roles.has("doorframe"))
        errors.push(`asset: faltan paño/marco de servicio ${asset.candidateId}`);
    }
    if (
      !Array.isArray(metadata.organizationBadges) ||
      metadata.organizationBadges.some((badge) => badge.bakedOrganizationColor !== null)
    ) {
      errors.push(`asset: color de organización horneado ${asset.candidateId}`);
    }
    if (
      !noAccessYet &&
      metadata.orientationStatus.access.filter((entry) => entry.purpose === "access:frame")
        .length !== 3
    ) {
      errors.push(`asset: no conserva tres bahías de servicio ${asset.candidateId}`);
    }
    if (
      asset.stateToken === "complete" &&
      asset.orientation === 0 &&
      metadata.orientationStatus.visibleAccessCount !== 3
    ) {
      errors.push(
        `asset: las tres bahías no son visibles en la vista frontal ${asset.candidateId}`,
      );
    }
  }
  const expectedKeys = new Set(
    STATES.flatMap((stateToken) =>
      ORIENTATIONS.flatMap((orientation) =>
        MOODS.map((moodId) => keyOf({ stateToken, orientation, moodId })),
      ),
    ),
  );
  for (const key of expectedKeys) if (!keys.has(key)) errors.push(`matriz: falta ${key}`);
  const capture = validateCapture(root, matrix, errors, requireLocalAssets);
  return {
    status: errors.length ? "failed" : "valid",
    errors,
    matrix,
    capture,
    localEvidence: {
      requireLocalAssets,
      missingAssets: missingLocalAssets,
      missingCaptures: capture.missingLocalFiles,
    },
  };
}

function main() {
  const root = REPO_ROOT;
  const writeIndex = process.argv.includes("--write-index");
  const matrix = writeIndex
    ? buildCleaningDepotMatrix(root)
    : readJson(join(root, "docs/art/cleaning-depot/candidate-matrix.json"));
  if (writeIndex)
    writeFileSync(
      join(root, "docs/art/cleaning-depot/candidate-matrix.json"),
      `${JSON.stringify(matrix, null, 1)}\n`,
    );
  const result = validateCleaningDepotArt({ root, matrix });
  writeFileSync(
    join(root, "docs/art/cleaning-depot/validation.json"),
    `${JSON.stringify({ ...result, matrix: undefined, validatedAt: new Date().toISOString() }, null, 1)}\n`,
  );
  if (result.errors.length) {
    console.error(result.errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      status: result.status,
      assets: result.matrix.totalAssets,
      summary: result.matrix.summary,
      capture: result.capture,
      localEvidence: result.localEvidence,
      protectedRuntimeFiles: Object.keys(
        readJson(join(root, "docs/art/cleaning-depot/promotion-plan.json")).protectedRuntime,
      ).length,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
