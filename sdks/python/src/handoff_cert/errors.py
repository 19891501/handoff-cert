"""Errors for the HANDOFF CERT HTTP client. Fail closed. Never invent a verdict."""

from __future__ import annotations

from typing import Any


class HandoffError(Exception):
    """Base error for the certify client."""

    def __init__(self, message: str, *, status: int | None = None, body: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class BadRequestError(HandoffError):
    """HTTP 400 — JSON invalide, ruleset inconnu, or certification impossible."""

    def __init__(self, message: str, *, status: int = 400, body: Any = None) -> None:
        super().__init__(message, status=status, body=body)
        self.erreur = _erreur_of(body, message)


class UnknownRulesetError(BadRequestError):
    """ruleset is not 1.0 / 1.1 / 1.2. Server would 400; client fails closed first."""


class PaymentRequiredError(HandoffError):
    """HTTP 402 — x402 payment required. Preview billing does not raise this."""

    def __init__(self, message: str, *, status: int = 402, body: Any = None) -> None:
        super().__init__(message, status=status, body=body)
        payload = body if isinstance(body, dict) else {}
        self.x402_version = payload.get("x402Version")
        self.error = payload.get("error", message)
        self.accepts = payload.get("accepts") or []
        self.settlement = payload.get("settlement")


class TransportError(HandoffError):
    """Network / timeout / unreadable response. Not a verdict."""


def _erreur_of(body: Any, fallback: str) -> str:
    if isinstance(body, dict) and isinstance(body.get("erreur"), str):
        return body["erreur"]
    return fallback
