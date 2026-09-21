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
  titles: { s: string; label: string; start: string | null; end: string | null }[];
  wiki: { s: string; title: string }[];
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

const PREFIXES = [
  "Crown Prince", "Crown Princess", "Hereditary Prince", "Grand Duke", "Grand Duchess",
  "Archduke", "Archduchess", "Prince", "Princess", "Duke", "Duchess",
  "Infante", "Infanta", "Count", "Countess",
];

function splitLabel(label: string): { name: string; title?: string } {
  const comma = label.indexOf(", ");
  if (comma !== -1) {
    return { name: label.slice(0, comma), title: label.slice(comma + 2) };
  }

  for (const prefix of PREFIXES) {
    if (!label.startsWith(prefix + " ")) continue;
    const rest = label.slice(prefix.length + 1);
    const of = rest.indexOf(" of ");
    if (of === -1) return { name: rest, title: prefix };
    return { name: rest.slice(0, of), title: `${prefix} of ${rest.slice(of + 4)}` };
  }

  return { name: label };
}

const TIERS: RegExp[] = [
  /\b(emperor|empress|tsar|tsarina|king|queen|monarch)\b/i,
  /\b(grand duke|grand duchess|elector|electress)\b/i,
  /\b(duke|duchess|prince|princess|regent)\b/i,
];

const IMPERIAL = /\b(emperor|empress|tsar|tsarina)\b/i;
const SECONDARY = /\bof India\b/i;

function tier(title: string): number {
  const i = TIERS.findIndex((re) => re.test(title));
  return i === -1 ? TIERS.length : i;
}

const FEMININE: [RegExp, string][] = [
  [/\bEmperor\b/, "Empress"],
  [/\bKing\b/, "Queen"],
  [/\bTsar\b/, "Tsarina"],
  [/\bGrand Duke\b/, "Grand Duchess"],
  [/\bArchduke\b/, "Archduchess"],
  [/\bDuke\b/, "Duchess"],
  [/\bPrince\b/, "Princess"],
  [/\bElector\b/, "Electress"],
];

function cleanTitle(label: string, sex: "m" | "f"): string {
  let t = label.replace(/^monarch of /i, "King of ");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (sex === "f") {
    for (const [re, feminine] of FEMININE) t = t.replace(re, feminine);
  }
  return t;
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

  const titlesOf = new Map<string, Raw["titles"]>();
  for (const t of raw.titles) {
    if (!titlesOf.has(t.s)) titlesOf.set(t.s, []);
    titlesOf.get(t.s)!.push(t);
  }

  const wikiOf = new Map<string, string>();
  for (const w of raw.wiki) wikiOf.set(w.s, w.title);

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

    const { name: shortName, title: labelTitle } = splitLabel(rp.label);
    const sex: "m" | "f" = rp.sex.includes("Q6581072") ? "f" : "m";

    const fromWiki = (titlesOf.get(id) ?? [])
      .map((t) => ({
        title: cleanTitle(t.label, sex),
        from: year(t.start ?? undefined),
        to: year(t.end ?? undefined),
      }))
      .filter((t) => t.title !== "")
      .sort(
        (a, b) =>
        tier(a.title) - tier(b.title) ||
        Number(SECONDARY.test(a.title)) - Number(SECONDARY.test(b.title)) ||
        (a.from ?? 9999) - (b.from ?? 9999) ||
        Number(IMPERIAL.test(b.title)) - Number(IMPERIAL.test(a.title))
      );

    const royal = fromWiki.filter((t) => tier(t.title) < TIERS.length);
    const other = fromWiki.filter((t) => tier(t.title) === TIERS.length);
    const titles = [...royal];
    if (labelTitle !== undefined && !titles.some((t) => t.title === labelTitle)) {
      titles.push({ title: labelTitle, from: null, to: null });
    }
    titles.push(...other);

    let name = shortName;
    const primary = titles[0];
    const ofAt = name.lastIndexOf(" of ");
    if (primary !== undefined && ofAt !== -1 && primary.title.endsWith(name.slice(ofAt + 4))) {
      name = name.slice(0, ofAt);
    }

    people.push({
      id,
      name: { en: name },
      titles: titles.length > 0 ? titles : undefined,
      sex,
      born,
      died: year(rp.death[0]),
      houseBirth,
      houseMarriage: null,
      wiki: wikiOf.get(id),
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