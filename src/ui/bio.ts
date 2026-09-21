import type { Dataset, Person, PersonId } from "../types";
import type { Family } from "../data/family";
import { personLines } from "../render/tooltip";

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

export function showBio(
  data: Dataset,
  person: Person,
  family: Family,
  onSelect: (id: PersonId) => void
) {
  panel.replaceChildren();

  function addSection(title: string, ids: PersonId[]) {
    if (ids.length === 0) return;

    const heading = document.createElement("h3");
    heading.textContent = title;
    panel.appendChild(heading);

    const list = document.createElement("ul");
    for (const id of ids) {
      const item = document.createElement("li");
      const link = document.createElement("button");
      link.className = "bio-link";
      link.textContent = family.personById.get(id)?.name.en ?? id;
      link.addEventListener("click", () => onSelect(id));
      item.appendChild(link);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  const close = document.createElement("button");
  close.className = "bio-close";
  close.textContent = "×";
  close.addEventListener("click", hideBio);
  panel.appendChild(close);

  const [name, ...rest] = personLines(data, person);

  const title = document.createElement("h2");
  title.textContent = name;
  panel.appendChild(title);

  for (const line of rest) {
    const p = document.createElement("p");
    p.textContent = line;
    panel.appendChild(p);
  }

  const spouseId = family.spouseOf.get(person.id);
  addSection("Parents", family.parentsByChild.get(person.id) ?? []);
  addSection("Spouse", spouseId !== undefined ? [spouseId] : []);
  addSection("Children", family.childrenOf.get(person.id) ?? []);

  panel.style.display = "block";
}