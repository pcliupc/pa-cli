import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const postJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();
const readKnowledgeInputMock = vi.fn();
const printKnowledgeErrorMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    postJson = postJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({ serverUrl: "http://localhost:3000", apiKey: "pa_test123" }),
}));

vi.mock("../../src/lib/knowledge-input.js", () => ({
  readKnowledgeInput: readKnowledgeInputMock,
}));

vi.mock("../../src/lib/output.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/output.js")>(
    "../../src/lib/output.js",
  );
  return { ...actual, outputData: outputDataMock };
});

vi.mock("../../src/lib/knowledge-errors.js", () => ({
  printKnowledgeError: printKnowledgeErrorMock,
}));

vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: spinnerStopMock }) }),
}));

async function runKnowledgeCreate(argv: string[]) {
  const { registerKnowledgeCreateCommand } = await import(
    "../../src/commands/knowledge/create.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeCreateCommand(knowledgeCmd);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("knowledge create command", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
    readKnowledgeInputMock.mockReset();
    printKnowledgeErrorMock.mockReset();
  });

  it("creates Markdown in a Space using API type doc", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-create-"));
    const markdownPath = path.join(tempDir, "guide.md");
    fs.writeFileSync(markdownPath, "# Guide\n");
    readKnowledgeInputMock.mockResolvedValue({
      type: "md", apiType: "doc", content: "# Guide\n", title: "guide",
    });
    const response = {
      document: { id: "doc-1", title: "Guide", type: "doc", revisionNumber: 1 },
      alreadyExists: false,
    };
    postJsonMock.mockResolvedValue(response);

    await runKnowledgeCreate([
      "knowledge", "create", markdownPath,
      "--space", "space-1", "--folder", "folder-1", "--summary", "A guide",
    ]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/knowledge", {
      target: "current_space",
      spaceId: "space-1",
      folderId: "folder-1",
      title: "guide",
      summary: "A guide",
      source: { kind: "text", type: "doc", content: "# Guide\n" },
    });
    expect(outputDataMock).toHaveBeenCalledWith(
      response.document,
      "table",
      expect.any(Array),
      expect.arrayContaining([expect.arrayContaining(["md"])]),
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("maps CSV to API csv and defaults to personal scope", async () => {
    readKnowledgeInputMock.mockResolvedValue({
      type: "csv", apiType: "csv", content: "a,b\n1,2\n", title: "rows",
    });
    postJsonMock.mockResolvedValue({
      document: { id: "doc-2", title: "rows", type: "csv", revisionNumber: 1 },
      alreadyExists: true,
    });

    await runKnowledgeCreate(["knowledge", "create", "rows.csv"]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/knowledge", {
      target: "personal",
      folderId: null,
      title: "rows",
      summary: null,
      source: { kind: "text", type: "csv", content: "a,b\n1,2\n" },
    });
  });

  it("passes explicit type and title for stdin", async () => {
    readKnowledgeInputMock.mockResolvedValue({
      type: "md", apiType: "doc", content: "# Piped\n", title: "Piped guide",
    });
    postJsonMock.mockResolvedValue({
      document: { id: "doc-3", title: "Piped guide", type: "doc", revisionNumber: 1 },
      alreadyExists: false,
    });

    await runKnowledgeCreate([
      "knowledge", "create", "-", "--type", "md", "--title", "Piped guide",
    ]);

    expect(readKnowledgeInputMock).toHaveBeenCalledWith("-", {
      type: "md",
      title: "Piped guide",
    });
  });

  it("rejects an invalid runtime type without creating a document", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeCreate([
        "knowledge", "create", "guide.txt", "--type", "json",
      ]),
    ).rejects.toThrow("process.exit");

    expect(printKnowledgeErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "--type must be md or csv." }),
      "table",
    );
    expect(readKnowledgeInputMock).not.toHaveBeenCalled();
    expect(postJsonMock).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
