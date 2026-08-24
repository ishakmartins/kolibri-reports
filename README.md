# kolibri-reports

Static index of published Kolibri reports. Deployed as a GitHub Pages project
site: <https://open.lokanetra.dev/kolibri-reports/>

This repo only hosts and lists reports — it does not run any analysis itself. Reports
are produced in the sibling [`kolibri`](https://github.com/ishakmartins/kolibri) repo
(`kolibri-analyze-v7.ipynb`) and exported here, the same split `kestrel` /
`kestrel-reports` already uses.

## Workflow

1. Export the finished report from `kolibri-analyze-v7.ipynb` and paste the exported
   folder into `reports/<slug>/` (slug = the packet's report-page slug, e.g.
   `reports/gibran-&-ntt-20260824/`). The notebook already writes this repo's CMS row
   for the packet (see below) — this paste is the one step it doesn't automate.
2. Commit and push to `main`.
3. The Action runs `scripts/cms.py` (xlsx → JSON, stages report folders), builds
   Astro, and deploys to Pages.
4. Live a minute later at `/kolibri-reports/<slug>/`.

## The CMS

`cms/packets.xlsx`, sheet `packets`, columns in this exact order:

`Date published | Keywords | Date start | Date end | Analysis | Volume (collected) | Total estimated engagement`

- `Analysis` is a `reports/<slug>/` folder name, or blank — a blank cell renders
  `REPORT NOT AVAILABLE` instead of a link (e.g. a packet whose report-page build
  failed that run).
- Rows sharing the same `Date published` are grouped under one rowspan'd date cell
  on the homepage.
- `Date start`/`Date end` default to the GMT+7 (Asia/Jakarta) timestamp, to the
  minute, of the earliest and latest record in the packet's source CSV — computed
  and written by `kolibri-analyze-v7.ipynb` itself, not hand-entered.

Dates may be real Excel dates, serial numbers, or strings (`2026-03-14`,
`14 March 2026`, `01/02/2026` = D/M/Y; `Date start`/`Date end` also accept
`2026-03-14 09:30`). The build normalises them and sorts the table newest first. A
wrong header row fails the build loudly.

`cms/packets.xlsx` is written directly by `kolibri-analyze-v7.ipynb`'s
`build_and_record_cms()` (in the sibling `kolibri` repo) every run — it upserts a
packet's row keyed on `(Date published, Analysis)`, so a same-day re-run overwrites
in place instead of duplicating. Hand-edit it only to fix a bad row.

## Report folders

`reports/<slug>/` is copied verbatim into `public/<slug>/` before the build, so Astro
ships it untouched: no processing, no rewriting, vendored assets intact. The mapping is
folder-name driven; the spreadsheet only supplies the link text. Staged copies under
`public/` are generated and gitignored, apart from `fonts/` and `.nojekyll`.

Each `reports/<slug>/` is a self-contained bundle (`index.html` + `assets/` + vendored
JS, no `fetch()`, openable over `file://`) built by `kolibri-analyze-v7.ipynb`'s
report-page step and pasted in per the Workflow above.

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
