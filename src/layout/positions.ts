import type { Box, Dataset, Person, PersonId } from "../types";
import { COUPLE_GAP, SIBLING_GAP, UP, DOWN } from "../constants";
import { buildFamily } from "../data/family";

export type PlacedBox = Box & { id: PersonId };

export type LayoutBlock = {
  person: PlacedBox;
  spouse: (PlacedBox & { ghost: boolean }) | null;
  children: (PlacedBox & { ofCouple: boolean })[];
};

export type Layout = {
  positions: Map<PersonId, Box>;
  blocks: LayoutBlock[];
};

type RawBlock = {
  person: PersonId;
  spouse: PersonId | null;
  ghost: boolean;
  spouseX: number;
  children: PersonId[];
};

type Ctx = {
  childrenOf: Map<PersonId, PersonId[]>;
  spouseOf: Map<PersonId, PersonId>;
  parentsByChild: Map<PersonId, PersonId[]>;
  widths: Map<PersonId, number>;
  blood: Set<PersonId>;
  xByPerson: Map<PersonId, number>;
  partnerOf: Map<PersonId, PersonId>;
  rawBlocks: RawBlock[];
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
  const spouseId = ctx.spouseOf.get(personId);
  return (
    ctx.widths.get(personId)! +
    (spouseId !== undefined ? COUPLE_GAP + ctx.widths.get(spouseId)! : 0)
  );
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
  const personW = ctx.widths.get(personId)!;
  const spouseId = ctx.spouseOf.get(personId) ?? null;

  const blockLeft = left + (W - blockWidth(personId, ctx)) / 2;
  ctx.xByPerson.set(personId, blockLeft);

  const spouseX = blockLeft + personW + COUPLE_GAP;
  const ghost = spouseId !== null && ctx.blood.has(spouseId);
  if (spouseId !== null && !ghost) {
    ctx.xByPerson.set(spouseId, spouseX);
    ctx.partnerOf.set(spouseId, personId);
  }

  const block: RawBlock = { person: personId, spouse: spouseId, ghost, spouseX, children: [] };
  ctx.rawBlocks.push(block);

  const children = depth > 0 ? ctx.childrenOf.get(personId) ?? [] : [];
  if (children.length === 0) return;

  let childrenWidth = (children.length - 1) * SIBLING_GAP;
  for (const child of children) childrenWidth += subtreeWidth(child, depth - 1, ctx);

  let currentLeft = left + (W - childrenWidth) / 2;
  for (const child of children) {
    if (!ctx.xByPerson.has(child)) {
      place(child, currentLeft, depth - 1, ctx);
      block.children.push(child);
    }
    currentLeft += subtreeWidth(child, depth - 1, ctx) + SIBLING_GAP;
  }
}

export function computeLayout(
  data: Dataset,
  focusId: PersonId,
  widths: Map<PersonId, number>
): Layout {
  const { childrenOf, spouseOf, parentsByChild, personById } = buildFamily(data);
  const { anchorId, steps } = findAnchor(focusId, parentsByChild, personById);
  const depth = steps + DOWN;

  const blood = new Set<PersonId>();
  collectBlood(anchorId, depth, childrenOf, blood);

  const ctx: Ctx = {
    childrenOf,
    spouseOf,
    parentsByChild,
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
  for (const [spouseId, partnerId] of ctx.partnerOf) {
    yByPerson.set(spouseId, yByPerson.get(partnerId)!);
  }

  let minY = Infinity;
  for (const y of yByPerson.values()) minY = Math.min(minY, y);

  const positions = new Map<PersonId, Box>();
  for (const [id, x] of ctx.xByPerson) {
    positions.set(id, { x, y: yByPerson.get(id)! - minY + 40, w: widths.get(id)! });
  }

  const blocks: LayoutBlock[] = ctx.rawBlocks.map((b) => {
    const person = { id: b.person, ...positions.get(b.person)! };
    const spouse =
      b.spouse === null
        ? null
        : { id: b.spouse, ghost: b.ghost, x: b.spouseX, y: person.y, w: widths.get(b.spouse)! };
    const children = b.children.map((id) => ({
      id,
      ...positions.get(id)!,
      ofCouple: b.spouse !== null && (parentsByChild.get(id) ?? []).includes(b.spouse),
    }));
    return { person, spouse, children };
  });

  return { positions, blocks };
}