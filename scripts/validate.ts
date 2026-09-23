import { readFile, writeFile } from "node:fs/promises";
import type { Dataset, Person } from "../src/types";

type Problem = { kind: string; text: string };

async function main() {
  const data: Dataset = JSON.parse(await readFile("public/data/europe.json", "utf8"));
  const byId = new Map(data.people.map((p) => [p.id, p] as const));

  const describe = (p: Person) =>
    `${p.name.en} (${p.id}, ${p.bornEstimated ? "c. " : ""}${p.born}–${p.died ?? ""})`;

  const problems: Problem[] = [];
  const report = (kind: string, text: string) => problems.push({ kind, text });

  // 1. osobe same za sebe
  for (const p of data.people) {
    if (p.died !== null && p.died < p.born) report("died before born", describe(p));
    if (p.died !== null && p.died - p.born > 110) report("lived over 110 years", describe(p));
  }

  // 2. roditelji i deca
  const parentsOf = new Map<string, string[]>();
  for (const link of data.parentage) {
    const parent = byId.get(link.parent)!;
    const child = byId.get(link.child)!;

    if (!parentsOf.has(child.id)) parentsOf.set(child.id, []);
    parentsOf.get(child.id)!.push(parent.id);

    const age = child.born - parent.born;
    const pair = `${describe(parent)} → ${describe(child)}`;
    if (age < 12) report("parent too young", `${pair}, age ${age}`);
    if (age > 70) report("parent too old", `${pair}, age ${age}`);

    if (parent.died !== null) {
      const limit = parent.sex === "f" ? parent.died : parent.died + 1;
      if (child.born > limit) report("born after parent's death", pair);
    }
  }
  for (const [childId, parents] of parentsOf) {
    if (parents.length > 2) {
      const names = parents.map((id) => describe(byId.get(id)!)).join(", ");
      report("more than two parents", `${describe(byId.get(childId)!)}: ${names}`);
    }
  }

  // 3. brakovi
  for (const u of data.unions) {
    if (u.a === u.b) report("married to self", describe(byId.get(u.a)!));
    const a = byId.get(u.a)!;
    const b = byId.get(u.b)!;
    if (Math.abs(a.born - b.born) > 50) {
      report("spouses 50+ years apart", `${describe(a)} ═ ${describe(b)}`);
    }
  }

  // ispis
  const kinds = [...new Set(problems.map((p) => p.kind))];
  for (const kind of kinds) {
    const list = problems.filter((p) => p.kind === kind);
    console.log(`\n${kind}: ${list.length}`);
    for (const p of list.slice(0, 10)) console.log(`  ${p.text}`);
    if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);
  }

  await writeFile(
    "scripts/validation-report.txt",
    problems.map((p) => `${p.kind}\t${p.text}`).join("\n")
  );
  console.log(`\n${problems.length} problems, full list in scripts/validation-report.txt`);
}

main();