import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const outputDataMock = vi.fn();

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
    start: () => ({ stop: vi.fn() }),
  }),
}));

async function runSpaceList(argv: string[]) {
  const { registerSpaceListCommand } = await import(
    "../../src/commands/space/list.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  const spaceCmd = program.command("space");
  registerSpaceListCommand(spaceCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("space list command", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    outputDataMock.mockReset();
  });

  it("fetches spaces and displays in table format", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [
        { id: "default-id", key: "default", name: "Default Space", description: "", myRole: null, isDefault: true },
        { id: "space-1", key: "marketing", name: "Marketing", description: "Marketing team", myRole: "SPACE_ADMIN", isDefault: false },
      ],
    });

    await runSpaceList(["space", "list"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/spaces");
    expect(outputDataMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "default-id" }),
        expect.objectContaining({ id: "space-1" }),
      ]),
      "table",
      ["Name", "Key", "ID", "Role"],
      expect.arrayContaining([
        ["Default Space", "default", "default-id", "-"],
        ["Marketing", "marketing", "space-1", "SPACE_ADMIN"],
      ]),
    );
  });

  it("supports JSON output", async () => {
    getJsonMock.mockResolvedValueOnce({
      items: [
        { id: "space-1", key: "eng", name: "Engineering", description: "", myRole: "MEMBER", isDefault: false },
      ],
    });

    await runSpaceList(["--output", "json", "space", "list"]);

    expect(outputDataMock).toHaveBeenCalledWith(
      expect.any(Array),
      "json",
      ["Name", "Key", "ID", "Role"],
      expect.any(Array),
    );
  });

  it("prints a friendly message when no spaces are returned", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({ items: [] });

    await runSpaceList(["space", "list"]);

    expect(logSpy).toHaveBeenCalledWith("No spaces found.");
    expect(outputDataMock).not.toHaveBeenCalled();
  });
});
