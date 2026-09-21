import { mkdir, writeFile } from "node:fs/promises";

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "european-dynasties/0.1 (https://github.com/awesomelena/european-dynasties)";
const ROOT = "Q9439"; // Queen Victoria

type Row = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Row[]> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }),
    });

    if (response.ok) {
      const json = await response.json();
      return json.results.bindings;
    }

    if (response.status >= 500 || response.status === 429) {
      const wait = attempt * 5000;
      console.log(`  WikiData ${response.status}, retrying in ${wait / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }

    throw new Error(`WikiData ${response.status}: ${await response.text()}`);
  }
  throw new Error("WikiData: too many failed attempts");
}

function qid(uri: string): string {
  return uri.substring(uri.lastIndexOf("/") + 1);
}

function values(ids: string[]): string {
  return ids.map((id) => `wd:${id}`).join(" ");
}

async function descendants(root: string): Promise<string[]> {
  const rows = await sparql(`
    SELECT DISTINCT ?p WHERE {
      { BIND(wd:${root} AS ?p) }
      UNION { wd:${root} wdt:P40 ?p }
      UNION { wd:${root} wdt:P40/wdt:P40 ?p }
      UNION { wd:${root} wdt:P40/wdt:P40/wdt:P40 ?p }
    }`);
  return rows.map((r) => qid(r.p!.value));
}

type Pair = { s: string; o: string; oLabel: string };

function chunks<T>(list: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

async function pairs(ids: string[], prop: string): Promise<Pair[]> {
  if (ids.length === 0) return [];
  const rows = await sparql(`
    SELECT ?s ?o ?oLabel WHERE {
      VALUES ?s { ${values(ids)} }
      ?s wdt:${prop} ?o .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`);
  return rows.map((r) => ({
    s: qid(r.s!.value),
    o: qid(r.o!.value),
    oLabel: r.oLabel?.value ?? "",
  }));
}

type RawPerson = { label: string; birth: string[]; death: string[]; sex: string[] };

async function basics(ids: string[]): Promise<Record<string, RawPerson>> {
  const rows = await sparql(`
    SELECT ?p ?pLabel ?birth ?death ?sex WHERE {
      VALUES ?p { ${values(ids)} }
      OPTIONAL { ?p wdt:P569 ?birth . }
      OPTIONAL { ?p wdt:P570 ?death . }
      OPTIONAL { ?p wdt:P21 ?sex . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`);

  const people: Record<string, RawPerson> = {};
  for (const r of rows) {
    const id = qid(r.p!.value);
    if (people[id] === undefined) {
      people[id] = { label: r.pLabel?.value ?? id, birth: [], death: [], sex: [] };
    }
    const person = people[id];
    const add = (list: string[], v: string | undefined) => {
      if (v !== undefined && !list.includes(v)) list.push(v);
    };
    add(person.birth, r.birth?.value);
    add(person.death, r.death?.value);
    add(person.sex, r.sex ? qid(r.sex.value) : undefined);
  }
  return people;
}

type RawPosition = { s: string; label: string; start: string | null; end: string | null };

async function positions(ids: string[]): Promise<RawPosition[]> {
  const result: RawPosition[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?posLabel ?start ?end WHERE {
        VALUES ?s { ${values(part)} }
        ?s p:P39 ?st .
        ?st ps:P39 ?pos .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`);
    for (const r of rows) {
      result.push({
        s: qid(r.s!.value),
        label: r.posLabel?.value ?? "",
        start: r.start?.value ?? null,
        end: r.end?.value ?? null,
      });
    }
  }
  return result;
}

async function main() {
  console.log("Descendants...");
  const core = await descendants(ROOT);

  console.log("Spouses...");
  const spousePairs = await pairs(core, "P26");
  const spouses = [...new Set(spousePairs.map((x) => x.o))].filter(
    (id) => !core.includes(id)
  );

  console.log("Parents of spouses...");
  const inLawFathers = await pairs(spouses, "P22");
  const inLawMothers = await pairs(spouses, "P25");

  const all = [
    ...new Set([
      ...core,
      ...spouses,
      ...inLawFathers.map((x) => x.o),
      ...inLawMothers.map((x) => x.o),
    ]),
  ];

  console.log(`Details for ${all.length} people...`);
  const people = await basics(all);
  const fathers = await pairs(all, "P22");
  const mothers = await pairs(all, "P25");
  const marriages = await pairs(all, "P26");
  const houses = await pairs(all, "P53");
  const titles = await positions(all);

  await mkdir("scripts/raw", { recursive: true });
  await writeFile(
    "scripts/raw/victoria.json",
    JSON.stringify({ root: ROOT, people, fathers, mothers, marriages, houses, titles }, null, 2)
  );
  console.log(`Saved ${Object.keys(people).length} people.`);
}

main();