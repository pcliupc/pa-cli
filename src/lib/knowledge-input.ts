import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApiKnowledgeType,
  CliKnowledgeType,
  KnowledgeTextInput,
} from "./knowledge-types.js";

export function inferKnowledgeType(inputPath: string): CliKnowledgeType | undefined {
  switch (path.extname(inputPath).toLowerCase()) {
    case ".md":
    case ".markdown":
      return "md";
    case ".csv":
      return "csv";
    default:
      return undefined;
  }
}

export function apiTypeForCliType(type: CliKnowledgeType): ApiKnowledgeType {
  return type === "md" ? "doc" : "csv";
}

export async function readKnowledgeContent(
  inputPath: string,
  readStdin: () => Promise<string> = readProcessStdin,
): Promise<string> {
  if (inputPath === "-") {
    return readStdin();
  }
  return readFile(inputPath, "utf8");
}

export async function readKnowledgeInput(
  inputPath: string,
  options: {
    type?: CliKnowledgeType;
    title?: string;
    readStdin?: () => Promise<string>;
  },
): Promise<KnowledgeTextInput> {
  const isStdin = inputPath === "-";
  const type = options.type ?? inferKnowledgeType(inputPath);
  if (!type) {
    throw new Error(isStdin ? "Reading Knowledge from stdin requires --type and --title." : "Knowledge file type is unknown; provide --type.");
  }
  if (isStdin && !options.title) {
    throw new Error("Reading Knowledge from stdin requires --type and --title.");
  }

  const content = await readKnowledgeContent(inputPath, options.readStdin);
  const title = options.title ?? path.basename(inputPath, path.extname(inputPath));
  return { type, apiType: apiTypeForCliType(type), content, title };
}

async function readProcessStdin(): Promise<string> {
  let content = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    content += chunk;
  }
  return content;
}
