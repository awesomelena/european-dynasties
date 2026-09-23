import { readFile, writeFile } from "node:fs/promises";
import type { Country, Dataset, House, Parentage, Person, Union } from "../src/types";
import type { Pair, RawArticle, RawMarriage, RawPerson, RawPosition } from "./wikidata";

type Raw = {
  root: string;
  people: Record<string, RawPerson>;
  fathers: Pair[];
  mothers: Pair[];
  marriages: RawMarriage[];
  houses: Pair[];
  titles: RawPosition[];
  wiki: RawArticle[];
};

type PersonOverride = {
  name?: string;
  born?: number;
  died?: number | null;
  displayTitle?: string;
  houseBirth?: string;
};

type Overrides = {
  people?: Record<string, PersonOverride>;
  removeParentage?: { parent: string; child: string }[];
  addParentage?: { parent: string; child: string }[];
  removeUnions?: { a: string; b: string }[];
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
const SECONDARY =
  /\bof (the )?(India|Canada|Australia|New Zealand|(Union of )?South Africa|Pakistan|Ceylon|Jamaica|Barbados|Bahamas|Belize|Grenada|Papua New Guinea|Solomon Islands|Tuvalu|Saint Lucia|Saint Vincent|Antigua|Saint Kitts|Fiji|Ghana|Kenya|Malta|Mauritius|Nigeria|Sierra Leone|Tanganyika|Trinidad|Uganda|Guyana|The Gambia)\b/i;
const NOISE = /^(head of state|member of)\b/i;

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

function span(t: { from: number | null; to: number | null }): number {
  return t.from !== null && t.to !== null ? t.to - t.from : 0;
}

function knownYears(ids: string[] | undefined, from: Map<string, number>): number[] {
  const result: number[] = [];
  for (const id of ids ?? []) {
    const y = from.get(id);
    if (y !== undefined) result.push(y);
  }
  return result;
}

function estimateBirthYears(raw: Raw, overrides: Overrides) {
  const years = new Map<string, number>();
  for (const [id, rp] of Object.entries(raw.people)) {
    const y = year(rp.birth[0]);
    if (y !== null) years.set(id, y);
  }
  for (const [id, o] of Object.entries(overrides.people ?? {})) {
    if (o.born !== undefined) years.set(id, o.born);
  }

  const spousesOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, key: string, value: string) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(value);
  };
  for (const m of raw.marriages) {
    add(spousesOf, m.s, m.o);
    add(spousesOf, m.o, m.s);
  }
  for (const p of [...raw.fathers, ...raw.mothers]) {
    add(parentsOf, p.s, p.o);
    add(childrenOf, p.o, p.s);
  }

  const estimated = new Set<string>();

  function pass(useDeath: boolean): boolean {
    const before = new Map(years);
    let found = false;

    for (const [id, rp] of Object.entries(raw.people)) {
      if (before.has(id)) continue;

      const spouses = knownYears(spousesOf.get(id), before);
      const children = knownYears(childrenOf.get(id), before);
      const parents = knownYears(parentsOf.get(id), before);
      const died = year(rp.death[0]);

      let estimate: number | undefined;
      if (spouses.length > 0) estimate = spouses[0];
      else if (children.length > 0) estimate = Math.min(...children) - 25;
      else if (parents.length > 0) estimate = Math.max(...parents) + 25;
      else if (useDeath && died !== null) estimate = died - 45;

      if (estimate !== undefined) {
        let lower = -Infinity;
        let upper = Infinity;
        if (parents.length > 0) lower = Math.max(...parents) + 15;
        if (children.length > 0) upper = Math.min(...children) - 15;
        if (died !== null) upper = Math.min(upper, died);
        for (const parentId of parentsOf.get(id) ?? []) {
          const parentDied = year(raw.people[parentId]?.death[0]);
          if (parentDied !== null) upper = Math.min(upper, parentDied + 1);
        }
        if (lower <= upper) estimate = Math.min(Math.max(estimate, lower), upper);

        years.set(id, estimate);
        estimated.add(id);
        found = true;
      }
    }

    return found;
  }

  while (pass(false)) {}
  pass(true);
  while (pass(false)) {}

  return { years, estimated };
}

  async function main() {
    const datasetName = process.argv[2] ?? "europe";
    const raw: Raw = JSON.parse(await readFile(`scripts/raw/${datasetName}.json`, "utf8"));

    let overrides: Overrides = {};
    try {
      overrides = JSON.parse(await readFile("scripts/overrides.json", "utf8"));
    } catch {
      console.log("  no overrides.json, skipping");
    }

    // pomoćne mape
    const housesOf = new Map<string, string[]>();
    const houseLabel = new Map<string, string>();
    const canonicalByLabel = new Map<string, string>();

    for (const h of raw.houses) {
      if (!canonicalByLabel.has(h.oLabel)) canonicalByLabel.set(h.oLabel, h.o);
    }
    for (const h of raw.houses) {
      const id = canonicalByLabel.get(h.oLabel)!;
      houseLabel.set(id, /^Q\d+$/.test(h.oLabel) ? "Unnamed house" : h.oLabel);
      if (!housesOf.has(h.s)) housesOf.set(h.s, []);
      if (!housesOf.get(h.s)!.includes(id)) housesOf.get(h.s)!.push(id);
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
    const { years, estimated } = estimateBirthYears(raw, overrides);
    const people: Person[] = [];
    let skipped = 0;

    for (const [id, rp] of Object.entries(raw.people)) {
      const born = years.get(id);
      if (born === undefined) {
        skipped++;
        continue;
      }

      const own = housesOf.get(id) ?? [];
      const father = fatherOf.get(id);
      const fatherHouses = father !== undefined ? housesOf.get(father) ?? [] : [];
      const houseBirth = own.find((h) => fatherHouses.includes(h)) ?? own[0] ?? "unknown";

      const { name: shortName, title: labelTitle } = splitLabel(rp.label);
      const sex: "m" | "f" = rp.sex.includes("Q6581072") ? "f" : "m";

      const mapped = (titlesOf.get(id) ?? [])
        .map((t) => ({
          title: cleanTitle(t.label, sex),
          from: year(t.start ?? undefined),
          to: year(t.end ?? undefined),
        }))
        .filter((t) => t.title !== "" && !NOISE.test(t.title));

      const merged = new Map<string, { title: string; from: number | null; to: number | null; years: number }>();
      for (const t of mapped) {
        const m = merged.get(t.title);
        if (m === undefined) {
          merged.set(t.title, { ...t, years: span(t) });
        } else {
          m.from = m.from === null ? t.from : t.from === null ? m.from : Math.min(m.from, t.from);
          m.to = m.to === null ? t.to : t.to === null ? m.to : Math.max(m.to, t.to);
          m.years += span(t);
        }
      }

      const fromWiki = [...merged.values()].sort(
        (a, b) =>
          tier(a.title) - tier(b.title) ||
          Number(SECONDARY.test(a.title)) - Number(SECONDARY.test(b.title)) ||
          b.years - a.years ||
          Number(IMPERIAL.test(b.title)) - Number(IMPERIAL.test(a.title))
      );

      const royal = fromWiki.filter((t) => tier(t.title) < TIERS.length);
      const other = fromWiki.filter((t) => tier(t.title) === TIERS.length);
      const clean = (t: { title: string; from: number | null; to: number | null }) => ({
        title: t.title,
        from: t.from,
        to: t.to,
      });
      const titles = royal.map(clean);
      if (labelTitle !== undefined && !titles.some((t) => t.title === labelTitle)) {
        titles.push({ title: labelTitle, from: null, to: null });
      }
      titles.push(...other.map(clean));

      let personName = shortName;
      const primary = titles[0];
      const ofAt = personName.lastIndexOf(" of ");
      if (primary !== undefined && ofAt !== -1 && primary.title.endsWith(personName.slice(ofAt + 4))) {
        personName = personName.slice(0, ofAt);
      }

      people.push({
        id,
        name: { en: personName },
        titles: titles.length > 0 ? titles : undefined,
        sex,
        born,
        died: year(rp.death[0]),
        houseBirth,
        houseMarriage: null,
        wiki: wikiOf.get(id),
        bornEstimated: estimated.has(id) || undefined,
        displayTitle: royal[0]?.title ?? labelTitle,
      });
    }

    // 1b. ručne ispravke osoba
    for (const p of people) {
      const o = overrides.people?.[p.id];
      if (o === undefined) continue;
      if (o.name !== undefined) p.name.en = o.name;
      if (o.born !== undefined) {
        p.born = o.born;
        p.bornEstimated = undefined;
      }
      if (o.died !== undefined) p.died = o.died;
      if (o.displayTitle !== undefined) p.displayTitle = o.displayTitle;
      if (o.houseBirth !== undefined) {
        const houseId = canonicalByLabel.get(o.houseBirth);
        if (houseId !== undefined) p.houseBirth = houseId;
        else console.log(`  override: house not found: ${o.houseBirth}`);
      }
    }

    const ids = new Set(people.map((p) => p.id));

    // 2. roditelji
    const parentage: Parentage[] = [];
    for (const p of [...raw.fathers, ...raw.mothers]) {
      if (ids.has(p.s) && ids.has(p.o)) {
        parentage.push({ parent: p.o, child: p.s });
      }
    }

    // 2b. ručne ispravke veza
    const sameLink = (a: Parentage, b: { parent: string; child: string }) =>
      a.parent === b.parent && a.child === b.child;

    for (const r of overrides.removeParentage ?? []) {
      const i = parentage.findIndex((p) => sameLink(p, r));
      if (i !== -1) parentage.splice(i, 1);
      else console.log(`  override: link not found: ${r.parent} → ${r.child}`);
    }
    for (const a of overrides.addParentage ?? []) {
      if (ids.has(a.parent) && ids.has(a.child)) parentage.push(a);
      else console.log(`  override: unknown person in ${a.parent} → ${a.child}`);
    }

    // 3. brakovi, svaki par jednom
    const unions: Union[] = [];
    const seen = new Set<string>();
    for (const m of raw.marriages) {
      if (!ids.has(m.s) || !ids.has(m.o)) continue;
      const removed = (overrides.removeUnions ?? []).some(
        (r) => (r.a === m.s && r.b === m.o) || (r.a === m.o && r.b === m.s)
      );
      if (removed) continue;
      const key = m.s < m.o ? `${m.s}|${m.o}` : `${m.o}|${m.s}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unions.push({
        a: m.s,
        b: m.o,
        from: year(m.start ?? undefined),
        to: year(m.end ?? undefined),
        ended: /annul/i.test(m.cause) ? "annulment" : /divorc/i.test(m.cause) ? "divorce" : undefined,
      });
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

    // 6. države
    type HouseEntry = string | { house: string; start: string };

    const countryConfig: { name: string; color: string; houses: HouseEntry[] }[] = JSON.parse(
      await readFile("scripts/countries.json", "utf8")
    );
    const usedHouses = new Set(houses.map((h) => h.id));

    const countries: Country[] = countryConfig.map((c) => {
      const houseIds: string[] = [];
      const starts: Record<string, string> = {};

      for (const entry of c.houses) {
        const label = typeof entry === "string" ? entry : entry.house;
        const houseId = canonicalByLabel.get(label);
        if (houseId === undefined || !usedHouses.has(houseId)) {
          console.log(`  ${c.name}: house not found in data: ${label}`);
          continue;
        }
        houseIds.push(houseId);

        if (typeof entry !== "string") {
          if (ids.has(entry.start)) starts[houseId] = entry.start;
          else console.log(`  ${c.name}: start person not in data: ${entry.start}`);
        }
      }

      return { name: c.name, color: c.color, houses: houseIds, starts };
    });

    // zapis
    const dataset: Dataset = { houses, people, parentage, unions, countries };
    await writeFile(`public/data/${datasetName}.json`, JSON.stringify(dataset));

    console.log(
      `${people.length} people (${skipped} skipped, no birth year), ` +
      `${houses.length} houses, ${unions.length} unions`
    );
  }

  main();