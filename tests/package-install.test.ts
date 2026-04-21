import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const rootPackageJsonPath = path.join(repoRoot, "package.json");

describe("github install packaging", () => {
  it("exposes a root package with a pa bin that points at the built CLI entry", () => {
    expect(fs.existsSync(rootPackageJsonPath)).toBe(true);

    const rootPackage = JSON.parse(fs.readFileSync(rootPackageJsonPath, "utf8"));
    expect(rootPackage.bin?.pa).toBe("./cli/dist/index.js");
    expect(rootPackage.scripts?.prepare ?? rootPackage.scripts?.prepack).toBeTruthy();
  });
});
