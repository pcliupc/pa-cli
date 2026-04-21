import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const cliRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(cliRoot, "package.json");
const publishWorkflowPath = path.join(cliRoot, ".github", "workflows", "publish.yml");

describe("npm publish packaging", () => {
  it("publishes the CLI under the scoped npm package name", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.name).toBe("@pcliupc/pa-cli");
    expect(packageJson.bin?.pa).toBe("./dist/index.js");
    expect(packageJson.publishConfig?.access).toBe("public");
  });

  it("ships a publish workflow for tag-based npm releases", () => {
    expect(fs.existsSync(publishWorkflowPath)).toBe(true);

    const workflow = fs.readFileSync(publishWorkflowPath, "utf8");
    expect(workflow).toContain("npm publish");
    expect(workflow).toContain('"v*"');
    expect(workflow).toContain("GITHUB_REF_NAME");
  });
});
