import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const deleteJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    deleteJson = deleteJsonMock;
  },
}));

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: () => ({
    serverUrl: "http://localhost:3000",
    apiKey: "pa_test123",
  }),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: spinnerStartMock,
  }),
}));

async function runAgentDelete(argv: string[]) {
  const { registerAgentDeleteCommand } = await import(
    "../../src/commands/agent/delete.js"
  );

  const program = new Command();
  program.exitOverride();

  const agentCmd = program.command("agent");
  registerAgentDeleteCommand(agentCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("agent delete command", () => {
  beforeEach(() => {
    deleteJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("prints deleted when the API removes the agent", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    deleteJsonMock.mockResolvedValue({
      status: "deleted",
      message: "智能体已删除。",
    });

    await runAgentDelete(["agent", "delete", "agent-1", "--force"]);

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/agents/agent-1");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Agent "agent-1" deleted'));
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });

  it("prints disabled when the API keeps the agent because sessions exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    deleteJsonMock.mockResolvedValue({
      status: "disabled",
      reason: "has_sessions",
      sessionCount: 3,
      liveArtifactCount: 2,
      message: "该智能体已有历史会话，已自动停用。",
    });

    await runAgentDelete(["agent", "delete", "agent-2", "--force"]);

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/agents/agent-2");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent "agent-2" disabled because sessions exist'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Agent "agent-2" deleted'),
    );
  });
});
