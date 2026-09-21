"""Wire types for GET/POST /api/v1/certify. Extra fields are kept, required ones fail closed."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Mapping

Verdict = Literal["REPRENABLE", "PARTIEL", "CORROMPU"]
Ruleset = Literal["1.0", "1.1", "1.2"]
GateDecision = Literal["PASS", "STOP"]

SOLD_RULESETS: tuple[Ruleset, ...] = ("1.0", "1.1", "1.2")
VERDICTS: tuple[Verdict, ...] = ("REPRENABLE", "PARTIEL", "CORROMPU")

SKU_RECEIPT = "handoff-cert-v1"
SKU_GATE = "handoff-gate-v12"
ENDPOINT = "/api/v1/certify"


def _require_str(data: Mapping[str, Any], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or value == "":
        raise ValueError(f"champ manquant ou invalide: {key}")
    return value


def _str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


@dataclass(frozen=True)
class IssuerSig:
    """On-wire issuer signature. Not an identity of agent A. Absent when unsigned."""

    signature: str
    key_id: str

    @classmethod
    def from_dict(cls, data: Any) -> IssuerSig | None:
        if not isinstance(data, Mapping):
            return None
        sig = data.get("signature")
        key_id = data.get("key_id")
        if not isinstance(sig, str) or not isinstance(key_id, str):
            return None
        if not sig or not key_id:
            return None
        return cls(signature=sig, key_id=key_id)


@dataclass(frozen=True)
class Certificate:
    """Public certificate as returned by POST /api/v1/certify."""

    verdict: Verdict
    confidence: float
    missing: tuple[str, ...]
    conflicts: tuple[str, ...]
    warnings: tuple[str, ...]
    certificate_id: str
    ruleset: str
    input_hash: str
    timestamp: str
    issuer_sig: IssuerSig | None = None
    extra: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Any) -> Certificate:
        if not isinstance(data, Mapping):
            raise ValueError("certificate manquant")
        verdict_raw = _require_str(data, "verdict")
        if verdict_raw not in VERDICTS:
            raise ValueError(f"verdict inconnu: {verdict_raw}")
        confidence = data.get("confidence", 0.0)
        if not isinstance(confidence, (int, float)):
            confidence = 0.0
        known = {
            "verdict",
            "confidence",
            "missing",
            "conflicts",
            "warnings",
            "certificate_id",
            "ruleset",
            "input_hash",
            "timestamp",
            "issuer_sig",
        }
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            verdict=verdict_raw,  # type: ignore[arg-type]
            confidence=float(confidence),
            missing=tuple(_str_list(data.get("missing"))),
            conflicts=tuple(_str_list(data.get("conflicts"))),
            warnings=tuple(_str_list(data.get("warnings"))),
            certificate_id=_require_str(data, "certificate_id"),
            ruleset=_require_str(data, "ruleset"),
            input_hash=_require_str(data, "input_hash"),
            timestamp=_require_str(data, "timestamp"),
            issuer_sig=IssuerSig.from_dict(data.get("issuer_sig")),
            extra=extra,
        )


@dataclass(frozen=True)
class Offer:
    sku: str
    price_eur: float
    currency: str
    billing: str
    unit: str

    @classmethod
    def from_dict(cls, data: Any) -> Offer:
        if not isinstance(data, Mapping):
            raise ValueError("offer manquant")
        price = data.get("price_eur", 0)
        if not isinstance(price, (int, float)):
            price = 0.0
        return cls(
            sku=_require_str(data, "sku"),
            price_eur=float(price),
            currency=str(data.get("currency") or "EUR"),
            billing=str(data.get("billing") or "preview"),
            unit=str(data.get("unit") or "certificat"),
        )


@dataclass(frozen=True)
class Payment:
    """Preview: billing=preview. Enforced x402: payer + transaction + network."""

    billing: str | None = None
    payer: str | None = None
    transaction: str | None = None
    network: str | None = None
    extra: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Any) -> Payment | None:
        if not isinstance(data, Mapping):
            return None
        known = {"billing", "payer", "transaction", "network"}
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            billing=data.get("billing") if isinstance(data.get("billing"), str) else None,
            payer=data.get("payer") if isinstance(data.get("payer"), str) else None,
            transaction=data.get("transaction") if isinstance(data.get("transaction"), str) else None,
            network=data.get("network") if isinstance(data.get("network"), str) else None,
            extra=extra,
        )


@dataclass(frozen=True)
class CertifyResponse:
    certificate: Certificate
    integrite: str
    offer: Offer
    payment: Payment | None = None
    extra: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Any) -> CertifyResponse:
        if not isinstance(data, Mapping):
            raise ValueError("réponse certify invalide")
        known = {"certificate", "integrite", "offer", "payment"}
        extra = {k: v for k, v in data.items() if k not in known}
        integrite = data.get("integrite")
        if not isinstance(integrite, str):
            integrite = "non_fourni"
        return cls(
            certificate=Certificate.from_dict(data.get("certificate")),
            integrite=integrite,
            offer=Offer.from_dict(data.get("offer")),
            payment=Payment.from_dict(data.get("payment")),
            extra=extra,
        )


@dataclass(frozen=True)
class Catalogue:
    sku: str
    endpoint: str
    price_eur: float
    billing: str
    method: str
    ruleset: str
    rulesets: tuple[str, ...]
    x402: Mapping[str, Any]
    extra: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Any) -> Catalogue:
        if not isinstance(data, Mapping):
            raise ValueError("catalogue invalide")
        price = data.get("price_eur", 0)
        if not isinstance(price, (int, float)):
            price = 0.0
        rulesets = data.get("rulesets") or []
        if not isinstance(rulesets, list):
            rulesets = []
        x402 = data.get("x402")
        if not isinstance(x402, Mapping):
            x402 = {}
        known = {
            "sku",
            "endpoint",
            "price_eur",
            "billing",
            "method",
            "ruleset",
            "rulesets",
            "x402",
        }
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            sku=_require_str(data, "sku"),
            endpoint=str(data.get("endpoint") or ENDPOINT),
            price_eur=float(price),
            billing=str(data.get("billing") or "preview"),
            method=str(data.get("method") or "POST"),
            ruleset=str(data.get("ruleset") or "1.0"),
            rulesets=tuple(str(item) for item in rulesets),
            x402=dict(x402),
            extra=extra,
        )


@dataclass(frozen=True)
class GateResult:
    """HTTP equivalent of gateResume: B resumes only if the notary says REPRENABLE."""

    couple: Literal["CERT+GATE"]
    ruleset: str
    decision: GateDecision
    verdict: Verdict
    reason: str
    certificate: Certificate
    response: CertifyResponse

    @property
    def ok(self) -> bool:
        return self.decision == "PASS"
