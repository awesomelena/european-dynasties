import type { Dataset, HouseId, HouseStyle } from "../types";
import { houseName } from "../render/tooltip";

const LINE_SAMPLES = `
  <h4>Lines</h4>
  <div class="legend-row">
    <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="var(--sable)" stroke-width="6"/><line x1="0" y1="6" x2="36" y2="6" stroke="white" stroke-width="2"/></svg>
    Marriage
  </div>
  <div class="legend-row">
    <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="var(--sable)" stroke-width="2"/></svg>
    Parent – child
  </div>
  <div class="legend-row">
    <svg width="36" height="18"><rect x="2" y="2" width="32" height="14" fill="#ccc" stroke="var(--sable)" stroke-width="2" stroke-dasharray="4 3"/></svg>
    Also shown elsewhere
  </div>
  <div class="legend-row">
    <svg width="36" height="18"><rect x="3" y="3" width="30" height="12" fill="var(--azure)" stroke="var(--gules)" stroke-width="3"/></svg>
    Fill: born into · Border: married into
  </div>
`;

export function createLegend(onHighlight: (house: HouseId | null) => void) {
  const details = document.createElement("details");
  details.className = "legend";
  details.open = true;

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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active !== null) setActive(null);
  });

  return function update(colors: Map<HouseId, HouseStyle>, data: Dataset) {
    if (active !== null && !colors.has(active)) active = null;
    body.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "Houses in view";
    body.appendChild(heading);

    for (const [id, style] of colors) {
      const row = document.createElement("div");
      row.className = "legend-row";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = style.color;
      const name = document.createElement("span");
      name.textContent = id === "unknown" ? "Unknown" : houseName(data, id);
      row.append(swatch, name);
      row.dataset.house = id;
      row.classList.toggle("active", id === active);
      row.addEventListener("click", () => setActive(active === id ? null : id));
      body.appendChild(row);
    }

    body.insertAdjacentHTML("beforeend", LINE_SAMPLES);
    onHighlight(active);
  };
}