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

## Architecture

```
Praha Demo/
├── CLAUDE.md                  # This file — project docs & progress log
├── README.md                  # GitHub readme
├── streamlit_app.py           # Entry point, navigation, global filters
├── utils/
│   └── data_loader.py         # All SQL queries and data access layer
├── page_modules/              # Individual page logic
│   └── *.py
├── .streamlit/
│   └── secrets.toml           # Local credentials (gitignored)
└── requirements.txt
```

### Key Patterns
- All SQL queries use fully qualified table names from `get_table_name()`
- Queries cached with `@st.cache_data(ttl=300)`
- Global filters stored in `st.session_state`, applied via WHERE clause builders
- Environment parity: `os.environ.get('KEY') or st.secrets.get('KEY')`

---

## Keboola Backend

### Project Details
- **Project ID**: 2737
- **Region**: europe-west3.gcp (GCP EU)
- **SQL Dialect**: Snowflake
- **Conditional Flows**: Enabled

### Data Sources
> _To be filled in as data is added to the project_

### Tables
> _To be filled in as tables are created_

### Flows / Transformations
> _To be filled in as pipeline is built_

---

## Progress Log

### 2026-04-16 — Session 1: Project Initialization
**Status**: Setup complete, awaiting data definition

**Done**:
- [x] Local folder created: `/Users/tomascuban/Praha Demo`
- [x] Git repository initialized
- [x] GitHub repo created: https://github.com/tomascuban-bit/praha-demo (private)
- [x] Keboola project explored — confirmed empty, Snowflake dialect, GCP EU West3
- [x] `CLAUDE.md` created (this file)
- [x] Development toolchain confirmed: Keboola MCP + Playwright MCP operational

**Next Steps**:
- [ ] Define what data the app will use (source system / data model)
- [ ] Define app pages and features
- [ ] Set up Keboola data pipeline (extractors → transformations → storage)
- [ ] Scaffold Streamlit app structure
- [ ] Configure `.streamlit/secrets.toml` for local dev
- [ ] Deploy to Keboola Data Apps

---

## How to Resume Work

### Starting a New Session
1. Open Claude Code in `/Users/tomascuban/Praha Demo`
2. Claude auto-loads this `CLAUDE.md` for full context
3. Use the `dataapp-dev` skill for development
4. Check the Progress Log above for current status and next steps

### Key Commands
```bash
# Start local dev server
streamlit run streamlit_app.py

# Check app is running
lsof -ti:8501

# Push to GitHub
git add . && git commit -m "message" && git push

# Deploy to Keboola (when ready)
# See dataapp-deployment skill
```

### Keboola MCP Quick Reference
```
get_project_info()           — Project context and SQL dialect
get_buckets()                — List all storage buckets
get_tables(bucket_ids=[...]) — List tables in buckets
query_data(sql=..., ...)     — Run SQL query against workspace
search(patterns=[...])       — Find tables/configs by name
```
