import { readFile, writeFile } from "node:fs/promises";
import type { Dataset, House, Parentage, Person, Union } from "../src/types";

type Pair = { s: string; o: string; oLabel: string };
type RawPerson = { label: string; birth: string[]; death: string[]; sex: string[] };
type Raw = {
  root: string;
  people: Record<string, RawPerson>;
  fathers: Pair[];
  mothers: Pair[];
  marriages: Pair[];
  houses: Pair[];
};

const PALETTE: { color: string; textColor?: string }[] = [
  { color: "var(--azure)" },
  { color: "var(--gules)" },
  { color: "var(--vert)" },
  { color: "var(--purpure)" },
  { color: "var(--sable)" },
  { color: "var(--or)", textColor: "var(--sable)" },
];

function year(date: string | undefined): number | null {
  if (date === undefined) return null;
  const y = parseInt(date, 10);
  return Number.isNaN(y) ? null : y;
}

async function main() {
  const raw: Raw = JSON.parse(await readFile("scripts/raw/victoria.json", "utf8"));

  // pomoćne mape
  const housesOf = new Map<string, string[]>();
  const houseLabel = new Map<string, string>();
  for (const h of raw.houses) {
    if (!housesOf.has(h.s)) housesOf.set(h.s, []);
    housesOf.get(h.s)!.push(h.o);
    houseLabel.set(h.o, h.oLabel);
  }
  const fatherOf = new Map<string, string>();
  for (const f of raw.fathers) fatherOf.set(f.s, f.o);

  // 1. osobe
  const people: Person[] = [];
  let skipped = 0;
  for (const [id, rp] of Object.entries(raw.people)) {
    const born = year(rp.birth[0]);
    if (born === null) {
      skipped++;
      continue;
    }

    const own = housesOf.get(id) ?? [];
    const father = fatherOf.get(id);
    const fatherHouses = father !== undefined ? housesOf.get(father) ?? [] : [];
    const houseBirth = own.find((h) => fatherHouses.includes(h)) ?? own[0] ?? "unknown";
    const comma = rp.label.indexOf(", ");
    const shortName = comma === -1 ? rp.label : rp.label.slice(0, comma);
    const titleText = comma === -1 ? undefined : rp.label.slice(comma + 2);

    people.push({
      id,
      name: { en: shortName },
      titles: titleText !== undefined ? [{ title: titleText, from: null, to: null }] : undefined,
      sex: rp.sex.includes("Q6581072") ? "f" : "m",
      born,
      died: year(rp.death[0]),
      houseBirth,
      houseMarriage: null,
    });
  }
  const ids = new Set(people.map((p) => p.id));

  // 2. roditelji
  const parentage: Parentage[] = [];
  for (const p of [...raw.fathers, ...raw.mothers]) {
    if (ids.has(p.s) && ids.has(p.o)) {
      parentage.push({ parent: p.o, child: p.s });
    }
  }

  // 3. brakovi, svaki par jednom
  const unions: Union[] = [];
  const seen = new Set<string>();
  for (const m of raw.marriages) {
    if (!ids.has(m.s) || !ids.has(m.o)) continue;
    const key = m.s < m.o ? `${m.s}|${m.o}` : `${m.o}|${m.s}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unions.push({ a: m.s, b: m.o, from: null });
  }

  // 4. kuća braka
  const byId = new Map<string, Person>(people.map((p) => [p.id, p]));
  for (const u of unions) {
    const a = byId.get(u.a)!;
    const b = byId.get(u.b)!;
    if (a.houseMarriage === null && b.houseBirth !== a.houseBirth) a.houseMarriage = b.houseBirth;
    if (b.houseMarriage === null && a.houseBirth !== b.houseBirth) b.houseMarriage = a.houseBirth;
  }

  // 5. kuće, najčešće prve
  const count = new Map<string, number>();
  for (const p of people) count.set(p.houseBirth, (count.get(p.houseBirth) ?? 0) + 1);

  const houses: House[] = [...count.keys()]
    .sort((a, b) => count.get(b)! - count.get(a)!)
    .map((id, i) =>
      id === "unknown"
        ? { id, name: { en: "Unknown" }, color: "#9a9a9a" }
        : { id, name: { en: houseLabel.get(id) ?? id }, ...PALETTE[i % PALETTE.length] }
    );

  const dataset: Dataset = { houses, people, parentage, unions };
  await writeFile("public/data/victoria.json", JSON.stringify(dataset));

  console.log(
    `${people.length} people (${skipped} skipped, no birth year), ` +
      `${houses.length} houses, ${unions.length} unions`
  );
}

main();