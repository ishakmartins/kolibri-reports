"""CMS build step: cms/packets.xlsx -> src/data/packets.json, and stage
reports/<slug>/ into public/<slug>/ so Astro copies them verbatim. <slug> is the
"Analysis" column, which is what the homepage links to.

Run before `astro build` (npm run build does it).
"""
import json
import shutil
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COLUMNS = ["Date published", "Keywords", "Date start", "Date end", "Analysis",
           "Volume (collected)", "Total estimated engagement"]
KEYS = ["published", "keywords", "dateStart", "dateEnd", "analysis",
        "volume", "totalEngagement"]
EXCEL_EPOCH = date(1899, 12, 30)  # Excel serial 1 == 1900-01-01, with the 1900 leap bug


def norm_date(v, keep_time=False):
    """Excel serial, datetime, date, or string -> ISO YYYY-MM-DD (keep_time=False) or
    'YYYY-MM-DD HH:MM' (keep_time=True). Unparseable passes through. "Date published"
    is always date-only; "Date start"/"Date end" keep the GMT+7 hour:minute
    kolibri-analyze-v7.ipynb writes -- keep_time=True for those two columns only."""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M") if keep_time else v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        base = datetime.combine(EXCEL_EPOCH, datetime.min.time()) + timedelta(days=v)
        return base.strftime("%Y-%m-%d %H:%M") if keep_time else base.date().isoformat()
    s = str(v or "").strip()
    formats = (("%Y-%m-%d %H:%M",) if keep_time else ()) + (
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d %B %Y", "%B %d, %Y", "%Y/%m/%d")
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d %H:%M") if (keep_time and fmt == "%Y-%m-%d %H:%M") else dt.date().isoformat()
        except ValueError:
            pass
    return s  # ponytail: unknown formats sort lexically; add a parser when one shows up


def read_rows(xlsx):
    from openpyxl import load_workbook

    ws = load_workbook(xlsx, data_only=True)["packets"]
    header = [str(c.value).strip() if c.value else "" for c in ws[1]]
    if header[: len(COLUMNS)] != COLUMNS:
        sys.exit(f"cms: sheet 'packets' header must be {COLUMNS}, got {header}")
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not any(r):
            continue
        row = dict(zip(KEYS, [("" if v is None else v) for v in r[: len(KEYS)]]))
        row["published"] = norm_date(r[0])
        row["dateStart"] = norm_date(r[2], keep_time=True) if r[2] else ""
        row["dateEnd"] = norm_date(r[3], keep_time=True) if r[3] else ""
        row["analysis"] = str(row["analysis"]).strip()
        row["keywords"] = str(row["keywords"]).strip()
        row["volume"] = int(row["volume"]) if row["volume"] != "" else 0
        row["totalEngagement"] = int(row["totalEngagement"]) if row["totalEngagement"] != "" else 0
        rows.append(row)

    rows.sort(key=lambda x: x["published"], reverse=True)
    prev_date = None
    for row in rows:
        row["isFirstOfDate"] = row["published"] != prev_date
        prev_date = row["published"]
    for row in rows:
        if row["isFirstOfDate"]:
            row["dateRowSpan"] = sum(1 for r in rows if r["published"] == row["published"])
    return rows


def stage_reports(src, out):
    slugs = [d for d in sorted(src.glob("*")) if d.is_dir()]
    for d in slugs:
        shutil.rmtree(out / d.name, ignore_errors=True)
        shutil.copytree(d, out / d.name)
    return [d.name for d in slugs]


def main():
    rows = read_rows(ROOT / "cms" / "packets.xlsx")
    (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "data" / "packets.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    slugs = stage_reports(ROOT / "reports", ROOT / "public")
    print(f"cms: {len(rows)} rows, {len(slugs)} report folders {slugs}")


def test():
    assert norm_date(45000) == "2023-03-15", norm_date(45000)
    assert norm_date(datetime(2026, 2, 1, 9, 30)) == "2026-02-01"
    assert norm_date(date(2026, 2, 1)) == "2026-02-01"
    assert norm_date("2026-02-01") == "2026-02-01"
    assert norm_date("01/02/2026") == "2026-02-01"
    assert norm_date("14 March 2026") == "2026-03-14"
    assert norm_date(None) == ""
    # keep_time=True: Date start/Date end preserve GMT+7 hour:minute
    assert norm_date(datetime(2026, 2, 1, 9, 30), keep_time=True) == "2026-02-01 09:30"
    assert norm_date(datetime(2026, 2, 1, 0, 0), keep_time=True) == "2026-02-01 00:00"
    assert norm_date("2026-02-01 09:30", keep_time=True) == "2026-02-01 09:30"
    assert norm_date(45000.375, keep_time=True) == "2023-03-15 09:00"  # fractional serial day -> time-of-day
    assert norm_date(45000, keep_time=True) == "2023-03-15 00:00"
    print("ok")


if __name__ == "__main__":
    test() if "--test" in sys.argv else main()
