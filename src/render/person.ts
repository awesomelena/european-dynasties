import type { HouseId, Person, Box, HouseStyle } from "../types";
import { SVG_NS, NODE_H, NODE_PAD, FONT_NAME, FONT_TITLE, UNKNOWN_STYLE, NAME_Y_ALONE, NAME_Y_WITH_TITLE, TITLE_Y } from "../constants";
import { bornText } from "./tooltip";

export function drawPerson(
  svg: SVGGElement,
  colors: Map<HouseId, HouseStyle>,
  person: Person,
  pos: Box,
  opts: { ghost?: boolean; focus?: boolean } = {}
): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  g.style.cursor = "pointer";

  g.classList.add("person");
  g.dataset.id = person.id;

  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "button");
  const years = `${bornText(person)}-${person.died ?? ""}`;
  const label = person.displayTitle !== undefined ? `, ${person.displayTitle}` : "";
  g.setAttribute("aria-label", `${person.name.en}, ${years}${label}`);

  if (opts.ghost) g.classList.add("ghost");
  g.dataset.houses = [person.houseBirth, person.houseMarriage ?? ""].join(" ");

  if (opts.focus) {
    const ring = document.createElementNS(SVG_NS, "rect");
    ring.setAttribute("x", String(pos.x - 6));
    ring.setAttribute("y", String(pos.y - 6));
    ring.setAttribute("width", String(pos.w + 12));
    ring.setAttribute("height", String(NODE_H + 12));
    ring.style.fill = "none";
    ring.style.stroke = "var(--or)";
    ring.style.strokeWidth = "3";
    g.appendChild(ring);
  }

  if (!opts.ghost) {
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x", String(pos.x + 4));
    shadow.setAttribute("y", String(pos.y + 4));
    shadow.setAttribute("width", String(pos.w));
    shadow.setAttribute("height", String(NODE_H));
    shadow.style.fill = "var(--sable)";
    g.appendChild(shadow);
  }

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(pos.x));
  rect.setAttribute("y", String(pos.y));
  rect.setAttribute("width", String(pos.w));
  rect.setAttribute("height", String(NODE_H));
  rect.style.fill = (colors.get(person.houseBirth) ?? UNKNOWN_STYLE).color;
  rect.style.stroke =
    person.houseMarriage !== null
      ? (colors.get(person.houseMarriage) ?? UNKNOWN_STYLE).color
      : "none";
  rect.style.strokeWidth = "4";
  if (opts.ghost) {
    rect.style.stroke = "var(--sable)";
    rect.style.strokeDasharray = "6 4";
  }
  g.appendChild(rect);

  const textColor = colors.get(person.houseBirth)?.textColor ?? "var(--argent)";
  const title = person.displayTitle;

  const name = document.createElementNS(SVG_NS, "text");
  name.setAttribute("x", String(pos.x + NODE_PAD));
  name.setAttribute("y", String(pos.y + (title !== undefined ? NAME_Y_WITH_TITLE : NAME_Y_ALONE)));
  name.style.font = FONT_NAME;
  name.style.fill = textColor;
  name.textContent = person.name.en;
  g.appendChild(name);

  if (title !== undefined) {
    const sub = document.createElementNS(SVG_NS, "text");
    sub.setAttribute("x", String(pos.x + NODE_PAD));
    sub.setAttribute("y", String(pos.y + TITLE_Y));
    sub.style.font = FONT_TITLE;
    sub.style.fill = textColor;
    sub.style.opacity = "0.85";
    sub.textContent = title;
    g.appendChild(sub);
  }

  svg.appendChild(g);
  return g;
}