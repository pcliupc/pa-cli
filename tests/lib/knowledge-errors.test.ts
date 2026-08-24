import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/lib/api-client.js";
import {
  describeKnowledgeError,
  printKnowledgeError,
} from "../../src/lib/knowledge-errors.js";

describe("knowledge errors", () => {
  const cases = [
    ["knowledge.revisionConflict", "Knowledge document changed since it was loaded."],
    ["knowledge.folderNotEmpty", "Folder is not empty and cannot be deleted."],
    ["knowledge.folderNameConflict", "A folder with this name already exists here."],
    ["knowledge.writeAccessDenied", "You do not have permission to write to this Space knowledge base."],
    ["knowledge.personalWriteAccessDenied", "Only the personal owner can edit this document."],
    ["knowledge.documentNotFound", "Knowledge document not found."],
    ["knowledge.expectedRevisionRequired", "Content updates require the current revision."],
    ["knowledge.pageContentReadOnly", "Page content must be edited through Live Artifact."],
    ["knowledge.fileContentReadOnly", "Binary knowledge files cannot be edited as text."],
  ] as const;

  it.each(cases)("maps %s to its stable message", (errorKey, message) => {
    expect(describeKnowledgeError(new ApiError("Server detail.", 409, errorKey))).toEqual({
      errorKey,
      status: 409,
      message,
    });
  });

  it("falls back to an ApiError message for an unknown key", () => {
    expect(describeKnowledgeError(new ApiError("Server detail.", 422, "knowledge.unknown"))).toEqual({
      errorKey: "knowledge.unknown",
      status: 422,
      message: "Server detail.",
    });
  });

  it("falls back to a string for unknown errors", () => {
    expect(describeKnowledgeError("bad request")).toEqual({
      status: 500,
      message: "bad request",
    });
  });

  it("prints a readable table error", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    printKnowledgeError(new ApiError("Server detail.", 409, "knowledge.revisionConflict"), "table");
    expect(log).toHaveBeenCalledWith("Error: Knowledge document changed since it was loaded.");
    log.mockRestore();
  });

  it("prints the complete error payload as JSON", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    printKnowledgeError(new ApiError("Server detail.", 409, "knowledge.revisionConflict"), "json");
    expect(log).toHaveBeenCalledWith(JSON.stringify({
      errorKey: "knowledge.revisionConflict",
      status: 409,
      message: "Knowledge document changed since it was loaded.",
    }, null, 2));
    log.mockRestore();
  });
});
