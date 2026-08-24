# Fonts

Alte Haas Grotesk (freeware, by Yann Le Coroller) — the shared Lokanetra brand font,
copied here from `kestrel-reports/public/fonts/` for consistency across Open Lokanetra
Products sites. Two woff2 files ship from here and `src/layouts/Base.astro` loads them
by exact name:

```
public/fonts/AlteHaasGroteskRegular.woff2
public/fonts/AlteHaasGroteskBold.woff2
```

The TTF originals and the licence live in `kestrel-reports/cms/fonts/` (not duplicated
here). Regenerate the woff2 from them after a font update:

```bash
# pip install fonttools brotli
cd public/fonts
python -m fontTools.ttLib.woff2 compress <path-to>/AlteHaasGroteskRegular.ttf
python -m fontTools.ttLib.woff2 compress <path-to>/AlteHaasGroteskBold.ttf
```

Delete the woff2 and the site falls back to Helvetica Neue / Arial. Nothing breaks,
`font-display:swap` keeps text visible either way.
