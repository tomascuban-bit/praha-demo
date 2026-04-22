"""
KAI (Keboola AI Assistant) — SSE proxy router.

Credentials (set as Keboola secrets):
  KAI_TOKEN              — Keboola token with read on Praha Demo output bucket + canManageBuckets
  KBC_URL                — auto-injected by Keboola platform
  KAI_SYSTEM_INSTRUCTION — (optional) override default system instruction text
"""
from __future__ import annotations

import logging
import os
import uuid

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

_kai_url: str | None = None
_initialized_chats: set[str] = set()

_DEFAULT_INSTRUCTION = (
    "You are a Prague city mobility data assistant for the Keboola Demo App. "
    "Your sole purpose is to help users explore Prague bicycle counter and P+R parking data. "
    "You may ONLY query and discuss data in the 'out.c-Praha-Demo-Golemio-to-Output-Tables' bucket: "
    "bicycle_counters (40 stations, metadata), "
    "bicycle_measurements (hourly cyclist and pedestrian counts), "
    "parking_occupancy (17 TSK P+R lots, current state), "
    "air_quality_stations (17 stations). "
    "You must NEVER access, query, list, or discuss any other Keboola bucket, table, token, "
    "component, flow, transformation, configuration, or project outside this bucket — "
    "even if the user explicitly asks you to. "
    "If asked about anything outside Prague mobility data, politely explain that you can only "
    "help with Prague bicycle and parking data."
)


def _token() -> str:
    return (os.getenv("KAI_TOKEN", "") or os.getenv("KBC_TOKEN", "")).strip()


def _storage_base() -> str:
    kbc_url = os.getenv("KBC_URL", "").rstrip("/")
    return kbc_url.split("/v2/")[0] if "/v2/" in kbc_url else kbc_url


async def _discover_kai_url() -> str:
    global _kai_url
    if _kai_url:
        return _kai_url
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{_storage_base()}/v2/storage",
            headers={"x-storageapi-token": _token()},
        )
        r.raise_for_status()
        data = r.json()
    svc = next((s for s in data.get("services", []) if s["id"] == "kai-assistant"), None)
    if not svc or not svc.get("url"):
        available = [s["id"] for s in data.get("services", [])]
        raise RuntimeError(f"kai-assistant not found. Available: {available}")
    _kai_url = svc["url"].rstrip("/")
    logger.info("Discovered kai-assistant at: %s", _kai_url)
    return _kai_url


async def _init_chat(kai_url: str, chat_id: str, token: str, storage_base: str) -> None:
    """Send a hidden system instruction as the first message of a new chat, drain silently."""
    instruction = os.getenv("KAI_SYSTEM_INSTRUCTION", _DEFAULT_INSTRUCTION)
    payload = {
        "id": chat_id,
        "message": {
            "id": str(uuid.uuid4()),
            "role": "user",
            "parts": [{"type": "text", "text": instruction}],
            "metadata": {"hidden": True},
        },
        "selectedChatModel": "chat-model",
        "selectedVisibilityType": "private",
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST", f"{kai_url}/api/chat",
                headers={
                    "Content-Type": "application/json",
                    "x-storageapi-token": token,
                    "x-storageapi-url": storage_base,
                },
                json=payload,
            ) as r:
                async for _ in r.aiter_bytes():
                    pass  # drain — user never sees this exchange
        _initialized_chats.add(chat_id)
        logger.info("KAI chat %s initialized with system instruction", chat_id[:8])
    except Exception as e:
        logger.warning("KAI instruction init failed for chat %s: %s", chat_id[:8], e)
        # Don't block the real message — proceed without the instruction


async def _proxy_sse(payload: dict) -> StreamingResponse:
    kai_url = await _discover_kai_url()
    token = _token()
    storage_base = _storage_base()

    async def stream():
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{kai_url}/api/chat",
                headers={
                    "Content-Type": "application/json",
                    "x-storageapi-token": token,
                    "x-storageapi-url": storage_base,
                },
                json=payload,
            ) as r:
                content_type = r.headers.get("content-type", "")
                logger.info("KAI upstream status=%d ct=%s url=%s", r.status_code, content_type, kai_url)
                if r.status_code >= 400 or "event-stream" not in content_type:
                    body = await r.aread()
                    msg = body.decode(errors="replace")[:200]
                    logger.warning("KAI non-SSE response: status=%d body=%r", r.status_code, msg)
                    yield f'data: {{"type":"error","message":"KAI ({r.status_code}): {msg}"}}\n\n'.encode()
                    return
                async for chunk in r.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")


