"""Unit tests against a local mock of GET/POST /api/v1/certify. Stdlib only."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from unittest import TestCase

from handoff_cert import (
    BadRequestError,
    Client,
    PaymentRequiredError,
    UnknownRulesetError,
    catalogue,
    certify,
    gate_resume,
)
from handoff_cert.models import ENDPOINT, SKU_RECEIPT

PAQUET = {
    "from": "a",
    "to": "b",
    "task": "reprendre",
    "work_done": [],
    "work_remaining": ["suite"],
}

CERT_10 = {
    "verdict": "REPRENABLE",
    "confidence": 0.99,
    "missing": [],
    "conflicts": [],
    "warnings": [],
    "certificate_id": "hc_test10",
    "ruleset": "1.0",
    "input_hash": "sha256:abc",
    "timestamp": "2026-09-19T00:00:00Z",
}

CERT_12_CORROMPU = {
    **CERT_10,
    "verdict": "CORROMPU",
    "certificate_id": "hc_test12",
    "ruleset": "1.2",
    "conflicts": ["claim vs evidence"],
}

OFFER = {
    "sku": SKU_RECEIPT,
    "price_eur": 0.001,
    "currency": "EUR",
    "billing": "preview",
    "unit": "certificat",
}

CATALOGUE = {
    "sku": SKU_RECEIPT,
    "endpoint": ENDPOINT,
    "price_eur": 0.001,
    "billing": "preview",
    "method": "POST",
    "ruleset": "1.0",
    "rulesets": ["1.0", "1.1", "1.2"],
    "x402": {"enforced": False, "payTo": None, "network": "base-sepolia", "amount": "1000"},
}


class _State:
    last_method = ""
    last_path = ""
    last_body: Any = None
    last_headers: dict[str, str] = {}
    mode = "ok"


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        return

    def _read_json(self) -> Any:
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _send(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        _State.last_method = "GET"
        _State.last_path = self.path
        _State.last_headers = {k: v for k, v in self.headers.items()}
        if _State.mode == "down":
            self._send(500, {"erreur": "interne"})
            return
        self._send(200, CATALOGUE)

    def do_POST(self) -> None:  # noqa: N802
        _State.last_method = "POST"
        _State.last_path = self.path
        _State.last_headers = {k: v for k, v in self.headers.items()}
        try:
            _State.last_body = self._read_json()
        except json.JSONDecodeError:
            self._send(400, {"erreur": "JSON invalide"})
            return
        mode = _State.mode
        if mode == "invalid_json":
            self._send(400, {"erreur": "JSON invalide"})
            return
        if mode == "unknown_ruleset":
            self._send(400, {"erreur": "ruleset inconnu: 9.9"})
            return
        if mode == "402":
            self._send(
                402,
                {
                    "x402Version": 1,
                    "error": "X-PAYMENT header is required",
                    "accepts": [{"scheme": "exact", "network": "base-sepolia"}],
                },
            )
            return
        if mode == "corrupt":
            ruleset = (_State.last_body or {}).get("ruleset") or "1.0"
            cert = dict(CERT_12_CORROMPU)
            cert["ruleset"] = ruleset
            self._send(
                200,
                {
                    "certificate": cert,
                    "integrite": "non_fourni",
                    "offer": OFFER,
                    "payment": {"billing": "preview"},
                },
            )
            return
        if mode == "partiel":
            cert = dict(CERT_10)
            cert["verdict"] = "PARTIEL"
            cert["missing"] = ["work_remaining"]
            self._send(
                200,
                {
                    "certificate": cert,
                    "integrite": "non_fourni",
                    "offer": OFFER,
                    "payment": {"billing": "preview"},
                },
            )
            return
        ruleset = (_State.last_body or {}).get("ruleset") or "1.0"
        cert = dict(CERT_10)
        cert["ruleset"] = ruleset
        self._send(
            200,
            {
                "certificate": cert,
                "integrite": "non_fourni",
                "offer": OFFER,
                "payment": {"billing": "preview"},
            },
        )


class MockServer:
    def __init__(self) -> None:
        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    @property
    def origin(self) -> str:
        host, port = self._httpd.server_address[:2]
        return f"http://{host}:{port}"

    def __enter__(self) -> MockServer:
        _State.mode = "ok"
        _State.last_body = None
        _State.last_headers = {}
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()
        self._thread.join(timeout=2)


class ClientTests(TestCase):
    def test_certify_omits_ruleset_posts_paquet(self) -> None:
        with MockServer() as server:
            client = Client(server.origin)
            res = client.certify(PAQUET)
        self.assertEqual(_State.last_method, "POST")
        self.assertEqual(_State.last_path, ENDPOINT)
        self.assertEqual(_State.last_body, {"paquet": PAQUET})
        self.assertEqual(_State.last_headers.get("Content-Type"), "application/json")
        self.assertTrue((_State.last_headers.get("User-Agent") or "").startswith("handoff-cert-python/"))
        self.assertEqual(res.certificate.verdict, "REPRENABLE")
        self.assertEqual(res.certificate.ruleset, "1.0")
        self.assertEqual(res.offer.sku, SKU_RECEIPT)
        self.assertEqual(res.integrite, "non_fourni")
        self.assertEqual(res.payment and res.payment.billing, "preview")

    def test_certify_ruleset_12(self) -> None:
        with MockServer() as server:
            res = Client(server.origin).certify(PAQUET, ruleset="1.2")
        self.assertEqual(_State.last_body, {"paquet": PAQUET, "ruleset": "1.2"})
        self.assertEqual(res.certificate.ruleset, "1.2")

    def test_unknown_ruleset_fails_closed_before_http(self) -> None:
        with MockServer() as server:
            client = Client(server.origin)
            with self.assertRaises(UnknownRulesetError) as ctx:
                client.certify(PAQUET, ruleset="2.0")
        self.assertIn("ruleset inconnu: 2.0", str(ctx.exception))
        self.assertIsNone(_State.last_body)

    def test_server_unknown_ruleset_maps_400(self) -> None:
        with MockServer() as server:
            _State.mode = "unknown_ruleset"
            with self.assertRaises(UnknownRulesetError) as ctx:
                Client(server.origin).certify(PAQUET)
        self.assertEqual(ctx.exception.status, 400)

    def test_400_json_invalide(self) -> None:
        with MockServer() as server:
            _State.mode = "invalid_json"
            with self.assertRaises(BadRequestError) as ctx:
                Client(server.origin).certify(PAQUET)
        self.assertEqual(ctx.exception.erreur, "JSON invalide")
        self.assertEqual(ctx.exception.status, 400)

    def test_402_payment_required(self) -> None:
        with MockServer() as server:
            _State.mode = "402"
            with self.assertRaises(PaymentRequiredError) as ctx:
                Client(server.origin).certify(PAQUET)
        err = ctx.exception
        self.assertEqual(err.status, 402)
        self.assertEqual(err.error, "X-PAYMENT header is required")
        self.assertEqual(err.x402_version, 1)
        self.assertTrue(err.accepts)

    def test_x_payment_header_forwarded(self) -> None:
        with MockServer() as server:
            Client(server.origin, payment="eyJ4NDAyIjogMX0").certify(PAQUET)
        headers = {k.lower(): v for k, v in _State.last_headers.items()}
        self.assertEqual(headers.get("x-payment"), "eyJ4NDAyIjogMX0")

    def test_catalogue_get(self) -> None:
        with MockServer() as server:
            cat = Client(server.origin).catalogue()
        self.assertEqual(_State.last_method, "GET")
        self.assertEqual(cat.sku, SKU_RECEIPT)
        self.assertEqual(cat.ruleset, "1.0")
        self.assertEqual(cat.rulesets, ("1.0", "1.1", "1.2"))
        self.assertFalse(cat.x402.get("enforced"))

    def test_gate_resume_pass_on_reprenable(self) -> None:
        with MockServer() as server:
            gate = Client(server.origin).gate_resume(PAQUET, ruleset="1.2")
        self.assertEqual(gate.decision, "PASS")
        self.assertTrue(gate.ok)
        self.assertEqual(gate.couple, "CERT+GATE")
        self.assertEqual(gate.ruleset, "1.2")
        self.assertIn("REPRENABLE", gate.reason)

    def test_gate_resume_stop_on_corrompu(self) -> None:
        with MockServer() as server:
            _State.mode = "corrupt"
            gate = Client(server.origin).gate_resume(PAQUET, ruleset="1.2")
        self.assertEqual(gate.decision, "STOP")
        self.assertFalse(gate.ok)
        self.assertEqual(gate.verdict, "CORROMPU")
        self.assertIn("reprise bloquée", gate.reason)

    def test_gate_resume_stop_on_partiel(self) -> None:
        with MockServer() as server:
            _State.mode = "partiel"
            gate = Client(server.origin).gate_resume(PAQUET, ruleset="1.0")
        self.assertEqual(gate.decision, "STOP")
        self.assertEqual(gate.verdict, "PARTIEL")
        self.assertTrue(gate.reason.startswith("V0"))

    def test_gate_resume_defaults_to_1_2(self) -> None:
        with MockServer() as server:
            Client(server.origin).gate_resume(PAQUET)
        self.assertEqual(_State.last_body.get("ruleset"), "1.2")

    def test_module_helpers(self) -> None:
        with MockServer() as server:
            res = certify(PAQUET, base_url=server.origin)
            cat = catalogue(base_url=server.origin)
            gate = gate_resume(PAQUET, base_url=server.origin, ruleset="1.0")
        self.assertEqual(res.offer.sku, SKU_RECEIPT)
        self.assertEqual(cat.method, "POST")
        self.assertEqual(gate.decision, "PASS")

    def test_certificate_fail_closed_on_missing_verdict(self) -> None:
        from handoff_cert.models import Certificate

        with self.assertRaises(ValueError):
            Certificate.from_dict({"certificate_id": "x", "ruleset": "1.0"})

    def test_no_fake_pypi_classifier(self) -> None:
        text = (Path_pyproject()).read_text(encoding="utf-8")
        self.assertIn("Private :: Do Not Upload", text)
        self.assertNotIn("twine", text.lower())


def Path_pyproject():
    from pathlib import Path

    return Path(__file__).resolve().parents[1] / "pyproject.toml"
