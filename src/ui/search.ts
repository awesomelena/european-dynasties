import type { Person, PersonId } from "../types";
import { bornText } from "../render/tooltip";
import { isSovereign } from "../data/people";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function createSearch(people: Person[], onSelect: (id: PersonId) => void) {
  const box = document.createElement("div");
  box.className = "search";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Search people…";
  const list = document.createElement("ul");
  list.className = "search-results";
  box.append(input, list);
  document.body.appendChild(box);

  const index = people.map((p) => ({
    person: p,
    name: normalize(p.name.en),
    allNames: normalize([p.name.en, p.name.native ?? ""].join(" ")),
    text: normalize(
      [p.name.en, p.name.native ?? "", ...(p.titles ?? []).map((t) => t.title)].join(" ")
    ),
    titles: (p.titles ?? []).map((t) => ({ raw: t.title, norm: normalize(t.title) })),
    sovereign: isSovereign(p),
  }));

  type Entry = (typeof index)[number];

  function score(entry: Entry, query: string, words: string[]): number {
    let s = 0;
    if (entry.name === query) s += 100;
    else if (entry.name.startsWith(query)) s += 50;

    const nameWords = entry.allNames.split(/\s+/);
    for (const w of words) {
      if (nameWords.some((nw) => nw.startsWith(w))) s += 20;
      else if (entry.allNames.includes(w)) s += 8;
    }

    if (entry.sovereign) s += 15;
    if (entry.person.wiki !== undefined) s += 5;
    return s;
  }

  function shownTitle(entry: Entry, words: string[]): string | undefined {
    const inTitles = words.filter((w) => !entry.allNames.includes(w));
    if (inTitles.length > 0) {
      const match = entry.titles.find((t) => inTitles.every((w) => t.norm.includes(w)));
      if (match !== undefined) return match.raw;
    }
    return entry.person.displayTitle;
  }

  let results: Entry[] = [];
  let active = -1;

  function setActive(i: number) {
    active = i;
    const items = list.querySelectorAll("li");
    items.forEach((item, j) => item.classList.toggle("active", j === i));
    if (i >= 0) items[i].scrollIntoView({ block: "nearest" });
  }

  function clear() {
    active = -1;
    input.value = "";
    list.replaceChildren();
    results = [];
  }

  function choose(id: PersonId) {
    clear();
    input.blur();
    onSelect(id);
  }

  input.addEventListener("input", () => {
    list.replaceChildren();
    const query = normalize(input.value.trim());
    if (query.length < 2) {
      results = [];
      return;
    }

    const words = query.split(/\s+/);
    results = index
      .filter((entry) => words.every((w) => entry.text.includes(w)))
      .map((entry) => ({ entry, s: score(entry, query, words) }))
      .sort((a, b) => b.s - a.s || a.entry.person.born - b.entry.person.born)
      .slice(0, 12)
      .map(({ entry }) => entry);

    results.forEach((entry, i) => {
      const p = entry.person;
      const title = shownTitle(entry, words);
      const item = document.createElement("li");
      item.textContent = `${p.name.en} (${bornText(p)})${title !== undefined ? " · " + title : ""}`;
      item.addEventListener("click", () => choose(p.id));
      item.addEventListener("mouseenter", () => setActive(i));
      list.appendChild(item);
    });
    setActive(results.length > 0 ? 0 : -1);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActive((active + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActive((active - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && active >= 0) {
      choose(results[active].person.id);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      clear();
      input.blur();
    }
  });

  return {
    focus: () => input.focus(),
  };
}