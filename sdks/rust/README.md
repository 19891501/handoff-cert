# handoff-cert (Rust)

HTTP client for `POST /api/v1/certify` plus **`gate_resume`** (PASS iff
REPRENABLE). Horizon 2030: TLS of agent handoffs.

- **`certify`** omits `ruleset` → frozen receipt **1.0** (`handoff-cert-v1`,
  €0.001). Not a safety gate. KFP-001 is REPRENABLE on 1.0.
- **`gate_resume` / `gate_node`** default to **1.2** (`handoff-gate-v12`,
  €0.05) — the paid grille. KFP-001 is CORROMPU / STOP on 1.2.
- Billing is **`preview`** until the server sets `X402_PAY_TO`. No paying
  customers. Not on crates.io (`publish = false`).

```toml
# git workspace — not crates.io
handoff-cert = { git = "https://github.com/19891501/handoff-cert" }
```

```rust
use handoff_cert::{gate_resume, gate_resume_with, Client};
use serde_json::json;

let paquet = json!({
    "from": "planner",
    "to": "executor",
    "task": "reprendre",
    "work_done": [],
    "work_remaining": ["suite"],
});

// Grille 1.2 — B resumes only if REPRENABLE
let gate = gate_resume(&paquet)?;
if !gate.ok() { /* STOP */ }

// Receipt 1.0 — frozen, not a safety gate
let receipt = Client::new().certify(&paquet, None)?;
assert_eq!(receipt.certificate.ruleset, "1.0");

// Same packet, explicit V0 gate (still PASSes KFP-001)
let v0 = gate_resume_with(&paquet, "1.0")?;
```

`HANDOFF_CERT_URL` overrides the default `http://127.0.0.1:8080`.
Pass `Client::builder().payment(x402)` for an `X-PAYMENT` header — the
client never invents a nonce or a transaction hash.

`wrap_node` is the observer (silence, no judge). `gate_node` is the
attacked couple. Unknown rulesets fail closed before HTTP.

```
cargo test -p handoff-cert
```
