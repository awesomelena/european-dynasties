import type { Dataset } from "../types";
import { registerLayer } from "./layers";

export function createAbout(data: Dataset) {
  const overlay = document.createElement("div");
  overlay.className = "home about";

  const inner = document.createElement("div");
  inner.className = "home-inner about-inner";

  const fmt = (n: number) => n.toLocaleString("en");
  const people = data.people.length;
  const estimated = data.people.filter((p) => p.bornEstimated).length;
  const withWiki = data.people.filter((p) => p.wiki !== undefined).length;
  const countries = data.countries?.length ?? 0;
  const dynasties = new Set((data.countries ?? []).flatMap((c) => c.houses)).size;
  const pct = (n: number) => Math.round((n / people) * 100);

  inner.innerHTML = `
    <button class="home-back about-close">← Back</button>
    <h1>About the data</h1>

    <h2>At a glance</h2>
    <ul>
      <li><strong>${fmt(people)}</strong> people, ${fmt(data.houses.length)} houses, ${fmt(data.unions.length)} marriages</li>
      <li><strong>${countries}</strong> countries and <strong>${dynasties}</strong> featured dynasties</li>
      <li><strong>${fmt(estimated)}</strong> birth years estimated (${pct(estimated)}%), shown as <em>c. 1045</em></li>
      <li><strong>${fmt(withWiki)}</strong> people with a Wikipedia article (${pct(withWiki)}%)</li>
    </ul>

    <h2>Sources</h2>
    <p>Family relations, dates, houses and titles come from <a href="https://www.wikidata.org/" target="_blank" rel="noopener">Wikidata</a>, the free knowledge base behind Wikipedia. Biographies and portraits are loaded from <a href="https://en.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> when a biography is opened.</p>

    <h2>What is included</h2>
    <p>The data starts from the members of the ruling houses of the great European powers and the Balkans, including Byzantium, and from the holders of their royal and imperial titles, born from the 10th century onward. From each of them it follows one step of family relations - parents, children and spouses - so that families are complete around every ruler.</p>

    <h2>How the data is prepared</h2>
    <ul>
      <li><strong>House of birth</strong> is the house a person shares with their father. Wikidata often lists several houses per person.</li>
      <li><strong>House by marriage</strong> is the spouse's house of birth.</li>
      <li><strong>Houses with the same name</strong> are shown as one, even when Wikidata keeps separate entries for different branches.</li>
      <li><strong>The main title</strong> under a name is the highest-ranking one - sovereign, then grand duke, then duke or prince - and among equals, the one held longest. Titles of secondary realms, such as Commonwealth realms, rank lower.</li>
      <li><strong>Stepparents and adoptive parents</strong> are left out where Wikidata marks them as such.</li>
    </ul>

    <h2>Estimates and uncertainty</h2>
    <p>Dates known only to the decade or century are treated as unknown. A missing birth year is then estimated from relatives: from a spouse, from the eldest child, from a parent, or as a last resort from the year of death. The estimate is kept consistent with what is known - at least 15 years after a parent, 15 years before a child, and not after the person's own death. Estimated years are always marked with <em>c.</em>.</p>
    <p>Vertical position follows year of birth, but spouses are aligned with their partner and a child is always drawn below its parents, so some people sit slightly away from their exact year on the ruler.</p>

    <h2>Known limitations</h2>
    <ul>
      <li>Wikidata contains errors - wrong parents, merged people with the same name, impossible dates. An automated check flags many of them, and some are corrected by hand, but not all.</li>
      <li>Where parentage is historically disputed, only one version may appear.</li>
      <li>The order of marriages relies on marriage dates where known, otherwise on the birth of the first child.</li>
      <li>Houses are grouped by name, so a few unrelated families that share a name may appear as one.</li>
    </ul>

    <h2>Found a mistake?</h2>
    <p>The best fix is on Wikidata itself - anyone can edit it, and the correction then reaches every project that uses the data. You can also report it as an <a href="https://github.com/awesomelena/european-dynasties/issues" target="_blank" rel="noopener">issue on GitHub</a>.</p>

    <h2>Licenses</h2>
    <p>Wikidata content is available under CC0. Wikipedia text and images are shown under their own licenses, with a link to the source. The fonts Silkscreen and Pixelify Sans are available under the SIL Open Font License. The site's code is released under the MIT License.</p>
  `;

  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  function show() {
    overlay.style.display = "flex";
    overlay.scrollTop = 0;
  }

  function hide() {
    overlay.style.display = "none";
  }

  inner.querySelector(".about-close")!.addEventListener("click", hide);

  registerLayer({
    priority: 85,
    isOpen: () => overlay.style.display === "flex",
    close: hide,
  });

  return { show, hide };
}