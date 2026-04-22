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

# The default instruction is intentionally generic — no internal table FQNs or database names.
# In production, set KAI_SYSTEM_INSTRUCTION as a Keboola secret with the full instruction
# including Snowflake fully-qualified table names and column schemas.
_DEFAULT_INSTRUCTION = """You are a Prague city mobility data assistant for the Keboola Demo App. \
You can answer questions about bicycle counter measurements and P+R parking occupancy in Prague. \
Never access any data outside of what is described here. \
If asked about anything else, say you can only help with Prague mobility data."""


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



async def _proxy_sse(payload: dict) -> StreamingResponse:
    kai_url = await _discover_kai_url()
    token = _token()
    storage_base = _storage_base()

    async def stream():
        import asyncio
        queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        errors: list[str] = []

        async def fetch_kai() -> None:
            try:
                async with httpx.AsyncClient(timeout=300) as client:
                    async with client.stream(
                        "POST", f"{kai_url}/api/chat",
                        headers={
                            "Content-Type": "application/json",
                            "x-storageapi-token": token,
                            "x-storageapi-url": storage_base,
                        },
                        json=payload,
                    ) as r:
                        ct = r.headers.get("content-type", "")
                        logger.info("KAI upstream status=%d ct=%s", r.status_code, ct)
                        if r.status_code >= 400 or "event-stream" not in ct:
                            body = await r.aread()
                            msg = body.decode(errors="replace")[:200]
                            logger.warning("KAI non-SSE: status=%d body=%r", r.status_code, msg)
                            errors.append(f"KAI ({r.status_code}): {msg}")
                        else:
                            async for chunk in r.aiter_bytes():
                                await queue.put(chunk)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                await queue.put(None)

        asyncio.create_task(fetch_kai())

        # Forward KAI chunks; send keepalive comments while waiting so proxies don't time out
        while True:
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=5.0)
                if chunk is None:
                    break
                yield chunk
            except asyncio.TimeoutError:
                yield b": keepalive\n\n"

        if errors:
            safe = errors[0].replace('"', "'")
            yield f'data: {{"type":"error","message":"{safe}"}}\n\n'.encode()

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



@router.post("/api/chat")
async def chat(payload: _ChatPayload):
    if not _token() or not _storage_base():
        return JSONResponse(status_code=503, content={"error": "KAI not configured — set KAI_TOKEN secret"})
    try:
        payload_dict = payload.model_dump()

        # First message of a new chat: prepend the system instruction to the user's text.
        # The frontend stores and displays the original text locally; KAI gets the full context.
        if payload.id not in _initialized_chats:
            instruction = os.getenv("KAI_SYSTEM_INSTRUCTION", _DEFAULT_INSTRUCTION)
            parts = payload_dict.get("message", {}).get("parts", [])
            if parts and parts[0].get("type") == "text":
                parts[0]["text"] = f"{instruction}\n\n---\n\nUser question: {parts[0]['text']}"
            _initialized_chats.add(payload.id)
            logger.info("KAI chat %s: system instruction prepended", payload.id[:8])

        return await _proxy_sse(payload_dict)
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
