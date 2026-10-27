import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const checker = fileURLToPath(new URL("./check-architecture.mjs", import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), "landlord-architecture-"));

try {
  mkdirSync(join(fixtureRoot, "packages/simulation/src"), { recursive: true });
  mkdirSync(join(fixtureRoot, "packages/shared/src"), { recursive: true });
  mkdirSync(join(fixtureRoot, "apps/web/src"), { recursive: true });
  mkdirSync(join(fixtureRoot, "apps/web/src/isometric"), { recursive: true });
  writeFileSync(
    join(fixtureRoot, "packages/simulation/src/forbidden.ts"),
    'import Phaser from "phaser";\nexport { Phaser };\n',
  );
  writeFileSync(join(fixtureRoot, "packages/shared/src/valid.ts"), "export const valid = true;\n");
  writeFileSync(
    join(fixtureRoot, "apps/web/src/forbidden-public.ts"),
    'import manifest from "../public/assets/manifest.json";\nexport { manifest };\n',
  );
  writeFileSync(
    join(fixtureRoot, "apps/web/src/isometric/gameplay-visual-adapter.ts"),
    'import { VISUAL_SLICE_LAYOUT } from "../visual-slice/layout";\nexport { VISUAL_SLICE_LAYOUT };\n',
  );

  const result = spawnSync(process.execPath, [checker], {
    cwd: repositoryRoot,
    env: { ...process.env, ARCHITECTURE_CHECK_ROOT: fixtureRoot },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0, "forbidden fixture must fail architecture check");
  assert.match(result.stdout + result.stderr, /forbidden import/);
  assert.match(result.stdout + result.stderr, /Vite source cannot import from public/);
  assert.match(
    result.stdout + result.stderr,
    /gameplay adapter cannot depend on visual-slice\/layout/,
  );
  console.log("Architecture negative fixture is detected.");
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
