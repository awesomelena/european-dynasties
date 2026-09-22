import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Dataset, PersonId } from "../src/types";
import { buildFamily } from "../src/data/family";
import { computeLayout, type Layout } from "../src/layout/positions";
import { COUPLE_GAP, MIN_GENERATION_GAP, NODE_H } from "../src/constants";

const data: Dataset = JSON.parse(readFileSync("public/data/europe.json", "utf8"));
const family = buildFamily(data);
const widths = new Map<PersonId, number>(data.people.map((p) => [p.id, 150]));

const focuses = [
  "Q9439",
  ...data.people.filter((_, i) => i % 100 === 0).map((p) => p.id),
];

function allBoxes(layout: Layout) {
  const boxes: { id: PersonId; x: number; y: number; w: number }[] = [];
  for (const b of layout.blocks) {
    boxes.push(b.person);
    for (const s of b.spouses) boxes.push(s);
  }
  return boxes;
}

describe.each(focuses)("layout around %s", (focusId) => {
  const layout = computeLayout(family, focusId, widths);

  it("contains the focused person", () => {
    expect(layout.positions.has(focusId)).toBe(true);
  });

  it("has no overlapping boxes", () => {
    const boxes = allBoxes(layout);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + NODE_H && b.y < a.y + NODE_H;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("puts adjacent spouses exactly COUPLE_GAP apart", () => {
    for (const b of layout.blocks) {
      for (const s of b.spouses) {
        if (!s.adjacent) continue;
        const gap = s.x > b.person.x ? s.x - (b.person.x + b.person.w) : b.person.x - (s.x + s.w);
        expect(gap).toBeCloseTo(COUPLE_GAP);
      }
    }
  });

  it("draws children below their parents", () => {
    for (const b of layout.blocks) {
      for (const c of b.children) {
        expect(c.y - b.person.y, `${c.id} under ${b.person.id}`).toBeGreaterThanOrEqual(
          MIN_GENERATION_GAP - 0.001
        );
      }
    }
  });

  it("orders children of each marriage by birth, left to right", () => {
    for (const b of layout.blocks) {
      const groups = new Map<number, typeof b.children>();
      for (const c of b.children) {
        if (!groups.has(c.spouse)) groups.set(c.spouse, []);
        groups.get(c.spouse)!.push(c);
      }
      for (const group of groups.values()) {
        for (let i = 1; i < group.length; i++) {
          const prev = family.personById.get(group[i - 1].id)!;
          const curr = family.personById.get(group[i].id)!;
          expect(curr.born).toBeGreaterThanOrEqual(prev.born);
          expect(group[i].x).toBeGreaterThan(group[i - 1].x);
        }
      }
    }
  });
});