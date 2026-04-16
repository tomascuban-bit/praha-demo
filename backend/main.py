"""
FastAPI backend for Praha Demo — Keboola Data App.

ARCHITECTURE:
  - Data loaded once at startup from Keboola Storage (or local CSVs)
  - Endpoints serve pre-computed results from in-memory DataFrames
  - KAI agent integration via SSE streaming (poll-based)
  - User context from Keboola OIDC headers

ROUTERS:
  - overview  : city-wide KPIs and trend chart
  - cycling   : bicycle counter data
  - traffic   : traffic detector data
  - query     : report builder (data schema + ad-hoc aggregation)
"""
import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from services.data_loader import TABLE_IDS, _DATA, init_data
from services.user_context import UserContext, get_user_context

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent / ".env")

# ─── KAI state ────────────────────────────────────────────────────────────────
_http_client: httpx.AsyncClient | None = None
_kai_url: str | None = None
_streams: dict[str, dict] = {}


def _kbc_base_url() -> str:
    kbc_url = os.getenv("KBC_URL", "").strip().rstrip("/")
    return kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url


async def _discover_kai_url() -> str:
    global _kai_url
    if _kai_url:
        return _kai_url
    kbc_token = os.getenv("KBC_TOKEN", "").strip()
    base = _kbc_base_url()
    if not kbc_token or not base:
        raise HTTPException(500, "KBC_TOKEN / KBC_URL not configured")
    assert _http_client is not None
    resp = await _http_client.get(
        f"{base}/v2/storage",
        headers={"x-storageapi-token": kbc_token},
        timeout=30.0,
    )
    data = resp.json()
    svc = next((s for s in data.get("services", []) if s["id"] == "kai-assistant"), None)
    if not svc:
        ids = [s.get("id") for s in data.get("services", [])]
        raise HTTPException(500, f"kai-assistant not found. Available: {ids}")
    _kai_url = svc["url"].rstrip("/")
    logger.info("Discovered KAI URL: %s", _kai_url)
    return _kai_url


def _kai_headers() -> tuple[str, str, dict]:
    kai_token = os.getenv("KAI_TOKEN", "").strip() or os.getenv("KBC_TOKEN", "").strip()
    base = _kbc_base_url()
    return base, kai_token, {
        "Content-Type": "application/json",
        "x-storageapi-token": kai_token,
        "x-storageapi-url": base,
    }


async def _kai_stream_consumer(stream_id: str, resp: httpx.Response, client: httpx.AsyncClient) -> None:
    buf = _streams[stream_id]
    try:
        raw = b""
        async for chunk in resp.aiter_bytes():
            raw += chunk
            while b"\n\n" in raw:
                event_bytes, raw = raw.split(b"\n\n", 1)
                event_str = event_bytes.decode("utf-8", errors="replace").strip()
                if event_str:
                    buf["events"].append(event_str)
        if raw.strip():
            buf["events"].append(raw.decode("utf-8", errors="replace").strip())
    except Exception as exc:
        logger.warning("KAI stream %s error: %s", stream_id, exc)
        buf["error"] = str(exc)
    finally:
        buf["done"] = True
        await resp.aclose()
        await client.aclose()


async def _start_kai_stream(kai_url: str, headers: dict, body: dict) -> str:
    stream_id = str(uuid.uuid4())
    client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    req = client.build_request("POST", f"{kai_url}/api/chat", headers=headers, json=body)
    resp = await client.send(req, stream=True)
    if resp.status_code != 200:
        error_body = await resp.aread()
        await resp.aclose()
        await client.aclose()
        _streams[stream_id] = {"events": [], "done": True, "error": f"KAI {resp.status_code}: {error_body.decode()[:200]}"}
        return stream_id
    _streams[stream_id] = {"events": [], "done": False, "error": None}
    asyncio.create_task(_kai_stream_consumer(stream_id, resp, client))
    return stream_id


# ─── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    try:
        await _discover_kai_url()
    except Exception as e:
        logger.warning("KAI pre-warm failed (will retry on first request): %s", e)
    try:
        init_data()
    except Exception:
        logger.error("Data loading failed — app cannot start", exc_info=True)
        raise
    yield
    await _http_client.aclose()
    _http_client = None


app = FastAPI(title="Praha Demo", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────────────────────
from routers import overview, cycling, traffic, query  # noqa: E402

app.include_router(overview.router)
app.include_router(cycling.router)
app.include_router(traffic.router)
app.include_router(query.router)


# ─── Core endpoints ────────────────────────────────────────────────────────────

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


# ─── KAI endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def kai_chat(request: Request):
    kai_url = await _discover_kai_url()
    _base, _token, headers = _kai_headers()
    body = await request.json()
    stream_id = await _start_kai_stream(kai_url, headers, body)
    return {"stream_id": stream_id}


@app.get("/api/chat/{stream_id}/poll")
async def kai_poll(stream_id: str, cursor: int = 0):
    buf = _streams.get(stream_id)
    if not buf:
        raise HTTPException(404, "Stream not found or expired")
    events = buf["events"][cursor:]
    new_cursor = cursor + len(events)
    done = buf["done"]
    error = buf["error"]
    if done and new_cursor >= len(buf["events"]):
        _streams.pop(stream_id, None)
    return {"events": events, "cursor": new_cursor, "done": done, "error": error}


@app.post("/api/chat/{chat_id}/{action}/{approval_id}")
async def kai_tool_approval(chat_id: str, action: str, approval_id: str):
    kai_url = await _discover_kai_url()
    _base, _token, headers = _kai_headers()
    approved = action == "approve"
    payload = {
        "id": chat_id,
        "message": {
            "id": str(uuid.uuid4()),
            "role": "user",
            "parts": [{"type": "tool-approval-response", "approvalId": approval_id, "approved": approved,
                        **({"reason": "User denied"} if not approved else {})}],
        },
        "selectedChatModel": "chat-model",
        "selectedVisibilityType": "private",
    }
    stream_id = await _start_kai_stream(kai_url, headers, payload)
    return {"stream_id": stream_id}
