# European Dynasties

Interactive family trees of Europe's royal, imperial and noble houses. Follow marriages and descendants across dynasties, see who was born into which house and who married into it, and read each person's biography - all built on open data from Wikidata and Wikipedia.

XOXO Gossip Girl

**Live site:** https://awesomelena.github.io/european-dynasties/

![Screenshot of the family tree](docs/screenshot.png)

## Features

- **Genealogy-specific layout.** A custom layout algorithm guarantees the two rules family trees need: spouses always stand side by side, and children are ordered by birth.
- **Time axis.** Vertical position follows year of birth, so generations and age gaps are visible at a glance.
- **Neighbourhood view.** The tree shows the surroundings of one focused person - parents, siblings, children and grandchildren. Click anyone to recentre and walk up or down the family.
- **Houses in colour.** A person's fill shows the house they were born into; the border shows the house they married into. Colours are assigned per view, and a legend explains them.
- **Cousin marriages without clutter.** When both spouses already appear in the tree, the partner is shown as a faded, dashed copy next to their spouse instead of drawing a long line across the whole tree.
- **Search.** Find anyone by name or title (e.g. "duke albany"), with accent-insensitive matching.
- **House highlighting.** Click a house in the legend to highlight its members, or open a full list of everyone born or married into it.
- **Biographies.** Portrait and introduction from Wikipedia, plus titles with dates, parents, spouse and children as clickable links.
- **Zoom and pan** with the mouse wheel, trackpad pinch, touch gestures, or on-screen buttons.

## How it works

The site is fully static - there is no backend. Data is prepared ahead of time by two scripts and shipped as a JSON file.

```
Wikidata (SPARQL)
      │  npm run fetch:wikidata
      ▼
scripts/raw/*.json        raw data, stored as received
      │  npm run transform
      ▼
public/data/*.json        clean dataset the site loads
      │
      ▼
browser: layout → SVG rendering
```

Fetching and transforming are deliberately separate. The fetch script only collects data and makes no decisions; all interpretation happens in `transform.ts`. Changing a rule therefore only requires re-running the transform, not downloading everything again.

Rules applied during the transform include:

- **House of birth** is the house a person shares with their father (royal houses pass through the male line); Wikidata often lists several.
- **House by marriage** is derived from the spouse's house of birth.
- **Houses with identical names** are merged, since Wikidata sometimes has separate entries for branches of the same dynasty.
- **Names and titles** are split from Wikidata labels ("Prince Arthur, Duke of Connaught" → *Arthur* / *Duke of Connaught*), and the main title is chosen by rank (sovereign → grand duke → duke/prince), then by date.

Wikipedia summaries are not stored; they are fetched in the browser only when a biography is opened, and cached for the session.

## Tech stack

- **TypeScript** - shared types between the site and the data scripts
- **Vite** - dev server and build
- **SVG** - rendering, without a UI framework
- **d3-zoom** - zoom and pan gestures
- **tsx** - running the TypeScript data scripts in Node
- **GitHub Actions + GitHub Pages** - automatic build and deploy on every push to `main`

## Project structure

```
├── public/data/          dataset loaded by the site
├── scripts/
│   ├── fetch-wikidata.ts downloads raw data from Wikidata
│   ├── transform.ts      turns raw data into the site's dataset
│   └── raw/              raw Wikidata responses
└── src/
    ├── main.ts           entry point: wiring, rendering, zoom
    ├── types.ts          data model shared with the scripts
    ├── constants.ts      sizes, fonts, palette
    ├── data/             loading and family lookups
    ├── layout/           the family-tree layout algorithm
    ├── render/           drawing people, lines, colours, tooltip
    ├── ui/               search, legend, menu, side panel
    └── styles/           CSS, with heraldic colour tokens in tokens.css
```

## Getting started

Requires Node.js (LTS).

```bash
npm install
npm run dev
```

Then open http://localhost:5173/european-dynasties/

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build the site into `dist/` (the same check CI runs) |
| `npm run preview` | Serve the production build locally |
| `npm run fetch:wikidata` | Download fresh raw data from Wikidata |
| `npm run transform` | Rebuild `public/data/` from the raw data |

## Data and licensing

- Genealogical data comes from **[Wikidata](https://www.wikidata.org/)**, available under CC0.
- Biographies and portraits come from **[Wikipedia](https://en.wikipedia.org/)** and are shown under CC BY-SA, with a link to the source article.
- Much of the structure (houses, main titles, name splitting) is inferred by rules, so some entries will be imperfect. Corrections to the underlying facts are best made on Wikidata itself.

## Roadmap

- Extend the data beyond Queen Victoria's family to Europe's ruling houses from the 10th century onward
- Split the dataset so only the needed part is loaded
- Country and dynasty menu on the start page
- Heraldic visual design
- Animated transitions when recentring
- Better display of people with several marriages

## License

The code is released under the [MIT License](LICENSE). This applies to the source code only — data from Wikidata and text from Wikipedia keep their own licenses, described above.
