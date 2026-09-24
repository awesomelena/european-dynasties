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
import "./styles/loading.css";
import "./styles/banner.css";
import "./styles/about.css";
import { createAbout } from "./ui/about";
import { createThemeButton } from "./ui/theme";
import { computeAncestry } from "./layout/ancestry";
import { findPath } from "./data/relations";
import { showBanner, hideBanner } from "./ui/banner";
import { createHome } from "./ui/home";
import { assignColors } from "./render/colors";
import { createLegend } from "./ui/legend";
import type { Person, PersonId, Box, HouseId } from "./types";
import { SVG_NS, NODE_H, FONT_NAME, FONT_TITLE } from "./constants";
import { nodeWidth } from "./render/measure";
import { loadData } from "./data/loader";
import { buildFamily } from "./data/family";
import { computeLayout, type Layout } from "./layout/positions";
import { drawUnions, drawParentage } from "./render/lines";
import { drawPerson } from "./render/person";
import {
  showTooltip, moveTooltip, hideTooltip, personLines, houseName,
} from "./render/tooltip";
import { showMenu, type MenuItem } from "./ui/menu";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { createSearch } from "./ui/search";
import { showBio, showHouse, showRelationship } from "./ui/bio";
import { createRuler } from "./render/ruler";
import { hideLoading, nextFrame, setStatus, showError } from "./ui/loading";
import "./styles/pixel.css";
import "./styles/mobile.css";

