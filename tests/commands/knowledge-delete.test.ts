import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const deleteJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStopMock = vi.fn();
const printKnowledgeErrorMock = vi.fn();
const confirmDestructiveActionMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
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

async function runKnowledgeDelete(argv: string[]) {
  const { registerKnowledgeDeleteCommand } = await import(
    "../../src/commands/knowledge/delete.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  const knowledgeCmd = program.command("knowledge");
  registerKnowledgeDeleteCommand(knowledgeCmd);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("knowledge delete command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    deleteJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStopMock.mockReset();
    printKnowledgeErrorMock.mockReset();
    confirmDestructiveActionMock.mockReset();
    confirmDestructiveActionMock.mockResolvedValue(true);
  });

  it("deletes with the revision read immediately before the request", async () => {
    getJsonMock.mockResolvedValue({
      document: { id: "doc-1", title: "Guide", currentRevisionId: "rev-4" },
    });
    deleteJsonMock.mockResolvedValue({ deleted: true, id: "doc-1" });

    await runKnowledgeDelete(["knowledge", "delete", "doc-1", "--force"]);

    expect(confirmDestructiveActionMock).toHaveBeenCalledTimes(1);
    expect(confirmDestructiveActionMock).toHaveBeenCalledWith(
      expect.stringContaining("doc-1"),
      { force: true },
    );
    expect(getJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1");
    expect(deleteJsonMock).toHaveBeenCalledWith("/api/knowledge/doc-1", {
      expectedCurrentRevisionId: "rev-4",
    });
  });

  it("confirms before reading and deleting without force", async () => {
    getJsonMock.mockResolvedValue({ document: { id: "doc-1", currentRevisionId: "rev-1" } });
    const order: string[] = [];
    confirmDestructiveActionMock.mockImplementation(async (question: string, options: unknown) => {
      order.push("confirm");
      expect(question).toContain("doc-1");
      expect(options).toEqual(expect.objectContaining({ force: false }));
      return true;
    });
    getJsonMock.mockImplementation(async () => {
      order.push("get");
      return { document: { id: "doc-1", currentRevisionId: "rev-1" } };
    });
    deleteJsonMock.mockImplementation(async () => {
      order.push("delete");
      return { deleted: true, id: "doc-1" };
    });

    await runKnowledgeDelete(["knowledge", "delete", "doc-1"]);

    expect(order).toEqual(["confirm", "get", "delete"]);
  });

  it("requires a current revision before sending DELETE", async () => {
    getJsonMock.mockResolvedValue({ document: { id: "doc-1", currentRevisionId: null } });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeDelete(["knowledge", "delete", "doc-1", "--force"]),
    ).rejects.toThrow("process.exit");

    expect(deleteJsonMock).not.toHaveBeenCalled();
    expect(printKnowledgeErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("revision") }),
      "table",
    );
    exitSpy.mockRestore();
  });

  it("passes revision conflicts through the knowledge error printer", async () => {
    getJsonMock.mockResolvedValue({ document: { id: "doc-1", currentRevisionId: "rev-4" } });
    const conflict = new Error("conflict");
    deleteJsonMock.mockRejectedValue(conflict);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      runKnowledgeDelete(["knowledge", "delete", "doc-1", "--force"]),
    ).rejects.toThrow("process.exit");

    expect(printKnowledgeErrorMock).toHaveBeenCalledWith(conflict, "table");
    expect(spinnerStopMock).toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
