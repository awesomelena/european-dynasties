import type { Dataset, PersonId, Point } from "../types";
import { SVG_NS, NODE_W, NODE_H } from "../constants";
import { unionKey } from "../data/family";

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

export function drawUnions(svg: SVGSVGElement, data: Dataset, positions: Map<PersonId, Point>) {
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

export function drawParentage(svg: SVGSVGElement, data: Dataset, positions: Map<PersonId, Point>) {
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