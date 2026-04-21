import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const cliRoot = path.resolve(import.meta.dirname, "..", "..");
const packageJsonPath = path.join(cliRoot, "package.json");
const indexSourcePath = path.join(cliRoot, "src", "index.ts");

describe("CLI version wiring", () => {
  it("does not hardcode the program version in the CLI entrypoint", () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const source = fs.readFileSync(indexSourcePath, "utf8");

    expect(source).not.toContain(`.version("${pkg.version}")`);
    expect(source).toContain("package.json");
  });
});
