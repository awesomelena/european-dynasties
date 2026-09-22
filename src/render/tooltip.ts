import type { Dataset, HouseId, Person } from "../types";

const tip = document.createElement("div");
tip.className = "tooltip";
tip.style.display = "none";
document.body.appendChild(tip);

export function houseName(data: Dataset, houseId: HouseId): string {
  const house = data.houses.find((h) => h.id === houseId);
  return house ? house.name.en : houseId;
}

export function showTooltip(lines: string[], x: number, y: number) {
  tip.replaceChildren();
  for (const line of lines) {
    const row = document.createElement("div");
    row.textContent = line;
    tip.appendChild(row);
  }
  moveTooltip(x, y);
  tip.style.display = "block";
}

export function moveTooltip(x: number, y: number) {
  tip.style.left = `${x + 12}px`;
  tip.style.top = `${y + 12}px`;
}

export function hideTooltip() {
  tip.style.display = "none";
}

export function bornText(person: Person): string {
  return `${person.bornEstimated ? "c. " : ""}${person.born}`;
}

export function personLines(data: Dataset, person: Person): string[] {
  const lines: string[] = [];

  lines.push(person.name.en);

  if (person.name.native !== undefined) {
    lines.push(person.name.native);
  }

  const died = person.died === null ? "" : String(person.died);
  lines.push(`${bornText(person)}-${died}`);

  for (const t of person.titles ?? []) {
    if (t.from === null && t.to === null) {
      lines.push(t.title);
      continue;
    }
    
    const span =
      t.from === t.to ? `${t.from}` : `${t.from ?? "?"}–${t.to ?? ""}`;
    lines.push(`${t.title} (${span})`);
  }

  lines.push(`Born: ${houseName(data, person.houseBirth)}`);

  if (person.houseMarriage !== null) {
    lines.push(`Married into: ${houseName(data, person.houseMarriage)}`);
  }

  return lines;
}