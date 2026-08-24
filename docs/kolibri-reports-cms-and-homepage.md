# Claude Code Prompt — Kolibri-Reports homepage + packets CMS

Paste everything below the `---` into Claude Code, run from the root of the
**`kolibri-reports`** checkout (sibling of `kestrel-reports` and `kolibri` on
this machine). Part 2 at the bottom is a separate prompt to run inside the
**`kolibri`** checkout — it touches a different repo, so it cannot be done in
the same Claude Code session as Part 1.

---

## Part 1 — `kolibri-reports` repo (run this one first)

### Context

This repo is a static Astro site (`base: /kolibri-reports`, deployed to
`https://open.lokanetra.dev/kolibri-reports/`) that only hosts and lists
reports produced by the sibling `kolibri` repo's `kolibri-analyze-v7.ipynb`.
It was scaffolded from `kestrel-reports`'s structure and currently still uses
kestrel-reports' original schema: a flat `UUID | Title | Date published |
Report Page link | DOI | Kolibri version` table, one row per report, backed
by `cms/reports.xlsx` and built by `scripts/cms.py`.

A more advanced version of this exact idea already exists and works, just in
the wrong place: `kolibri/site/` (a throwaway preview site inside the
`kolibri` repo, deployed to `https://ishakmartins.github.io/kolibri/`, not a
production URL). It already implements everything this task asks for —
grouped "packets" table, `cms/packets.xlsx` CMS, GMT+7-aware date handling,
the Kestrel-Trending callout — for **that repo's own** reports. Your job is
to port that same design into `kolibri-reports` so the tables/keywords model
is called "PACKETS" everywhere for consistency, replacing the old
UUID/Title/DOI schema entirely.

