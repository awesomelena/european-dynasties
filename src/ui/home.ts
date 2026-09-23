import type { Country, Dataset, HouseId, Person, PersonId } from "../types";
import { houseName } from "../render/tooltip";
import { isSovereign } from "../data/people";
import { registerLayer } from "./layers";
import { shield } from "../render/shield";

type Dynasty = {
  id: HouseId;
  name: string;
  members: number;
  from: number;
  to: string;
  entry: Person;
  toYear: number | null;
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

  const lastBorn = members[members.length - 1].born;

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
    toYear: living ? null : Math.max(lastDeath, lastBorn),
  };
}

const TIMELINE_START = 950;
const TIMELINE_END = new Date().getFullYear();
const TIMELINE_TICKS = [1000, 1500, 2000];

function percent(year: number): number {
  return ((year - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
}

function createTimeline(): HTMLElement {
  const track = document.createElement("div");
  track.className = "home-timeline";
  for (const year of TIMELINE_TICKS) {
    const tick = document.createElement("div");
    tick.className = "home-timeline-tick";
    tick.style.left = `${percent(year)}%`;
    track.appendChild(tick);
  }
  return track;
}

function addBar(track: HTMLElement, from: number, to: number | null, color: string) {
  const bar = document.createElement("div");
  bar.className = "home-timeline-bar";
  const start = Math.max(from, TIMELINE_START);
  const end = to ?? TIMELINE_END;
  bar.style.left = `${percent(start)}%`;
  bar.style.width = `${Math.max(1, percent(end) - percent(start))}%`;
  bar.style.background = color;
  track.appendChild(bar);
}

function card(title: string, lines: string[], accent: string, onClick: () => void, extra?: HTMLElement) {
  const button = document.createElement("button");
  button.className = "home-card";
  button.style.setProperty("--accent", accent);

  const head = document.createElement("div");
  head.className = "home-card-head";
  const heading = document.createElement("h3");
  heading.textContent = title;
  head.append(shield(accent, 3), heading);
  button.appendChild(head);

  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    button.appendChild(p);
  }

  if (extra !== undefined) button.appendChild(extra);

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
      const timeline = createTimeline();
      for (const houseId of country.houses) {
        const d = describe(data, houseId, country.starts?.[houseId]);
        if (d !== null) addBar(timeline, d.from, d.toYear, country.color);
      }
      grid.appendChild(
        card(country.name, [`${count} ${count === 1 ? "dynasty" : "dynasties"}`], country.color, () =>
          showCountry(country), timeline
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
      const timeline = createTimeline();
      addBar(timeline, d.from, d.toYear, country.color);
      grid.appendChild(
        card(
          d.name,
          [`${d.from}-${d.to}`, `${d.members} members`, `Start with ${d.entry.name.en}`],
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