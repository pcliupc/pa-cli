import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const clientConstructorMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    errorKey?: string;
    constructor(message: string, status: number, errorKey?: string) {
      super(message);
      this.status = status;
      this.errorKey = errorKey;
    }
  },
  PaApiClient: class {
    constructor(options: unknown) {
      clientConstructorMock(options);
    }

    getJson = getJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({
    serverUrl: "http://localhost:3000",
    apiKey: "pa_test123",
  }),
}));

vi.mock("../../src/lib/output.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/output.js")>(
    "../../src/lib/output.js",
  );
  return { ...actual, outputData: outputDataMock };
});

vi.mock("../../src/lib/knowledge-errors.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/knowledge-errors.js")>(
    "../../src/lib/knowledge-errors.js",
  );
  return actual;
});

vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: spinnerStopMock }) }),
}));

async function runKnowledgeGet(argv: string[]) {
  const { registerKnowledgeGetCommand } = await import(
    "../../src/commands/knowledge/get.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeGetCommand(knowledgeCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

const baseDocument = {
  id: "doc-1",
  title: "Guide",
  type: "doc" as const,
  status: "published" as const,
  content: "# Guide\n",
  summary: null,
  spaceId: null,
  folderId: null,
  createdById: null,
  updatedById: null,
  currentRevisionId: "rev-1",
  revisionNumber: 1,
  createdAt: "2026-08-24T10:00:00Z",
  updatedAt: "2026-08-24T10:00:00Z",
};

describe("knowledge get command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    clientConstructorMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
  });

  it("renders document metadata in table mode", async () => {
    const response = { document: baseDocument, capabilities: { viewHistory: false, restoreRevision: false } };
    getJsonMock.mockResolvedValue(response);

    await runKnowledgeGet(["knowledge", "get", "doc-1"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1");
    expect(outputDataMock).toHaveBeenCalledWith(
      baseDocument,
      "table",
      expect.any(Array),
      expect.arrayContaining([expect.arrayContaining(["md"])]),
    );
  });

  it("passes the complete response through in JSON mode", async () => {
    const response = { document: baseDocument, capabilities: { viewHistory: true, restoreRevision: false } };
    getJsonMock.mockResolvedValue(response);

    await runKnowledgeGet(["--output", "json", "knowledge", "get", "doc-1"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      response,
      "json",
      expect.any(Array),
      expect.any(Array),
    );
  });

  it("passes the global server override and configured API key to the client", async () => {
    getJsonMock.mockResolvedValue({
      document: baseDocument,
      capabilities: { viewHistory: false, restoreRevision: false },
    });

    await runKnowledgeGet(["--server", "https://override.example", "knowledge", "get", "doc-1"]);

    expect(clientConstructorMock).toHaveBeenCalledWith({
      serverUrl: "https://override.example",
      apiKey: "pa_test123",
    });
  });

  it("writes Markdown content to the requested output file", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-get-"));
    const outputPath = path.join(tempDir, "nested", "guide.md");
    getJsonMock.mockResolvedValue({
      document: baseDocument,
      capabilities: { viewHistory: false, restoreRevision: false },
    });

    await runKnowledgeGet(["knowledge", "get", "doc-1", "--content", "-o", outputPath]);

    expect(fs.readFileSync(outputPath, "utf8")).toBe("# Guide\n");
    expect(getJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes raw CSV content to stdout when no output file is provided", async () => {
    const response = {
      document: { ...baseDocument, type: "csv" as const, content: "a,b\n1,2\n" },
      capabilities: { viewHistory: false, restoreRevision: false },
    };
    getJsonMock.mockResolvedValue(response);
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runKnowledgeGet(["knowledge", "get", "doc-1", "--content"]);

    expect(writeSpy).toHaveBeenCalledWith("a,b\n1,2\n");
    writeSpy.mockRestore();
  });

  it("preserves the complete response envelope for JSON content output", async () => {
    const response = {
      document: baseDocument,
      capabilities: { viewHistory: true, restoreRevision: false },
    };
    getJsonMock.mockResolvedValue(response);
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runKnowledgeGet([
      "--output", "json", "knowledge", "get", "doc-1", "--content",
    ]);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(outputDataMock).toHaveBeenCalledWith(
      response,
      "json",
      expect.any(Array),
      expect.any(Array),
    );
    writeSpy.mockRestore();
  });

  it("writes content to a file and preserves the JSON response envelope", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-knowledge-get-json-"));
    const outputPath = path.join(tempDir, "nested", "guide.md");
    const response = {
      document: baseDocument,
      capabilities: { viewHistory: true, restoreRevision: false },
    };
    getJsonMock.mockResolvedValue(response);

    await runKnowledgeGet([
      "--output", "json", "knowledge", "get", "doc-1",
      "--content", "-o", outputPath,
    ]);

    expect(fs.readFileSync(outputPath, "utf8")).toBe("# Guide\n");
    expect(outputDataMock).toHaveBeenCalledWith(
      response,
      "json",
      expect.any(Array),
      expect.any(Array),
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects an output file without content before fetching metadata", async () => {
    const errorSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeGet(["knowledge", "get", "doc-1", "-o", "guide.md"]),
    ).rejects.toThrow("process.exit");

    expect(getJsonMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("Error: --output-file requires --content.");
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it.each([
    ["page", "Page content must be edited through Live Artifact."],
    ["file", "Binary knowledge files cannot be edited as text."],
  ])("rejects --content for %s documents", async (type, message) => {
    const response = {
      document: { ...baseDocument, type },
      capabilities: { viewHistory: false, restoreRevision: false },
    };
    getJsonMock.mockResolvedValue(response);
    const errorSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeGet(["knowledge", "get", "doc-1", "--content"]),
    ).rejects.toThrow("process.exit");

    expect(errorSpy).toHaveBeenCalledWith(`Error: ${message}`);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
