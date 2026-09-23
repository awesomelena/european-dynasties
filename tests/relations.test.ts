import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Dataset } from "../src/types";
import { buildFamily } from "../src/data/family";
import { findPath } from "../src/data/relations";

const data: Dataset = JSON.parse(readFileSync("public/data/europe.json", "utf8"));
const family = buildFamily(data);

describe("findPath", () => {
  it("finds a person to themselves in zero steps", () => {
    expect(findPath(family, "Q9439", "Q9439")).toEqual([{ id: "Q9439", relation: "start" }]);
  });

  it("finds a parent in one step", () => {
    const child = data.parentage[0].child;
    const parent = data.parentage[0].parent;
    const path = findPath(family, child, parent)!;
    expect(path).toHaveLength(2);
    expect(path[1]).toEqual({ id: parent, relation: "parent" });
  });

  it("produces a path where every step is a real relation", () => {
    const path = findPath(family, "Q9439", data.people[500].id);
    if (path === null) return;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1].id;
      const { id, relation } = path[i];
      const list =
        relation === "parent" ? family.parentsByChild.get(prev)
        : relation === "child" ? family.childrenOf.get(prev)
        : family.spousesOf.get(prev);
      expect(list ?? []).toContain(id);
    }
  });
});