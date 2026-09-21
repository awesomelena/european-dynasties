import "./styles/tokens.css";
import type { Dataset, Person, HouseId, PersonId } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 180;
const NODE_H = 40;
const COUPLE_GAP = 50;
const SIBLING_GAP = 30;

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

function buildFamily(data: Dataset) {
  const born = new Map<PersonId, number>();
  for (const person of data.people) born.set(person.id, person.born);

  const childrenOf = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!childrenOf.has(p.parent)) childrenOf.set(p.parent, []);
    childrenOf.get(p.parent)!.push(p.child);
  }
  for (const kids of childrenOf.values()) {
    kids.sort((a, b) => born.get(a)! - born.get(b)!);
  }

  const spouseOf = new Map<PersonId, PersonId>();
  for (const u of data.unions) {
    if (!spouseOf.has(u.a)) spouseOf.set(u.a, u.b);
    if (!spouseOf.has(u.b)) spouseOf.set(u.b, u.a);
  }

  return { childrenOf, spouseOf };
}

function subtreeWidth(
  personId: PersonId,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>
): number {
  let blockWidth = NODE_W;
  if (spouseOf.has(personId)) {
    blockWidth = NODE_W + COUPLE_GAP + NODE_W;
  }

  const children = childrenOf.get(personId) ?? [];
  if (children.length === 0) return blockWidth;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, childrenOf, spouseOf);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  return Math.max(blockWidth, childrenWidth);
}

function place(
  personId: PersonId,
  left: number,
  childrenOf: Map<PersonId, PersonId[]>,
  spouseOf: Map<PersonId, PersonId>,
  xByPerson: Map<PersonId, number>
) {
  const W = subtreeWidth(personId, childrenOf, spouseOf);
  const spouseId = spouseOf.get(personId);
  const blockWidth =
    spouseId !== undefined ? NODE_W + COUPLE_GAP + NODE_W : NODE_W;

  const blockLeft = left + (W - blockWidth) / 2;
  xByPerson.set(personId, blockLeft);
  if (spouseId !== undefined) {
    xByPerson.set(spouseId, blockLeft + NODE_W + COUPLE_GAP);
  }

  const children = childrenOf.get(personId) ?? [];
  if (children.length === 0) return;

  let childrenWidth = 0;
  for (const child of children) {
    childrenWidth += subtreeWidth(child, childrenOf, spouseOf);
  }
  childrenWidth += (children.length - 1) * SIBLING_GAP;

  let currentLeft = left + (W - childrenWidth) / 2;
  for (const child of children) {
    place(child, currentLeft, childrenOf, spouseOf, xByPerson);
    currentLeft += subtreeWidth(child, childrenOf, spouseOf) + SIBLING_GAP;
  }
}

function computeLayout(data: Dataset): Map<PersonId, Point> {
  const { childrenOf, spouseOf } = buildFamily(data);

  const xByPerson = new Map<PersonId, number>();
  place("victoria", 0, childrenOf, spouseOf, xByPerson);

  const parentsByChild = new Map<PersonId, PersonId[]>();
  for (const p of data.parentage) {
    if (!parentsByChild.has(p.child)) parentsByChild.set(p.child, []);
    parentsByChild.get(p.child)!.push(p.parent);
  }

  const yByPerson = new Map<PersonId, number>();
  for (const person of data.people) {
    yByPerson.set(person.id, yearToY(person.born));
  }
  for (const union of data.unions) {
    const aHasParents = parentsByChild.has(union.a);
    const bHasParents = parentsByChild.has(union.b);
    if (!aHasParents && bHasParents) {
      yByPerson.set(union.a, yByPerson.get(union.b)!);
    }
    if (aHasParents && !bHasParents) {
      yByPerson.set(union.b, yByPerson.get(union.a)!);
    }
  }

  const positions = new Map<PersonId, Point>();
  for (const person of data.people) {
    const x = xByPerson.get(person.id);
    if (x === undefined) continue;
    positions.set(person.id, { x, y: yByPerson.get(person.id)! });
  }
  return positions;
}

type LineKind = "union" | "parent";

function drawLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: LineKind
) {
  const line = document.createElementNS(SVG_NS, "line");

  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));

  line.style.stroke = "var(--sable)";
  line.style.strokeLinecap = "square";

  if (kind === "union") {
    line.style.strokeWidth = "6";
    svg.appendChild(line);

    const inner = line.cloneNode() as SVGLineElement;
    inner.style.stroke = "white";
    inner.style.strokeWidth = "2";
    svg.appendChild(inner);
    return;
  }

  line.style.strokeWidth = "2";
  svg.appendChild(line);
}

function drawUnionPath(svg: SVGSVGElement, points: Point[]) {
  const pts = points.map((p) => `${p.x},${p.y}`).join(" ");

  const outer = document.createElementNS(SVG_NS, "polyline");
  outer.setAttribute("points", pts);
  outer.style.fill = "none";
  outer.style.stroke = "var(--sable)";
  outer.style.strokeWidth = "6";
  outer.style.strokeLinejoin = "miter";
  svg.appendChild(outer);

  const inner = outer.cloneNode() as SVGPolylineElement;
  inner.style.stroke = "white";
  inner.style.strokeWidth = "2";
  svg.appendChild(inner);
}

function drawUnions(svg: SVGSVGElement, data: Dataset, positions: Map<PersonId, Point>) {
  for (const union of data.unions) {
    const a = positions.get(union.a);
    const b = positions.get(union.b);
    if (a === undefined || b === undefined) continue;

    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    const startX = left.x + NODE_W;
    const startY = left.y + NODE_H / 2;
    const endX = right.x;
    const endY = right.y + NODE_H / 2;
    const midX = (startX + endX) / 2;

    drawUnionPath(svg, [
    { x: startX, y: startY },
    { x: midX, y: startY },
    { x: midX, y: endY },
    { x: endX, y: endY },
    ]);
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
    const midY = Math.max(left.y, right.y) + NODE_H / 2 + 3;

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

    drawLine(svg, midX, midY, midX, barY, "parent");
    drawLine(svg, barLeft, barY, barRight, barY, "parent");
    for (let i = 0; i < children.length; i++) {
      drawLine(svg, centers[i], barY, centers[i], children[i].y, "parent");
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

  svg.setAttribute("width", "3000");
  svg.setAttribute("height", "900");

  document.querySelector("#app")!.appendChild(svg);

  const positions = computeLayout(data);

  drawUnions(svg, data, positions);
  drawParentage(svg, data, positions);

  for (const person of data.people) {
    const pos = positions.get(person.id);
    if (pos === undefined) continue;

    drawPerson(svg, data, person, pos);
  }
}

main();