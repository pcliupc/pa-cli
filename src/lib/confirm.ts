import { createInterface } from "node:readline";

export async function confirmDestructiveAction(
  question: string,
  options: {
    force?: boolean;
    interactive?: boolean;
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
  } = {},
): Promise<boolean> {
  if (options.force) return true;

  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const inputIsTTY = Boolean((input as NodeJS.ReadableStream & { isTTY?: boolean }).isTTY);
  const outputIsTTY = Boolean((output as NodeJS.WritableStream & { isTTY?: boolean }).isTTY);
  const interactive = options.interactive ?? (inputIsTTY && outputIsTTY);
  if (!interactive) {
    throw new Error("Destructive actions are non-interactive; use --force.");
  }

  const readline = createInterface({
    input: input as NodeJS.ReadableStream & AsyncIterable<string>,
    output: output as NodeJS.WritableStream,
  });

  return new Promise((resolve) => {
    readline.question(`${question} (y/N) `, (answer) => {
      readline.close();
      resolve(/^(y|yes)$/i.test(answer.trim()));
    });
  });
}
