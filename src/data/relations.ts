import type { PersonId } from "../types";
import type { Family } from "./family";

export type Relation = "start" | "parent" | "child" | "spouse";
export type Step = { id: PersonId; relation: Relation };

export function findPath(family: Family, from: PersonId, to: PersonId): Step[] | null {
  const cameFrom = new Map<PersonId, { id: PersonId; relation: Relation }>();
  cameFrom.set(from, { id: from, relation: "start" });

  const queue: PersonId[] = [from];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    if (current === to) return rebuild(cameFrom, from, to);

    const neighbours: [PersonId, Relation][] = [];
    for (const p of family.parentsByChild.get(current) ?? []) neighbours.push([p, "parent"]);
    for (const c of family.childrenOf.get(current) ?? []) neighbours.push([c, "child"]);
    for (const s of family.spousesOf.get(current) ?? []) neighbours.push([s, "spouse"]);

    for (const [next, relation] of neighbours) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, { id: current, relation });
      queue.push(next);
    }
  }

  return null;
}

function rebuild(
  cameFrom: Map<PersonId, { id: PersonId; relation: Relation }>,
  from: PersonId,
  to: PersonId
): Step[] {
  const steps: Step[] = [];
  let id = to;
  while (id !== from) {
    const prev = cameFrom.get(id)!;
    steps.push({ id, relation: prev.relation });
    id = prev.id;
  }
  steps.push({ id: from, relation: "start" });
  return steps.reverse();
}