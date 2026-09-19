"""Optional live tests against a running HANDOFF CERT server. Skip if down.

Never kill port 8080. Override origin with HANDOFF_CERT_BASE.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from unittest import TestCase, skipUnless

from handoff_cert import Client, UnknownRulesetError
from handoff_cert.errors import TransportError
from handoff_cert.models import SKU_RECEIPT

DEFAULT_BASE = os.environ.get("HANDOFF_CERT_BASE", "http://127.0.0.1:8080")

KFP001_PATH = (
    Path(__file__).resolve().parents[3] / "falsification" / "cases" / "KFP-001.json"
)


def _server_up(base: str) -> bool:
    url = base.rstrip("/") + "/api/v1/certify"
    try:
        req = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            return int(getattr(resp, "status", 200) or 200) == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


LIVE = _server_up(DEFAULT_BASE)


def _kfp001_packet() -> object:
    data = json.loads(KFP001_PATH.read_text(encoding="utf-8"))
    return data["input_packet"]


@skipUnless(LIVE, f"server down at {DEFAULT_BASE}")
class LiveCertifyTests(TestCase):
    def setUp(self) -> None:
        self.client = Client(DEFAULT_BASE, timeout=10)

    def test_catalogue_sold_rulesets(self) -> None:
        cat = self.client.catalogue()
        self.assertEqual(cat.sku, SKU_RECEIPT)
        self.assertEqual(cat.ruleset, "1.0")
        self.assertEqual(cat.method, "POST")
        self.assertIn("1.0", cat.rulesets)
        self.assertIn("1.2", cat.rulesets)

    def test_simple_packet_reprenable_10(self) -> None:
        res = self.client.certify(
            {
                "from": "a",
                "to": "b",
                "task": "suite",
                "work_done": [],
                "work_remaining": ["suite"],
            }
        )
        self.assertEqual(res.certificate.verdict, "REPRENABLE")
        self.assertEqual(res.certificate.ruleset, "1.0")
        self.assertEqual(res.offer.sku, SKU_RECEIPT)
        self.assertEqual(res.integrite, "non_fourni")
        self.assertEqual(res.offer.billing, "preview")

    def test_kfp001_omit_stays_v0_reprenable(self) -> None:
        """V0 is frozen. KFP-001 must remain a false REPRENABLE on 1.0."""
        if not KFP001_PATH.is_file():
            self.skipTest("KFP-001.json absent")
        res = self.client.certify(_kfp001_packet())
        self.assertEqual(res.certificate.verdict, "REPRENABLE")
        self.assertEqual(res.certificate.ruleset, "1.0")

    def test_kfp001_ruleset_12_corrompu_gate_stop(self) -> None:
        if not KFP001_PATH.is_file():
            self.skipTest("KFP-001.json absent")
        packet = _kfp001_packet()
        res = self.client.certify(packet, ruleset="1.2")
        self.assertEqual(res.certificate.verdict, "CORROMPU")
        self.assertEqual(res.certificate.ruleset, "1.2")
        gate = self.client.gate_resume(packet, ruleset="1.2")
        self.assertEqual(gate.decision, "STOP")
        self.assertFalse(gate.ok)

    def test_unknown_ruleset_400(self) -> None:
        with self.assertRaises(UnknownRulesetError):
            self.client.certify({"from": "a", "to": "b"}, ruleset="9.9")

    def test_transport_error_on_dead_port(self) -> None:
        dead = Client("http://127.0.0.1:9", timeout=1)
        with self.assertRaises(TransportError):
            dead.catalogue()
