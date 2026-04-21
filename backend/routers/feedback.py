"""
Feedback — accepts a message + sender email and forwards to the configured recipient via SMTP.

Required env vars (set as Keboola secrets):
  FEEDBACK_TO_EMAIL  — address to receive feedback (never exposed to frontend)
  SMTP_FROM          — address to send from (e.g. a Gmail address)
  SMTP_PASSWORD      — SMTP password / Gmail App Password

Optional:
  SMTP_HOST  — default smtp.gmail.com
  SMTP_PORT  — default 587 (STARTTLS)
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


class FeedbackIn(BaseModel):
    sender_email: str
    message: str


@router.post("/api/feedback")
def submit_feedback(payload: FeedbackIn):
    sender = payload.sender_email.strip()
    message = payload.message.strip()

    if not sender or not message or len(message) < 5:
        return {"ok": False, "reason": "invalid_input"}

    to_email = os.getenv("FEEDBACK_TO_EMAIL", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not all([to_email, smtp_from, smtp_password]):
        logger.warning("Feedback submitted but SMTP not configured — skipping send")
        return {"ok": False, "reason": "not_configured"}

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg["Subject"] = f"Keboola Demo App — Feedback"
        body = f"Od: {sender}\n\n{message}"
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_from, smtp_password)
            server.send_message(msg)

        logger.info("Feedback email sent")
        return {"ok": True}

    except Exception:
        logger.error("Failed to send feedback email", exc_info=True)
        return {"ok": False, "reason": "send_error"}
