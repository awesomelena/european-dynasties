import type { Box, Point } from "../types";
import type { Layout } from "../layout/positions";
import { SVG_NS, NODE_H } from "../constants";

type LineKind = "union" | "parent";

function drawLine(
  svg: SVGGElement,
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

function drawUnionPath(svg: SVGGElement, points: Point[]) {
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

export function drawUnions(g: SVGGElement, layout: Layout) {
  for (const b of layout.blocks) {
    if (b.spouse === null) continue;
    const y = b.person.y + NODE_H / 2;
    drawUnionPath(g, [
      { x: b.person.x + b.person.w, y },
      { x: b.spouse.x, y },
    ]);
  }
}

function drawComb(g: SVGGElement, fromX: number, fromY: number, kids: Box[], gap: number) {
  if (kids.length === 0) return;
  const centers = kids.map((c) => c.x + c.w / 2);
  const barY = Math.min(...kids.map((c) => c.y)) - gap;
  const barLeft = Math.min(fromX, ...centers);
  const barRight = Math.max(fromX, ...centers);

  drawLine(g, fromX, fromY, fromX, barY, "parent");
  drawLine(g, barLeft, barY, barRight, barY, "parent");
  for (let i = 0; i < kids.length; i++) {
    drawLine(g, centers[i], barY, centers[i], kids[i].y, "parent");
  }
}

export function drawParentage(g: SVGGElement, layout: Layout) {
  for (const b of layout.blocks) {
    const ofCouple = b.children.filter((c) => c.ofCouple);
    const alone = b.children.filter((c) => !c.ofCouple);

    if (b.spouse !== null) {
      const midX = (b.person.x + b.person.w + b.spouse.x) / 2;
      drawComb(g, midX, b.person.y + NODE_H / 2 + 3, ofCouple, 20);
    }
    drawComb(g, b.person.x + b.person.w / 2, b.person.y + NODE_H, alone, 32);
  }
}