import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const postJsonMock = vi.fn();
const postMultipartMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    postJson = postJsonMock;
    postMultipart = postMultipartMock;
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

async function runAgentCommand(argv: string[]) {
  const { registerAgentCommands } = await import(
    "../../src/commands/agent/index.js"
  );

  const program = new Command();
  program
    .exitOverride()
    .option("--output <format>", "output format: table or json", "table")
    .option("--server <url>", "override server URL");

  registerAgentCommands(program);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

describe("agent version commands", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    postMultipartMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  it("lists versions in json mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      agent_id: "demo",
      current_version_id: "ver-2",
      items: [
        {
          version_id: "ver-2",
          version_number: "v2",
          version_index: 2,
          source_version_id: "ver-1",
          creatorName: "Alice",
          createdAt: "2026-04-22T10:00:00.000Z",
          is_current: true,
        },
      ],
    });

    await runAgentCommand(["--output", "json", "agent", "version", "list", "demo"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/agents/demo/versions");
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        [
          {
            version_id: "ver-2",
            version_number: "v2",
            version_index: 2,
            source_version_id: "ver-1",
            creatorName: "Alice",
            createdAt: "2026-04-22T10:00:00.000Z",
            is_current: true,
          },
        ],
        null,
        2,
      ),
    );
  });

  it("prints a version snapshot in table mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getJsonMock.mockResolvedValueOnce({
      agent_id: "demo",
      agent_name: "Demo Agent",
      version_id: "ver-2",
      version_number: "v2",
      version_index: 2,
      source_version_id: "ver-1",
      config: { name: "Demo Agent", stages: [] },
      is_current: true,
      creatorName: "Alice",
      createdAt: "2026-04-22T10:00:00.000Z",
    });

    await runAgentCommand(["agent", "version", "get", "demo", "v2"]);

    expect(getJsonMock).toHaveBeenCalledWith("/api/agents/demo/versions/v2");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Demo Agent v2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("\"name\": \"Demo Agent\""));
  });

  it("publishes a version", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    postJsonMock.mockResolvedValueOnce({
      agent_id: "demo",
      current_version_id: "ver-3",
      current_version_number: "v3",
    });

    await runAgentCommand(["agent", "version", "publish", "demo", "v3"]);

    expect(postJsonMock).toHaveBeenCalledWith("/api/agents/demo/versions/v3/publish");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("now publishes v3"));
  });

  it("creates a new version from a directory and keeps the current published version by default", async () => {
    const tmpDir = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const os = await vi.importActual<typeof import("node:os")>("node:os");
    const path = await vi.importActual<typeof import("node:path")>("node:path");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = await tmpDir.mkdtemp(path.join(os.tmpdir(), "pa-agent-version-"));
    await tmpDir.writeFile(
      path.join(dir, "config.yaml"),
      "agent_id: demo\nname: Demo Agent\nstages: []\n",
      "utf8",
    );

    postMultipartMock.mockResolvedValueOnce({
      agent_id: "demo",
      status: "version_created",
      version_number: "v3",
      current_version_number: "v2",
    });

    await runAgentCommand(["agent", "version", "create", "demo", dir, "--from", "v2"]);

    expect(postMultipartMock).toHaveBeenCalledTimes(1);
    const [, formData] = postMultipartMock.mock.calls[0];
    expect(formData.get("agentId")).toBe("demo");
    expect(formData.get("sourceVersionId")).toBe("v2");
    expect(formData.get("publish")).toBe("false");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("new version v3, current v2"));

    await tmpDir.rm(dir, { recursive: true, force: true });
  });

  it("uses upload to append a new version to an existing logical agent", async () => {
    const tmpDir = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const os = await vi.importActual<typeof import("node:os")>("node:os");
    const path = await vi.importActual<typeof import("node:path")>("node:path");
    const dir = await tmpDir.mkdtemp(path.join(os.tmpdir(), "pa-agent-upload-"));
    await tmpDir.writeFile(
      path.join(dir, "config.yaml"),
      "agent_id: ignored-local-id\nname: Demo Agent\nstages: []\n",
      "utf8",
    );

    postMultipartMock.mockResolvedValueOnce({
      agent_id: "demo",
      status: "version_created",
      version_number: "v4",
      current_version_number: "v2",
    });

    await runAgentCommand(["agent", "upload", dir, "--agent", "demo", "--from", "v2"]);

    expect(postMultipartMock).toHaveBeenCalledTimes(1);
    const [, formData] = postMultipartMock.mock.calls[0];
    expect(formData.get("agentId")).toBe("demo");
    expect(formData.get("sourceVersionId")).toBe("v2");
    expect(formData.get("publish")).toBe("false");

    await tmpDir.rm(dir, { recursive: true, force: true });
  });
});
