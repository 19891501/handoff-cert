//! HANDOFF CERT — TLS of agent handoffs.
//!
//! HTTP client for `POST /api/v1/certify` plus `gate_resume` (PASS iff REPRENABLE).
//!
//! - [`certify`] defaults to ruleset **1.0** — frozen receipt, not a safety gate.
//! - [`gate_resume`] defaults to ruleset **1.2** — the paid grille (€0.05, preview).
//! - Billing is `preview` until the server sets `X402_PAY_TO`. No paying customers.
//! - Not published to crates.io (`publish = false`).
//!
//! ```no_run
//! use handoff_cert::{gate_resume, Client};
//! use serde_json::json;
//!
//! let paquet = json!({
//!     "from": "a",
//!     "to": "b",
//!     "task": "reprendre",
//!     "work_done": [],
//!     "work_remaining": ["suite"],
//! });
//! let gate = gate_resume(&paquet)?; // ruleset 1.2
//! if !gate.ok() {
//!     // STOP — B does not resume
//! }
//! let receipt = Client::new().certify(&paquet, None)?; // ruleset 1.0
//! # Ok::<(), handoff_cert::Error>(())
//! ```

mod client;
mod error;
mod node;
mod types;

pub use client::{
    catalogue, certify, certify_with, gate_resume, gate_resume_with, Client, ClientBuilder,
};
pub use error::Error;
pub use node::{gate_node, is_handoff_command, read_goto, wrap_node, LANGGRAPH_END};
pub use types::{
    sku_for, Catalogue, Certificate, CertifyResponse, GateDecision, GateResult, IssuerSig, Offer,
    Payment, Verdict, DEFAULT_BASE_URL, ENDPOINT, RULESET_GRILLE, RULESET_NOTARY, RULESET_RECEIPT,
    SKU_GATE, SKU_RECEIPT, SOLD_RULESETS,
};

#[allow(non_snake_case)]
pub use gate_node as gateNode;
/// CamelCase aliases matching the TypeScript API (`gateResume`, `gateNode`, `wrapNode`).
#[allow(non_snake_case)]
pub use gate_resume as gateResume;
#[allow(non_snake_case)]
pub use wrap_node as wrapNode;
