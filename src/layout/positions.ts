import type { Dataset, Person, PersonId, Box } from "../types";
import { COUPLE_GAP, SIBLING_GAP, UP, DOWN } from "../constants";
import { buildFamily } from "../data/family";

function yearToY(year: number): number {
  return (year - 1800) * 8;
}

export function subtreeWidth(
  personId: PersonId,
  depth: number,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>,
  widths: Map<PersonId, number>
): number {
  const spouseId = spouseOf.get(personId);
  const blockWidth =
    widths.get(personId)! +
    (spouseId !== undefined ? COUPLE_GAP + widths.get(spouseId)! : 0);

  const children = depth > 0 ? childrenOf.get(personId) ?? [] : [];
  if (children.length === 0) return blockWidth;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, depth - 1, childrenOf, spouseOf, widths);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  return Math.max(blockWidth, childrenWidth);
}

function place(
  personId: PersonId,
  left: number,
  depth: number,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>,
  widths: Map<PersonId, number>,
  xByPerson: Map<PersonId, number>,
  partnerOf: Map<PersonId, PersonId>
) {
  const W = subtreeWidth(personId, depth, childrenOf, spouseOf, widths);
  const personW = widths.get(personId)!;
  const spouseId = spouseOf.get(personId);
  const blockWidth =
    personW + (spouseId !== undefined ? COUPLE_GAP + widths.get(spouseId)! : 0);

  const blockLeft = left + (W - blockWidth) / 2;
  xByPerson.set(personId, blockLeft);
  if (spouseId !== undefined) {
    xByPerson.set(spouseId, blockLeft + personW + COUPLE_GAP);
    partnerOf.set(spouseId, personId);
  }

  const children = depth > 0 ? childrenOf.get(personId) ?? [] : [];
  if (children.length === 0) return;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, depth - 1, childrenOf, spouseOf, widths);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  let currentLeft = left + (W - childrenWidth) / 2;
  for (const child of children) {
    place(child, currentLeft, depth - 1, childrenOf, spouseOf, widths, xByPerson, partnerOf);
    currentLeft += subtreeWidth(child, depth - 1, childrenOf, spouseOf, widths) + SIBLING_GAP;
  }
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

export function computeLayout(data: Dataset, focusId: PersonId, widths: Map<PersonId, number>): Map<PersonId, Box> {
  const { childrenOf, spouseOf, parentsByChild, personById } = buildFamily(data);

  const { anchorId, steps } = findAnchor(focusId, parentsByChild, personById);

  const xByPerson = new Map<PersonId, number>();
  const partnerOf = new Map<PersonId, PersonId>();
  place(anchorId, 0, steps + DOWN, childrenOf, spouseOf, widths, xByPerson, partnerOf);

  const yByPerson = new Map<PersonId, number>();
  for (const person of data.people) {
    yByPerson.set(person.id, yearToY(person.born));
  }
  for (const [spouseId, partnerId] of partnerOf) {
    yByPerson.set(spouseId, yByPerson.get(partnerId)!);
  }

  const positions = new Map<PersonId, Box>();
  for (const person of data.people) {
    const x = xByPerson.get(person.id);
    if (x === undefined) continue;
    positions.set(person.id, { x, y: yByPerson.get(person.id)!, w: widths.get(person.id)! });
  }

  let minY = Infinity;
  for (const p of positions.values()) minY = Math.min(minY, p.y);
  for (const p of positions.values()) p.y = p.y - minY + 40;

  return positions;
}