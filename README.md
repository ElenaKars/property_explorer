# Property Explorer

A small map-based analysis tool for real estate research: draw a rectangle anywhere in Germany and get the **total building footprint area** and **building coverage percentage** inside it, calculated from OpenStreetMap data.

**Live demo:** https://elenakars.github.io/property_explorer/

> Portfolio MVP. Independent project, built with AI assistance (Claude Code).
> Uses only free, public APIs; no API keys or backend.

## Features

- **Interactive map** (Leaflet + OpenStreetMap tiles), centred on Berlin.
- **Address and city search** in Germany via Nominatim.
- **Rectangle analysis area** drawn with mouse or touch, limited to 1 km².
- **Building footprints** loaded from the Overpass API and drawn on the map.
- **Boundary clipping:** buildings crossing the rectangle are cut to it, so only the part inside is counted. Cut buildings are highlighted, with their full outline shown dashed.
- **Results:** coverage %, footprint area, number of buildings (and how many were cut), and the OSM data timestamp.
- **Building details** on click: type, name, address, levels, footprint, and a link to the OSM object.
- **Loading and error states:** readable messages for rate limits, timeouts and network errors, with a retry button.
- **Attribution** for OpenStreetMap, Nominatim and Overpass.

## How the calculation works

1. Overpass returns all objects tagged `building=*` (except `building=no`) in the rectangle: simple outlines (ways) and multi-part buildings (multipolygon relations).
2. They are converted to GeoJSON. Multi-part buildings are assembled from their outline segments, with courtyards kept as holes. Outlines with gaps or missing points are skipped and counted.
3. Objects also tagged `man_made=*` (for example the concrete stelae of the Memorial to the Murdered Jews of Europe in Berlin, which are mapped as buildings) are **excluded**, and the sidebar shows how many.
4. Each building is clipped to the rectangle (`@turf/bbox-clip`) and its area measured on a sphere (`@turf/area`).
5. **Coverage = building footprint inside the rectangle ÷ rectangle area.** Both areas use the same Earth model.

The calculation is covered by unit tests: buildings fully inside, crossing an edge, over a corner, touching or outside, courtyards (also crossing the edge), concave shapes split by the edge, and multi-part buildings. On real Berlin data, results matched an independent random-point estimate to within 0.3 percentage points.

## Data limitations

- **OpenStreetMap is not official cadastral data** (e.g. ALKIS). It is mapped by volunteers and may be incomplete, outdated or inconsistently tagged.
- **Footprint ≠ floor area or plot area.** Coverage refers to the ground area covered by building outlines only.
- **Overlapping outlines** in OSM (rare) are counted twice.
- **Tagging decisions** affect results. For example, roofs without walls (`building=roof`) are counted; man-made structures are not.
- **Data freshness:** the primary Overpass server may lag OSM by several hours; the timestamp is shown with each result.
- **Areas are approximate** (spherical Earth model, accurate well below 1% at this scale).

## Responsible use of public APIs

- **Nominatim:** searches only on submit (no autocomplete), at most one request per second, with results cached.
- **Overpass:** one query per analysis, a 1 km² size limit, no parallel requests, a 30-second pause after rate-limit responses, and cached results. The app uses the public [Overpass Europe instance](https://wiki.openstreetmap.org/wiki/Overpass_API) first and falls back to the main instance (`overpass-api.de`).
- **Map tiles:** standard OSM tiles, suitable for low-traffic demos only (see the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).

## Tech stack

React 19 · Vite 8 · JavaScript · Leaflet 1.9 / react-leaflet 5 · Turf.js 7 · Vitest · Oxlint · GitHub Actions / GitHub Pages

## Run locally

Requires Node.js 22.12 or later (see `.nvmrc`).

```bash
npm ci
npm run dev      # development server
npm test         # unit tests
npm run build    # production build in dist/
```

## Project structure

```
src/
  components/   Map, search, drawing tool, sidebar panels, building layer
  hooks/        Search, data loading and analysis state
  services/     Nominatim and Overpass clients (throttling, caching, fallback)
  lib/          Geometry, OSM → GeoJSON conversion, coverage analysis, formatting
```

## Data and licences

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License (ODbL).
