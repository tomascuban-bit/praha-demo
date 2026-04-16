# Praha Demo — Project Documentation

## Project Overview
A Keboola Data App built with Streamlit, deployed to Keboola Data Apps (GCP EU West3).

**GitHub**: https://github.com/tomascuban-bit/praha-demo (private)
**Keboola Project**: `tomas.cuban@keboola.com` (ID: 2737)
**Keboola UI**: https://connection.europe-west3.gcp.keboola.com/admin/projects/2737/
**SQL Dialect**: Snowflake
**Owner**: tomas.cuban@keboola.com

---

## Development Environment

### Tools Required
- Claude Code CLI with `--dangerously-skip-permissions` for auto-approval
- Keboola MCP (`mcp__claude_ai_Keboola_GCP_EU__*`) — data validation and querying
- Playwright MCP (`mcp__plugin_dataapp-developer_playwright__*`) — visual verification
- GitHub CLI (`gh`) — repo management

### Skills Active
- `dataapp-dev` — Keboola Streamlit data app development skill
- `dataapp-deployment` — Keboola deployment skill (when needed)

### Local Development
- App runs on: `http://localhost:8501`
- Start command: `streamlit run streamlit_app.py`
- Secrets: `.streamlit/secrets.toml` (not committed)

### Workflow: Validate → Build → Verify
1. **Validate**: Use Keboola MCP to inspect table schemas and query sample data before writing code
2. **Build**: SQL-first architecture — aggregate in database, not Python
3. **Verify**: Use Playwright to open app, test interactions, take screenshots

---

## Stack

**Frontend**: Next.js 15 (standalone), React 19, ECharts, Framer Motion, Tailwind CSS v4
**Backend**: FastAPI + uvicorn, Python 3.11+, pandas, httpx
**Deployment**: Nginx (port 8888) → Next.js (3000) + FastAPI (8050), managed by Supervisord
**Data**: Golemio Open API → Keboola Generic REST extractor → Snowflake → FastAPI in-memory

## Architecture

```
Praha Demo/
├── CLAUDE.md                            # This file — project docs & progress log
├── backend/
│   ├── main.py                          # FastAPI app + KAI SSE streaming
│   ├── pyproject.toml                   # Python deps (uv)
│   ├── .env.example                     # Copy to .env for local dev
│   ├── data/                            # Local CSV fallback (90 days sample data)
│   │   ├── bicycle_counters.csv         # 10 counter stations
│   │   ├── bicycle_measurements.csv     # 21,600 rows hourly
│   │   ├── traffic_detectors.csv        # 10 detector stations
│   │   └── traffic_measurements.csv     # 21,600 rows hourly
│   ├── services/
│   │   ├── data_loader.py               # Keboola Storage API + GCP/AWS/Azure support
│   │   └── user_context.py              # Keboola OIDC header parsing
│   └── routers/
│       ├── overview.py                  # /api/kpis, /api/overview-chart
│       ├── cycling.py                   # /api/cycling/*
│       ├── traffic.py                   # /api/traffic/*
│       └── query.py                     # /api/data-schema, /api/query-data
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout + fonts
│   │   ├── providers.tsx                # React Query + KAI context
│   │   └── (dashboard)/
│   │       ├── layout.tsx               # Header + NavTabs + KAI slide panel
│   │       ├── page.tsx                 # Overview: KPIs + dual-axis trend chart
│   │       ├── cycling/page.tsx         # Cycling: trend + hourly + top counters
│   │       ├── traffic/page.tsx         # Traffic: trend + hourly + busiest detectors
│   │       └── custom/page.tsx          # Report Builder: dimension × measure charts
│   ├── components/
│   │   ├── layout/{Header,NavTabs}.tsx  # App chrome
│   │   └── kai/Chat.tsx                 # KAI sliding chat panel
│   └── lib/
│       ├── api.ts                       # React Query hooks for all endpoints
│       ├── types.ts                     # TypeScript API response types
│       ├── constants.ts                 # COLORS + formatters
│       └── kai-context.tsx              # KAI chat state + SSE poll loop
└── keboola-config/
    ├── nginx/sites/default.conf         # Reverse proxy (port 8888)
    ├── supervisord/services/            # node.conf + python.conf
    └── setup.sh                         # Container build script

```

