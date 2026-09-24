import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "european-dynasties/0.2 (https://github.com/awesomelena/european-dynasties)";
const CACHE_DIR = "scripts/cache";

export type Row = Record<string, { value: string } | undefined>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FatalError extends Error { }

export async function sparql(query: string): Promise<Row[]> {
  const key = createHash("sha1").update(query).digest("hex");
  const file = `${CACHE_DIR}/${key}.json`;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {

  }

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
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
        const rows: Row[] = (await response.json()).results.bindings;
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify(rows));
        await sleep(2000);
        return rows;
      }

      if (response.status >= 500 || response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = retryAfter > 0 ? retryAfter * 1000 : attempt * 10000;
        console.log(`  WikiData ${response.status}, retrying in ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      throw new FatalError(`WikiData ${response.status}: ${await response.text()}`);
    } catch (err) {
      if (err instanceof FatalError) throw err;
      const wait = attempt * 10000;
      console.log(`  Network error (${(err as Error).message}), retrying in ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
  throw new Error("WikiData: too many failed attempts");
}

export function chunks<T>(list: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

export function qid(uri: string): string {
  return uri.substring(uri.lastIndexOf("/") + 1);
}

export function values(ids: string[]): string {
  return ids.map((id) => `wd:${id}`).join(" ");
}

export type Pair = { s: string; o: string; oLabel: string };

export async function pairs(ids: string[], prop: string): Promise<Pair[]> {
  const result: Pair[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?o ?oLabel WHERE {
        VALUES ?s { ${values(part)} }
        ?s wdt:${prop} ?o .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,sv,da,nb,it,es,pl,ru,hu,cs,sr,hr,bg,el". }
      }`);
    for (const r of rows) {
      result.push({ s: qid(r.s!.value), o: qid(r.o!.value), oLabel: r.oLabel?.value ?? "" });
    }
  }
  return result;
}

export async function parentLinks(ids: string[], prop: "P22" | "P25"): Promise<Pair[]> {
  const result: Pair[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?o WHERE {
        VALUES ?s { ${values(part)} }
                ?s p:${prop} ?st .
        ?st ps:${prop} ?o ;
            a wikibase:BestRank .
        FILTER NOT EXISTS { ?st pq:P1039 ?kinship . }
      }`);
    for (const r of rows) {
      result.push({ s: qid(r.s!.value), o: qid(r.o!.value), oLabel: "" });
    }
  }
  return result;
}

export type RawMarriage = {
  s: string;
  o: string;
  start: string | null;
  end: string | null;
  cause: string;
};

export async function marriages(ids: string[]): Promise<RawMarriage[]> {
  const result: RawMarriage[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?o ?start ?end ?causeLabel WHERE {
        VALUES ?s { ${values(part)} }
        ?s p:P26 ?st .
        ?st ps:P26 ?o .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        OPTIONAL { ?st pq:P1534 ?cause . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,sv,da,nb,it,es,pl,ru,hu,cs,sr,hr,bg,el". }
      }`);
    for (const r of rows) {
      result.push({
        s: qid(r.s!.value),
        o: qid(r.o!.value),
        start: r.start?.value ?? null,
        end: r.end?.value ?? null,
        cause: r.causeLabel?.value ?? "",
      });
    }
  }
  return result;
}

export async function childrenViaParents(ids: string[]): Promise<Pair[]> {
  const result: Pair[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?o WHERE {
        VALUES ?s { ${values(part)} }
        ?o wdt:P22|wdt:P25 ?s .
      }`);
    for (const r of rows) {
      result.push({ s: qid(r.s!.value), o: qid(r.o!.value), oLabel: "" });
    }
  }
  return result;
}

export type RawPerson = { label: string; birth: string[]; death: string[]; sex: string[] };

export async function basics(ids: string[]): Promise<Record<string, RawPerson>> {
  const people: Record<string, RawPerson> = {};
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?p ?pLabel ?birth ?death ?sex WHERE {
        VALUES ?p { ${values(part)} }
        OPTIONAL {
          ?p p:P569 ?bs .
          ?bs psv:P569 ?bv ;
              wikibase:rank ?br .
          ?bv wikibase:timeValue ?birth ;
              wikibase:timePrecision ?bp .
          FILTER(?bp >= 9 && ?br != wikibase:DeprecatedRank)
        }
        OPTIONAL {
          ?p p:P570 ?ds .
          ?ds psv:P570 ?dv ;
              wikibase:rank ?dr .
          ?dv wikibase:timeValue ?death ;
              wikibase:timePrecision ?dp .
          FILTER(?dp >= 9 && ?dr != wikibase:DeprecatedRank)
        }
        OPTIONAL { ?p wdt:P21 ?sex . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,sv,da,nb,it,es,pl,ru,hu,cs,sr,hr,bg,el". }
      }`);
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
  }
  return people;
}

export type RawPosition = { s: string; label: string; start: string | null; end: string | null };

export async function positions(ids: string[]): Promise<RawPosition[]> {
  const result: RawPosition[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?posLabel ?start ?end WHERE {
        VALUES ?s { ${values(part)} }
        ?s p:P39 ?st .
        ?st ps:P39 ?pos .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,sv,da,nb,it,es,pl,ru,hu,cs,sr,hr,bg,el". }
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

export type RawArticle = { s: string; title: string };

export async function articles(ids: string[]): Promise<RawArticle[]> {
  const result: RawArticle[] = [];
  for (const part of chunks(ids, 100)) {
    const rows = await sparql(`
      SELECT ?s ?article WHERE {
        VALUES ?s { ${values(part)} }
        ?article schema:about ?s ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }`);
    for (const r of rows) {
      const url = r.article!.value;
      const title = url.substring(url.indexOf("/wiki/") + 6);
      result.push({ s: qid(r.s!.value), title: decodeURIComponent(title) });
    }
  }
  return result;
}