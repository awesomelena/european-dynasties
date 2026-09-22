import type { Person, PersonId } from "../types";
import { bornText } from "../render/tooltip";

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
    text: normalize(
      [p.name.en, p.name.native ?? "", ...(p.titles ?? []).map((t) => t.title)].join(" ")
    ),
  }));

  let results: Person[] = [];

  let active = -1;

  function setActive(index: number) {
    active = index;
    const items = list.querySelectorAll("li");
    items.forEach((item, i) => item.classList.toggle("active", i === index));
    if (index >= 0) items[index].scrollIntoView({ block: "nearest" });
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
      .map((entry) => entry.person)
      .sort((a, b) => a.born - b.born)
      .slice(0, 12);

    results.forEach((p, i) => {
      const item = document.createElement("li");
      const title = p.titles?.[0]?.title;
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
      choose(results[active].id);
    } else if (e.key === "Escape") {
      clear();
    }
  });
}