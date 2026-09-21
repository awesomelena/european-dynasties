import "./styles/tokens.css";
import { SVG_NS } from "./constants";
import { loadData } from "./data/loader";
import { buildFamily } from "./data/family";
import { computeLayout, subtreeWidth } from "./layout/positions";
import { drawUnions, drawParentage } from "./render/lines";
import { drawPerson } from "./render/person";

async function main() {
  const data = await loadData();

  const svg = document.createElementNS(SVG_NS, "svg");

  const { childrenOf, spouseOf } = buildFamily(data);
  const treeWidth = subtreeWidth("victoria", childrenOf, spouseOf);
  svg.setAttribute("width", String(treeWidth + 40));
  svg.setAttribute("height", "900");

  document.querySelector("#app")!.appendChild(svg);

  const positions = computeLayout(data);

  drawUnions(svg, data, positions);
  drawParentage(svg, data, positions);

  for (const person of data.people) {
    const pos = positions.get(person.id);
    if (pos === undefined) continue;

    drawPerson(svg, data, person, pos);
  }
}

main();