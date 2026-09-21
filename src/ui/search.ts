import type { Person, PersonId } from "../types";

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

  function clear() {
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

    for (const p of results) {
      const item = document.createElement("li");
      const title = p.titles?.[0]?.title;
      item.textContent = `${p.name.en} (${p.born})${title !== undefined ? " · " + title : ""}`;
      item.addEventListener("click", () => choose(p.id));
      list.appendChild(item);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && results.length > 0) choose(results[0].id);
    if (e.key === "Escape") clear();
  });
}