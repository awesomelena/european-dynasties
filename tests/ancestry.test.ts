import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Dataset, PersonId } from "../src/types";
import { buildFamily } from "../src/data/family";
import { computeAncestry } from "../src/layout/ancestry";
import { MIN_GENERATION_GAP, NODE_H } from "../src/constants";

const data: Dataset = JSON.parse(readFileSync("public/data/europe.json", "utf8"));
const family = buildFamily(data);
const widths = new Map<PersonId, number>(data.people.map((p) => [p.id, 150]));
const focuses = ["Q9439", ...data.people.filter((_, i) => i % 200 === 0).map((p) => p.id)];

describe.each(focuses)("ancestry of %s", (focusId) => {
  const layout = computeAncestry(family, focusId, widths);
  const boxes = [...layout.positions.values(), ...layout.ghosts];

  it("has no overlapping boxes", () => {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + NODE_H && b.y < a.y + NODE_H;
        expect(overlap).toBe(false);
      }
    }
  });

  it("draws parents above their child", () => {
    for (const b of layout.blocks) {
      for (const c of b.children) {
        expect(c.y - b.person.y).toBeGreaterThanOrEqual(MIN_GENERATION_GAP - 0.001);
      }
    }
  });
});