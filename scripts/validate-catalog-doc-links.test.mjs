import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findBrokenMarkdownLinks, validateCatalogDocLinks } from "./validate-catalog-doc-links.mjs";

test("catalog documentation accepts existing local targets and ignores web links", () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-doc-links-"));
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs/target.md"), "target\n");
    writeFileSync(
      join(root, "docs/index.md"),
      "[local](target.md) [web](https://example.com) [anchor](#section)\n",
    );
    const result = validateCatalogDocLinks({ root, targets: ["docs"] });
    assert.equal(result.status, "passed");
    assert.equal(result.files, 2);
    assert.deepEqual(result.broken, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("catalog documentation reports the exact missing target and line", () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-doc-links-"));
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs/index.md"), "ok\n[retired](missing.png)\n");
    const broken = findBrokenMarkdownLinks(root, ["docs/index.md"]);
    assert.deepEqual(broken, [{ file: "docs/index.md", line: 2, target: "missing.png" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
