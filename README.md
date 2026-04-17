# Praha Demo

A live Keboola Data App showcasing Prague city mobility data from the [Golemio Open API](https://api.golemio.cz/api-docs/).

**Live URL**: https://praha-demo-43210476.hub.us-east4.gcp.keboola.com

---

## What It Shows

Five-tab dashboard (Czech UI):

| Tab | Content |
|-----|---------|
| **Přehled** | KPI tiles (24 h / 7-day cyclists, free parking %) + daily trend chart with 7/14/30/90-day range control; amber notice when data window < requested range |
| **Cyklistika** | Daily bar chart, hourly pattern curve, top counters table — 7/14/30/90-day segmented control; unavailable ranges dimmed with data availability notice |
| **Parkování** | 17 Prague TSK P+R lots — per-lot horizontal bars with **Obsazenost (%) / Kapacita** view toggle; fill-distribution donut (ColorBrewer palette, lot counts in legend); 4 KPI tiles; last-update timestamp badge (Prague timezone) |
| **Mapa města** | Leaflet interactive map — 🚲 green circles (variable size by 7-day count, "7 dní" date chip) for bike counters; colored **P** squares (green→red by fill %) for P+R lots; parking popup includes visual fill bar |
| **Sestavy** | Report Builder: pick source × dimension × measure × chart type → bar or line; PNG download, CSV export, shareable URL state (`?src=&dim=&msr=&ct=`) |

A **KAI** AI assistant panel (powered by Keboola KAI) is available on every page via the "Zeptat se KAI" button.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (standalone), React 19, Tailwind CSS v4, ECharts, Leaflet, Framer Motion |
| Backend | FastAPI + uvicorn (port 8050), Python 3.12, pandas, httpx |
| Deployment | Nginx (port 8888) → Next.js (3000) + FastAPI (8050), Supervisord |
| Data pipeline | Keboola project 347 (GCP US East4), Snowflake (`KBC_USE4_347`) |
| Data source | [Golemio Open API](https://api.golemio.cz/api-docs/) — bicycle counters, detections, P+R parking |

---

## Architecture

```
Praha Demo/
├── backend/
│   ├── main.py                  # FastAPI app + KAI SSE streaming
│   ├── services/
│   │   ├── data_loader.py       # Keboola Storage API → in-memory DataFrames
│   │   └── user_context.py      # Keboola OIDC header parsing
│   └── routers/
│       ├── overview.py          # /api/kpis, /api/overview-chart?days=
│       ├── cycling.py           # /api/cycling/* (trend, by-counter, hourly)
│       ├── parking.py           # /api/parking/* — 17 TSK P+R lots, hardcoded coords/names
│       ├── map_data.py          # /api/map-data — combined bike + parking for Leaflet
│       └── query.py             # /api/data-schema, /api/query-data (Report Builder)
└── frontend/
    ├── app/(dashboard)/
    │   ├── page.tsx             # Přehled — KPIs + trend chart with range control
    │   ├── cycling/page.tsx     # Cyklistika — charts + table + range control
    │   ├── parking/page.tsx     # Parkování — bars (% / abs toggle) + donut + table
    │   ├── map/page.tsx         # Mapa města — Leaflet map with two layers
    │   └── custom/page.tsx      # Sestavy — Report Builder with export + URL state
    └── components/
        ├── layout/Header.tsx    # App chrome (ghost KAI button, neutral Golemio badge)
        ├── map/MapView.tsx      # Leaflet DivIcon markers (bike + parking)
        └── kai/Chat.tsx         # KAI sliding chat panel with error handling + retry
```

### Key Patterns

- **Data loading**: `init_data()` at FastAPI startup — all Keboola tables loaded in parallel
- **Fallback chain**: `/data/in/tables/` (Keboola container) → KBC Storage API → `backend/data/*.csv`
- **Range filtering**: all time-series endpoints accept `?days=N`; frontend shows amber notice when `trend.length < days`
- **Czech pluralization**: `pluralize(n, {one, few, many})` helper in `frontend/lib/constants.ts`
- **KAI streaming**: POST `/api/chat` → get `stream_id` → poll `/api/chat/{stream_id}/poll?cursor=N`
- **URL state in Sestavy**: `window.location.search` (not `useSearchParams`) to avoid Next.js 15 Suspense build requirement
- **Parking color palette**: `#2DC653` / `#74c69d` / `#f59e0b` / `#f97316` / `#ef4444` (5 occupancy buckets, consistent across chart, donut, and map)

---

## Keboola Pipeline

**Project 347, GCP US East4** — daily refresh at 06:00 UTC:

1. **Phase 1** (parallel): 3 Golemio extractors
   - Bicycle counters → `in.c-golemio.bicycle_counters`
   - Bicycle detections → `in.c-golemio.bicycle_detections`
   - Vehicle positions → `in.c-golemio.vehicle_positions`
2. **Phase 2**: SQL transformation → output tables in `out.c-Praha-Demo-Golemio-to-Output-Tables`

Backend loads all tables at startup; falls back to local CSV files when running without credentials.

---

## Local Development

```bash
# Clone
git clone https://github.com/tomascuban-bit/praha-demo.git
cd "Praha Demo"

# Backend — runs on http://localhost:8050 with CSV fallback (no credentials needed)
cd backend
cp .env.example .env          # optionally add KBC_TOKEN + GOLEMIO_API_KEY for real data
uv run uvicorn main:app --reload --port 8050

# Frontend — runs on http://localhost:3000, proxies /api/* to :8050
cd frontend
npm install
npm run dev
```

> **Note**: `uv` must be installed (`pip install uv`). The frontend Next.js config proxies all `/api/*` requests to the local FastAPI backend automatically.

---

## Data Notes

- **Bicycle counters**: 40 permanent counters across Prague, updated daily by Golemio; 4 days of data currently available (pipeline started 2026-04-14), growing daily
- **P+R parking**: 17 TSK Praha lots — real-time occupancy from Golemio `/v3/parking/{id}`; lot names and coordinates verified from the Golemio API (polygon centroids)
- **No traffic tab**: Golemio vehicle positions are point-in-time snapshots, not suitable for trend analysis — intentionally removed
- **Czech UI**: all labels, tooltips, KPI descriptions, chart series names, and KAI suggestions are in Czech

---

## Deployment

Deployed as a Keboola Data App (python-js type). The `setup.sh` script runs on container start:
1. `uv sync` — install Python deps
2. `npm install && npm run build` — build Next.js standalone bundle
3. Supervisord starts Nginx + Next.js + FastAPI

The app receives a Keboola Storage token via environment injection (no credentials in code).

> **Deploy tip**: call `deploy_data_app` when the app is **running** — do not stop first, as restarting without a fresh build causes the node-frontend service to fail (no `server.js`).
