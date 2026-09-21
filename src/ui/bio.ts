import type { Dataset, HouseId, Person, PersonId } from "../types";
import type { Family } from "../data/family";
import { houseName, personLines } from "../render/tooltip";

const panel = document.createElement("aside");
panel.className = "bio";
panel.style.display = "none";
document.body.appendChild(panel);

export function hideBio() {
  panel.style.display = "none";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideBio();
});

function startPanel(title: string) {
  panel.replaceChildren();

  const close = document.createElement("button");
  close.className = "bio-close";
  close.textContent = "×";
  close.addEventListener("click", hideBio);
  panel.appendChild(close);

  const heading = document.createElement("h2");
  heading.textContent = title;
  panel.appendChild(heading);
}

function addText(text: string) {
  const p = document.createElement("p");
  p.textContent = text;
  panel.appendChild(p);
}

function addPeople(title: string, people: Person[], onSelect: (id: PersonId) => void) {
  if (people.length === 0) return;

  const heading = document.createElement("h3");
  heading.textContent = title;
  panel.appendChild(heading);

  const list = document.createElement("ul");
  for (const person of people) {
    const item = document.createElement("li");
    const link = document.createElement("button");
    link.className = "bio-link";
    link.textContent = `${person.name.en} (${person.born}–${person.died ?? ""})`;
    link.addEventListener("click", () => onSelect(person.id));
    item.appendChild(link);
    list.appendChild(item);
  }
  panel.appendChild(list);
}

function lookup(ids: PersonId[], family: Family): Person[] {
  const result: Person[] = [];
  for (const id of ids) {
    const person = family.personById.get(id);
    if (person !== undefined) result.push(person);
  }
  return result;
}

export function showBio(
  data: Dataset,
  person: Person,
  family: Family,
  onSelect: (id: PersonId) => void
) {
  const [name, ...rest] = personLines(data, person);
  startPanel(name);
  for (const line of rest) addText(line);

  const spouseId = family.spouseOf.get(person.id);
  addPeople("Parents", lookup(family.parentsByChild.get(person.id) ?? [], family), onSelect);
  addPeople("Spouse", lookup(spouseId !== undefined ? [spouseId] : [], family), onSelect);
  addPeople("Children", lookup(family.childrenOf.get(person.id) ?? [], family), onSelect);

  panel.style.display = "block";
}

export function showHouse(
  data: Dataset,
  houseId: HouseId,
  onSelect: (id: PersonId) => void
) {
  const byBirth = (a: Person, b: Person) => a.born - b.born;
  const born = data.people.filter((p) => p.houseBirth === houseId).sort(byBirth);
  const married = data.people.filter((p) => p.houseMarriage === houseId).sort(byBirth);

  startPanel(houseName(data, houseId));
  addText(`${born.length} born into the house · ${married.length} married in`);
  addPeople("Born into the house", born, onSelect);
  addPeople("Married into the house", married, onSelect);

  panel.style.display = "block";
}