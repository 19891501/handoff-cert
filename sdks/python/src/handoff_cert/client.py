"""HTTP client for POST /api/v1/certify.

Does not judge locally. Does not invent a 1.2 engine. Does not publish to PyPI.
Billing is whatever the server returns (preview until X402_PAY_TO is set).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Mapping
from urllib.parse import urljoin

from .errors import (
    BadRequestError,
    HandoffError,
    PaymentRequiredError,
    TransportError,
    UnknownRulesetError,
)
from .models import (
    ENDPOINT,
    SOLD_RULESETS,
    Catalogue,
    CertifyResponse,
    GateDecision,
    GateResult,
    Ruleset,
)

__version__ = "0.1.0"

_DEFAULT_BASE = "http://127.0.0.1:8080"
_UA = f"handoff-cert-python/{__version__}"


def _judge_label(ruleset: str) -> str:
    return "V0" if ruleset == "1.0" else f"V{ruleset}"


def _gate_reason(verdict: str, ruleset: str) -> str:
    label = _judge_label(ruleset)
    if verdict == "REPRENABLE":
        return f"{label} : REPRENABLE — B est autorisé à reprendre."
    if verdict == "CORROMPU":
        return f"{label} : CORROMPU — reprise bloquée."
    return f"{label} : PARTIEL — reprise bloquée (reste non repris comme achevé)."


class Client:
    """Synchronous client for GET/POST /api/v1/certify.

    Parameters
    ----------
    base_url:
        Origin of the HANDOFF CERT server. Default is the local preview.
    timeout:
        urllib timeout in seconds.
    payment:
        Optional ``X-PAYMENT`` header (x402 exact / EIP-3009). Ignored in
        preview when the server has no ``X402_PAY_TO``. Never invents a nonce.
    """

    def __init__(
        self,
        base_url: str = _DEFAULT_BASE,
        *,
        timeout: float = 30.0,
        payment: str | None = None,
        user_agent: str = _UA,
        opener: urllib.request.OpenerDirector | None = None,
    ) -> None:
        origin = (base_url or _DEFAULT_BASE).rstrip("/")
        self.base_url = origin
        self.timeout = timeout
        self.payment = payment
        self.user_agent = user_agent
        self._opener = opener or urllib.request.build_opener()

    @property
    def certify_url(self) -> str:
        return urljoin(self.base_url + "/", ENDPOINT.lstrip("/"))

    def catalogue(self) -> Catalogue:
        """GET /api/v1/certify — SKU, sold rulesets, x402 catalogue. Public."""
        status, body = self._request("GET", self.certify_url)
        if status != 200:
            self._raise_status(status, body)
        return Catalogue.from_dict(body)

    def certify(
        self,
        paquet: Any,
        *,
        ruleset: str | None = None,
        payment: str | None = None,
    ) -> CertifyResponse:
        """POST /api/v1/certify.

        ``paquet`` is the handoff packet (from/to/task/…), not the HTTP envelope.
        Omit ``ruleset`` for the frozen receipt 1.0 (SKU ``handoff-cert-v1``).
        Pass ``1.2`` for the paid grille. Unknown rulesets fail closed (400).
        """
        payload = self._encode_body(paquet, ruleset)
        header = payment if payment is not None else self.payment
        status, body = self._request("POST", self.certify_url, payload, payment=header)
        if status != 200:
            self._raise_status(status, body)
        try:
            return CertifyResponse.from_dict(body)
        except ValueError as exc:
            raise HandoffError(str(exc), status=status, body=body) from exc

    def gate_resume(
        self,
        paquet: Any,
        *,
        ruleset: str = "1.2",
        payment: str | None = None,
    ) -> GateResult:
        """HTTP equivalent of ``gateResume``.

        B resumes only if the notary says REPRENABLE. Default ruleset is **1.2**
        (paid grille). CERT+GATE on 1.0 is dead — KFP-001 is the first
        counter-example (world CORROMPU, V0 REPRENABLE, gate PASS).
        """
        chosen = ruleset if ruleset is not None else "1.2"
        self._check_ruleset(chosen)
        response = self.certify(paquet, ruleset=chosen, payment=payment)
        cert = response.certificate
        decision: GateDecision = "PASS" if cert.verdict == "REPRENABLE" else "STOP"
        return GateResult(
            couple="CERT+GATE",
            ruleset=cert.ruleset,
            decision=decision,
            verdict=cert.verdict,
            reason=_gate_reason(cert.verdict, cert.ruleset),
            certificate=cert,
            response=response,
        )

    def _encode_body(self, paquet: Any, ruleset: str | None) -> dict[str, Any]:
        body: dict[str, Any] = {"paquet": paquet}
        if ruleset is None or ruleset == "":
            return body
        self._check_ruleset(ruleset)
        body["ruleset"] = ruleset
        return body

    @staticmethod
    def _check_ruleset(ruleset: str) -> Ruleset:
        if ruleset not in SOLD_RULESETS:
            raise UnknownRulesetError(
                f"ruleset inconnu: {ruleset}",
                body={"erreur": f"ruleset inconnu: {ruleset}"},
            )
        return ruleset  # type: ignore[return-value]

    def _request(
        self,
        method: str,
        url: str,
        payload: Mapping[str, Any] | None = None,
        *,
        payment: str | None = None,
    ) -> tuple[int, Any]:
        headers = {
            "Accept": "application/json",
            "User-Agent": self.user_agent,
        }
        data: bytes | None = None
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if payment:
            headers["X-PAYMENT"] = payment
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                raw = response.read()
                status = int(getattr(response, "status", 200) or 200)
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            status = int(exc.code)
        except urllib.error.URLError as exc:
            raise TransportError(f"certify injoignable: {exc.reason}") from exc
        except TimeoutError as exc:
            raise TransportError("certify timeout") from exc
        return status, self._decode(raw, status)

    @staticmethod
    def _decode(raw: bytes, status: int) -> Any:
        if not raw:
            return {}
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HandoffError("réponse non UTF-8", status=status, body=raw) from exc
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise HandoffError("réponse JSON invalide", status=status, body=text) from exc

    @staticmethod
    def _raise_status(status: int, body: Any) -> None:
        if status == 402:
            message = "paiement requis"
            if isinstance(body, dict) and isinstance(body.get("error"), str):
                message = body["error"]
            raise PaymentRequiredError(message, body=body)
        message = "certification impossible"
        if isinstance(body, dict) and isinstance(body.get("erreur"), str):
            message = body["erreur"]
        if status == 400:
            if isinstance(message, str) and message.startswith("ruleset inconnu"):
                raise UnknownRulesetError(message, body=body)
            raise BadRequestError(message, body=body)
        raise HandoffError(message, status=status, body=body)


def certify(
    paquet: Any,
    *,
    base_url: str = _DEFAULT_BASE,
    ruleset: str | None = None,
    payment: str | None = None,
    timeout: float = 30.0,
) -> CertifyResponse:
    """Module-level POST /api/v1/certify."""
    return Client(base_url, timeout=timeout, payment=payment).certify(
        paquet, ruleset=ruleset, payment=payment
    )


def gate_resume(
    paquet: Any,
    *,
    base_url: str = _DEFAULT_BASE,
    ruleset: str = "1.2",
    payment: str | None = None,
    timeout: float = 30.0,
) -> GateResult:
    """Module-level HTTP gateResume. Default ruleset 1.2 (grille)."""
    return Client(base_url, timeout=timeout, payment=payment).gate_resume(
        paquet, ruleset=ruleset, payment=payment
    )


def catalogue(
    *,
    base_url: str = _DEFAULT_BASE,
    timeout: float = 30.0,
) -> Catalogue:
    """Module-level GET /api/v1/certify."""
    return Client(base_url, timeout=timeout).catalogue()
