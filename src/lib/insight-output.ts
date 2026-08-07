import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { InsightJobComponent, InsightJobResultResponse } from "./insight-jobs.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function markdown(title: string, value: unknown): string {
  if (typeof value === "string") return `# ${title}\n\n${value}\n`;
  const record = asRecord(value);
  const text = record.summary_text ?? record.summaryText ?? record.overview ?? record.summary;
  if (typeof text === "string") return `# ${title}\n\n${text}\n`;
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(value ?? {}, null, 2)}\n\`\`\`\n`;
}

async function writeComponent(
  directory: string,
  componentName: string,
  component: InsightJobComponent | undefined,
  files: string[],
): Promise<void> {
  if (!component?.result) return;
  const componentDir = path.join(directory, componentName);
  await mkdir(componentDir, { recursive: true });
  const filePath = path.join(componentDir, "insights.md");
  await writeFile(filePath, markdown(`${componentName} insights`, component.result), "utf8");
  files.push(filePath);
}

export async function writeInsightEvaluation(input: {
  rootDir: string;
  job: InsightJobResultResponse;
}): Promise<{ directory: string; files: string[] }> {
  const directory = path.resolve(input.rootDir, input.job.jobId);
  const files: string[] = [];
  await mkdir(directory, { recursive: true });

  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(input.job, null, 2)}\n`, "utf8");
  files.push(manifestPath);

  if (!input.job.result) {
    const errorPath = path.join(directory, "error.md");
    await writeFile(
      errorPath,
      `# Insight generation failed\n\n- Job: ${input.job.jobId}\n- Status: ${input.job.status}\n- Error: ${input.job.errorKey ?? "unknown"}\n`,
      "utf8",
    );
    files.push(errorPath);
    return { directory, files };
  }

  const result = input.job.result;
  if (result.targetType === "session") {
    const summary = result.components.summary;
    if (summary?.result) {
      const summaryPath = path.join(directory, "summary.md");
      await writeFile(summaryPath, markdown("Session summary", summary.result), "utf8");
      files.push(summaryPath);

      const diagnosticsDir = path.join(directory, "diagnostics");
      await mkdir(diagnosticsDir, { recursive: true });
      const diagnosticsPath = path.join(diagnosticsDir, "summary.md");
      await writeFile(
        diagnosticsPath,
        markdown("Session diagnostics", asRecord(summary.result).diagnostics ?? result.metadata.inputBasis),
        "utf8",
      );
      files.push(diagnosticsPath);
    }
  } else {
    await writeComponent(directory, "business", result.components.business, files);
    const businessResult = result.components.business?.result;
    if (businessResult && businessResult.analysisProfile) {
      const profilePath = path.join(directory, "business", "analysis-profile.json");
      await writeFile(profilePath, `${JSON.stringify(businessResult.analysisProfile, null, 2)}\n`, "utf8");
      files.push(profilePath);
    }
    await writeComponent(directory, "design", result.components.design, files);
  }

  return { directory, files };
}

export function defaultInsightOutputRoot(): string {
  return path.resolve(process.cwd(), ".pa/evaluations");
}
