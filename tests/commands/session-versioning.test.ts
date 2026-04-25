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

async function runSessionCommand(argv: string[]) {
  const { registerSessionCommands } = await import(
    "../../src/commands/session/index.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  registerSessionCommands(program);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("session version-aware commands", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("includes agent version in session list output", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [
        {
          session_id: "sess_1234567890abcd",
          agent_id: "demo",
          agent_version_number: "v3",
          title: "Demo Session",
          status: "active",
          updated_at: "2026-04-24T10:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await runSessionCommand(["session", "list"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      [
        {
          session_id: "sess_1234567890abcd",
          agent_id: "demo",
          agent_version_number: "v3",
          title: "Demo Session",
          status: "active",
          updated_at: "2026-04-24T10:00:00.000Z",
        },
      ],
      "table",
      ["ID", "Agent", "Version", "Title", "Status", "Updated"],
      expect.any(Array),
    );
  });

  it("prints bound agent version in session details", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      session_id: "sess_123",
      agent_id: "demo",
      agent_version_id: "ver-3",
      agent_version_number: "v3",
      title: "Demo Session",
      status: "active",
      current_stage_id: "intake",
      created_at: "2026-04-24T09:00:00.000Z",
      updated_at: "2026-04-24T10:00:00.000Z",
      stages: [],
      usage_summary: null,
    });

    await runSessionCommand(["session", "get", "sess_123"]);

    expect(logSpy).toHaveBeenCalledWith("  Version: v3 (ver-3)");
  });
});
