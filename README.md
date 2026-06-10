# BORail Flatlands

Live timetable, service status, system maps, and a local-first Architect Workbench for the fictional BORail Flatlands rail system. The site is published with GitHub Pages.

## Repository structure

- `index.html` - live timetable entry page
- `map.html` - system map page
- `status.html` - line and elevator status page
- `home.html` - simple menu page
- `workbench.html` - interactive fictional railway world editor and public preview
- `sw.js` - offline cache for the timetable and core site assets
- `assets/css/` - page styles
- `assets/js/` - timetable and status behavior
- `assets/images/` - branding, line, navigation, advertisement, and UI images
- `assets/maps/` - downloadable system map PDFs
- `scripts/verify.mjs` - checks JavaScript syntax, asset links, and repository layout
- `scripts/workbench-test.mjs` - tests the Workbench seed world, coordinates, validation, and JSON roundtrip
- `scripts/workbench-browser-test.mjs` - exercises the rendered editor through a local headless Chrome session
- `CNAME` - GitHub Pages custom domain configuration

## Local preview

Serve the repository root with any static web server. For example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`.

Run the repository check after moving or renaming assets:

```powershell
node scripts/verify.mjs
```

Run the Architect Workbench model tests:

```powershell
node scripts/workbench-test.mjs
```

## Architect Workbench

Open `workbench.html` to edit a starter world containing every Green Line `(A)` local station between Newkirk and Mount River.

- Use **Select** to inspect objects and drag stations or labels.
- Use the drawing tools to place stations, add labels, and draw rail, land, water, regions, or terrain zones.
- Station and infrastructure properties are edited in the right inspector.
- Drafts auto-save in the browser and can also be saved manually.
- **Export** downloads the complete world as a `.borail.json` file. **Import** validates a file before replacing the current draft.
- **Validate** checks IDs, station slugs, bounds, references, lines, and geometry.
- **Public Preview** hides editing controls and presents a rider-style Green Line map.

The canonical map uses a fictional 10,000 by 7,000 BoRail XY plane with its origin at the top-left. It does not use real latitude/longitude or external map tiles.

Current limitations: the starter world contains only the Green Line, drafts are local to one browser, there is no multiplayer or backend, terrain is represented as 2.5D planning zones, and public preview does not contain live arrivals.

## Editing notes

Keep public HTML entry pages at the repository root so existing links continue to work. Put new static files in the matching `assets/` subfolder and use root-relative page paths such as `assets/images/navigation/map.png`.
