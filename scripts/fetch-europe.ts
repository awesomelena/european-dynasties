import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  articles, basics, childrenViaParents, chunks, pairs, positions, qid, sparql, values, marriages
} from "./wikidata";

const HOPS = 1;

type Seeds = {
  minBirthYear: number;
  houses: Record<string, string>;
  positions: Record<string, string>;
};

async function members(prop: "P53" | "P39", targets: string[], minYear: number) {
  const result: string[] = [];
  for (const part of chunks(targets, 10)) {
    const rows = await sparql(`
      SELECT DISTINCT ?p WHERE {
        VALUES ?t { ${values(part)} }
        ?p wdt:${prop} ?t .
        OPTIONAL { ?p wdt:P569 ?b . }
        OPTIONAL { ?p wdt:P570 ?d . }
        FILTER(IF(BOUND(?b), YEAR(?b) >= ${minYear}, !BOUND(?d) || YEAR(?d) >= ${minYear + 30}))
      }`);
    for (const r of rows) result.push(qid(r.p!.value));
  }
  return result;
}

async function neighbors(ids: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const prop of ["P22", "P25", "P40", "P26"]) {
    for (const p of await pairs(ids, prop)) found.add(p.o);
  }
  for (const p of await childrenViaParents(ids)) found.add(p.o);
  return [...found];
}

async function main() {
  const seeds: Seeds = JSON.parse(await readFile("scripts/seeds.json", "utf8"));
  const minYear = seeds.minBirthYear;

  console.log("Seeds from houses...");
  const fromHouses = await members("P53", Object.keys(seeds.houses), minYear);
  console.log("Seeds from positions...");
  const fromPositions = await members("P39", Object.keys(seeds.positions), minYear);

  const all = new Set([...fromHouses, ...fromPositions]);
  console.log(`Seeds: ${all.size} people`);

  let frontier = [...all];
  for (let hop = 1; hop <= HOPS; hop++) {
    console.log(`Hop ${hop}...`);
    const found = (await neighbors(frontier)).filter((id) => !all.has(id));
    for (const id of found) all.add(id);
    console.log(`Hop ${hop}: +${found.length} → ${all.size} people`);
    frontier = found;
  }

  const ids = [...all];
  console.log(`Details for ${ids.length} people (this will take a while)...`);
  const people = await basics(ids);
  console.log("  fathers, mothers...");
  const fathers = await pairs(ids, "P22");
  const mothers = await pairs(ids, "P25");
  console.log("  marriages, houses...");
  const marriageList = await marriages(ids);
  const houses = await pairs(ids, "P53");
  console.log("  titles, Wikipedia...");
  const titles = await positions(ids);
  const wiki = await articles(ids);

  await mkdir("scripts/raw", { recursive: true });
  await writeFile(
    "scripts/raw/europe.json",
    JSON.stringify({ root: "Q9439", people, fathers, mothers, marriages: marriageList, houses, titles, wiki })
  );
  console.log(`Saved ${Object.keys(people).length} people.`);
}

main();