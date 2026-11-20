# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/BIDGDCB/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/BIDGDCB/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A free, offline web app that turns any photo and a caption into GTA 6-style
cover art — the multi-panel poster look with a Vice City sunset / neon grade —
and exports it as a PNG to share. Built for [make.fun's bounty](https://make.fun/bounty/gta6-cover-art-01). No upload, no account, no network: photos
stay on your machine.

## How to use

1. Serve `app/` with any static server, e.g. `node serve.ts`, and open
   http://localhost:8080.
2. Add your photos (or use the two bundled samples), pick a layout and a
   colour grade, type a title and a script subtitle.
3. Click a panel in the preview to select it, drag to move its photo, scroll
   to zoom. Click a thumbnail in the filmstrip to place that photo in the
   selected panel.
4. Export a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080 — or all three at
   once.

## What it does

- **Layouts**: Hero + three, four-panel grid, full bleed, nine-panel collage.
- **Grades** (computed per pixel on canvas, no libraries): Vice Sunset, Neon
  Nights, Palm Duotone, Comic Ink (posterize + halftone dots), Golden Hour.
- **Lettering**: Anton condensed capitals for the title (white, sunset
  gradient or neon pink), Pacifico script for the subtitle, a neon top rule,
  a "Vice City" badge and film grain + vignette finish. Both fonts ship under
  the SIL Open Font License (`app/fonts/OFL.txt`).
- **Per-panel crop**: every panel keeps its own photo, zoom and position.
- **Offline**: every script, font and sample is a file under `app/`; the app
  makes no network request.

## Layout of this repository

- `app/` — the static app (`index.html`, `style.css`, `src/`, `fonts/`,
  `samples/`).
- `screenshots/` — 3–4 screenshots: the exported covers and the editor.
- `main.ts` — the program that hands the app in (copies `app/` and
  `screenshots/` to `/output` and writes `dossier.json`).
- `serve.ts` — a tiny static server for local testing.
- `shots.json` — the screenshot scenes (`?shot=cover` / `?shot=editor`).

## License

MIT. Fonts: Anton and Pacifico, SIL Open Font License 1.1.
