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
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { createSearch } from "./ui/search";
import { showBio, showHouse } from "./ui/bio";
import { createRuler } from "./render/ruler";
import "./styles/pixel.css";
import "./styles/mobile.css";

async function main() {
  const data = await loadData();
  const family = buildFamily(data);

  await Promise.all([document.fonts.load(FONT_NAME), document.fonts.load(FONT_TITLE)]);

  const widths = new Map<PersonId, number>(data.people.map((p) => [p.id, nodeWidth(p)]));
  const { personById } = family;

  function openBio(id: PersonId) {
    showBio(data, personById.get(id)!, family, (nextId) => {
      navigate(nextId);
      openBio(nextId);
    });
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("canvas");
  const world = document.createElementNS(SVG_NS, "g");
  svg.appendChild(world);
  document.querySelector("#app")!.appendChild(svg);

  const updateRuler = createRuler(svg, world);
  let currentOrigin = 0;
  let currentFocus: PersonId | null = null;
  let suppressClick = false;
  let lastLongPress = 0;

  const zoomer = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.05, 3])
    .on("zoom", (event) => {
      world.setAttribute("transform", event.transform.toString());
      updateRuler(event.transform, currentOrigin);
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

  function openMenuFor(person: Person, x: number, y: number) {
    const items: MenuItem[] = [{ label: "Biography", action: () => openBio(person.id) }];

    if (person.houseBirth !== "unknown") {
      items.push({
        label: `Members of ${houseName(data, person.houseBirth)}`,
        action: () => openHouse(person.houseBirth),
      });
    }

    for (const spouseId of family.spousesOf.get(person.id) ?? []) {
      const spouse = personById.get(spouseId)!;
      if (spouse.houseBirth === person.houseBirth) continue;
      items.push({
        label: `Open ${houseName(data, spouse.houseBirth)} tree (${spouse.name.en})`,
        action: () => navigate(spouse.id),
      });
    }

    showMenu(items, x, y);
  }

  function attach(g: SVGGElement, person: Person) {
    g.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      setHover(person.id);
      const hint =
        person.id === currentFocus
          ? "click for biography · right-click for more"
          : "click to centre · right-click for more";
      showTooltip(personLines(data, person), e.clientX, e.clientY, hint);
    });

    g.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") moveTooltip(e.clientX, e.clientY);
    });

    g.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      setHover(null);
      hideTooltip();
    });

    g.addEventListener("click", (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.stopPropagation();
        return;
      }

      e.stopPropagation();
      hideTooltip();
      if (person.id === currentFocus) {
        openBio(person.id);
      } else {
        navigate(person.id);
      }
    });

    g.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - lastLongPress < 1000) return;
      hideTooltip();
      openMenuFor(person, e.clientX, e.clientY);
    });

    let pressTimer: number | undefined;
    let startX = 0;
    let startY = 0;
    const cancelPress = () => window.clearTimeout(pressTimer);

    g.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      suppressClick = false;
      startX = e.clientX;
      startY = e.clientY;
      pressTimer = window.setTimeout(() => {
        suppressClick = true;
        lastLongPress = Date.now();
        hideTooltip();
        openMenuFor(person, startX, startY);
      }, 500);
    });

    g.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch") return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelPress();
    });
    g.addEventListener("pointerup", cancelPress);
    g.addEventListener("pointercancel", cancelPress);
  }

  function applyHighlight(house: HouseId | null) {
    world.classList.toggle("highlighting", house !== null);
    for (const g of world.querySelectorAll<SVGGElement>(".person")) {
      const houses = (g.dataset.houses ?? "").split(" ");
      g.classList.toggle("match", house !== null && houses.includes(house));
    }
  }

  function setHover(id: PersonId | null) {
    world.classList.toggle("hovering", id !== null);

    const related = new Set<PersonId>();
    if (id !== null) {
      related.add(id);
      for (const s of family.spousesOf.get(id) ?? []) related.add(s);
      for (const p of family.parentsByChild.get(id) ?? []) related.add(p);
      for (const c of family.childrenOf.get(id) ?? []) related.add(c);
    }

    for (const g of world.querySelectorAll<SVGGElement>(".person")) {
      g.classList.toggle("related", related.has(g.dataset.id ?? ""));
    }
    for (const line of world.querySelectorAll<SVGElement>(".line")) {
      const people = (line.dataset.people ?? "").split(" ");
      line.classList.toggle("related", id !== null && people.includes(id));
    }
  }

  function openHouse(houseId: HouseId) {
    showHouse(data, houseId, (id) => navigate(id));
  }

  const updateLegend = createLegend(applyHighlight, openHouse);

  function navigate(id: PersonId) {
    if (location.hash === `#${id}`) {
      render(id);
    } else {
      location.hash = id;
    }
  }

  function render(focusId: PersonId) {
    currentFocus = focusId;

    document.title = `${personById.get(focusId)!.name.en} · European Dynasties`;

    world.replaceChildren();
    hideTooltip();

    const layout = computeLayout(family, focusId, widths);

    currentOrigin = layout.origin;

    const colors = assignColors(layout, personById);

    let maxX = 0;
    let maxY = 0;
    for (const b of layout.blocks) {
      for (const box of [b.person, ...b.spouses]) {
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
      for (const s of b.spouses) {
        if (!s.ghost) continue;
        const person = personById.get(s.id)!;
        attach(drawPerson(world, colors, person, s, { ghost: true }), person);
      }
    }

    const focusBox = layout.positions.get(focusId);
    if (focusBox !== undefined) {
      centerOn(focusBox);
    } else {
      fitToView(lastWidth, lastHeight);
    }

    updateLegend(colors, data);

  }

  createSearch(data.people, (id) => navigate(id));

  const home = createHome(data, (id) => navigate(id));

  const homeButton = document.createElement("button");
  homeButton.className = "home-button";
  homeButton.textContent = "Dynasties";
  homeButton.addEventListener("click", () => home.show());
  document.body.appendChild(homeButton);

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (personById.has(id)) {
      home.hide();
      render(id);
    }
  });

  const initial = location.hash.slice(1);
  if (personById.has(initial)) {
    render(initial);
  } else {
    render("Q9439");
    home.show();
  }

  window.addEventListener("resize", () => updateRuler(zoomTransform(svg), currentOrigin));
}

main();