### Key Patterns
- **Data loading**: `init_data()` called once at FastAPI startup — downloads all Keboola tables in parallel, stores in `_DATA` dict
- **Local dev fallback**: If no `KBC_TOKEN`, loads from `backend/data/*.csv`
- **KAI streaming**: POST `/api/chat` → get `stream_id` → poll `/api/chat/{stream_id}/poll?cursor=N`
- **Nginx SSE rule**: `/api/chat` matched BEFORE `/api/` to enable `proxy_buffering off`
- **Brand colors**: Prague red `#D62828`, dark navy `#003049`, cycling green `#2DC653`

---

## Keboola Backend

### Project Details
- **Project ID**: 2737
- **Region**: europe-west3.gcp (GCP EU)
- **SQL Dialect**: Snowflake
- **Conditional Flows**: Enabled
- **Keboola UI**: https://connection.europe-west3.gcp.keboola.com/admin/projects/2737/

### Data Sources
- **Golemio Open API** — Prague city open data platform (`api.golemio.cz`)
  - API key: _to be provided by user_
  - Docs: https://api.golemio.cz/docs/public-openapi/

### Target Tables (to create via Keboola extractors)
| Short name | Keboola table ID | Golemio endpoint |
|---|---|---|
| `bicycle_counters` | `out.c-praha-demo.bicycle_counters` | `GET /v2/bicyclecounters` |
| `bicycle_measurements` | `out.c-praha-demo.bicycle_measurements` | `GET /v2/bicyclecounters/{id}/measurements` |
| `traffic_detectors` | `out.c-praha-demo.traffic_detectors` | `GET /v2/trafficdetectors` |
| `traffic_measurements` | `out.c-praha-demo.traffic_measurements` | `GET /v2/trafficdetectors/{id}/measurements` |

### Flows / Transformations
> _To be set up once Golemio API key is provided_

---

## Progress Log

### 2026-04-16 — Session 1: Full Scaffold Built

**Done**:
- [x] Local folder + git repo initialized
- [x] GitHub repo created: https://github.com/tomascuban-bit/praha-demo (private)
- [x] Keboola project explored — confirmed empty, Snowflake, GCP EU West3
- [x] Inspiration repo researched: `ottomansky/ads-sales-dashboard` (Next.js + FastAPI)
- [x] Golemio Prague Open API researched (traffic + bicycle counters)
- [x] **Full app scaffold built and pushed** — 34 files, 2,576 lines
  - FastAPI backend (overview, cycling, traffic, query routers + KAI streaming)
  - Next.js 15 frontend (4 pages: Overview, Cycling, Traffic, Report Builder)
  - KAI chat panel with SSE streaming + suggestion prompts
  - Nginx + Supervisord Keboola deployment config
  - 90 days × 10 stations sample CSV data for local dev
- [x] `CLAUDE.md` documentation maintained

**Next Steps**:
- [ ] **User provides Golemio API key** → set up Keboola Generic REST extractors
- [ ] Set up Keboola pipeline: extractors → `out.c-praha-demo.*` tables
- [ ] Run `npm install` + `npm run dev` in `frontend/` for local dev
- [ ] Set up `backend/.env` with KBC_TOKEN + KBC_URL for production data
- [ ] Deploy to Keboola Data Apps (build Next.js standalone + push to repo)
- [ ] Consider: add map visualization (Leaflet/Mapbox) for counter/detector locations

---

## How to Resume Work

### Starting a New Session
1. Open Claude Code in `/Users/tomascuban/Praha Demo`
2. Claude auto-loads this `CLAUDE.md` for full context
3. Use the `dataapp-dev` skill for development
4. Check the Progress Log above for current status and next steps

### Key Commands
```bash
# Install frontend deps (first time)
cd frontend && npm install

# Start frontend dev server (http://localhost:3000)
cd frontend && npm run dev

# Start backend (http://localhost:8050)
cd backend && uv sync && uv run uvicorn main:app --reload --port 8050

# Build frontend for production (creates .next/standalone)
cd frontend && npm run build

# Push to GitHub
git add . && git commit -m "message" && git push
```

### Keboola MCP Quick Reference
```
get_project_info()           — Project context and SQL dialect
get_buckets()                — List all storage buckets
get_tables(bucket_ids=[...]) — List tables in buckets
query_data(sql=..., ...)     — Run SQL query against workspace
search(patterns=[...])       — Find tables/configs by name
```
