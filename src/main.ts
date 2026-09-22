import "@fontsource/silkscreen";
import "@fontsource/pixelify-sans";

import "./styles/tokens.css";
import "./styles/tooltip.css";
import "./styles/menu.css";     
import "./styles/bio.css";
import "./styles/canvas.css";
import "./styles/search.css";
import "./styles/legend.css";
import "./styles/tree.css";
import "./styles/home.css";
import { createHome } from "./ui/home";
import { assignColors } from "./render/colors";
import { createLegend } from "./ui/legend";
import type { Person, PersonId, Box, HouseId } from "./types";
import { SVG_NS, NODE_H, FONT_NAME, FONT_TITLE } from "./constants";
import { nodeWidth } from "./render/measure";
import { loadData } from "./data/loader";
import { buildFamily } from "./data/family";  
import { computeLayout } from "./layout/positions";
import { drawUnions, drawParentage } from "./render/lines";
import { drawPerson } from "./render/person";
import {
  showTooltip, moveTooltip, hideTooltip, personLines, houseName,
} from "./render/tooltip";
import { showMenu, type MenuItem } from "./ui/menu"; 
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { createSearch } from "./ui/search";
import { showBio, showHouse } from "./ui/bio";
import "./styles/pixel.css";

async function main() {
  const data = await loadData();
  const family = buildFamily(data);

  await Promise.all([document.fonts.load(FONT_NAME), document.fonts.load(FONT_TITLE)]);

  const widths = new Map<PersonId, number>(data.people.map((p) => [p.id, nodeWidth(p)]));
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

  function centerOn(box: Box) {
    const k = 1;
    const x = svg.clientWidth / 2 - (box.x + box.w / 2) * k;
    const y = svg.clientHeight / 2 - (box.y + NODE_H / 2) * k;
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

  function attach(g: SVGGElement, person: Person) {
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

  function applyHighlight(house: HouseId | null) {
    world.classList.toggle("highlighting", house !== null);
    for (const g of world.querySelectorAll<SVGGElement>(".person")) {
      const houses = (g.dataset.houses ?? "").split(" ");
      g.classList.toggle("match", house !== null && houses.includes(house));
    }
  }

  function openHouse(houseId: HouseId) {
    showHouse(data, houseId, (id) => render(id));
  }

  const updateLegend = createLegend(applyHighlight, openHouse);

  function render(focusId: PersonId) {
  world.replaceChildren();
  hideTooltip();

  const layout = computeLayout(data, focusId, widths);

  const colors = assignColors(layout, personById);

  let maxX = 0;
  let maxY = 0;
  for (const b of layout.blocks) {
    const boxes = b.spouse !== null ? [b.person, b.spouse] : [b.person];
    for (const box of boxes) {
      maxX = Math.max(maxX, box.x + box.w);
      maxY = Math.max(maxY, box.y + NODE_H);
    }
  }
  lastWidth = maxX + 40;
  lastHeight = maxY + 40;

  drawUnions(world, layout);
  drawParentage(world, layout);

  for (const [id, box] of layout.positions) {
    const person = personById.get(id)!;
    attach(drawPerson(world, colors, person, box, { focus: id === focusId }), person);
  }

  for (const b of layout.blocks) {
    if (b.spouse === null || !b.spouse.ghost) continue;
    const person = personById.get(b.spouse.id)!;
    attach(drawPerson(world, colors, person, b.spouse, { ghost: true }), person);
  }

  const focusBox = layout.positions.get(focusId);
  if (focusBox !== undefined) {
    centerOn(focusBox);
  } else {
    fitToView(lastWidth, lastHeight);
  }

  updateLegend(colors, data);
  
}

  createSearch(data.people, (id) => render(id));

  const home = createHome(data, (id) => render(id));

  const homeButton = document.createElement("button");
  homeButton.className = "home-button";
  homeButton.textContent = "Dynasties";
  homeButton.addEventListener("click", () => home.show());
  document.body.appendChild(homeButton);

  render("Q9439");
  home.show();
}

main();