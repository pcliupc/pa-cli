import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
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

vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: spinnerStopMock }) }),
}));

async function runKnowledgeList(argv: string[]) {
  const { registerKnowledgeListCommand } = await import(
    "../../src/commands/knowledge/list.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeListCommand(knowledgeCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("knowledge list command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
  });

  it("lists personal knowledge with search, folder, and pagination", async () => {
    getJsonMock.mockResolvedValue({
      items: [{ id: "doc-1", title: "Guide", type: "doc", folderId: "folder-1", revisionNumber: 2, updatedAt: "2026-08-24T10:00:00Z" }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await runKnowledgeList([
      "knowledge", "list", "--folder", "folder-1", "--search", "Guide", "--limit", "20",
    ]);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/knowledge?scope=personal&folderId=folder-1&q=Guide&limit=20&offset=0",
    );
    expect(getJsonMock.mock.calls[0][0]).not.toContain("type=");
  });

  it("adds the space scope before folder and search filters", async () => {
    getJsonMock.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await runKnowledgeList(["knowledge", "list", "--space", "space-1"]);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/knowledge?scope=current_space&spaceId=space-1&limit=50&offset=0",
    );
  });

  it("maps API doc types to md in table rows", async () => {
    const item = {
      id: "doc-1",
      title: "Guide",
      type: "doc",
      folderId: null,
      revisionNumber: 2,
      updatedAt: "2026-08-24T10:00:00Z",
    };
    getJsonMock.mockResolvedValue({ items: [item], total: 1, limit: 50, offset: 0 });

    await runKnowledgeList(["knowledge", "list"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      [item],
      "table",
      expect.any(Array),
      expect.arrayContaining([expect.arrayContaining(["md"])]),
    );
  });

  it("passes the complete response through in JSON mode", async () => {
    const response = { items: [], total: 0, limit: 50, offset: 0 };
    getJsonMock.mockResolvedValue(response);

    await runKnowledgeList(["--output", "json", "knowledge", "list"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      response,
      "json",
      expect.any(Array),
      expect.any(Array),
    );
  });
});
