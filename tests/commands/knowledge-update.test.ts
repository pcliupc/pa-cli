import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const patchJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();
const readKnowledgeContentMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    patchJson = patchJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({ serverUrl: "http://localhost:3000", apiKey: "pa_test123" }),
}));

vi.mock("../../src/lib/knowledge-input.js", () => ({
  readKnowledgeContent: readKnowledgeContentMock,
}));

vi.mock("../../src/lib/output.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/output.js")>(
    "../../src/lib/output.js",
  );
  return { ...actual, outputData: outputDataMock };
});

vi.mock("../../src/lib/knowledge-errors.js", () => ({
  printKnowledgeError: vi.fn(),
}));

vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: spinnerStopMock }) }),
}));

async function runKnowledgeUpdate(argv: string[]) {
  const { registerKnowledgeUpdateCommand } = await import(
    "../../src/commands/knowledge/update.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeUpdateCommand(knowledgeCmd);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("knowledge update command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    patchJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
    readKnowledgeContentMock.mockReset();
  });

  it("updates content with the current revision", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-update-"));
    const nextMarkdownPath = path.join(tempDir, "next.md");
    fs.writeFileSync(nextMarkdownPath, "# New version\n");
    getJsonMock.mockResolvedValue({
      document: { id: "doc-1", type: "doc", currentRevisionId: "rev-2" },
    });
    readKnowledgeContentMock.mockResolvedValue("# New version\n");
    const response = {
      document: { id: "doc-1", type: "doc", currentRevisionId: "rev-3", revisionNumber: 3 },
    };
    patchJsonMock.mockResolvedValue(response);

    await runKnowledgeUpdate(["knowledge", "update", "doc-1", nextMarkdownPath]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1");
    expect(readKnowledgeContentMock).toHaveBeenCalledWith(nextMarkdownPath);
    expect(patchJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1", {
      content: "# New version\n",
      expectedCurrentRevisionId: "rev-2",
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates only supplied metadata fields", async () => {
    patchJsonMock.mockResolvedValue({
      document: { id: "doc-1", type: "doc", title: "New", revisionNumber: 2 },
    });

    await runKnowledgeUpdate([
      "knowledge", "update", "doc-1", "--title", "New", "--summary", "Summary",
      "--folder", "folder-2",
    ]);

    expect(getJsonMock).not.toHaveBeenCalled();
    expect(patchJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1", {
      title: "New",
      summary: "Summary",
      folderId: "folder-2",
    });
  });

  it("encodes root-folder as a null folder ID", async () => {
    patchJsonMock.mockResolvedValue({
      document: { id: "doc-1", type: "csv", folderId: null, revisionNumber: 2 },
    });

    await runKnowledgeUpdate(["knowledge", "update", "doc-1", "--root-folder"]);

    expect(patchJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1", { folderId: null });
  });

  it("accepts CSV content and does not send a type field", async () => {
    getJsonMock.mockResolvedValue({
      document: { id: "doc-1", type: "csv", currentRevisionId: "rev-1" },
    });
    readKnowledgeContentMock.mockResolvedValue("a,b\n3,4\n");
    patchJsonMock.mockResolvedValue({ document: { id: "doc-1", type: "csv" } });

    await runKnowledgeUpdate(["knowledge", "update", "doc-1", "rows.csv"]);

    expect(patchJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1", {
      content: "a,b\n3,4\n",
      expectedCurrentRevisionId: "rev-1",
    });
  });

  it("rejects content and metadata options together", async () => {
    await expect(
      runKnowledgeUpdate(["knowledge", "update", "doc-1", "next.md", "--title", "New"]),
    ).rejects.toThrow(/cannot combine content and metadata/);
    expect(getJsonMock).not.toHaveBeenCalled();
    expect(patchJsonMock).not.toHaveBeenCalled();
  });
});
