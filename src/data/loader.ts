import type { Dataset } from "../types";

export async function loadData(): Promise<Dataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/europe.json`);
  if (!response.ok) throw new Error(`Data request failed: HTTP ${response.status}`);
  const json = await response.json();
  return json as Dataset;
}