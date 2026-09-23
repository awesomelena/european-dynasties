import type { PersonId } from "../types";
import type { Family } from "../data/family";
import type { Layout, LayoutBlock, PlacedBox } from "./positions";
import { yearToY } from "./positions";
import {
  ANCESTOR_GENERATIONS,
  COUPLE_GAP,
  MIN_GENERATION_GAP,
  TOP_MARGIN,
} from "../constants";

type Slot = {
  id: PersonId;
  path: string;
  x: number;
  ghost: boolean;
  parents: Slot[];
};

export function computeAncestry(
  family: Family,
  focusId: PersonId,
  widths: Map<PersonId, number>
): Layout {
  const w = (id: PersonId) => widths.get(id)!;
  const born = (id: PersonId) => family.personById.get(id)!.born;

  const parentsOf = (id: PersonId): PersonId[] => {
    const parents = [...(family.parentsByChild.get(id) ?? [])];
    parents.sort(
      (a, b) =>
        (family.personById.get(a)!.sex === "m" ? 0 : 1) -
        (family.personById.get(b)!.sex === "m" ? 0 : 1)
    );
    return parents.slice(0, 2);
  };

  // 1. koja mesta su ponavljanja
  const seen = new Set<PersonId>();
  const repeats = new Set<string>();
  function mark(id: PersonId, gen: number, path: string) {
    if (seen.has(id)) {
      repeats.add(path);
      return;
    }
    seen.add(id);
    if (gen === 0) return;
    parentsOf(id).forEach((p, i) => mark(p, gen - 1, path + i));
  }
  mark(focusId, ANCESTOR_GENERATIONS, "");

  // 2. širina svakog mesta sa precima iznad njega
  function width(id: PersonId, gen: number, path: string): number {
    const own = w(id);
    if (gen === 0 || repeats.has(path)) return own;
    const parents = parentsOf(id);
    if (parents.length === 0) return own;
    let total = (parents.length - 1) * COUPLE_GAP;
    parents.forEach((p, i) => (total += width(p, gen - 1, path + i)));
    return Math.max(own, total);
  }

  // 3. x pozicije, od fokusa naviše
  function place(id: PersonId, gen: number, path: string, left: number): Slot {
    const W = width(id, gen, path);
    const slot: Slot = {
      id,
      path,
      x: left + (W - w(id)) / 2,
      ghost: repeats.has(path),
      parents: [],
    };
    if (gen > 0 && !slot.ghost) {
      const parents = parentsOf(id);
      let parentsWidth = (parents.length - 1) * COUPLE_GAP;
      parents.forEach((p, i) => (parentsWidth += width(p, gen - 1, path + i)));
      let cursor = left + (W - parentsWidth) / 2;
      parents.forEach((p, i) => {
        slot.parents.push(place(p, gen - 1, path + i, cursor));
        cursor += width(p, gen - 1, path + i) + COUPLE_GAP;
      });
    }
    return slot;
  }
  const root = place(focusId, ANCESTOR_GENERATIONS, "", 0);

  // 4. y pozicije, od fokusa naviše: roditelji u istom redu, iznad deteta
  const yByPath = new Map<string, number>();
  function assignY(slot: Slot, y: number) {
    yByPath.set(slot.path, y);
    if (slot.parents.length === 0) return;
    const coupleY = Math.min(
      ...slot.parents.map((p) => yearToY(born(p.id))),
      y - MIN_GENERATION_GAP
    );
    for (const p of slot.parents) assignY(p, coupleY);
  }
  assignY(root, yearToY(born(focusId)));

  // 5. gotovi pravougaonici i blokovi
  const minY = Math.min(...yByPath.values());
  const box = (slot: Slot): PlacedBox => ({
    id: slot.id,
    x: slot.x,
    y: yByPath.get(slot.path)! - minY + TOP_MARGIN,
    w: w(slot.id),
  });

  const positions = new Map<PersonId, PlacedBox>();
  const ghosts: PlacedBox[] = [];
  const blocks: LayoutBlock[] = [];

  function collect(slot: Slot) {
    if (slot.ghost) ghosts.push(box(slot));
    else positions.set(slot.id, box(slot));

    if (slot.parents.length > 0) {
      const [first, second] = slot.parents;
      blocks.push({
        person: box(first),
        spouses:
          second !== undefined
            ? [{ ...box(second), ghost: false, adjacent: true, arc: 0 }]
            : [],
        children: [{ ...box(slot), spouse: second !== undefined ? 0 : -1 }],
      });
    }
    slot.parents.forEach(collect);
  }
  collect(root);

  return { positions, blocks, ghosts, origin: minY };
}