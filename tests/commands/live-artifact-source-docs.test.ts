import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const getJsonMock = vi.fn();
const patchJsonMock = vi.fn();
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();

vi.mock("../../src/lib/api-client.js", () => ({
  PaApiClient: class {
    getJson = getJsonMock;
    patchJson = patchJsonMock;
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

vi.mock("../../src/lib/output.js", () => ({
  outputData: (data: unknown, _format: string, headers: string[], rows: string[][]) => {
    console.log(`[outputData] headers=${JSON.stringify(headers)} rows=${rows.length}`);
  },
  formatTable: (headers: string[], rows: string[][]) =>
    `[table] headers=${JSON.stringify(headers)} rows=${rows.length}`,
}));

async function runSourceDocsCommand(argv: string[]) {
  const { registerSourceDocsCommands } = await import(
    "../../src/commands/live-artifact/source-docs/index.js"
  );

  const program = new Command();
  program.exitOverride();

  const liveArtifactCmd = program.command("live-artifact");
  registerSourceDocsCommands(liveArtifactCmd);

  await program.parseAsync(["node", "pa", ...argv], { from: "node" });
}

const sampleArtifact = {
  artifact: {
    id: "la-1",
    title: "Test Artifact",
    sourceSessionId: "sess-1",
    sourceDocuments: [
      {
        id: "doc-1",
        label: "report.md",
        sourceType: "workspace-file",
        path: "/workspace/report.md",
        mimeType: "text/markdown",
        openMode: "inline",
        sessionId: "sess-1",
      },
      {
        id: "doc-2",
        label: "data.csv",
        sourceType: "workspace-file",
        path: "/workspace/data.csv",
        mimeType: "text/csv",
        openMode: "download",
        sessionId: "sess-1",
      },
    ],
  },
};

describe("live-artifact source-docs commands", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    patchJsonMock.mockReset();
    spinnerStartMock.mockReset();
    spinnerStopMock.mockReset();
    spinnerStartMock.mockReturnValue({ stop: spinnerStopMock });
  });

  describe("source-docs list", () => {
    it("lists source documents in table", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      getJsonMock.mockResolvedValue(sampleArtifact);

      await runSourceDocsCommand([
        "live-artifact",
        "source-docs",
        "list",
        "la-1",
      ]);

      expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
      expect(logSpy).toHaveBeenCalled();
      // outputData was called via mock which logs [outputData]
      const outputCall = logSpy.mock.calls.find((c) =>
        typeof c[0] === "string" && c[0].includes("[outputData]"),
      );
      expect(outputCall).toBeDefined();
      expect(outputCall![0]).toContain("rows=2");
      expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    });

    it("shows friendly message when no source documents", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      getJsonMock.mockResolvedValue({
        artifact: {
          id: "la-2",
          title: "Empty Artifact",
          sourceDocuments: [],
        },
      });

      await runSourceDocsCommand([
        "live-artifact",
        "source-docs",
        "list",
        "la-2",
      ]);

      expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-2");
      expect(logSpy).toHaveBeenCalledWith("No source documents found.");
      expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("source-docs add", () => {
    it("adds a document by path", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      getJsonMock.mockResolvedValue(sampleArtifact);
      patchJsonMock.mockResolvedValue({});

      await runSourceDocsCommand([
        "live-artifact",
        "source-docs",
        "add",
        "la-1",
        "--path",
        "/workspace/new-file.md",
      ]);

      expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
      expect(patchJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1", {
        sourceDocuments: [
          { sourceType: "workspace-file", sessionId: "sess-1", path: "/workspace/report.md" },
          { sourceType: "workspace-file", sessionId: "sess-1", path: "/workspace/data.csv" },
          { sourceType: "workspace-file", sessionId: "sess-1", path: "/workspace/new-file.md" },
        ],
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Source document added to "la-1"'),
      );
      expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    });

    it("warns when document already exists at path", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      getJsonMock.mockResolvedValue(sampleArtifact);

      await runSourceDocsCommand([
        "live-artifact",
        "source-docs",
        "add",
        "la-1",
        "--path",
        "/workspace/report.md",
      ]);

      expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
      expect(patchJsonMock).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("already exists"),
      );
      expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    });

    it("errors when no sourceSessionId", async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit(1)");
      });

      getJsonMock.mockResolvedValue({
        artifact: {
          id: "la-3",
          sourceSessionId: null,
          sourceDocuments: [],
        },
      });

      try {
        await runSourceDocsCommand([
          "live-artifact",
          "source-docs",
          "add",
          "la-3",
          "--path",
          "/workspace/file.md",
        ]);
        expect.unreachable("Should have thrown");
      } catch (err: unknown) {
        expect((err as Error).message).toBe("process.exit(1)");
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("no source session ID"),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe("source-docs remove", () => {
    it("removes a document by ID", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      getJsonMock.mockResolvedValue(sampleArtifact);
      patchJsonMock.mockResolvedValue({});

      await runSourceDocsCommand([
        "live-artifact",
        "source-docs",
        "remove",
        "la-1",
        "doc-1",
      ]);

      expect(getJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1");
      expect(patchJsonMock).toHaveBeenCalledWith("/api/live-artifacts/la-1", {
        sourceDocuments: [
          { sourceType: "workspace-file", sessionId: "sess-1", path: "/workspace/data.csv" },
        ],
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Source document "doc-1" removed from "la-1"',
        ),
      );
      expect(spinnerStopMock).toHaveBeenCalledTimes(1);
    });

    it("errors when doc ID not found", async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit(1)");
      });

      getJsonMock.mockResolvedValue(sampleArtifact);

      try {
        await runSourceDocsCommand([
          "live-artifact",
          "source-docs",
          "remove",
          "la-1",
          "doc-nonexistent",
        ]);
        expect.unreachable("Should have thrown");
      } catch (err: unknown) {
        expect((err as Error).message).toBe("process.exit(1)");
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("not found"),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
