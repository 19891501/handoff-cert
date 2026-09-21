# HANDOFF CERT — client Python

HTTP client for `POST /api/v1/certify`. Stdlib only. **Not on PyPI.**
Do not `twine upload`. Install from this repository.

Horizon 2030: TLS of agent handoffs. V0 (`1.0`, SKU `handoff-cert-v1`, 0.001 €)
is a **frozen receipt**, not a safety gate. Ruleset **1.2** (SKU
`handoff-gate-v12`, 0.05 €) is the paid grille. Billing is `preview` until
`X402_PAY_TO` is set. No paying customers claimed. MIT, not a standard.

```
AGENT A  →  POST /api/v1/certify  →  certificat  →  AGENT B
```

## Install

```bash
pip install -e ./sdks/python
# or, without install:
PYTHONPATH=sdks/python/src python3 -c "from handoff_cert import Client"
```

## Certify

```python
from handoff_cert import Client

client = Client("http://127.0.0.1:8080")
res = client.certify(
    {
        "from": "a",
        "to": "b",
        "task": "reprendre",
        "work_done": [],
        "work_remaining": ["suite"],
    }
)
print(res.certificate.verdict)   # REPRENABLE | PARTIEL | CORROMPU
print(res.certificate.ruleset)   # 1.0 when omitted
print(res.offer.sku)             # handoff-cert-v1
print(res.integrite)             # non_fourni
```

Ruleset 1.2 (grille) — the server still returns the HTTP offer SKU it sells:

```python
res = client.certify(paquet, ruleset="1.2")
```

Unknown rulesets raise `UnknownRulesetError` (400). Invalid JSON on the wire
raises `BadRequestError`. When x402 is enforced and `X-PAYMENT` is missing,
`PaymentRequiredError` (402) — never a fake nonce.

## gateResume (HTTP)

B resumes only if the notary says REPRENABLE. Default ruleset **1.2**.
CERT+GATE on 1.0 is dead (KFP-001: world CORROMPU, V0 REPRENABLE, gate PASS).

```python
gate = client.gate_resume(paquet)          # ruleset 1.2
if not gate.ok:
    raise SystemExit(gate.reason)          # STOP
# B may goto
```

## Catalogue

```python
cat = client.catalogue()
# sku handoff-cert-v1, rulesets ("1.0", "1.1", "1.2"), x402.enforced
```

## Tests

```bash
cd sdks/python
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

Live tests hit `HANDOFF_CERT_BASE` (default `http://127.0.0.1:8080`) and skip
if the server is down. They never stop the process on 8080.

No local judge. No invented 1.2 engine. No PyPI publish.
