import { describe, expect, it } from "vitest";
import {
  addKnowledgeScopeQuery,
  resolveKnowledgeTarget,
} from "../../src/lib/knowledge-scope.js";

describe("knowledge scope", () => {
  it("resolves personal scope when no Space is provided", () => {
    expect(resolveKnowledgeTarget()).toEqual({ target: "personal" });
  });

  it("resolves current Space scope with its Space ID", () => {
    expect(resolveKnowledgeTarget("space-1")).toEqual({
      target: "current_space",
      spaceId: "space-1",
    });
  });

  it("rejects an empty Space value", () => {
    expect(() => resolveKnowledgeTarget(" ")).toThrow(/space/i);
  });

  it("builds a personal scope query", () => {
    const params = new URLSearchParams();
    addKnowledgeScopeQuery(params);
    expect(params.toString()).toBe("scope=personal");
  });

  it("removes a stale Space ID when applying personal scope", () => {
    const params = new URLSearchParams("spaceId=stale-space");
    addKnowledgeScopeQuery(params);
    expect(params.toString()).toBe("scope=personal");
  });

  it("builds a Space scope query", () => {
    const params = new URLSearchParams();
    addKnowledgeScopeQuery(params, "space-1");
    expect(params.toString()).toBe("scope=current_space&spaceId=space-1");
  });
});
