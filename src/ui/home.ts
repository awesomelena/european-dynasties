import type { Country, Dataset, HouseId, Person, PersonId } from "../types";
import { houseName } from "../render/tooltip";
import { isSovereign } from "../data/people";
import { registerLayer } from "./layers";

type Dynasty = {
  id: HouseId;
  name: string;
  members: number;
  from: number;
  to: string;
  entry: Person;
};

function describe(data: Dataset, houseId: HouseId, startId?: PersonId): Dynasty | null {
  const members = data.people
    .filter((p) => p.houseBirth === houseId)
    .sort((a, b) => a.born - b.born);
  if (members.length === 0) return null;

  let lastDeath = 0;
  for (const p of members) {
    if (p.died !== null) lastDeath = Math.max(lastDeath, p.died);
  }
  const living = members.some((p) => p.died === null && p.born > 1920);

  return {
    id: houseId,
    name: houseName(data, houseId),
    members: members.length,
    from: members[0].born,
    to: living ? "present" : String(lastDeath),
    entry:
    (startId !== undefined ? data.people.find((p) => p.id === startId) : undefined) ??
    members.find(isSovereign) ??
    members.find((p) => p.displayTitle !== undefined) ??
    members[0],
  };
}

function card(title: string, lines: string[], accent: string, onClick: () => void) {
  const button = document.createElement("button");
  button.className = "home-card";
  button.style.setProperty("--accent", accent);

  const heading = document.createElement("h3");
  heading.textContent = title;
  button.appendChild(heading);

  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    button.appendChild(p);
  }

  button.addEventListener("click", onClick);
  return button;
}

export function createHome(data: Dataset, onPick: (id: PersonId) => void) {
  const overlay = document.createElement("div");
  overlay.className = "home";

  const inner = document.createElement("div");
  inner.className = "home-inner";

  const title = document.createElement("h1");
  title.textContent = "European Dynasties";
  const subtitle = document.createElement("p");
  subtitle.className = "home-sub";
  subtitle.textContent =
    "Royal, imperial and noble houses of Europe from the 10th century. Choose a country to begin.";

  const content = document.createElement("div");
  inner.append(title, subtitle, content);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  function showCountries() {
    content.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "home-grid";
    for (const country of data.countries ?? []) {
      if (country.houses.length === 0) continue;
      const count = country.houses.length;
      grid.appendChild(
        card(country.name, [`${count} ${count === 1 ? "dynasty" : "dynasties"}`], country.color, () =>
          showCountry(country)
        )
      );
    }
    content.appendChild(grid);
  }

  function showCountry(country: Country) {
    content.replaceChildren();

    const back = document.createElement("button");
    back.className = "home-back";
    back.textContent = "← All countries";
    back.addEventListener("click", showCountries);

    const heading = document.createElement("h2");
    heading.textContent = country.name;

    const grid = document.createElement("div");
    grid.className = "home-grid";
    for (const houseId of country.houses) {
      const d = describe(data, houseId, country.starts?.[houseId]);
      if (d === null) continue;
      grid.appendChild(
        card(
          d.name,
          [`${d.from}–${d.to}`, `${d.members} members`, `Start with ${d.entry.name.en}`],
          country.color,
          () => {
            hide();
            onPick(d.entry.id);
          }
        )
      );
    }

    content.append(back, heading, grid);
  }

  function show() {
    showCountries();
    overlay.style.display = "flex";
  }

  function hide() {
    overlay.style.display = "none";
  }

  registerLayer({
    priority: 80,
    isOpen: () => overlay.style.display === "flex",
    close: hide,
  });

  return {
    show,
    hide,
    isOpen: () => overlay.style.display === "flex",
  };
}