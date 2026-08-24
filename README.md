# kolibri-reports

Static index of published Kolibri reports. Deployed as a GitHub Pages project
site: <https://open.lokanetra.dev/kolibri-reports/>

This repo only hosts and lists reports — it does not run any analysis itself. Reports
are produced in the sibling [`kolibri`](https://github.com/ishakmartins/kolibri) repo
(`kolibri-analyze.ipynb`) and exported here, the same split `kestrel` /
`kestrel-reports` already uses.

## Workflow

1. Export the finished report from `kolibri-analyze.ipynb` and paste the exported
   folder into `reports/<slug>/` (slug = the digits after `zenodo.`, e.g.
   `reports/21876131/`).
2. Add a row to `cms/reports.xlsx`, sheet `reports` — `Report Page link` must be the
   slug (`21876131`), which is what the table's "Open report" link uses. `DOI` is
   separate: it only feeds the outbound `https://doi.org/...` link.
3. Commit and push to `main`.
4. The Action runs `scripts/cms.py` (xlsx → JSON, stages report folders), builds
   Astro, and deploys to Pages.
5. Live a minute later at `/kolibri-reports/<slug>/`.

## The CMS

`cms/reports.xlsx`, sheet `reports`, columns in this exact order:

`UUID | Title | Date published | Report Page link | DOI | Kolibri version`

Dates may be real Excel dates, serial numbers, or strings (`2026-03-14`,
`14 March 2026`, `01/02/2026` = D/M/Y). The build normalises them and sorts the
table newest first. A wrong header row fails the build loudly.

## Report folders

`reports/<slug>/` is copied verbatim into `public/<slug>/` before the build, so Astro
ships it untouched: no processing, no rewriting, vendored assets intact. The mapping is
folder-name driven; the spreadsheet only supplies the link text. Staged copies under
`public/` are generated and gitignored, apart from `fonts/` and `.nojekyll`.

**`reports/` is currently empty** (`.gitkeep` only) — `kolibri-analyze.ipynb` doesn't
yet have an export step that produces this self-contained report-bundle shape
(`index.html` + `assets/` + `data/*.js`, no `fetch()`, openable over `file://`). That's
a separate follow-up in the `kolibri` repo, not part of this scaffold.

`astro dev` serves `public/` verbatim and will not resolve `<slug>/` to its `index.html`,
so `astro.config.mjs` adds a dev-only vite middleware that does. The built site needs no
such help.

## Local

```bash
pip install openpyxl
npm install
npm run dev      # or: npm run build && npm run preview
python scripts/cms.py --test   # date-normalisation self-check
```

## Edit points

- Intro paragraph: `src/pages/index.astro`, marked `<!-- EDIT: intro paragraph -->`
- Dataset citation DOI in the footer: `src/layouts/Base.astro`, marked `<!-- EDIT: dataset DOI -->`
- Fonts: see `public/fonts/README.md`

## Pages setup (once)

Repo Settings → Pages → Source: **GitHub Actions**. The custom domain is
inherited from the `open.lokanetra.dev` user/org site; leave it blank here.
