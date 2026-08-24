import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { confirmDestructiveAction } from "../../src/lib/confirm.js";

describe("confirmDestructiveAction", () => {
  it("requires force outside an interactive terminal", async () => {
    await expect(
      confirmDestructiveAction("Delete?", { interactive: false }),
    ).rejects.toThrow(/non-interactive.*--force/i);
  });

  it("does not auto-prompt when the input stream is not a TTY", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    await expect(
      confirmDestructiveAction("Delete?", { input, output }),
    ).rejects.toThrow(/non-interactive.*--force/i);
  });

  it("does not auto-prompt when the output stream is not a TTY", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: false });
    await expect(
      confirmDestructiveAction("Delete?", { input, output }),
    ).rejects.toThrow(/non-interactive.*--force/i);
  });

  it("accepts force without opening a prompt", async () => {
    await expect(
      confirmDestructiveAction("Delete?", { force: true, interactive: false }),
    ).resolves.toBe(true);
  });

  it("allows an explicit interactive override with supplied streams", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const confirmation = confirmDestructiveAction("Delete?", {
      input,
      output,
      interactive: true,
    });
    input.end("y\n");
    await expect(confirmation).resolves.toBe(true);
  });

  it("accepts yes when both selected streams are TTYs", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const confirmation = confirmDestructiveAction("Delete?", { input, output });
    input.end("yes\n");
    await expect(confirmation).resolves.toBe(true);
  });

  it("rejects anything other than yes from an interactive prompt", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const confirmation = confirmDestructiveAction("Delete?", { input, output });
    input.end("no\n");
    await expect(confirmation).resolves.toBe(false);
  });
});