Reference implementation to study before changing anything (read, don't
copy verbatim — the two repos' layouts differ slightly):

- `../kolibri/site/src/pages/index.astro` (table markup, `.callout` styling,
  `REPORT NOT AVAILABLE` fallback)
- `../kolibri/site/src/data/packets.json` (shape the build step must produce,
  including `isFirstOfDate` / `dateRowSpan` for the grouped date cell)
- `../kolibri/scripts/cms.py` (the `read_rows` / `norm_date(keep_time=...)` /
  grouping logic — this repo's `scripts/cms.py` needs the same logic, adapted
  to this repo's flat layout, i.e. no `site/` subdirectory)

Two report bundles already sit in `reports/` in *this* repo
(`reports/gibran-&-ntt-20260824/`, `reports/kesejahteraan-guru-2026-08-22-20260824/`)
— they're already the self-contained `index.html` + `assets/` + `*.js` shape
`scripts/cms.py`'s `stage_reports()` copies verbatim into `public/`. Don't
touch these bundles.

### Changes

1. **`cms/reports.xlsx` → `cms/packets.xlsx`.** Rename the file and its sheet
   (`reports` → `packets`). Replace the header row with:

   `Date published | Keywords | Date start | Date end | Analysis | Volume (collected) | Total estimated engagement`

   Seed it with these two rows — the actual computed values for the two
   report bundles already staged in `reports/`, taken from
   `../kolibri/site/src/data/packets.json` (the notebook already computed
   these for the same two packets):

   | Date published | Keywords | Date start | Date end | Analysis | Volume (collected) | Total estimated engagement |
   |---|---|---|---|---|---|---|
   | 2026-08-24 | Gibran Peduli NTT, #PRAYFORNTT, wapres gibran, #bantuanNTT, #GempaNTT | 2026-08-18 07:08 | 2026-08-22 17:52 | gibran-&-ntt-20260824 | 28253 | 4160126 |
   | 2026-08-24 | kesejahteraan guru indonesia | 2026-08-19 23:42 | 2026-08-21 08:18 | kesejahteraan-guru-2026-08-22-20260824 | 433 | 217094 |

   Write `Date published` as a real Excel date and `Date start`/`Date end` as
   real Excel datetimes (not strings), matching how `../kolibri/pipeline/cms.py`
   writes them (see Part 2) — that's what `scripts/cms.py`'s `norm_date` is
   built to round-trip.

2. **`scripts/cms.py`** — rewrite `read_rows`/`norm_date` to match
   `../kolibri/scripts/cms.py`:
   - `norm_date(v, keep_time=False)`: `Date published` stays date-only;
     `Date start`/`Date end` need `keep_time=True` (GMT+7 hour:minute
     precision — see Part 2 for where that precision comes from).
   - New `COLUMNS`/`KEYS` for the packets schema (see step 1).
   - After sorting by `published` descending, compute `isFirstOfDate` and
     `dateRowSpan` per row exactly as `../kolibri/scripts/cms.py` does, so the
     Astro template can rowspan same-date rows together without recomputing
     grouping logic in the template.
   - Keep this repo's existing `stage_reports()` (copies `reports/<slug>/`
     into `public/<slug>/`) — optionally also port the `.staged-reports.json`
     stale-slug cleanup `../kolibri/scripts/cms.py` added, since this repo's
     version doesn't have it yet, but that's a nice-to-have, not required.
   - Output path: `src/data/packets.json` (rename from `reports.json`).
   - Update the `--test` self-check block for the new `keep_time` cases
     (copy `../kolibri/scripts/cms.py`'s `test()`).

3. **`src/pages/index.astro`**:
   - Import `packets` from `../data/packets.json` instead of `reports` from
     `../data/reports.json`.
   - Add a callout paragraph right after the intro, linking Kolibri to
     Kestrel-Trending. Reuse the exact copy already written in
     `../kolibri/site/src/pages/index.astro`:

     ```astro
     <p class="callout">
       Kolibri is best paired with
       <a href="https://open.lokanetra.dev/kestrel-trending/">Kestrel-Trending</a>.
     </p>
     ```

   - Replace the whole table (`UUID | Title | Date published | Report Page |
     DOI | Kolibri version`) with the packets table:

     `Date published | Keywords | Date start | Date end | Analysis | Volume (collected) | Total estimated engagement`

     Port the row markup verbatim from `../kolibri/site/src/pages/index.astro`:
     rowspan the `Date published` cell using `p.isFirstOfDate`/`p.dateRowSpan`,
     render `Analysis` as `<a href={`${base}/${p.analysis}/`}>Open report</a>`
     when present, else the literal text `REPORT NOT AVAILABLE`, and
     `.toLocaleString()` the two numeric columns.
   - Add the same scoped `<style>` block (`.callout`, `td.num`) from
     `../kolibri/site/src/pages/index.astro` at the bottom of the file, since
     `src/layouts/Base.astro` doesn't have `.callout`/`td.num` rules yet (it
     does already have `td.date` — leave that alone).
   - Empty-state text: change `{packets.length === 0 && <p class="empty">No
     packets published yet.</p>}`.

4. **`src/data/reports.json`** → delete (replaced by the generated
   `src/data/packets.json`).

5. **`.gitignore`** — update the generated-file line from
   `src/data/reports.json` to `src/data/packets.json`.

6. **`README.md`** — rewrite the "The CMS" and "Workflow" sections to
   describe the new `cms/packets.xlsx` schema, the same way
   `../kolibri/README.md` documents `cms/packets.xlsx` for that repo. Cover:
   - The 7-column header, in order, and that `Analysis` is a `reports/<slug>/`
     folder name (unchanged mechanic from today) or blank →
     `REPORT NOT AVAILABLE`.
   - Rows sharing a `Date published` are grouped under one rowspan'd cell.
   - `Date start`/`Date end` default to the GMT+7 timestamp of the earliest
     and latest record in the packet's source CSV — computed and written by
     `kolibri-analyze-v7.ipynb`, not hand-entered (cross-reference Part 2
     below and note that this repo's copy of `cms/packets.xlsx` is now
     written by that notebook directly, not hand-edited except to fix a bad
     row).
   - Keep the existing "paste the exported folder into `reports/<slug>/`"
     step — Part 2 only automates the CMS row, not the report-bundle copy.

7. **`CHANGELOG.md`** — add a dated entry summarizing this change (packets
   schema, grouped table, Kestrel-Trending callout, notebook write-authority).

### Verification

- `python scripts/cms.py --test` passes.
- `npm run build` succeeds and `dist/index.html` (or the dev server) shows:
  a two-row table grouped under one `2026-08-24` date cell, both rows' Analysis
  linking into their respective `reports/<slug>/` folders, and the
  Kestrel-Trending callout rendered under the intro paragraph.
- Confirm no leftover references to `reports.json`, `cms/reports.xlsx`, or the
  old UUID/Title/DOI columns remain anywhere in `src/`, `scripts/`, `README.md`.

---

## Part 2 — `kolibri` repo (separate Claude Code session, different checkout)

### Context

`kolibri/pipeline/cms.py` already has a working, parameterized writer —
`upsert_packet_row(packet_id, row, xlsx_path=DEFAULT_XLSX_PATH)` — that gives
`kolibri-analyze-v7.ipynb` authority to create/upsert its own
`kolibri/cms/packets.xlsx` every run (sheet `packets`, keyed by
`(Date published, Analysis)`, never raises on a locked file). It's called
once per packet from `build_and_record_cms()` in
`scripts/build_notebook_analyze_v7.py` (~line 745), which also computes
`Date start`/`Date end` in GMT+7 down to the minute from the packet's own
tweet timestamps (`pipeline/reportpage.py`'s `gmt7_datetime_bounds` /
`to_gmt7_minute_str` — earliest record → `Date start`, latest record → `Date
end`). That machinery already satisfies the "Date start/Date end default to
GMT+7 based on earliest/latest record" requirement; nothing there needs to
change.

What's missing: that authority only reaches `kolibri`'s own
`cms/packets.xlsx` (feeding its throwaway `kolibri/site/` preview). It needs
to also reach the sibling **`kolibri-reports`** repo's `cms/packets.xlsx`
(the production CMS from Part 1), which currently has to be hand-edited per
the (soon to be updated) `kolibri-reports/README.md` workflow.

### Change

In `scripts/build_notebook_analyze_v7.py`, inside `build_and_record_cms()`
(where it currently does `upsert_packet_row(packet_id, row)`), add a second
upsert into the sibling repo, using the same `row` dict:

```python
KOLIBRI_REPORTS_XLSX = Path("../kolibri-reports/cms/packets.xlsx")
...
upsert_packet_row(packet_id, row)
if KOLIBRI_REPORTS_XLSX.parent.exists():
    upsert_packet_row(packet_id, row, xlsx_path=KOLIBRI_REPORTS_XLSX)
```

Notes:

- `upsert_packet_row` already handles "file doesn't exist yet" (creates it
  with the header row) and never raises on a write failure — it logs a
  warning and continues, matching the note in `pipeline/cms.py`'s docstring
  that a CMS write failure must never discard `summary.json`. The
  `KOLIBRI_REPORTS_XLSX.parent.exists()` guard is just so a checkout that
  doesn't have `kolibri-reports` cloned as a sibling (e.g. CI) skips the
  second write instead of creating a stray `../kolibri-reports/` directory
  tree outside the repo.
- Keep this path relative and resolved the same way `PACKETS`' `csv_path`
  already is documented to be (repo-root-relative, notebook runs with
  `cwd` = repo root) — don't hardcode an absolute Windows path.
- `Analysis` in `row` still only gets a real slug when `build_report_page`
  ran successfully this run (unchanged `build_and_record_cms` logic); when
  it's empty, `kolibri-reports`'s table will correctly show "REPORT NOT
  AVAILABLE" for that row once Part 1 lands, with no further change needed
  here.
- This does **not** copy the `reports/<slug>/` report-bundle folder into
  `kolibri-reports/reports/` — that stays a manual "paste the exported
  folder" step per `kolibri-reports/README.md`, unless you want to extend
  this further (out of scope for this prompt; flag it back if wanted).
- Update `scripts/test_build_notebook_analyze_v7.py` and `CHANGELOG.md` to
  cover the second upsert (a fake `../kolibri-reports/cms/` sibling dir in
  the test fixture is enough to assert the second file gets written/updated).
- `PACKETS` in Section 1 of this same script already matches the two packets
  this task names (`Gibran & NTT`, `kesejahteraan-guru-2026-08-22`) — no
  change needed there.

### Verification

- Re-run (or re-generate + re-run) the notebook against the two existing
  `PACKETS` entries with a `kolibri-reports` sibling checkout present, and
  confirm `kolibri-reports/cms/packets.xlsx` picks up both rows with the same
  values already seeded manually in Part 1, step 1 — i.e. re-running the
  notebook should be idempotent against that seed data (same
  `(Date published, Analysis)` key ⇒ upsert in place, not a duplicate row).
- Confirm the existing `kolibri/cms/packets.xlsx` (and `kolibri/site/`) still
  build and upsert exactly as before — this change is additive only.
