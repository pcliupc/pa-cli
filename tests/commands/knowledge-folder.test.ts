import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const postJsonMock = vi.fn();
const deleteJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();
const printKnowledgeErrorMock = vi.fn();
const confirmDestructiveActionMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    postJson = postJsonMock;
    deleteJson = deleteJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({ serverUrl: "http://localhost:3000", apiKey: "pa_test123" }),
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

vi.mock("../../src/lib/confirm.js", () => ({
  confirmDestructiveAction: confirmDestructiveActionMock,
}));

vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: spinnerStopMock }) }),
}));

async function runKnowledgeFolder(argv: string[]) {
  const { registerKnowledgeFolderCommands } = await import(
    "../../src/commands/knowledge/folder/index.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeFolderCommands(knowledgeCmd);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("knowledge folder commands", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    deleteJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
    printKnowledgeErrorMock.mockReset();
    confirmDestructiveActionMock.mockReset();
    confirmDestructiveActionMock.mockResolvedValue(true);
  });

  it("lists personal folders with an optional parent", async () => {
    const response = {
      folders: [{
        id: "folder-1", name: "Guides", parentId: null, spaceId: null,
        createdAt: "2026-08-24T10:00:00Z", updatedAt: "2026-08-24T11:00:00Z",
      }],
    };
    getJsonMock.mockResolvedValue(response);

    await runKnowledgeFolder([
      "knowledge", "folder", "list", "--parent", "folder-root",
    ]);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/knowledge/folders?scope=personal&parentId=folder-root",
    );
    expect(outputDataMock).toHaveBeenCalledWith(
      response.folders,
      "table",
      expect.arrayContaining(["Name", "Parent", "Space", "Created", "Updated"]),
      expect.any(Array),
    );
  });

  it("lists folders in a Space with the current-space scope", async () => {
    getJsonMock.mockResolvedValue({ folders: [] });

    await runKnowledgeFolder([
      "knowledge", "folder", "list", "--space", "space-1",
    ]);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/api/knowledge/folders?scope=current_space&spaceId=space-1",
    );
  });

  it("creates a nested Space folder", async () => {
    const response = {
      folder: { id: "folder-2", name: "Travel", parentId: "folder-1", spaceId: "space-1" },
    };
    postJsonMock.mockResolvedValue(response);

    await runKnowledgeFolder([
      "knowledge", "folder", "create", "Travel",
      "--space", "space-1", "--parent", "folder-1",
    ]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/knowledge/folders", {
      target: "current_space",
      spaceId: "space-1",
      name: "Travel",
      parentId: "folder-1",
    });
  });

  it("creates a personal root folder with a null parent", async () => {
    postJsonMock.mockResolvedValue({ folder: { id: "folder-1", name: "Guides" } });

    await runKnowledgeFolder(["knowledge", "folder", "create", "Guides"]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/knowledge/folders", {
      target: "personal",
      name: "Guides",
      parentId: null,
    });
  });

  it("deletes a personal folder with the personal scope query", async () => {
    deleteJsonMock.mockResolvedValue({ deleted: true, id: "folder-1" });

    await runKnowledgeFolder([
      "knowledge", "folder", "delete", "folder-1", "--force",
    ]);

    expect(confirmDestructiveActionMock).toHaveBeenCalledTimes(1);
    expect(confirmDestructiveActionMock).toHaveBeenCalledWith(
      expect.stringContaining("folder-1"),
      { force: true },
    );
    expect(deleteJsonMock).toHaveBeenCalledWith(
      "/api/knowledge/folders/folder-1?scope=personal",
    );
    expect(deleteJsonMock.mock.calls[0]).toHaveLength(1);
  });

  it("confirms before deleting a personal folder without force", async () => {
    const order: string[] = [];
    confirmDestructiveActionMock.mockImplementation(async (question: string, options: unknown) => {
      order.push("confirm");
      expect(question).toContain("folder-1");
      expect(options).toEqual(expect.objectContaining({ force: false }));
      return true;
    });
    deleteJsonMock.mockImplementation(async () => {
      order.push("delete");
      return { deleted: true, id: "folder-1" };
    });

    await runKnowledgeFolder(["knowledge", "folder", "delete", "folder-1"]);

    expect(order).toEqual(["confirm", "delete"]);
    expect(deleteJsonMock).toHaveBeenCalledWith(
      "/api/knowledge/folders/folder-1?scope=personal",
    );
  });

  it("preserves the server folder-not-empty error", async () => {
    const error = new Error("Folder is not empty and cannot be deleted.");
    deleteJsonMock.mockRejectedValue(error);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeFolder(["knowledge", "folder", "delete", "folder-1", "--force"]),
    ).rejects.toThrow("process.exit");

    expect(printKnowledgeErrorMock).toHaveBeenCalledWith(error, "table");
    exitSpy.mockRestore();
  });
});
