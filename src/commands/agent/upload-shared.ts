import fs from "node:fs";
import path from "node:path";

export function resolveAndValidateInputPath(inputPath: string): string {
  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path not found: ${resolvedPath}`);
  }
  return resolvedPath;
}

export function buildAgentUploadFormData(
  inputPath: string,
  options: {
    targetAgentId?: string;
    sourceVersionId?: string;
    publish?: boolean;
  } = {},
): FormData {
  const resolvedPath = resolveAndValidateInputPath(inputPath);
  const stat = fs.statSync(resolvedPath);
  const formData = new FormData();

  if (options.targetAgentId) {
    formData.append("agentId", options.targetAgentId);
  }
  if (options.sourceVersionId) {
    formData.append("sourceVersionId", options.sourceVersionId);
  }
  if (typeof options.publish === "boolean") {
    formData.append("publish", options.publish ? "true" : "false");
  }

  if (stat.isFile()) {
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== ".yaml" && ext !== ".yml" && ext !== ".zip") {
      throw new Error("Unsupported file type. Use .yaml, .yml, or .zip files.");
    }
    const buffer = fs.readFileSync(resolvedPath);
    formData.append("file", new Blob([buffer]), path.basename(resolvedPath));
    return formData;
  }

  if (stat.isDirectory()) {
    const files = walkDir(resolvedPath);
    if (files.length === 0) {
      throw new Error("Directory is empty.");
    }
    for (const filePath of files) {
      const buffer = fs.readFileSync(filePath);
      const relativePath = path.relative(resolvedPath, filePath);
      formData.append("files[]", new Blob([buffer]), relativePath);
      formData.append("paths[]", relativePath);
    }
    return formData;
  }

  throw new Error("Unsupported path. Provide a .yaml, .yml, .zip file, or directory.");
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}
