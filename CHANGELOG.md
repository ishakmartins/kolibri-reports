# Changelog

## 2026-08-24 — initial scaffold

- Astro static site, `base: /kolibri-reports`, `site: https://open.lokanetra.dev` —
  scaffolded directly from `kestrel-reports`' verified structure (same CMS/staging
  mechanism, same Pages workflow, same dark/light shell), swapping Kestrel-specific
  copy for Kolibri's.
- `cms/reports.xlsx` (sheet `reports`, columns `UUID | Title | Date published |
  Report Page link | DOI | Kolibri version`) as the only content source — header row
  only, no reports yet.
- `scripts/cms.py`: validates the header, normalises Excel serials / dates / strings to
  ISO, sorts newest first, writes `src/data/reports.json`, and stages `reports/<slug>/`
  into `public/<slug>/` so Astro copies each export verbatim. `--test` runs a
  date-parsing self-check.
- Homepage: h1, intro paragraph describing Kolibri's inauthentic-amplification-
  detection reports, reports table (empty state: "No reports published yet."),
  dark/light toggle, bordered footer strip. Custom 404 in the same shell.
- Fonts: `public/fonts/{AlteHaasGroteskRegular,AlteHaasGroteskBold}.woff2` copied from
  `kestrel-reports/public/fonts/` (shared Lokanetra brand font) rather than
  reconverted from TTF — see `public/fonts/README.md` for the regenerate command if
  the source TTFs are ever updated.
- `reports/` starts empty (`.gitkeep` only) — `kolibri-analyze.ipynb` has no
  report-export step yet that produces the self-contained bundle shape this repo
  expects to stage; that's a follow-up in the `kolibri` repo, not this one.
- `.github/workflows/deploy.yml`: push to main → cms → build → `actions/deploy-pages`.
  `public/.nojekyll` included.
- `.gitignore`: ignores all of `public/` except `fonts/` and `.nojekyll` (staged report
  slugs are generated, not source), plus Excel's `cms/~$*` lock files and the
  generated `src/data/reports.json`.
