import type { Dataset } from "../types";

export async function loadData(): Promise<Dataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/victoria.json`);
  const json = await response.json();
  return json as Dataset;
}