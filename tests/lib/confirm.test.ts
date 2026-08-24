import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { confirmDestructiveAction } from "../../src/lib/confirm.js";

describe("confirmDestructiveAction", () => {
  it("requires force outside an interactive terminal", async () => {
    await expect(
      confirmDestructiveAction("Delete?", { interactive: false }),
    ).rejects.toThrow(/non-interactive.*--force/i);
  });

  it("does not prompt when the input stream is not a TTY", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    await expect(
      confirmDestructiveAction("Delete?", { input, interactive: true }),
    ).rejects.toThrow(/non-interactive.*--force/i);
  });

  it("accepts force without opening a prompt", async () => {
    await expect(
      confirmDestructiveAction("Delete?", { force: true, interactive: false }),
    ).resolves.toBe(true);
  });

  it("accepts yes from an interactive prompt", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = new PassThrough();
    const confirmation = confirmDestructiveAction("Delete?", { input, output });
    input.end("y\n");
    await expect(confirmation).resolves.toBe(true);
  });

  it("rejects anything other than yes from an interactive prompt", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = new PassThrough();
    const confirmation = confirmDestructiveAction("Delete?", { input, output });
    input.end("no\n");
    await expect(confirmation).resolves.toBe(false);
  });
});
