import "./styles/tokens.css";
import "./styles/tooltip.css";
import { SVG_NS } from "./constants";
import { loadData } from "./data/loader";
import { buildFamily } from "./data/family";
import { computeLayout, subtreeWidth } from "./layout/positions";
import { drawUnions, drawParentage } from "./render/lines";
import { drawPerson } from "./render/person";
import { showTooltip, moveTooltip, hideTooltip, personLines } from "./render/tooltip";

async function main() {
  const data = await loadData();

  const rootId = "victoria";

  const svg = document.createElementNS(SVG_NS, "svg");

  const { childrenOf, spouseOf } = buildFamily(data);
  const treeWidth = subtreeWidth(rootId, childrenOf, spouseOf);
  svg.setAttribute("width", String(treeWidth + 40));
  svg.setAttribute("height", "900");

  document.querySelector("#app")!.appendChild(svg);

  const positions = computeLayout(data, rootId);

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
  }
}

main();