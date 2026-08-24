import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  apiTypeForCliType,
  inferKnowledgeType,
  readKnowledgeContent,
  readKnowledgeInput,
} from "../../src/lib/knowledge-input.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("knowledge input", () => {
  it("infers Markdown and CSV types case-insensitively", () => {
    expect(inferKnowledgeType("guide.md")).toBe("md");
    expect(inferKnowledgeType("guide.MARKDOWN")).toBe("md");
    expect(inferKnowledgeType("rows.CSV")).toBe("csv");
    expect(inferKnowledgeType("guide.txt")).toBeUndefined();
  });

  it("maps Markdown to CLI md and API doc", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-input-"));
    tempDirs.push(tempDir);
    const inputPath = path.join(tempDir, "guide.md");
    fs.writeFileSync(inputPath, "# Guide");

    const input = await readKnowledgeInput(inputPath, {
      readStdin: async () => "# Guide",
    });

    expect(input).toEqual({
      type: "md",
      apiType: "doc",
      content: "# Guide",
      title: "guide",
    });
  });

  it("reads local content as UTF-8", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-input-"));
    tempDirs.push(tempDir);
    const inputPath = path.join(tempDir, "notes.txt");
    fs.writeFileSync(inputPath, "你好");

    await expect(readKnowledgeContent(inputPath)).resolves.toBe("你好");
  });

  it("requires an explicit type for local files without a recognized extension", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-input-"));
    tempDirs.push(tempDir);
    const inputPath = path.join(tempDir, "notes");
    fs.writeFileSync(inputPath, "content");

    await expect(readKnowledgeInput(inputPath, { title: "Notes" })).rejects.toThrow(/--type/);
  });

  it("requires type and title for stdin", async () => {
    await expect(
      readKnowledgeInput("-", { readStdin: async () => "content" }),
    ).rejects.toThrow(/--type.*--title/);
  });

  it("reads stdin with explicit type and title", async () => {
    const input = await readKnowledgeInput("-", {
      type: "md",
      title: "Piped guide",
      readStdin: async () => "# Guide",
    });

    expect(input).toEqual({
      type: "md",
      apiType: "doc",
      content: "# Guide",
      title: "Piped guide",
    });
  });

  it("uses the basename without its final extension as the default title", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-input-"));
    tempDirs.push(tempDir);
    const inputPath = path.join(tempDir, "release.notes.md");
    fs.writeFileSync(inputPath, "content");

    await expect(readKnowledgeInput(inputPath, {})).resolves.toMatchObject({
      title: "release.notes",
    });
  });

  it("maps CLI types to API types", () => {
    expect(apiTypeForCliType("md")).toBe("doc");
    expect(apiTypeForCliType("csv")).toBe("csv");
  });
});
