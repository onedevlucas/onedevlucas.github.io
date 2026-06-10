# BORail Flatlands

Live timetable, service status, and system maps for the fictional BORail Flatlands rail system. The site is published with GitHub Pages.

## Repository structure

- `index.html` - live timetable entry page
- `map.html` - system map page
- `status.html` - line and elevator status page
- `home.html` - simple menu page
- `sw.js` - offline cache for the timetable and core site assets
- `assets/css/` - page styles
- `assets/js/` - timetable and status behavior
- `assets/images/` - branding, line, navigation, advertisement, and UI images
- `assets/maps/` - downloadable system map PDFs
- `scripts/verify.mjs` - checks JavaScript syntax, asset links, and repository layout
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

## Editing notes

Keep public HTML entry pages at the repository root so existing links continue to work. Put new static files in the matching `assets/` subfolder and use root-relative page paths such as `assets/images/navigation/map.png`.
