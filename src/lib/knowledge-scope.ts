export function resolveKnowledgeTarget(space?: string): {
  target: "personal" | "current_space";
  spaceId?: string;
} {
  if (space !== undefined && !space.trim()) {
    throw new Error("--space must not be empty.");
  }
  return space === undefined
    ? { target: "personal" }
    : { target: "current_space", spaceId: space };
}

export function addKnowledgeScopeQuery(
  params: URLSearchParams,
  space?: string,
): void {
  const target = resolveKnowledgeTarget(space);
  params.set("scope", target.target);
  if (target.spaceId !== undefined) {
    params.set("spaceId", target.spaceId);
  }
}
