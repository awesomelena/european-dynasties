import "./styles/tokens.css";
import type { Dataset, Person, HouseId } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

function houseColor(data: Dataset, houseId: HouseId | null): string {
  if (houseId === null) return "none";
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.color : "none";
}

function yearToY(year: number): number {
  return (year - 1800) * 8;
}

function drawPerson(svg: SVGSVGElement, data: Dataset, person: Person, x: number) {
  const y = yearToY(person.born);

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", "180");
  rect.setAttribute("height", "40");
  rect.style.fill = houseColor(data, person.houseBirth);
  rect.style.stroke = houseColor(data, person.houseMarriage);
  rect.style.strokeWidth = "4";
  svg.appendChild(rect);

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(x + 8));
  text.setAttribute("y", String(y + 25));
  text.style.fill = "var(--argent)";
  text.textContent = person.name.en;
  svg.appendChild(text);
}

async function loadData(): Promise<Dataset> {
  const response = await fetch("/data/test.json");
  const json = await response.json();
  return json as Dataset;
}

async function main() {
  const data = await loadData();

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "1000");
  svg.setAttribute("height", "900");
  document.querySelector("#app")!.appendChild(svg);

  for (let i = 0; i < data.people.length; i++) {
    drawPerson(svg, data, data.people[i], i * 200);
  }
}

main();