import dagre from "@dagrejs/dagre";

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

function unionKey(a: PersonId, b: PersonId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function computeLayout(data: Dataset): Map<PersonId, Point> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const person of data.people) {
    g.setNode(person.id, { width: NODE_W, height: NODE_H });
  }

  const unionNodeByPair = new Map<string, string>();
  for (const union of data.unions) {
    const uid = "u:" + unionKey(union.a, union.b);
    unionNodeByPair.set(unionKey(union.a, union.b), uid);
    g.setNode(uid, { width: 1, height: 1 });
    g.setEdge(union.a, uid);
    g.setEdge(union.b, uid);
  }

  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) parentsByChild.set(p.child, []);
    parentsByChild.get(p.child)!.push(p.parent);
  }

  for (const [childId, parentIds] of parentsByChild) {
    const uid =
      parentIds.length === 2
        ? unionNodeByPair.get(unionKey(parentIds[0], parentIds[1]))
        : undefined;

    if (uid !== undefined) {
      g.setEdge(uid, childId);
    } else {
      for (const parentId of parentIds) g.setEdge(parentId, childId);
    }
  }

  dagre.layout(g);

  const positions = new Map<PersonId, Point>();
  for (const person of data.people) {
    const n = g.node(person.id);
    positions.set(person.id, {
      x: n.x - NODE_W / 2,
      y: yearToY(person.born),
    });
  }
  return positions;
}

function drawLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const line = document.createElementNS(SVG_NS, "line");

  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));

  line.style.stroke = "var(--sable)";
  line.style.strokeWidth = "3";

  svg.appendChild(line);
}

function drawUnions(
  svg: SVGSVGElement,
  data: Dataset,
  positions: Map<PersonId, Point>
) {
  for (const union of data.unions) {
    const a = positions.get(union.a);
    const b = positions.get(union.b);

    if (a === undefined || b === undefined) continue;

    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    drawLine(
      svg,
      left.x + NODE_W,
      left.y + NODE_H / 2,
      right.x,
      right.y + NODE_H / 2
    );
  }
}

function drawParentage(svg: SVGSVGElement, data: Dataset, positions: Map<PersonId, Point>) {
  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) parentsByChild.set(p.child, []);
    parentsByChild.get(p.child)!.push(p.parent);
  }

  const childrenByUnion = new Map<string, PersonId[]>();
  for (const [childId, parentIds] of parentsByChild) {
    if (parentIds.length !== 2) continue;
    const key = unionKey(parentIds[0], parentIds[1]);
    if (!childrenByUnion.has(key)) childrenByUnion.set(key, []);
    childrenByUnion.get(key)!.push(childId);
  }

  for (const union of data.unions) {
    const childIds = childrenByUnion.get(unionKey(union.a, union.b));
    if (childIds === undefined) continue;

    const a = positions.get(union.a);
    const b = positions.get(union.b);
    if (a === undefined || b === undefined) continue;

    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;
    const midX = (left.x + NODE_W + right.x) / 2;
    const midY = (left.y + right.y) / 2 + NODE_H / 2;

    const children: Point[] = [];
    for (const id of childIds) {
      const pos = positions.get(id);
      if (pos !== undefined) children.push(pos);
    }
    if (children.length === 0) continue;

    const centers = children.map((c) => c.x + NODE_W / 2);
    const barY = Math.min(...children.map((c) => c.y)) - 20;
    const barLeft = Math.min(midX, ...centers);
    const barRight = Math.max(midX, ...centers);

    drawLine(svg, midX, midY, midX, barY);
    drawLine(svg, barLeft, barY, barRight, barY);
    for (let i = 0; i < children.length; i++) {
      drawLine(svg, centers[i], barY, centers[i], children[i].y);
    }
  }
}

function drawPerson(
  svg: SVGSVGElement,
  data: Dataset,
  person: Person,
  pos: Point
) {
  const rect = document.createElementNS(SVG_NS, "rect");

  rect.setAttribute("x", String(pos.x));
  rect.setAttribute("y", String(pos.y));
  rect.setAttribute("width", String(NODE_W));
  rect.setAttribute("height", String(NODE_H));

  rect.style.fill = houseColor(data, person.houseBirth);
  rect.style.stroke = houseColor(data, person.houseMarriage);
  rect.style.strokeWidth = "4";

  svg.appendChild(rect);


  const text = document.createElementNS(SVG_NS, "text");

  text.setAttribute("x", String(pos.x + 8));
  text.setAttribute("y", String(pos.y + 25));

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


  // 1. Layout
  const positions = computeLayout(data);


  // 2. Sve linije
  drawUnions(svg, data, positions);
  drawParentage(svg, data, positions);


  // 3. Osobe preko linija
  for (const person of data.people) {
    const pos = positions.get(person.id)!;

    drawPerson(svg, data, person, pos);
  }
}

main();