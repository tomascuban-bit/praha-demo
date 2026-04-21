"""
FastAPI backend for Praha Demo — Keboola Data App.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.data_loader import TABLE_IDS, _DATA, init_data
from services.user_context import UserContext, get_user_context

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_data()
    except Exception:
        logger.error("Data loading failed — app cannot start", exc_info=True)
        raise
    yield


app = FastAPI(title="Praha Demo", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

from routers import overview, cycling, pedestrian, query, environment, map_data, parking  # noqa: E402

app.include_router(overview.router)
app.include_router(cycling.router)
app.include_router(pedestrian.router)
app.include_router(query.router)
app.include_router(environment.router)
app.include_router(map_data.router)
app.include_router(parking.router)


@app.get("/api/health")
def health():
    tables = [
        {"short_name": name, "row_count": len(_DATA[name]) if name in _DATA else 0, "table_id": TABLE_IDS.get(name, "")}
        for name in TABLE_IDS
    ]
    return {"status": "ok", "tables_loaded": len(_DATA), "tables": tables}


@app.get("/api/platform")
def platform():
    kbc_url = os.getenv("KBC_URL", "").strip().rstrip("/")
    kbc_project_id = os.getenv("KBC_PROJECTID", "").strip()
    if not kbc_project_id:
        kbc_token = os.getenv("KBC_TOKEN", "")
        if "-" in kbc_token:
            kbc_project_id = kbc_token.split("-", 1)[0]
    connection_base = kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url
    return {"connection_url": connection_base or None, "project_id": kbc_project_id or None}


@app.get("/api/me")
def me(user: UserContext = Depends(get_user_context)):
    return {"email": user.email or "demo@localhost", "role": user.role, "is_authenticated": user.is_authenticated}
