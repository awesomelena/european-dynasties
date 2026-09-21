import type { Dataset, HouseId, Person, Box } from "../types";
import { SVG_NS, NODE_H, NODE_PAD, FONT_NAME, FONT_TITLE } from "../constants";

function houseColor(data: Dataset, houseId: HouseId | null): string {
  if (houseId === null) return "none";
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.color : "none";
}

export function drawPerson(
  svg: SVGGElement,
  data: Dataset,
  person: Person,
  pos: Box,
  ghost = false
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  g.style.cursor = "pointer";

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(pos.x));
  rect.setAttribute("y", String(pos.y));
  rect.setAttribute("width", String(pos.w));
  rect.setAttribute("height", String(NODE_H));
  rect.style.fill = houseColor(data, person.houseBirth);
  rect.style.stroke = houseColor(data, person.houseMarriage);
  rect.style.strokeWidth = "4";
  if (ghost) {
    rect.style.stroke = "var(--sable)";
    rect.style.strokeDasharray = "6 4";
    g.style.opacity = "0.55";
  }
  g.appendChild(rect);

  const house = data.houses.find((h) => h.id === person.houseBirth);
  const textColor = house?.textColor ?? "var(--argent)";
  const title = person.titles?.[0]?.title;

  const name = document.createElementNS(SVG_NS, "text");
  name.setAttribute("x", String(pos.x + NODE_PAD));
  name.setAttribute("y", String(pos.y + (title !== undefined ? 18 : 27)));
  name.style.font = FONT_NAME;
  name.style.fill = textColor;
  name.textContent = person.name.en;
  g.appendChild(name);

  if (title !== undefined) {
    const sub = document.createElementNS(SVG_NS, "text");
    sub.setAttribute("x", String(pos.x + NODE_PAD));
    sub.setAttribute("y", String(pos.y + 35));
    sub.style.font = FONT_TITLE;
    sub.style.fill = textColor;
    sub.style.opacity = "0.85";
    sub.textContent = title;
    g.appendChild(sub);
  }

  svg.appendChild(g);
  return g;
}