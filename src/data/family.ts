import type { Dataset, Person, PersonId } from "../types";

export function unionKey(a: PersonId, b: PersonId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildFamily(data: Dataset) {
  const born = new Map<PersonId, number>();
  for (const person of data.people) born.set(person.id, person.born);

  const childrenOf = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!childrenOf.has(p.parent)) childrenOf.set(p.parent, []);
    childrenOf.get(p.parent)!.push(p.child);
  }
  for (const kids of childrenOf.values()) {
    kids.sort((a, b) => born.get(a)! - born.get(b)!);
  }

  const spouseOf = new Map<PersonId, PersonId>();
  for (const u of data.unions) {
    if (!spouseOf.has(u.a)) spouseOf.set(u.a, u.b);
    if (!spouseOf.has(u.b)) spouseOf.set(u.b, u.a);
  }

  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) parentsByChild.set(p.child, []);
    parentsByChild.get(p.child)!.push(p.parent);
  }

  const personById = new Map<PersonId, Person>();
  for (const person of data.people) personById.set(person.id, person);

  return { childrenOf, spouseOf, parentsByChild, personById };
}

export type Family = ReturnType<typeof buildFamily>;