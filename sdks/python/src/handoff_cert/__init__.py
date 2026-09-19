"""HANDOFF CERT Python client — POST /api/v1/certify.

Horizon 2030. TLS of agent handoffs. Not a local judge. Not on PyPI.
V0 (ruleset 1.0) is a frozen receipt, not a safety gate. 1.2 is the paid grille.
"""

from .client import Client, catalogue, certify, gate_resume
from .errors import (
    BadRequestError,
    HandoffError,
    PaymentRequiredError,
    TransportError,
    UnknownRulesetError,
)
from .models import (
    ENDPOINT,
    SKU_GATE,
    SKU_RECEIPT,
    SOLD_RULESETS,
    Catalogue,
    Certificate,
    CertifyResponse,
    GateResult,
    Offer,
    Payment,
)

__version__ = "0.1.0"
__all__ = [
    "ENDPOINT",
    "SKU_GATE",
    "SKU_RECEIPT",
    "SOLD_RULESETS",
    "BadRequestError",
    "Catalogue",
    "Certificate",
    "CertifyResponse",
    "Client",
    "GateResult",
    "HandoffError",
    "Offer",
    "Payment",
    "PaymentRequiredError",
    "TransportError",
    "UnknownRulesetError",
    "catalogue",
    "certify",
    "gate_resume",
]
