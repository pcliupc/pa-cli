import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();

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

vi.mock("ora", () => ({
  default: () => ({
    start: () => ({ stop: vi.fn() }),
  }),
}));

async function runSpaceGet(argv: string[]) {
  const { registerSpaceGetCommand } = await import(
    "../../src/commands/space/get.js"
  );

  const program = new Command();
  program.exitOverride();

  const spaceCmd = program.command("space");
  registerSpaceGetCommand(spaceCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("space get command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("displays space details when space is found", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      items: [
        { id: "space-1", key: "marketing", name: "Marketing", description: "Marketing team", myRole: "SPACE_ADMIN" },
        { id: "space-2", key: "eng", name: "Engineering", description: "Engineering team", myRole: "MEMBER" },
      ],
    });

    await runSpaceGet(["space", "get", "space-1"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/spaces");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Marketing"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("SPACE_ADMIN"),
    );
  });

  it("exits with error when space is not found", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as typeof process.exit);

    getJsonMock.mockResolvedValueOnce({
      items: [
        { id: "space-2", key: "eng", name: "Engineering", description: "", myRole: "MEMBER" },
      ],
    });

    await expect(runSpaceGet(["space", "get", "space-999"])).rejects.toThrow("process.exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not found"),
    );
  });
});
