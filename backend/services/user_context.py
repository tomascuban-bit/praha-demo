"""User context from Keboola OIDC headers."""
from __future__ import annotations
from dataclasses import dataclass
from fastapi import Request


@dataclass
class UserContext:
    email: str | None
    role: str | None
    is_authenticated: bool


def get_user_context(request: Request) -> UserContext:
    email = request.headers.get("x-kbc-user-email")
    role = request.headers.get("x-kbc-user-role")
    return UserContext(
        email=email,
        role=role,
        is_authenticated=bool(email),
    )
