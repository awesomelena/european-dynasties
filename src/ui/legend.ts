import type { Dataset, HouseId, HouseStyle } from "../types";
import { houseName } from "../render/tooltip";
import { OTHER_STYLE } from "../constants";
import { registerLayer } from "./layers";
import { shield } from "../render/shield";
import { crownMarkup } from "../render/crown";

const LINE_SAMPLES = `
  <h4>Lines</h4>
  <div class="legend-row">
    <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="var(--sable)" stroke-width="6"/><line x1="0" y1="6" x2="36" y2="6" stroke="var(--argent)" stroke-width="2"/></svg>
    Marriage
  </div>
  <div class="legend-row">
    <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="var(--sable)" stroke-width="6" stroke-dasharray="10 6"/><line x1="0" y1="6" x2="36" y2="6" stroke="var(--argent)" stroke-width="2" stroke-dasharray="10 6"/></svg>
    Divorce or annulment
  </div>
  <div class="legend-row">
    <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="var(--sable)" stroke-width="2"/></svg>
    Parent - child
  </div>
  <div class="legend-row">
    <svg width="36" height="18"><rect x="2" y="2" width="32" height="14" fill="#ccc" stroke="var(--sable)" stroke-width="2" stroke-dasharray="4 3"/></svg>
    Also shown elsewhere
  </div>
  <div class="legend-row">
    <svg width="36" height="18"><rect x="3" y="3" width="30" height="12" fill="var(--azure)" stroke="var(--gules)" stroke-width="3"/></svg>
    Fill: born into · Border: married into
  </div>
    <div class="legend-row">
    ${crownMarkup()}
    Reigned as monarch
  </div>
  <h4>Keys</h4>
  <div class="legend-row">↑ parent · ↓ eldest child</div>
  <div class="legend-row">← → siblings · S spouse</div>
  <div class="legend-row">/ search · Enter biography</div>
`;

export function createLegend(
  onHighlight: (house: HouseId | null) => void,
  onShowHouse: (house: HouseId) => void
){
  const details = document.createElement("details");
  details.className = "legend";
  details.open = !window.matchMedia("(max-width: 700px)").matches;

  const summary = document.createElement("summary");
  summary.textContent = "Legend";
  const body = document.createElement("div");
  body.className = "legend-body";

  details.append(summary, body);
  document.body.appendChild(details);

  let active: HouseId | null = null;

  function setActive(house: HouseId | null) {
    active = house;
    for (const row of body.querySelectorAll<HTMLElement>(".legend-row[data-house]")) {
      row.classList.toggle("active", row.dataset.house === active);
    }
    onHighlight(active);
  }

  registerLayer({
    priority: 40,
    isOpen: () => active !== null,
    close: () => setActive(null),
  });

  return function update(colors: Map<HouseId, HouseStyle>, data: Dataset) {
    if (active !== null && !colors.has(active)) active = null;
    body.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "Houses in view";
    body.appendChild(heading);

    for (const [id, style] of colors) {
      let others = 0;
      if (style === OTHER_STYLE) {
        others++;
        continue;
      }

      if (others > 0) {
        const row = document.createElement("div");
        row.className = "legend-row";
        const swatch = shield(OTHER_STYLE.color);
        const name = document.createElement("span");
        name.textContent = `${others} other ${others === 1 ? "house" : "houses"}`;
        row.append(swatch, name);
        body.appendChild(row);
      }
      
      const row = document.createElement("div");
      row.className = "legend-row";
      const swatch = shield(style.color);
      const name = document.createElement("span");
      name.textContent = id === "unknown" ? "Unknown" : houseName(data, id);
      row.append(swatch, name);

      if (id !== "unknown") {
        const more = document.createElement("button");
        more.className = "legend-more";
        more.textContent = ">";
        more.title = "Show all members";
        more.addEventListener("click", (e) => {
          e.stopPropagation();
          onShowHouse(id);
        });
        row.appendChild(more);
      }
      row.dataset.house = id;
      row.classList.toggle("active", id === active);
      row.addEventListener("click", () => setActive(active === id ? null : id));
      body.appendChild(row);
    }

    body.insertAdjacentHTML("beforeend", LINE_SAMPLES);
    onHighlight(active);
  };
}