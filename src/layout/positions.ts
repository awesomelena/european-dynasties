import type { Box, Dataset, Person, PersonId, Union } from "../types";
import { COUPLE_GAP, SIBLING_GAP, UP, DOWN, MIN_GENERATION_GAP } from "../constants";
import { buildFamily, unionKey } from "../data/family";

export type PlacedBox = Box & { id: PersonId };

export type LayoutSpouse = PlacedBox & { ghost: boolean; adjacent: boolean; arc: number; ended?: "divorce" | "annulment"; };

export type LayoutBlock = {
  person: PlacedBox;
  spouses: LayoutSpouse[];
  children: (PlacedBox & { spouse: number })[];
};

export type Layout = {
  positions: Map<PersonId, Box>;
  blocks: LayoutBlock[];
};

type RawSpouse = { id: PersonId; x: number; ghost: boolean; adjacent: boolean; arc: number; ended?: "divorce" | "annulment"; };

type RawBlock = {
  person: PersonId;
  spouses: RawSpouse[];
  children: { id: PersonId; spouse: number }[];
};

type Ctx = {
  childrenOf: Map<PersonId, PersonId[]>;
  spousesOf: Map<PersonId, PersonId[]>;
  parentsByChild: Map<PersonId, PersonId[]>;
  widths: Map<PersonId, number>;
  blood: Set<PersonId>;
  xByPerson: Map<PersonId, number>;
  partnerOf: Map<PersonId, PersonId>;
  rawBlocks: RawBlock[];
  unionByPair: Map<string, Union>;
};

function yearToY(year: number): number {
  return (year - 1800) * 8;
}

function findAnchor(
  focusId: PersonId,
  parentsByChild: Map<PersonId, PersonId[]>,
  personById: Map<PersonId, Person>
): { anchorId: PersonId; steps: number } {
  let current = focusId;
  let steps = 0;
  while (steps < UP) {
    const parents = parentsByChild.get(current);
    if (parents === undefined || parents.length === 0) break;
    const house = personById.get(current)!.houseBirth;
    const sameHouse = parents.find((p) => personById.get(p)?.houseBirth === house);
    current = sameHouse ?? parents[0];
    steps++;
  }
  return { anchorId: current, steps };
}

function collectBlood(
  id: PersonId,
  depth: number,
  childrenOf: Map<PersonId, PersonId[]>,
  out: Set<PersonId>
) {
  out.add(id);
  if (depth === 0) return;
  for (const child of childrenOf.get(id) ?? []) {
    collectBlood(child, depth - 1, childrenOf, out);
  }
}

function blockWidth(personId: PersonId, ctx: Ctx): number {
  let w = ctx.widths.get(personId)!;
  for (const s of ctx.spousesOf.get(personId) ?? []) w += COUPLE_GAP + ctx.widths.get(s)!;
  return w;
}

function subtreeWidth(personId: PersonId, depth: number, ctx: Ctx): number {
  const own = blockWidth(personId, ctx);
  const children = depth > 0 ? ctx.childrenOf.get(personId) ?? [] : [];
  if (children.length === 0) return own;

  let total = (children.length - 1) * SIBLING_GAP;
  for (const child of children) total += subtreeWidth(child, depth - 1, ctx);
  return Math.max(own, total);
}

