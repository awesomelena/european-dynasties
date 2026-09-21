import type { Dataset, PersonId, Point } from "../types";
import { NODE_W, COUPLE_GAP, SIBLING_GAP } from "../constants";
import { buildFamily } from "../data/family";

function yearToY(year: number): number {
  return (year - 1800) * 8;
}

export function subtreeWidth(
  personId: PersonId,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>
): number {
  let blockWidth = NODE_W;
  if (spouseOf.has(personId)) {
    blockWidth = NODE_W + COUPLE_GAP + NODE_W;
  }

  const children = childrenOf.get(personId) ?? [];
  if (children.length === 0) return blockWidth;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, childrenOf, spouseOf);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  return Math.max(blockWidth, childrenWidth);
}

function place(
  personId: PersonId,
  left: number,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>,
  xByPerson: Map<PersonId, number>
) {
  const W = subtreeWidth(personId, childrenOf, spouseOf);
  const spouseId = spouseOf.get(personId);
  const blockWidth =
    spouseId !== undefined ? NODE_W + COUPLE_GAP + NODE_W : NODE_W;

  const blockLeft = left + (W - blockWidth) / 2;
  xByPerson.set(personId, blockLeft);
  if (spouseId !== undefined) {
    xByPerson.set(spouseId, blockLeft + NODE_W + COUPLE_GAP);
  }

  const children = childrenOf.get(personId) ?? [];
  if (children.length === 0) return;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, childrenOf, spouseOf);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  let currentLeft = left + (W - childrenWidth) / 2;
  for (const child of children) {
    place(child, currentLeft, childrenOf, spouseOf, xByPerson);
    currentLeft += subtreeWidth(child, childrenOf, spouseOf) + SIBLING_GAP;
  }
}

export function computeLayout(data: Dataset, rootId: PersonId): Map<PersonId, Point> {
  const { childrenOf, spouseOf } = buildFamily(data);

  const xByPerson = new Map<PersonId, number>();
  place(rootId, 0, childrenOf, spouseOf, xByPerson);

  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) parentsByChild.set(p.child, []);
    parentsByChild.get(p.child)!.push(p.parent);
  }

  const yByPerson = new Map<PersonId, number>();
  for (const person of data.people) {
    yByPerson.set(person.id, yearToY(person.born));
  }
  for (const union of data.unions) {
    const aHasParents = parentsByChild.has(union.a);
    const bHasParents = parentsByChild.has(union.b);
    if (!aHasParents && bHasParents) {
      yByPerson.set(union.a, yByPerson.get(union.b)!);
    }
    if (aHasParents && !bHasParents) {
      yByPerson.set(union.b, yByPerson.get(union.a)!);
    }
  }

  const positions = new Map<PersonId, Point>();
  for (const person of data.people) {
    const x = xByPerson.get(person.id);
    if (x === undefined) continue;
    positions.set(person.id, { x, y: yByPerson.get(person.id)! });
  }
  return positions;
}