import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PaApiClient } from "../../src/lib/api-client.js";

describe("PaApiClient", () => {
  let client: PaApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = new PaApiClient({
      serverUrl: "http://localhost:3000",
      apiKey: "pa_test123",
      fetch: fetchMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization header with Bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await client.getJson("/api/agents");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/agents",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer pa_test123",
        }),
      }),
    );
  });

  it("throws on 401 with friendly message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "未登录" }), { status: 401 }),
    );
    await expect(client.getJson("/api/agents")).rejects.toThrow(
      "Authentication failed",
    );
  });

  it("throws on 404 with not found message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "不存在" }), { status: 404 }),
    );
    await expect(client.getJson("/api/agents/xxx")).rejects.toThrow(
      "not found",
    );
  });

  it("throws on 409 with overwrite hint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "already exists" }), { status: 409 }),
    );
    await expect(client.postMultipart("/api/agents/upload", new FormData())).rejects.toThrow(
      "--overwrite",
    );
  });

  it("handles network errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(client.getJson("/api/agents")).rejects.toThrow(
      "Cannot connect to server",
    );
  });

  it("downloads files with encoded workspace paths and writes the fetched bytes", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-cli-download-"));
    const outputPath = path.join(tmpDir, "nested", "report final.md");
    fetchMock.mockResolvedValueOnce(
      new Response(Uint8Array.from([80, 65]).buffer, { status: 200 }),
    );

    await client.downloadFile(
      "/api/workspace/sess_123/serve?path=nested%2Freport%20final.md",
      outputPath,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/workspace/sess_123/serve?path=nested%2Freport%20final.md",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer pa_test123",
        }),
      }),
    );
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([80, 65]));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
