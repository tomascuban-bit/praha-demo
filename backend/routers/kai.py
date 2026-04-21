"""
KAI (Keboola AI Assistant) — SSE proxy router.

Credentials (set as Keboola secrets):
  KAI_TOKEN   — master Keboola token (required; auto-injected KBC_TOKEN returns 401)
  KBC_URL     — auto-injected by Keboola platform
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


def _token() -> str:
    return os.getenv("KAI_TOKEN") or os.getenv("KBC_TOKEN", "")


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
                    "Authorization": f"Bearer {token}",
                    "x-storageapi-token": token,
                    "x-storageapi-url": storage_base,
                },
                json=payload,
            ) as r:
                logger.info("KAI upstream status: %d", r.status_code)
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
def kai_debug():
    kai_token = os.getenv("KAI_TOKEN", "")
    kbc_token = os.getenv("KBC_TOKEN", "")
    kbc_url   = os.getenv("KBC_URL", "")
    return {
        "kai_token_set": bool(kai_token),
        "kbc_token_set": bool(kbc_token),
        "active_token_prefix": (_token() or "")[:12] + "..." if _token() else None,
        "storage_base": _storage_base(),
        "kbc_url_raw": kbc_url[:40] + "..." if len(kbc_url) > 40 else kbc_url,
        "kai_url_cached": _kai_url,
    }


@router.post("/api/chat")
async def chat(payload: _ChatPayload):
    if not _token() or not _storage_base():
        return JSONResponse(status_code=503, content={"error": "KAI not configured — set KAI_TOKEN secret"})
    try:
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
