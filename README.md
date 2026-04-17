# Praha Demo

A live Keboola Data App showcasing Prague city mobility data from the [Golemio Open API](https://api.golemio.cz/api-docs/).

**Live URL**: https://praha-demo-43210476.hub.us-east4.gcp.keboola.com

---

## What It Shows

Five tab dashboard (Czech UI):

| Tab | Content |
|-----|---------|
| **Přehled** | KPI tiles (total cyclists, 7-day cyclists, free parking %) + dual-axis daily trend chart |
| **Cyklistika** | Daily bar chart, hourly pattern, top 10 bicycle counters table — toggle 7/30/90 days |
| **Parkování** | 17 Prague TSK P+R lots: per-lot horizontal bars (free vs. occupied), fill distribution donut, KPI summary |
| **Mapa města** | Leaflet map — 🚲 green circles (variable size by traffic) for bike counters, colored **P** squares (green→red by fill %) for P+R lots |
| **Sestavy** | Report Builder: pick data source × dimension × measure → bar or line chart, no code needed |

A **KAI** AI assistant panel (powered by Keboola KAI) is available on every page.

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
│       ├── overview.py          # /api/kpis, /api/overview-chart
│       ├── cycling.py           # /api/cycling/*
│       ├── parking.py           # /api/parking/* — 17 TSK P+R lots with hardcoded coords/names
│       ├── map_data.py          # /api/map-data — combined bike counters + parking for map
│       └── query.py             # /api/data-schema, /api/query-data (Report Builder)
└── frontend/
    ├── app/(dashboard)/
    │   ├── page.tsx             # Přehled (overview)
    │   ├── cycling/page.tsx     # Cyklistika
    │   ├── parking/page.tsx     # Parkování
    │   ├── map/page.tsx         # Mapa města
    │   └── custom/page.tsx      # Sestavy (Report Builder)
    └── components/
        ├── map/MapView.tsx      # Leaflet map with DivIcon markers
        └── kai/Chat.tsx         # KAI sliding chat panel
```

---

## Keboola Pipeline

**Project 347, GCP US East4** — daily refresh at 06:00 UTC:

1. **Phase 1** (parallel): 3 Golemio extractors
   - Bicycle counters → `in.c-golemio.bicycle_counters`
   - Bicycle detections → `in.c-golemio.bicycle_detections`
   - Vehicle positions → `in.c-golemio.vehicle_positions`
2. **Phase 2**: SQL transformation → output tables in `out.c-Praha-Demo-Golemio-to-Output-Tables`

Backend loads data at startup via Keboola Storage API; falls back to local CSV files when running without credentials.

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

- **Bicycle counters**: 40 permanent counters across Prague, updated daily by Golemio
- **P+R parking**: 17 TSK Praha lots — real-time occupancy from Golemio `/v3/parking/{id}`; lot names and coordinates verified from the Golemio API
- **No traffic tab**: Golemio vehicle positions are point-in-time snapshots, not suitable for trend analysis — this tab was intentionally removed
- **Czech UI**: all labels, tooltips, and KAI suggestions are in Czech

---

## Deployment

Deployed as a Keboola Data App (python-js type). The `setup.sh` script runs on container start:
1. `uv sync` — install Python deps
2. `npm install && npm run build` — build Next.js standalone bundle
3. Supervisord starts Nginx + Next.js + FastAPI

The app receives a Keboola Storage token via environment injection (no credentials in code).
