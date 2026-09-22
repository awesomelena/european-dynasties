import type { Box, Point, PersonId } from "../types";
import type { Layout, LayoutSpouse, PlacedBox } from "../layout/positions";
import { SVG_NS, NODE_H } from "../constants";

function tag(el: SVGElement, people: PersonId[]) {
  el.classList.add("line");
  el.dataset.people = people.join(" ");
}

type LineKind = "union" | "parent";

function drawLine(
  svg: SVGGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: LineKind,
  people: PersonId[]
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
  tag(line, people);
  svg.appendChild(line);
}

function drawUnionPath(svg: SVGGElement, points: Point[], dashed = false, people: PersonId[]) {
  const pts = points.map((p) => `${p.x},${p.y}`).join(" ");

  const outer = document.createElementNS(SVG_NS, "polyline");
  outer.setAttribute("points", pts);
  outer.style.fill = "none";
  outer.style.stroke = "var(--sable)";
  outer.style.strokeWidth = "6";
  outer.style.strokeLinejoin = "miter";
  svg.appendChild(outer);

  tag(outer, people);

  if (dashed) outer.style.strokeDasharray = "10 6";

  const inner = outer.cloneNode() as SVGPolylineElement;
  inner.style.stroke = "var(--argent)";
  inner.style.strokeWidth = "2";
  svg.appendChild(inner);
}

function unionAnchor(p: Box, s: LayoutSpouse) {
  if (s.adjacent) {
    const left = s.x < p.x ? s : p;
    const right = s.x < p.x ? p : s;
    return { x: (left.x + left.w + right.x) / 2, y: p.y + NODE_H / 2 + 3 };
  }
  return { x: s.x + 12, y: p.y };
}

function arcTop(p: Box, s: LayoutSpouse) {
  return p.y - 10 - 8 * s.arc;
}

export function drawUnions(g: SVGGElement, layout: Layout) {
  for (const b of layout.blocks) {
    const p = b.person;
    const midY = p.y + NODE_H / 2;
    for (const s of b.spouses) {
      if (s.adjacent) {
        const left = s.x < p.x ? s : p;
        const right = s.x < p.x ? p : s;
        drawUnionPath(g, [{ x: left.x + left.w, y: midY }, { x: right.x, y: midY }], s.ended !== undefined, [p.id, s.id]);
      } else {
        const top = arcTop(p, s);
        const x1 = p.x + p.w - 8 - 8 * s.arc;
        const x2 = s.x + 12;
        drawUnionPath(g, [
          { x: x1, y: p.y },
          { x: x1, y: top },
          { x: x2, y: top },
          { x: x2, y: p.y },
          ], 
          s.ended !== undefined,
          [p.id, s.id]
        );
      }
    }
  }
}

function drawComb(
  g: SVGGElement,
  fromX: number,
  fromY: number,
  kids: PlacedBox[],
  barY: number,
  parents: PersonId[]
) {
  if (kids.length === 0) return;
  const centers = kids.map((c) => c.x + c.w / 2);
  const everyone = [...parents, ...kids.map((k) => k.id)];
  drawLine(g, fromX, fromY, fromX, barY, "parent", everyone);

  kids.forEach((k, i) => {
    const mine = [...parents, k.id];
    drawLine(g, fromX, barY, centers[i], barY, "parent", mine);
    drawLine(g, centers[i], barY, centers[i], k.y, "parent", mine);
  });
}

export function drawParentage(g: SVGGElement, layout: Layout) {
  for (const b of layout.blocks) {
    if (b.children.length === 0) continue;
    const p = b.person;
    const top = Math.min(...b.children.map((c) => c.y));

    b.spouses.forEach((s, i) => {
      const kids = b.children.filter((c) => c.spouse === i);
      const from = unionAnchor(p, s);
      drawComb(g, from.x, from.y, kids, top - 20 - 8 * i, [p.id, s.id]);
    });

    const alone = b.children.filter((c) => c.spouse === -1);
    drawComb(g, p.x + p.w / 2, p.y + NODE_H, alone, top - 20 - 8 * b.spouses.length, [p.id]);
  }
}