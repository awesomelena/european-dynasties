import type { Dataset, HouseId, Person, Point } from "../types";
import { SVG_NS, NODE_W, NODE_H } from "../constants";

function houseColor(data: Dataset, houseId: HouseId | null): string {
  if (houseId === null) return "none";
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.color : "none";
}

export function drawPerson(
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