import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const depot = join(root, "docs/art/cleaning-depot");
const sourceRoots = ["a", "b", "c"].flatMap((group) => [
  join(depot, `candidates-day-${group}`),
  join(depot, `candidates-night-${group}`),
]);
const outputs = {
  day_civic: join(depot, "candidates-day-v1"),
  night_civic: join(depot, "candidates-night-v1"),
};
const moodArgument = process.argv.find((argument) => argument.startsWith("--mood="))?.slice(7);
const selectedMoods = moodArgument ? [moodArgument] : Object.keys(outputs);
if (selectedMoods.some((mood) => !outputs[mood]))
  throw new Error(`Mood no soportado: ${moodArgument}`);
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function jsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.name.endsWith(".json") ? [path] : [];
  });
}

for (const moodId of selectedMoods) {
  const output = outputs[moodId];
  if (existsSync(output) && readdirSync(output).length > 0) {
    throw new Error(`La salida debe estar vacía: ${output}`);
  }
}

const selected = new Map();
for (const path of sourceRoots.flatMap(jsonFiles)) {
  const candidate = JSON.parse(readFileSync(path, "utf8"));
  if (
    candidate.candidateId?.startsWith("cd_cleaning_depot_") !== true ||
    candidate.buildingType !== "cleaning_depot" ||
    !["day_civic", "night_civic"].includes(candidate.moodId)
  ) {
    continue;
  }
  const png = join(dirname(path), `${candidate.candidateId}.png`);
  if (!existsSync(png) || sha256(png) !== candidate.sha256) continue;
  const key = `${candidate.moodId}|${candidate.candidateId}`;
  const previous = selected.get(key);
  if (!previous || candidate.compositionSignature !== previous.candidate.compositionSignature) {
    if (previous) throw new Error(`Firma de composición divergente para ${key}`);
    selected.set(key, { candidate, metadata: path, png });
  }
}

const report = { schemaVersion: 1, assembledAt: new Date().toISOString(), moods: {} };
for (const moodId of selectedMoods) {
  const output = outputs[moodId];
  mkdirSync(output, { recursive: true });
  const entries = [...selected.values()]
    .filter((entry) => entry.candidate.moodId === moodId)
    .sort((left, right) => left.candidate.candidateId.localeCompare(right.candidate.candidateId));
  if (entries.length !== 24)
    throw new Error(`${moodId}: se esperaban 24 candidatos verificables, hay ${entries.length}`);
  for (const entry of entries) {
    const id = entry.candidate.candidateId;
    copyFileSync(entry.png, join(output, `${id}.png`));
    copyFileSync(entry.metadata, join(output, `${id}.json`));
  }
  report.moods[moodId] = {
    count: entries.length,
    output: output.slice(root.length + 1),
    candidates: entries.map((entry) => ({
      id: entry.candidate.candidateId,
      sourceMetadata: entry.metadata.slice(root.length + 1),
      sha256: entry.candidate.sha256,
      compositionSignature: entry.candidate.compositionSignature,
    })),
  };
}
writeFileSync(join(depot, "assembly.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(report.moods).map(([mood, value]) => [mood, value.count])),
  ),
);