async function main() {
  setStatus("Loading data…");
  const data = await loadData();
  setStatus("Loading fonts…");
  await Promise.all([document.fonts.load(FONT_NAME), document.fonts.load(FONT_TITLE)]);
  setStatus("Measuring names…");
  await nextFrame();
  const family = buildFamily(data);
  const widths = new Map<PersonId, number>(data.people.map((p) => [p.id, nodeWidth(p)]));
  const { personById } = family;

  function openBio(id: PersonId) {
    showBio(data, personById.get(id)!, family, (nextId) => {
      navigate(nextId);
      openBio(nextId);
    });
  }

  function relationWord(relation: string, person: Person): string {
    const f = person.sex === "f";
    if (relation === "parent") return f ? "mother" : "father";
    if (relation === "child") return f ? "daughter" : "son";
    if (relation === "spouse") return f ? "wife" : "husband";
    return "";
  }

  function startRelationPick(id: PersonId) {
    pickFrom = id;
    showBanner(`Choose someone to compare with ${personById.get(id)!.name.en} · Esc to cancel`, () => {
      pickFrom = null;
    });
  }

  function finishRelationPick(toId: PersonId) {
    const fromId = pickFrom!;
    pickFrom = null;
    hideBanner();

    const path = findPath(family, fromId, toId);
    const steps =
      path === null
        ? null
        : path.map((s) => {
          const person = personById.get(s.id)!;
          return { person, relation: relationWord(s.relation, person) };
        });

    showRelationship(personById.get(fromId)!, personById.get(toId)!, steps, (id) => navigate(id));
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("canvas");
  const world = document.createElementNS(SVG_NS, "g");
  svg.appendChild(world);
  document.querySelector("#app")!.appendChild(svg);

  const updateRuler = createRuler(svg, world);
  let currentOrigin = 0;
  let currentFocus: PersonId | null = null;
  let pickFrom: PersonId | null = null;
  type Mode = "family" | "ancestors";
  let currentMode: Mode = "family";
  let suppressClick = false;
  let lastLongPress = 0;
  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastLayout: Layout | null = null;

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

  function animateChange(
    before: Map<PersonId, [number, number]>,
    drawn: { id: PersonId; g: SVGGElement; box: Box }[]
  ) {
    const t = zoomTransform(svg);

    for (const { id, g, box } of drawn) {
      const old = before.get(id);
      if (old === undefined) {
        g.animate([{ opacity: 0, offset: 0 }], { duration: 350, delay: 150, fill: "backwards" });
        continue;
      }
      const [nx, ny] = t.apply([box.x, box.y]);
      const dx = (old[0] - nx) / t.k;
      const dy = (old[1] - ny) / t.k;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      g.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration: 500, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }

    for (const el of world.querySelectorAll<SVGElement>(".line, .person.ghost")) {
      el.animate([{ opacity: 0, offset: 0 }], { duration: 300, delay: 400, fill: "backwards" });
    }
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

    items.push({
      label: `How is ${person.name.en} related to…?`,
      action: () => startRelationPick(person.id),
    });

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

      if (pickFrom !== null) {
        e.stopPropagation();
        finishRelationPick(person.id);
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

    g.addEventListener(
      "touchend",
      (e) => {
        if (suppressClick) e.preventDefault();
      },
      { passive: false }
    );

    g.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - lastLongPress < 1000) return;
      hideTooltip();

      const fromKeyboard = e.clientX === 0 && e.clientY === 0;
      if (fromKeyboard) {
        const r = g.getBoundingClientRect();
        openMenuFor(person, r.right, r.top);
      } else {
        openMenuFor(person, e.clientX, e.clientY);
      }
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
        openMenuFor(person, startX + 16, startY - 16);
      }, 500);
    });

    g.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch") return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelPress();
    });
    g.addEventListener("pointerup", cancelPress);
    g.addEventListener("pointercancel", cancelPress);

    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (person.id === currentFocus) openBio(person.id);
        else navigate(person.id);
      }
    });
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

  function relative(id: PersonId, key: string): PersonId | undefined {
    const person = personById.get(id)!;
    const parents = family.parentsByChild.get(id) ?? [];

    switch (key) {
      case "ArrowUp":
        return (
          parents.find((p) => personById.get(p)?.houseBirth === person.houseBirth) ?? parents[0]
        );
      case "ArrowDown":
        return (family.childrenOf.get(id) ?? [])[0];
      case "ArrowLeft":
      case "ArrowRight": {
        if (parents.length === 0) return undefined;
        const siblings = family.childrenOf.get(parents[0]) ?? [];
        const i = siblings.indexOf(id);
        return siblings[i + (key === "ArrowLeft" ? -1 : 1)];
      }
      case "s":
      case "S":
        return (family.spousesOf.get(id) ?? [])[0];
    }
    return undefined;
  }

  function openHouse(houseId: HouseId) {
    showHouse(data, houseId, (id) => navigate(id));
  }

  const updateLegend = createLegend(applyHighlight, openHouse);

  function parseHash(): { id: PersonId; mode: Mode } | null {
    const [id, mode] = location.hash.slice(1).split("/");
    if (!personById.has(id)) return null;
    return { id, mode: mode === "ancestors" ? "ancestors" : "family" };
  }

  function navigate(id: PersonId, mode: Mode = currentMode) {
    const hash = mode === "ancestors" ? `#${id}/ancestors` : `#${id}`;
    if (location.hash === hash) render(id, mode);
    else location.hash = hash;
  }

  function render(focusId: PersonId, mode: Mode) {
    currentFocus = focusId;
    currentMode = mode;
    modeButton.textContent = mode === "ancestors" ? "Family" : "Ancestors";

    document.title = `${personById.get(focusId)!.name.en} · European Dynasties`;

    const before = new Map<PersonId, [number, number]>();
    if (motion && lastLayout !== null) {
      const t = zoomTransform(svg);
      for (const [id, box] of lastLayout.positions) before.set(id, t.apply([box.x, box.y]));
    }

    world.replaceChildren();
    hideTooltip();

    const layout =
      mode === "ancestors"
        ? computeAncestry(family, focusId, widths)
        : computeLayout(family, focusId, widths);

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

    const drawn: { id: PersonId; g: SVGGElement; box: Box }[] = [];
    for (const [id, box] of layout.positions) {
      const person = personById.get(id)!;
      const g = drawPerson(world, colors, person, box, { focus: id === focusId });
      attach(g, person);
      drawn.push({ id, g, box });
    }

    for (const b of layout.blocks) {
      for (const s of b.spouses) {
        if (!s.ghost) continue;
        const person = personById.get(s.id)!;
        attach(drawPerson(world, colors, person, s, { ghost: true }), person);
      }
    }

    for (const ghost of layout.ghosts) {
      const person = personById.get(ghost.id)!;
      attach(drawPerson(world, colors, person, ghost, { ghost: true }), person);
    }

    const focusBox = layout.positions.get(focusId);
    if (mode === "family" && focusBox !== undefined) centerOn(focusBox);
    else fitToView(lastWidth, lastHeight);

    const focusedNode = world.querySelector<SVGGElement>(`.person[data-id="${focusId}"]:not(.ghost)`);
    focusedNode?.focus({ preventScroll: true });
    updateLegend(colors, data);

    if (motion && lastLayout !== null) animateChange(before, drawn);
    lastLayout = layout;

  }

  const search = createSearch(data.people, (id) =>
    pickFrom !== null ? finishRelationPick(id) : navigate(id)
  );

  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (home.isOpen()) return;

    if (e.key === "/") {
      e.preventDefault();
      search.focus();
      return;
    }

    if (currentFocus === null) return;
    const next = relative(currentFocus, e.key);
    if (next !== undefined) {
      e.preventDefault();
      navigate(next);
    }
  });

  const about = createAbout(data);
  const home = createHome(data, (id) => navigate(id), () => about.show());

  const topButtons = document.createElement("div");
  topButtons.className = "top-buttons";

  const modeButton = document.createElement("button");
  modeButton.className = "home-button";
  modeButton.addEventListener("click", () => {
    if (currentFocus !== null) {
      navigate(currentFocus, currentMode === "ancestors" ? "family" : "ancestors");
    }
  });

  const homeButton = document.createElement("button");
  homeButton.className = "home-button";
  homeButton.textContent = "Dynasties";
  homeButton.addEventListener("click", () => home.show());

  const themeButton = createThemeButton();

  topButtons.append(themeButton, modeButton, homeButton);
  document.body.appendChild(topButtons);

  window.addEventListener("hashchange", () => {
    const target = parseHash();
    if (target !== null) {
      home.hide();
      render(target.id, target.mode);
    }
  });

  const initial = parseHash();
  if (initial !== null) {
    render(initial.id, initial.mode);
  } else {
    render("Q9439", "family");
    home.show();
  }

  window.addEventListener("resize", () => updateRuler(zoomTransform(svg), currentOrigin));
  hideLoading();
}

main().catch((err) => {
  console.error(err);
  showError("Could not load the dynasties. Check your connection and try again.");
});