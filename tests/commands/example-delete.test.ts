import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const deleteMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    delete = deleteMock;
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

async function runExampleDelete(argv: string[]) {
  const { registerExampleCommands } = await import("../../src/commands/example/index.js");
  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");
  registerExampleCommands(program);
  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("example delete command", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("deletes example with --force", async () => {
    deleteMock.mockResolvedValueOnce(undefined);

    await runExampleDelete(["example", "delete", "example_1", "--force"]);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith("/api/examples/example_1");
    expect(spinnerStopMock).toHaveBeenCalledTimes(1);
  });
});

