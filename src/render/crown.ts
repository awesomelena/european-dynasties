import { SVG_NS } from "../constants";

const CROWN = [
  "k...k...k",
  "kk.kok.kk",
  "kokoookok",
  "koooroook",
  "koooooook",
  "kkkkkkkkk",
];

const COLORS: Record<string, string> = {
  k: "var(--sable)",
  o: "var(--or)",
  r: "var(--gules)",
};

export const CROWN_W = CROWN[0].length;
export const CROWN_H = CROWN.length;

export function drawCrown(parent: SVGElement, x: number, y: number, pixel = 2) {
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("crown");

  CROWN.forEach((row, r) => {
    [...row].forEach((c, col) => {
      if (c === ".") return;
      const cell = document.createElementNS(SVG_NS, "rect");
      cell.setAttribute("x", String(x + col * pixel));
      cell.setAttribute("y", String(y + r * pixel));
      cell.setAttribute("width", String(pixel));
      cell.setAttribute("height", String(pixel));
      cell.style.fill = COLORS[c];
      group.appendChild(cell);
    });
  });

  parent.appendChild(group);
}

export function crownMarkup(pixel = 2): string {
  let cells = "";
  CROWN.forEach((row, r) => {
    [...row].forEach((c, col) => {
      if (c === ".") return;
      cells += `<rect x="${col * pixel}" y="${r * pixel}" width="${pixel}" height="${pixel}" style="fill:${COLORS[c]}"/>`;
    });
  });
  return `<svg width="${CROWN_W * pixel}" height="${CROWN_H * pixel}" shape-rendering="crispEdges">${cells}</svg>`;
}