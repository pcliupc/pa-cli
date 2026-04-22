import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const outputDataMock = vi.fn();
const spinnerStartMock = vi.fn();
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
  return {
    ...actual,
    outputData: outputDataMock,
  };
});

vi.mock("ora", () => ({
  default: () => ({
    start: spinnerStartMock,
  }),
}));

function buildAgent(
  id: string,
  overrides: Partial<{
    description: string;
    isActive: boolean;
    stage_count: number;
    updatedAt: string;
  }> = {},
) {
  return {
    agent_id: id,
    name: `Agent ${id}`,
    description: overrides.description ?? `Description for ${id}`,
    isActive: overrides.isActive ?? true,
    stage_count: overrides.stage_count ?? 2,
    updatedAt: overrides.updatedAt ?? "2026-04-22T10:00:00.000Z",
  };
}

async function runAgentList(argv: string[]) {
  const { registerAgentListCommand } = await import(
    "../../src/commands/agent/list.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const agentCmd = program.command("agent");
  registerAgentListCommand(agentCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("agent list command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("fetches and combines all paginated agent results", async () => {
    getJsonMock
      .mockResolvedValueOnce({
        items: [buildAgent("agent-1"), buildAgent("agent-2")],
        pagination: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [buildAgent("agent-3"), buildAgent("agent-4")],
        pagination: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [buildAgent("agent-5")],
        pagination: { page: 3, pageSize: 2, total: 5, totalPages: 3 },
      });

    await runAgentList(["agent", "list"]);

    expect(getJsonMock).toHaveBeenCalledTimes(3);
    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/api/agents");
    expect(getJsonMock).toHaveBeenNthCalledWith(2, "/api/agents?page=2&pageSize=2");
    expect(getJsonMock).toHaveBeenNthCalledWith(3, "/api/agents?page=3&pageSize=2");
    expect(outputDataMock).toHaveBeenCalledWith(
      [
        buildAgent("agent-1"),
        buildAgent("agent-2"),
        buildAgent("agent-3"),
        buildAgent("agent-4"),
        buildAgent("agent-5"),
      ],
      "table",
      ["ID", "Name", "Description", "Active", "Stages", "Updated"],
      expect.any(Array),
    );
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("stops after the first request when pagination has one page", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [buildAgent("agent-1")],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    await runAgentList(["agent", "list"]);

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(outputDataMock).toHaveBeenCalledWith(
      [buildAgent("agent-1")],
      "table",
      ["ID", "Name", "Description", "Active", "Stages", "Updated"],
      expect.any(Array),
    );
  });

  it("supports legacy array responses", async () => {
    getJsonMock.mockResolvedValueOnce([buildAgent("agent-1"), buildAgent("agent-2")]);

    await runAgentList(["agent", "list"]);

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(outputDataMock).toHaveBeenCalledWith(
      [buildAgent("agent-1"), buildAgent("agent-2")],
      "table",
      ["ID", "Name", "Description", "Active", "Stages", "Updated"],
      expect.any(Array),
    );
  });

  it("keeps filters on follow-up paginated requests", async () => {
    getJsonMock
      .mockResolvedValueOnce({
        items: [buildAgent("agent-1")],
        pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: [buildAgent("agent-2")],
        pagination: { page: 2, pageSize: 1, total: 2, totalPages: 2 },
      });

    await runAgentList(["agent", "list", "--all", "--category", "ops"]);

    expect(getJsonMock).toHaveBeenNthCalledWith(
      1,
      "/api/agents?all=true&category=ops",
    );
    expect(getJsonMock).toHaveBeenNthCalledWith(
      2,
      "/api/agents?all=true&category=ops&page=2&pageSize=1",
    );
  });

  it("keeps JSON output as a plain array", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [buildAgent("agent-1")],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    await runAgentList(["--output", "json", "agent", "list"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      [buildAgent("agent-1")],
      "json",
      ["ID", "Name", "Description", "Active", "Stages", "Updated"],
      expect.any(Array),
    );
  });

  it("prints a friendly message when no agents are returned", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await runAgentList(["agent", "list"]);

    expect(logSpy).toHaveBeenCalledWith("No agents found.");
    expect(outputDataMock).not.toHaveBeenCalled();
  });

  it("exits with an error when a paginated request fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as typeof process.exit);

    getJsonMock
      .mockResolvedValueOnce({
        items: [buildAgent("agent-1")],
        pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
      })
      .mockRejectedValueOnce(new Error("boom"));

    await expect(runAgentList(["agent", "list"])).rejects.toThrow("process.exit:1");
    expect(errorSpy).toHaveBeenCalledWith("Error: boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});