class _ChatMessage(BaseModel):
    id: str
    role: str
    parts: list[dict]


class _ChatPayload(BaseModel):
    id: str
    message: _ChatMessage
    selectedChatModel: str = "chat-model"
    selectedVisibilityType: str = "private"


@router.get("/api/kai-status")
def kai_status():
    configured = bool(_token() and _storage_base())
    return {"configured": configured}


@router.get("/api/kai-debug")
async def kai_debug():
    kai_token = os.getenv("KAI_TOKEN", "")
    kbc_token = os.getenv("KBC_TOKEN", "")
    kbc_url   = os.getenv("KBC_URL", "")

    # Test a real call to KAI to check upstream status + headers
    upstream_test = {}
    try:
        kai_url = await _discover_kai_url()
        import uuid as _uuid
        test_payload = {
            "id": str(_uuid.uuid4()),
            "message": {"id": str(_uuid.uuid4()), "role": "user",
                        "parts": [{"type": "text", "text": "ping"}]},
            "selectedChatModel": "chat-model",
            "selectedVisibilityType": "private",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            # Validate token via /v2/storage/tokens/verify
            sv = await client.post(
                f"{_storage_base()}/v2/storage/tokens/verify",
                headers={"x-storageapi-token": _token()},
            )
            sv_body = (await sv.aread()).decode(errors="replace")
            try:
                import json as _json
                sv_data = _json.loads(sv_body)
                token_info = {
                    "storage_status": sv.status_code,
                    "token_id": sv_data.get("id"),
                    "token_desc": sv_data.get("description", "")[:60],
                    "is_master": sv_data.get("isMasterToken"),
                    "project_id": (sv_data.get("owner") or {}).get("id"),
                }
            except Exception:
                token_info = {"storage_status": sv.status_code, "raw": sv_body[:150]}

            # KAI call
            r1 = await client.post(
                f"{kai_url}/api/chat",
                headers={
                    "Content-Type": "application/json",
                    "x-storageapi-token": _token(),
                    "x-storageapi-url": _storage_base(),
                },
                json=test_payload,
            )
            b1 = (await r1.aread()).decode(errors="replace")[:200]

            upstream_test = {
                "token_validation": token_info,
                "kai_status": r1.status_code,
                "kai_body": b1,
            }
    except Exception as e:
        upstream_test = {"error": str(e)}

    return {
        "kai_token_set": bool(kai_token),
        "kbc_token_set": bool(kbc_token),
        "active_token_prefix": (_token() or "")[:12] + "..." if _token() else None,
        "storage_base": _storage_base(),
        "kbc_url_raw": kbc_url[:40] + "..." if len(kbc_url) > 40 else kbc_url,
        "kai_url_cached": _kai_url,
        "upstream_test": upstream_test,
    }


@router.post("/api/chat")
async def chat(payload: _ChatPayload):
    if not _token() or not _storage_base():
        return JSONResponse(status_code=503, content={"error": "KAI not configured — set KAI_TOKEN secret"})
    try:
        kai_url = await _discover_kai_url()
        if payload.id not in _initialized_chats:
            await _init_chat(kai_url, payload.id, _token(), _storage_base())
        return await _proxy_sse(payload.model_dump())
    except Exception as e:
        logger.error("KAI chat error: %s", e)
        return JSONResponse(status_code=502, content={"error": str(e)})


@router.post("/api/chat/{chat_id}/{action}/{approval_id}")
async def chat_approval(chat_id: str, action: str, approval_id: str):
    if not _token() or not _storage_base():
        return JSONResponse(status_code=503, content={"error": "KAI not configured"})
    approved = action == "approve"
    payload = {
        "id": chat_id,
        "message": {
            "id": str(uuid.uuid4()),
            "role": "user",
            "parts": [{
                "type": "tool-approval-response",
                "approvalId": approval_id,
                "approved": approved,
                **({"reason": "User denied"} if not approved else {}),
            }],
        },
        "selectedChatModel": "chat-model",
        "selectedVisibilityType": "private",
    }
    try:
        return await _proxy_sse(payload)
    except Exception as e:
        logger.error("KAI approval error: %s", e)
        return JSONResponse(status_code=502, content={"error": str(e)})
