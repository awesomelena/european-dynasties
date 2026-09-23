import type { Person } from "../types";

const SOVEREIGN =
  /\b(king|queen|emperor|empress|tsar|tsarina|grand prince|grand duke|grand duchess|despot)\b/i;

export function isSovereign(p: Person): boolean {
  const t = p.displayTitle;
  return t !== undefined && SOVEREIGN.test(t) && !/consort/i.test(t);
}