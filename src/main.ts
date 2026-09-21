import "./styles/tokens.css";
import type { Dataset, Person, HouseId, PersonId } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 180;
const NODE_H = 40;

type Point = { x: number; y: number };

function houseColor(data: Dataset, houseId: HouseId | null): string {
  if (houseId === null) return "none";
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.color : "none";
}

function yearToY(year: number): number {
  return (year - 1800) * 8;
}

function drawPerson(svg: SVGSVGElement, data: Dataset, person: Person, x: number): Point {
  const y = yearToY(person.born);

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(NODE_W));
  rect.setAttribute("height", String(NODE_H));
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

  return {x, y};
}

function drawLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number) {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.style.stroke = "var(--sable)";
  line.style.strokeWidth = "3";
  svg.appendChild(line);
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

  const positions = new Map<PersonId, Point>();

  for (let i = 0; i < data.people.length; i++) {
    const person = data.people[i];
    const pos = drawPerson(svg, data, person, i * 200);
    positions.set(person.id, pos);
  }

  for (const union of data.unions) {
    const a = positions.get(union.a);
    const b = positions.get(union.b);
    if (a === undefined || b === undefined) continue;

    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    drawLine(svg, left.x + NODE_W, left.y + NODE_H / 2, right.x, right.y + NODE_H / 2);
  }

  const parentsByChild = new Map<PersonId, PersonId[]>();

  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) {
      parentsByChild.set(p.child, []);
    }
    parentsByChild.get(p.child)!.push(p.parent);
  }

  for (const [childId, parentIds] of parentsByChild) {
    if (parentIds.length !== 2) continue;

    const p1 = positions.get(parentIds[0]);
    const p2 = positions.get(parentIds[1]);
    const c = positions.get(childId);
    if (p1 === undefined || p2 === undefined || c === undefined) continue;

    const left = p1.x < p2.x ? p1 : p2;
    const right = p1.x < p2.x ? p2 : p1;

    const midX = (left.x + NODE_W + right.x) / 2;
    const midY = (left.y + right.y) / 2 + NODE_H / 2;

    drawLine(svg, midX, midY, c.x + NODE_W / 2, c.y);
  }
}

main();