# Praha Demo

A live Keboola Data App showcasing Prague city mobility data from the [Golemio Open API](https://api.golemio.cz/api-docs/).

**Live URL**: https://praha-demo-43210476.hub.us-east4.gcp.keboola.com

---

## What It Shows

Seven-tab dashboard (Czech UI) with dark/light mode toggle:

| Tab | Content |
|-----|---------|
| **Přehled** | KPI tiles (24 h / 7-day cyclists, free parking %) + daily trend chart with 7/14/30/90-day range control + P+R parking occupancy bar chart |
| **Cyklistika** | Daily bar chart, hourly pattern curve, cyclist vs. pedestrian comparison, top counters table — 7/14/30/90-day range; unavailable ranges dimmed |
| **Chodci** | Pedestrian KPIs, daily trend, hourly pattern, cyclist vs. pedestrian comparison, by-counter bar — 6 shared-path counters |
| **Parkování** | 17 Prague TSK P+R lots — per-lot horizontal bars (**Obsazenost % / Kapacita** toggle); fill-distribution donut; 4 KPI tiles; last-update timestamp badge |
| **Mapa města** | Leaflet interactive map — 🚲 green circles (bike-only) and indigo circles (shared bike+pedestrian path, shows both 7-day counts) for counters; color-coded **P** squares for P+R lots |
| **Reporty** | Report builder: source × dimension × measure(s) × chart type; granularity (hour/day/week/month); sort + top-N; saved reports (localStorage); PNG/CSV export; shareable URL state |
| **Feedback** | Feedback form — sends a message to the app maintainer; graceful degradation when SMTP not configured |

A **KAI** AI chat panel (powered by Keboola AI) is available on every page — answers questions about the Prague mobility data using natural language.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (standalone), React 19, Tailwind CSS v4, ECharts, Leaflet |
| Backend | FastAPI + uvicorn (port 8050), Python 3.12, pandas, httpx |
| Deployment | Nginx (port 8888) → Next.js (3000) + FastAPI (8050), Supervisord |
| Data pipeline | Keboola (GCP US East4), Snowflake |
| Data source | [Golemio Open API](https://api.golemio.cz/api-docs/) — bicycle counters, detections, P+R parking |

---

## Architecture

```
Praha Demo/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan data loading
│   ├── services/
│   │   ├── data_loader.py       # Keboola Storage API → in-memory DataFrames
│   │   └── user_context.py      # Keboola OIDC header parsing
│   └── routers/
│       ├── overview.py          # /api/kpis, /api/overview-chart?days=
│       ├── cycling.py           # /api/cycling/* (trend, by-counter, hourly)
│       ├── pedestrian.py        # /api/pedestrian/* — 6 shared-path counters
│       ├── parking.py           # /api/parking/* — 17 TSK P+R lots
│       ├── map_data.py          # /api/map-data — combined bike + parking for Leaflet
│       ├── query.py             # /api/data-schema, /api/query-data (Reporty builder)
│       ├── feedback.py          # POST /api/feedback — SMTP send
│       └── kai.py               # /api/chat SSE proxy — KAI AI assistant
└── frontend/
    ├── app/(dashboard)/
    │   ├── page.tsx             # Přehled
    │   ├── cycling/page.tsx     # Cyklistika
    │   ├── pedestrian/page.tsx  # Chodci
    │   ├── parking/page.tsx     # Parkování
    │   ├── map/page.tsx         # Mapa města
    │   ├── custom/page.tsx      # Reporty
    │   └── feedback/page.tsx    # Feedback form
    └── components/
        ├── layout/Header.tsx    # App chrome — Keboola logo, dark/light toggle, KAI button
        ├── map/MapView.tsx      # Leaflet DivIcon markers (bike counters + parking)
        └── kai/
            ├── Chat.tsx         # KAI sliding panel — SSE streaming, tool indicators, suggestions
            └── kai-context.tsx  # React context — message state, approval flow, timeout
```

### Key Patterns

- **Data loading**: `init_data()` at FastAPI startup — all Keboola tables loaded in parallel into memory
- **Fallback chain**: `/data/in/tables/` (Keboola container) → KBC Storage API → `backend/data/*.csv`
- **Range filtering**: all time-series endpoints accept `?days=N`; frontend shows amber notice when `trend.length < days`
- **Czech pluralization**: `pluralize(n, {one, few, many})` helper in `frontend/lib/constants.ts`
- **KAI chat**: FastAPI proxies SSE from the Keboola KAI service; scoped by system instruction to Praha Demo data only; keepalive comments prevent proxy timeouts; token required with `canManageBuckets`
- **URL state in Reporty**: `window.location.search` (not `useSearchParams`) to avoid Next.js 15 Suspense build requirement
- **Parking color palette**: `#2DC653` / `#74c69d` / `#f59e0b` / `#f97316` / `#ef4444` (5 occupancy buckets, consistent across chart, donut, and map)
- **Dark mode**: class-based (`dark` on `<html>`), toggled via `ThemeProvider`; ECharts charts use `chartDefaults(isDark)` since they don't read CSS variables
- **Pedestrian counters**: 6 of 40 bicycle stations are shared bike+pedestrian paths (`PEDESTRIAN_COUNTER_IDS` in `pedestrian.py`); shown as indigo markers on map

---

## Keboola Pipeline

**GCP US East4** — daily refresh at 06:00 UTC:

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
cp .env.example .env          # optionally add KBC_TOKEN for real Keboola data
uv run uvicorn main:app --reload --port 8050

# Frontend — runs on http://localhost:3000, proxies /api/* to :8050
cd frontend
npm install
npm run dev
```

> **Note**: `uv` must be installed (`pip install uv`). The frontend Next.js config proxies all `/api/*` requests to the local FastAPI backend automatically.

### KAI (local)

KAI requires a Keboola Storage token with `canManageBuckets` access. Set `KAI_TOKEN` in your `.env` file. Without it, the `/api/kai-status` endpoint returns `configured: false` and the chat button is disabled.

---

## Data Notes

- **Bicycle counters**: 40 permanent counters across Prague, updated daily by Golemio; historical data available from 2026-04-14, growing daily
- **Pedestrian counters**: 6 stations on shared bike+pedestrian paths; separate Chodci tab shows pedestrian-specific KPIs
- **P+R parking**: 17 TSK Praha lots — real-time occupancy snapshot; lot names and coordinates verified from Golemio API polygon centroids
- **No traffic tab**: Golemio vehicle positions are point-in-time snapshots, not suitable for trend analysis — intentionally excluded
- **Czech UI**: all labels, tooltips, KPI descriptions, chart series names, and KAI responses are in Czech

---

## Deployment

Deployed as a Keboola Data App (python-js type). The `setup.sh` script runs on container start:
1. `uv sync` — install Python deps
2. `npm install && npm run build` — build Next.js standalone bundle
3. Supervisord starts Nginx + Next.js + FastAPI

All credentials (Keboola token, KAI token, SMTP settings) are injected via Keboola secrets — no credentials in code or config files.

> **Deploy tip**: call `deploy_data_app` when the app is **running** — do not stop first, as restarting without a fresh build causes the node-frontend service to fail.
