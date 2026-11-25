import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const hq = join(root, "docs/art/organization-headquarters");
const sourceRoots = [
  join(hq, "attempts"),
  join(hq, "candidates-day_civic"),
  join(hq, "candidates-night_civic"),
  join(hq, "candidates-night-courtyard-temp"),
  join(hq, "candidates-night-courtyard-a"),
  join(hq, "candidates-night-courtyard-b"),
];
const outputs = {
  day_civic: join(hq, "candidates-day-v1"),
  night_civic: join(hq, "candidates-night-v1"),
};
const moodArgument = process.argv.find((argument) => argument.startsWith("--mood="))?.slice(7);
const verifyOnly = process.argv.includes("--verify-only");
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
  if (!verifyOnly && existsSync(output) && readdirSync(output).length > 0)
    throw new Error(`La salida debe estar vacía: ${output}`);
}

const selected = new Map();
for (const path of jsonFiles(sourceRoots[0]).concat(...sourceRoots.slice(1).map(jsonFiles))) {
  const candidate = JSON.parse(readFileSync(path, "utf8"));
  if (
    !candidate.candidateId?.startsWith("hq_headquarters_") ||
    !["day_civic", "night_civic"].includes(candidate.moodId) ||
    !["headquarters_cupola", "headquarters_courtyard"].includes(candidate.buildingType)
  )
    continue;
  const png = join(dirname(path), `${candidate.candidateId}.png`);
  if (!existsSync(png) || sha256(png) !== candidate.sha256) continue;
  const key = `${candidate.moodId}|${candidate.candidateId}`;
  const previous = selected.get(key);
  if (!previous || statSync(path).mtimeMs > previous.mtimeMs)
    selected.set(key, { candidate, metadata: path, png, mtimeMs: statSync(path).mtimeMs });
}

const assemblyPath = join(hq, "assembly.json");
const previous = existsSync(assemblyPath)
  ? JSON.parse(readFileSync(assemblyPath, "utf8"))
  : { moods: {} };
const report = {
  schemaVersion: 1,
  assembledAt: new Date().toISOString(),
  moods: { ...previous.moods },
};
for (const moodId of selectedMoods) {
  const output = outputs[moodId];
  mkdirSync(output, { recursive: true });
  const entries = [...selected.values()]
    .filter((entry) => entry.candidate.moodId === moodId)
    .sort((left, right) => left.candidate.candidateId.localeCompare(right.candidate.candidateId));
  if (entries.length !== 48)
    throw new Error(`${moodId}: se esperaban 48 candidatos verificables, hay ${entries.length}`);
  for (const entry of entries) {
    const id = entry.candidate.candidateId;
    if (!verifyOnly) {
      copyFileSync(entry.png, join(output, `${id}.png`));
      copyFileSync(entry.metadata, join(output, `${id}.json`));
    }
  }
  report.moods[moodId] = {
    count: entries.length,
    output: output.slice(root.length + 1),
    candidates: entries.map((entry) => ({
      id: entry.candidate.candidateId,
      sourceMetadata: entry.metadata.slice(root.length + 1),
      sha256: entry.candidate.sha256,
    })),
  };
}
writeFileSync(assemblyPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(report.moods).map(([mood, value]) => [mood, value.count])),
  ),
);
