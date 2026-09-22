import type { Dataset, Person, PersonId, Union } from "../types";

export function unionKey(a: PersonId, b: PersonId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildFamily(data: Dataset) {
  const born = new Map<PersonId, number>();
  const personById = new Map<PersonId, Person>();
  for (const p of data.people) {
    born.set(p.id, p.born);
    personById.set(p.id, p);
  }

  const add = (map: Map<PersonId, PersonId[]>, key: PersonId, value: PersonId) => {
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key)!.includes(value)) map.get(key)!.push(value);
  };

  const childrenOf = new Map<PersonId, PersonId[]>();
  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    add(childrenOf, p.parent, p.child);
    add(parentsByChild, p.child, p.parent);
  }
  for (const kids of childrenOf.values()) {
    kids.sort((a, b) => born.get(a)! - born.get(b)!);
  }

  const spousesOf = new Map<PersonId, PersonId[]>();
  const unionByPair = new Map<string, Union>();
  for (const u of data.unions) unionByPair.set(unionKey(u.a, u.b), u);
  for (const u of data.unions) {
    add(spousesOf, u.a, u.b);
    add(spousesOf, u.b, u.a);
  }

  function marriageKey(person: PersonId, spouse: PersonId): number {
    const from = unionByPair.get(unionKey(person, spouse))?.from;
    if (from !== null && from !== undefined) return from;

    let firstChild = Infinity;
    for (const c of childrenOf.get(person) ?? []) {
      if ((parentsByChild.get(c) ?? []).includes(spouse)) {
        firstChild = Math.min(firstChild, born.get(c)!);
      }
    }
    return firstChild !== Infinity ? firstChild : born.get(spouse)! + 20;
  }
  for (const [person, list] of spousesOf) {
    list.sort((a, b) => marriageKey(person, a) - marriageKey(person, b));
  }

  const spouseOf = new Map<PersonId, PersonId>();
  for (const [person, list] of spousesOf) spouseOf.set(person, list[0]);

  return { childrenOf, spouseOf, spousesOf, parentsByChild, personById, unionByPair };
}

export type Family = ReturnType<typeof buildFamily>;