function place(personId: PersonId, left: number, depth: number, ctx: Ctx) {
  const W = subtreeWidth(personId, depth, ctx);
  const spouses = ctx.spousesOf.get(personId) ?? [];
  const w = (id: PersonId) => ctx.widths.get(id)!;

  // raspored u bloku: S1 levo (ako ih je 2+), pa osoba, pa ostali desno
  let cursor = left + (W - blockWidth(personId, ctx)) / 2;
  const placed: RawSpouse[] = [];
  const makeSpouse = (id: PersonId, x: number, adjacent: boolean, arc: number): RawSpouse => ({
    id,
    x,
    adjacent,
    arc,
    ghost: ctx.blood.has(id) || ctx.xByPerson.has(id),
    ended: ctx.unionByPair.get(unionKey(personId, id))?.ended,
  });

  if (spouses.length >= 2) {
    placed.push(makeSpouse(spouses[0], cursor, true, 0));
    cursor += w(spouses[0]) + COUPLE_GAP;
  }

  ctx.xByPerson.set(personId, cursor);
  cursor += w(personId);

  let rightCount = 0;
  for (let i = spouses.length >= 2 ? 1 : 0; i < spouses.length; i++) {
    cursor += COUPLE_GAP;
    const adjacent = rightCount === 0;
    placed.push(makeSpouse(spouses[i], cursor, adjacent, adjacent ? 0 : rightCount));
    cursor += w(spouses[i]);
    rightCount++;
  }

  for (const s of placed) {
    if (!s.ghost) ctx.xByPerson.set(s.id, s.x);
  }

  const block: RawBlock = { person: personId, spouses: placed, children: [] };
  ctx.rawBlocks.push(block);

  // deca, grupisana po braku
  const kids = depth > 0 ? ctx.childrenOf.get(personId) ?? [] : [];
  if (kids.length === 0) return;

  const spouseIndex = (child: PersonId) =>
    spouses.findIndex((s) => (ctx.parentsByChild.get(child) ?? []).includes(s));
  const group = (child: PersonId) => {
    const i = spouseIndex(child);
    return i === -1 ? spouses.length : i;
  };
  const children = [...kids].sort((a, b) => group(a) - group(b));

  let childrenWidth = (children.length - 1) * SIBLING_GAP;
  for (const child of children) childrenWidth += subtreeWidth(child, depth - 1, ctx);

  let currentLeft = left + (W - childrenWidth) / 2;
  for (const child of children) {
    if (!ctx.xByPerson.has(child)) {
      place(child, currentLeft, depth - 1, ctx);
      block.children.push({ id: child, spouse: spouseIndex(child) });
    }
    currentLeft += subtreeWidth(child, depth - 1, ctx) + SIBLING_GAP;
  }
}

export function computeLayout(
  data: Dataset,
  focusId: PersonId,
  widths: Map<PersonId, number>
): Layout {
  const { childrenOf, spousesOf, parentsByChild, personById, unionByPair } = buildFamily(data);
  const { anchorId, steps } = findAnchor(focusId, parentsByChild, personById);
  const depth = steps + DOWN;

  const blood = new Set<PersonId>();
  collectBlood(anchorId, depth, childrenOf, blood);

  const ctx: Ctx = {
    childrenOf,
    spousesOf,
    parentsByChild,
    unionByPair,
    widths,
    blood,
    xByPerson: new Map(),
    partnerOf: new Map(),
    rawBlocks: [],
  };
  place(anchorId, 0, depth, ctx);

  const yByPerson = new Map<PersonId, number>();
  for (const id of ctx.xByPerson.keys()) {
    yByPerson.set(id, yearToY(personById.get(id)!.born));
  }
  for (const b of ctx.rawBlocks) {
    const y = yByPerson.get(b.person)!;
    for (const s of b.spouses) {
      if (!s.ghost) yByPerson.set(s.id, y);
    }
    for (const c of b.children) {
      yByPerson.set(c.id, Math.max(yByPerson.get(c.id)!, y + MIN_GENERATION_GAP));
    }
  }

  let minY = Infinity;
  for (const y of yByPerson.values()) minY = Math.min(minY, y);

  const positions = new Map<PersonId, Box>();
  for (const [id, x] of ctx.xByPerson) {
    positions.set(id, { x, y: yByPerson.get(id)! - minY + 40, w: widths.get(id)! });
  }

  const blocks: LayoutBlock[] = ctx.rawBlocks.map((b) => {
    const person = { id: b.person, ...positions.get(b.person)! };
    const spouses = b.spouses.map((s) => ({
      id: s.id,
      ghost: s.ghost,
      adjacent: s.adjacent,
      arc: s.arc,
      x: s.x,
      y: person.y,
      w: widths.get(s.id)!,
      ended: s.ended,
    }));
    const children = b.children.map((c) => ({ id: c.id, spouse: c.spouse, ...positions.get(c.id)! }));
    return { person, spouses, children };
  });

  return { positions, blocks };
}