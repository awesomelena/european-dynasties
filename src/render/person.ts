import type { Dataset, HouseId, Person, Point } from "../types";
import { SVG_NS, NODE_W, NODE_H } from "../constants";

function houseColor(data: Dataset, houseId: HouseId | null): string {
  if (houseId === null) return "none";
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.color : "none";
}

export function drawPerson(svg: SVGGElement, data: Dataset, person: Person, pos: Point): SVGGElement{    
  const g = document.createElementNS(SVG_NS, "g");
  g.style.cursor = "pointer";            

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(pos.x));
  rect.setAttribute("y", String(pos.y));
  rect.setAttribute("width", String(NODE_W));
  rect.setAttribute("height", String(NODE_H));
  rect.style.fill = houseColor(data, person.houseBirth);
  rect.style.stroke = houseColor(data, person.houseMarriage);
  rect.style.strokeWidth = "4";
  g.appendChild(rect);          

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(pos.x + 8));
  text.setAttribute("y", String(pos.y + 25));

  const house = data.houses.find((h) => h.id === person.houseBirth);
  text.style.fill = house?.textColor ?? "var(--argent)"; 

  text.textContent = person.name.en;
  g.appendChild(text);            

  svg.appendChild(g);   
  return g;            
}