import type { Dataset } from "../types";

export async function loadData(): Promise<Dataset> {
  const response = await fetch("/data/test.json");
  const json = await response.json();
  return json as Dataset;
}