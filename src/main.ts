import "./styles/tokens.css";
import type { Dataset } from "./types";

async function loadData(): Promise<Dataset> {
  const response = await fetch("/data/test.json");
  const json = await response.json();
  return json as Dataset;
}

async function main() {
  const data = await loadData();
  console.log(data.people.length);
}

main();