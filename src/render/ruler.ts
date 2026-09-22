import type { ZoomTransform } from "d3-zoom";
import { BASE_YEAR, SVG_NS, TOP_MARGIN, YEAR_PX } from "../constants";

const STEPS = [1, 5, 10, 25, 50, 100, 250];

export function createRuler(svg: SVGSVGElement, world: SVGGElement) {
  const guides = document.createElementNS(SVG_NS, "g");
  guides.classList.add("ruler");
  svg.insertBefore(guides, world);

  const labels = document.createElementNS(SVG_NS, "g");
  labels.classList.add("ruler");
  svg.appendChild(labels);

  return function update(t: ZoomTransform, origin: number) {
    guides.replaceChildren();
    labels.replaceChildren();

    const yearAt = (screenY: number) =>
      BASE_YEAR + ((screenY - t.y) / t.k - TOP_MARGIN + origin) / YEAR_PX;
    const screenYOf = (year: number) =>
      t.y + t.k * ((year - BASE_YEAR) * YEAR_PX - origin + TOP_MARGIN);

    const pxPerYear = YEAR_PX * t.k;
    const step = STEPS.find((s) => s * pxPerYear >= 60) ?? 500;

    const first = Math.ceil(yearAt(0) / step) * step;
    const last = yearAt(svg.clientHeight);

    for (let year = first; year <= last; year += step) {
      const y = screenYOf(year);

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("x2", String(svg.clientWidth));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.classList.add("ruler-guide");
      guides.appendChild(line);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", "8");
      text.setAttribute("y", String(y - 4));
      text.classList.add("ruler-label");
      text.textContent = String(year);
      labels.appendChild(text);
    }
  };
}