#!/usr/bin/env node
/** Candidate-only catalog/job/promotion gate for D-110 headquarters art. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const VARIANTS = ["headquarters_cupola", "headquarters_courtyard"];
const STATES = ["complete", "foundation", "structure", "finishing", "damaged", "burning"];
const ORIENTATIONS = [0, 90, 180, 270];
const MOODS = ["day_civic", "night_civic"];
const ZOOMS = [0.5, 1, 1.5];
const SOURCE_DIRS = {
  day_civic: "docs/art/organization-headquarters/candidates-day-v1",
  night_civic: "docs/art/organization-headquarters/candidates-night-v1",
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const keyOf = (candidate) =>
  `${candidate.buildingType}|${candidate.stateToken}|${candidate.orientation}|${candidate.moodId}`;

function candidateIdFor(buildingType, stateToken, orientation) {
  const stateSuffix = stateToken === "complete" ? "" : `_${stateToken}`;
  const orientSuffix = orientation === 0 ? "" : `_o${orientation}`;
  return `hq_${buildingType}_5101${stateSuffix}${orientSuffix}`;
}

export function buildHeadquartersMatrix(root = REPO_ROOT) {
  const assets = [];
  for (const buildingType of VARIANTS) {
    for (const stateToken of STATES) {
      for (const orientation of ORIENTATIONS) {
        for (const moodId of MOODS) {
          const candidateId = candidateIdFor(buildingType, stateToken, orientation);
          const directory = SOURCE_DIRS[moodId];
          const metadataPath = `${directory}/${candidateId}.json`;
          const pngPath = `${directory}/${candidateId}.png`;
          const metadata = readJson(join(root, metadataPath));
          assets.push({
            key: keyOf({ buildingType, stateToken, orientation, moodId }),
            candidateId,
            buildingType,
            variant: buildingType.replace("headquarters_", ""),
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
            organizationBadges: metadata.organizationBadges,
            entranceVisibility: {
              anyAccessVisible: metadata.orientationStatus.anyAccessVisible,
              primaryAccessVisible: metadata.orientationStatus.primaryAccessVisible,
              visibleAccessCount: metadata.orientationStatus.visibleAccessCount,
              visibleSides: [
                ...new Set(
                  metadata.orientationStatus.access
                    .filter((entry) => entry.visible)
                    .map((entry) => entry.side),
                ),
              ],
            },
            architecturalDetails: metadata.architecturalDetails.map((detail) => ({
              id: detail.id,
              kind: detail.kind,
              mount: detail.mount,
              sourceId: detail.sourceId,
              license: detail.license,
            })),
          });
        }
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
    matrixId: "organization-headquarters-candidate-matrix-v1",
    status: "candidate_only_pending_human_visual_approval",
    totalAssets: assets.length,
    expectedAssets: 96,
    summary: {
      byVariant: countBy("buildingType"),
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
    "docs/art/organization-headquarters/gameplay-capture-v1/capture-manifest.json",
  );
  if (!existsSync(capturePath)) return { status: "pending", captures: 0, missingLocalFiles: 0 };
  let missingLocalFiles = 0;
  const capture = readJson(capturePath);
  if (capture.captureCount !== 288 || capture.captures.length !== 288) {
    errors.push(`captura: se esperaban 288 entradas, hay ${capture.captures.length}`);
  }
  if (capture.pageErrors.length)
    errors.push(`captura: ${capture.pageErrors.length} errores de página`);
  const expectedKeys = new Set(
    VARIANTS.flatMap((buildingType) =>
      STATES.flatMap((stateToken) =>
        ORIENTATIONS.flatMap((orientation) =>
          MOODS.flatMap((moodId) =>
            ZOOMS.map((zoom) => `${buildingType}|${stateToken}|${orientation}|${moodId}|${zoom}`),
          ),
        ),
      ),
    ),
  );
  const seen = new Set();
  const byCandidate = new Map(
    matrix.assets.map((asset) => [`${asset.candidateId}|${asset.moodId}`, asset]),
  );
  for (const entry of capture.captures) {
    const key = `${entry.buildingType}|${entry.stateToken}|${entry.orientation}|${entry.moodId}|${entry.zoom}`;
    if (seen.has(key)) errors.push(`captura: clave duplicada ${key}`);
    seen.add(key);
    if (!expectedKeys.has(key)) errors.push(`captura: clave fuera de matriz ${key}`);
    const file = join(root, "docs/art/organization-headquarters/gameplay-capture-v1", entry.file);
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
    if (entry.placed.length !== 2) errors.push(`captura: ${entry.file} no muestra dos identidades`);
    if (new Set(entry.placed.map((sample) => sample.organizationIdentityId)).size !== 2) {
      errors.push(`captura: ${entry.file} no distingue jugador/rival`);
    }
    if (entry.placed.some((sample) => sample.organizationBadgeCount !== 1)) {
      errors.push(`captura: ${entry.file} tiene emblema ausente`);
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

export function validateHeadquartersArt({
  root = REPO_ROOT,
  matrix,
  catalog,
  jobs,
  promotionPlan,
  requireLocalAssets = process.env.HQ_REQUIRE_LOCAL_ASSETS === "1",
} = {}) {
  const errors = [];
  let missingLocalAssets = 0;
  catalog ??= readJson(join(root, "docs/art/organization-headquarters/candidate-catalog.json"));
  jobs ??= readJson(join(root, "docs/art/organization-headquarters/candidate-jobs.json"));
  promotionPlan ??= readJson(join(root, "docs/art/organization-headquarters/promotion-plan.json"));
  matrix ??= readJson(join(root, "docs/art/organization-headquarters/candidate-matrix.json"));

  if (catalog.schemaVersion !== 1 || catalog.variants.length !== 2)
    errors.push("catálogo: faltan dos variantes");
  if (jobs.schemaVersion !== 1 || jobs.jobs.length !== 2) errors.push("jobs: faltan dos trabajos");
  if (
    promotionPlan.approvalStatus !== "approved_human" ||
    promotionPlan.automaticPromotion !== false ||
    !promotionPlan.approvalReference ||
    !existsSync(join(root, promotionPlan.approvalReference)) ||
    !promotionPlan.approvedBy ||
    !promotionPlan.approvedAt
  ) {
    errors.push(
      "promoción: el plan debe registrar aprobación humana, referencia, autor y fecha, sin automatización",
    );
  }
  for (const [path, expected] of Object.entries(promotionPlan.protectedRuntime)) {
    const actual = sha256(join(root, path));
    if (actual !== expected) errors.push(`runtime protegido cambió: ${path} (${actual})`);
  }
  for (const variant of catalog.variants) {
    const job = jobs.jobs.find(
      (entry) => entry.candidateBuildingType === variant.candidateBuildingType,
    );
    if (!job) errors.push(`jobs: falta ${variant.candidateBuildingType}`);
    else {
      if (job.expectedCount !== 48 || job.seed !== 5101 || job.target !== "evidence") {
        errors.push(`jobs: contrato incorrecto ${job.id}`);
      }
      if (JSON.stringify(job.states) !== JSON.stringify(STATES))
        errors.push(`jobs: estados ${job.id}`);
      if (JSON.stringify(job.orientations) !== JSON.stringify(ORIENTATIONS))
        errors.push(`jobs: orientaciones ${job.id}`);
      if (JSON.stringify(job.moods) !== JSON.stringify(MOODS)) errors.push(`jobs: moods ${job.id}`);
    }
    const proposed = promotionPlan.proposedPromotions.find(
      (entry) => entry.candidateBuildingType === variant.candidateBuildingType,
    );
    if (!proposed || proposed.approvalStatus !== "approved_human") {
      errors.push(`promoción: falta aprobación humana de ${variant.variantId}`);
    }
  }
  if (matrix.totalAssets !== 96 || matrix.assets.length !== 96)
    errors.push("matriz: se esperaban 96 assets");
  const keys = new Set();
  for (const asset of matrix.assets) {
    if (keys.has(asset.key)) errors.push(`matriz: clave duplicada ${asset.key}`);
    keys.add(asset.key);
    if (
      !VARIANTS.includes(asset.buildingType) ||
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
    if (metadata.moodId !== asset.moodId || metadata.buildingType !== asset.buildingType)
      errors.push(`asset: procedencia ${asset.candidateId}`);
    if (
      metadata.orientation !== asset.orientation ||
      metadata.constructionStage !== asset.constructionStage
    )
      errors.push(`asset: estado/orientación ${asset.candidateId}`);
    const expectedRuntimeState = ["foundation", "structure", "finishing"].includes(asset.stateToken)
      ? "construction"
      : asset.stateToken;
    if (metadata.state !== expectedRuntimeState)
      errors.push(`asset: runtimeState ${asset.candidateId}`);
    const expectedFootprint = [90, 270].includes(asset.orientation)
      ? { width: 2, height: 4 }
      : { width: 4, height: 2 };
    if (JSON.stringify(metadata.footprint) !== JSON.stringify(expectedFootprint))
      errors.push(`asset: huella ${asset.candidateId}`);
    if (
      !Array.isArray(metadata.organizationBadges) ||
      !metadata.organizationBadges.some((badge) => badge.visible)
    ) {
      errors.push(`asset: sin emblema visible ${asset.candidateId}`);
    }
    if (metadata.organizationBadges.some((badge) => badge.bakedOrganizationColor !== null))
      errors.push(`asset: color horneado ${asset.candidateId}`);
    const noAccessYet = ["foundation", "structure"].includes(asset.stateToken);
    if (!noAccessYet && !metadata.orientationStatus.anyAccessVisible)
      errors.push(`asset: entrada invisible ${asset.candidateId}`);
    if ([180, 270].includes(asset.orientation) && !noAccessYet) {
      const serviceAccessVisible =
        asset.buildingType === "headquarters_cupola"
          ? metadata.orientationStatus.access.some(
              (entry) => entry.visible && entry.detailId === "service_garage",
            )
          : metadata.orientationStatus.access.some(
              (entry) => entry.visible && entry.purpose.startsWith("access:rear_service_door:"),
            );
      if (!serviceAccessVisible)
        errors.push(`asset: 180/270 sin acceso de servicio visible ${asset.candidateId}`);
    }
    const detailIds = new Set(metadata.architecturalDetails.map((detail) => detail.id));
    if (
      asset.buildingType === "headquarters_cupola" &&
      !noAccessYet &&
      !detailIds.has("service_garage")
    ) {
      errors.push(`asset: cupola sin cochera ${asset.candidateId}`);
    }
    if (
      asset.buildingType === "headquarters_courtyard" &&
      !noAccessYet &&
      !detailIds.has("courtyard_service_threshold")
    ) {
      errors.push(`asset: courtyard sin umbral de servicio ${asset.candidateId}`);
    }
    if (noAccessYet && ![...detailIds].some((id) => id === "construction_identity")) {
      errors.push(`asset: obra sin señal de identidad ${asset.candidateId}`);
    }
  }
  const expectedKeys = new Set(
    VARIANTS.flatMap((buildingType) =>
      STATES.flatMap((stateToken) =>
        ORIENTATIONS.flatMap((orientation) =>
          MOODS.map((moodId) => keyOf({ buildingType, stateToken, orientation, moodId })),
        ),
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
    ? buildHeadquartersMatrix(root)
    : readJson(join(root, "docs/art/organization-headquarters/candidate-matrix.json"));
  if (writeIndex)
    writeFileSync(
      join(root, "docs/art/organization-headquarters/candidate-matrix.json"),
      `${JSON.stringify(matrix, null, 1)}\n`,
    );
  const result = validateHeadquartersArt({ root, matrix });
  writeFileSync(
    join(root, "docs/art/organization-headquarters/validation.json"),
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
        readJson(join(root, "docs/art/organization-headquarters/promotion-plan.json"))
          .protectedRuntime,
      ).length,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
