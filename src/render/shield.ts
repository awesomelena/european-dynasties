import { SVG_NS } from "../constants";

const MASK = [
  "####....####",
  "############",
  "############",
  "############",
  "############",
  "############",
  "############",
  ".##########.",
  "...######...",
  "....####...."
];

export function shield(color: string, pixel = 2): SVGSVGElement {
  const height = MASK.length;
  const width = MASK[0].length;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("shield");
  svg.setAttribute("width", String(width * pixel));
  svg.setAttribute("height", String(height * pixel));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");

  const inside = (x: number, y: number) =>
    y >= 0 && y < height && x >= 0 && x < width && MASK[y][x] === "#";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const edge =
        !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);

      const cell = document.createElementNS(SVG_NS, "rect");
      cell.setAttribute("x", String(x));
      cell.setAttribute("y", String(y));
      cell.setAttribute("width", "1");
      cell.setAttribute("height", "1");
      cell.style.fill = edge ? "var(--sable)" : color;
      svg.appendChild(cell);
    }
  }

  return svg;
}