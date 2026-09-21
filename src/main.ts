import "./styles/tokens.css";
import "./styles/tooltip.css";
import "./styles/menu.css";     
import "./styles/bio.css";
import "./styles/canvas.css";
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
import { showBio } from "./ui/bio";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";

async function main() {
  const data = await loadData();
  const family = buildFamily(data);
  const { spouseOf, personById } = family;

  function openBio(id: PersonId) {
    showBio(data, personById.get(id)!, family, (nextId) => {
      render(nextId);
      openBio(nextId);
    });
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("canvas");
  const world = document.createElementNS(SVG_NS, "g");
  svg.appendChild(world);
  document.querySelector("#app")!.appendChild(svg);

  const zoomer = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.05, 3])
    .on("zoom", (event) => {
      world.setAttribute("transform", event.transform.toString());
    });
  select(svg).call(zoomer);

  function fitToView(width: number, height: number) {
    const k = Math.min(1, svg.clientWidth / width, svg.clientHeight / height);
    const x = (svg.clientWidth - width * k) / 2;
    const y = (svg.clientHeight - height * k) / 2;
    select(svg).call(zoomer.transform, zoomIdentity.translate(x, y).scale(k));
  }

  let lastWidth = 0;
  let lastHeight = 0;

  const controls = document.createElement("div");
  controls.className = "zoom-controls";
  for (const [label, action] of [
    ["+", () => select(svg).call(zoomer.scaleBy, 1.4)],
    ["−", () => select(svg).call(zoomer.scaleBy, 1 / 1.4)],
    ["⤢", () => fitToView(lastWidth, lastHeight)],
  ] as const) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", action);
    controls.appendChild(button);
  }
  document.body.appendChild(controls);

  function render(focusId: PersonId) {
    world.replaceChildren();
    hideTooltip();

    const positions = computeLayout(data, focusId);

    let maxX = 0;
    let maxY = 0;
    for (const p of positions.values()) {
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    }
    lastWidth = maxX + 40;
    lastHeight = maxY + 40;

    drawUnions(world, data, positions);
    drawParentage(world, data, positions);

    for (const person of data.people) {
      const pos = positions.get(person.id);
      if (pos === undefined) continue;

      const g = drawPerson(world, data, person, pos);
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
          { label: "Biography", action: () => openBio(person.id) },
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

    fitToView(lastWidth, lastHeight);

  }

  render("Q9439");
}

main();