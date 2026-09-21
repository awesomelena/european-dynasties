import "./styles/tokens.css";
import "./styles/tooltip.css";
import "./styles/menu.css";     
import type { PersonId } from "./types";
import { SVG_NS, NODE_W, NODE_H } from "./constants";
import { loadData } from "./data/loader";
import { buildFamily } from "./data/family";  
import { computeLayout } from "./layout/positions";
import { drawUnions, drawParentage } from "./render/lines";
import { drawPerson } from "./render/person";
import {
  showTooltip, moveTooltip, hideTooltip, personLines, houseName,
} from "./render/tooltip";
import { showMenu, type MenuItem } from "./ui/menu"; 

async function main() {
  const data = await loadData();
  const { spouseOf, personById } = buildFamily(data);

  const svg = document.createElementNS(SVG_NS, "svg");
  document.querySelector("#app")!.appendChild(svg);

  function render(focusId: PersonId) {
    svg.replaceChildren();
    hideTooltip();

    const positions = computeLayout(data, focusId);

    let maxX = 0;
    let maxY = 0;
    for (const p of positions.values()) {
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    }
    svg.setAttribute("width", String(maxX + 40));
    svg.setAttribute("height", String(maxY + 40));

    drawUnions(svg, data, positions);
    drawParentage(svg, data, positions);

    for (const person of data.people) {
      const pos = positions.get(person.id);
      if (pos === undefined) continue;

      const g = drawPerson(svg, data, person, pos);
      g.addEventListener("mouseenter", (e) =>
        showTooltip(personLines(data, person), e.clientX, e.clientY)
      );
      g.addEventListener("mousemove", (e) => moveTooltip(e.clientX, e.clientY));
      g.addEventListener("mouseleave", hideTooltip);

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        hideTooltip();

        const items: MenuItem[] = [
          { label: "Center here", action: () => render(person.id) },
        ];

        const spouseId = spouseOf.get(person.id);
        const spouse = spouseId !== undefined ? personById.get(spouseId) : undefined;
        if (spouse !== undefined && spouse.houseBirth !== person.houseBirth) {
          items.push({
            label: `Open ${houseName(data, spouse.houseBirth)} tree`,
            action: () => render(spouse.id),
          });
        }

        showMenu(items, e.clientX, e.clientY);
      });
    }
  }

  render("victoria");
}

main();