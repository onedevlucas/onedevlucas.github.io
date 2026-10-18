# Live Map engineering SVGs

These SVGs are hidden movement guides. The passenger-facing map remains
`assets/maps/borail-live-track-layout.svg`.

Each registered service needs:

- one SVG with the original `4000 × 4000` canvas and `0 0 3000 2999.999989` viewBox;
- sequential, two-digit direction IDs such as `FLocal-Southbound-01`;
- one direction-specific `stop-...` ID for every scheduled stop; and
- a matching entry in `registry.json`.

After adding or replacing a registered SVG, run
`node scripts/generate-live-map-id-geometry.mjs` while the local preview and
Chrome debugging session used by the browser tests are running. The generator
rejects missing files, duplicate IDs, numbering gaps, non-padded section IDs,
nested route IDs, missing stop markers, and disconnected route geometry before
rewriting `assets/js/live-map-id-geometry.js`.

All 12 passenger services are registered: A local/express, B local/express,
C, D, E, F local/express, G, and S local/express. The live map uses their
generated ID geometry automatically and retains
`assets/js/live-map-route-geometry.js` only as a guarded fallback if a future
SVG replacement is incomplete.
