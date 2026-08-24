import { ApiError } from "./api-client.js";

export type KnowledgeErrorPayload = {
  errorKey?: string;
  status: number;
  message: string;
};

const KNOWLEDGE_MESSAGES = {
  "knowledge.revisionConflict": "Knowledge document changed since it was loaded.",
  "knowledge.folderNotEmpty": "Folder is not empty and cannot be deleted.",
  "knowledge.folderNameConflict": "A folder with this name already exists here.",
  "knowledge.writeAccessDenied": "You do not have permission to write to this Space knowledge base.",
  "knowledge.personalWriteAccessDenied": "Only the personal owner can edit this document.",
  "knowledge.documentNotFound": "Knowledge document not found.",
  "knowledge.expectedRevisionRequired": "Content updates require the current revision.",
  "knowledge.pageContentReadOnly": "Page content must be edited through Live Artifact.",
  "knowledge.fileContentReadOnly": "Binary knowledge files cannot be edited as text.",
} as const;

export function describeKnowledgeError(error: unknown): KnowledgeErrorPayload {
  if (error instanceof ApiError) {
    return {
      ...(error.errorKey ? { errorKey: error.errorKey } : {}),
      status: error.status,
      message: error.errorKey && error.errorKey in KNOWLEDGE_MESSAGES
        ? KNOWLEDGE_MESSAGES[error.errorKey as keyof typeof KNOWLEDGE_MESSAGES]
        : error.message,
    };
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function printKnowledgeError(
  error: unknown,
  output: "table" | "json",
): void {
  const payload = describeKnowledgeError(error);
  if (output === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Error: ${payload.message}`);
}
