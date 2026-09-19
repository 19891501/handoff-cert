//! Wire types for GET/POST `/api/v1/certify`. Extra fields are kept.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// Sold rulesets. Unknown values fail closed (400 / [`crate::Error::UnknownRuleset`]).
pub const SOLD_RULESETS: [&str; 3] = ["1.0", "1.1", "1.2"];

/// Frozen receipt. Not a safety gate. €0.001. SKU `handoff-cert-v1`.
pub const RULESET_RECEIPT: &str = "1.0";
/// Paid grille. B resumes only if this notary says REPRENABLE. €0.05.
pub const RULESET_GRILLE: &str = "1.2";
/// Experimental boolean notary. Never a silent patch of 1.0. Not sold as the grille.
pub const RULESET_NOTARY: &str = "1.1";

pub const SKU_RECEIPT: &str = "handoff-cert-v1";
pub const SKU_GATE: &str = "handoff-gate-v12";
pub const ENDPOINT: &str = "/api/v1/certify";
pub const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8080";

pub fn is_sold_ruleset(ruleset: &str) -> bool {
    SOLD_RULESETS.contains(&ruleset)
}

/// Machine verdict. Faux REPRENABLE is the critical error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Verdict {
    #[serde(rename = "REPRENABLE")]
    Reprenable,
    #[serde(rename = "PARTIEL")]
    Partiel,
    #[serde(rename = "CORROMPU")]
    Corrompu,
}

impl Verdict {
    pub fn as_str(self) -> &'static str {
        match self {
            Verdict::Reprenable => "REPRENABLE",
            Verdict::Partiel => "PARTIEL",
            Verdict::Corrompu => "CORROMPU",
        }
    }
}

impl std::fmt::Display for Verdict {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// B resumes only on PASS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum GateDecision {
    Pass,
    Stop,
}

impl GateDecision {
    pub fn as_str(self) -> &'static str {
        match self {
            GateDecision::Pass => "PASS",
            GateDecision::Stop => "STOP",
        }
    }
}

/// On-wire issuer signature. Absent when unsigned. Not an identity of agent A.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IssuerSig {
    pub signature: String,
    pub key_id: String,
}

/// Public certificate as returned by POST `/api/v1/certify`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Certificate {
    pub verdict: Verdict,
    pub confidence: f64,
    #[serde(default)]
    pub missing: Vec<String>,
    #[serde(default)]
    pub conflicts: Vec<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
    pub certificate_id: String,
    pub ruleset: String,
    pub input_hash: String,
    pub timestamp: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuer_sig: Option<IssuerSig>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Offer {
    pub sku: String,
    pub price_eur: f64,
    #[serde(default = "eur")]
    pub currency: String,
    #[serde(default = "preview")]
    pub billing: String,
    #[serde(default = "certificat")]
    pub unit: String,
}

fn eur() -> String {
    "EUR".into()
}
fn preview() -> String {
    "preview".into()
}
fn certificat() -> String {
    "certificat".into()
}

/// Preview: `billing = preview`. Enforced x402: payer + transaction + network.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Payment {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transaction: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl Payment {
    pub fn is_preview(&self) -> bool {
        self.billing.as_deref() == Some("preview") || self.transaction.is_none()
    }
}

/// Two layers, never fused: `certificate` (verdict) and `integrite` (`non_fourni`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CertifyResponse {
    pub certificate: Certificate,
    #[serde(default = "non_fourni")]
    pub integrite: String,
    pub offer: Offer,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment: Option<Payment>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

fn non_fourni() -> String {
    "non_fourni".into()
}

/// GET `/api/v1/certify` catalogue. Sold SKU on the wire is the receipt.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Catalogue {
    pub sku: String,
    #[serde(default = "endpoint")]
    pub endpoint: String,
    pub price_eur: f64,
    #[serde(default = "preview")]
    pub billing: String,
    #[serde(default = "post")]
    pub method: String,
    #[serde(default = "one_oh")]
    pub ruleset: String,
    #[serde(default)]
    pub rulesets: Vec<String>,
    #[serde(default)]
    pub x402: Value,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

fn endpoint() -> String {
    ENDPOINT.into()
}
fn post() -> String {
    "POST".into()
}
fn one_oh() -> String {
    "1.0".into()
}

/// HTTP equivalent of `gateResume`: B resumes only if the notary says REPRENABLE.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GateResult {
    pub couple: &'static str,
    pub ruleset: String,
    pub decision: GateDecision,
    pub verdict: Verdict,
    pub reason: String,
    pub certificate: Certificate,
    pub response: CertifyResponse,
}

impl GateResult {
    pub fn ok(&self) -> bool {
        self.decision == GateDecision::Pass
    }

    /// Product SKU for this ruleset. Wire `offer.sku` may still be the receipt.
    pub fn sku(&self) -> &'static str {
        sku_for(&self.ruleset)
    }

    pub(crate) fn from_response(response: CertifyResponse) -> Self {
        let cert = response.certificate.clone();
        let decision = if cert.verdict == Verdict::Reprenable {
            GateDecision::Pass
        } else {
            GateDecision::Stop
        };
        let reason = gate_reason(cert.verdict, &cert.ruleset);
        Self {
            couple: "CERT+GATE",
            ruleset: cert.ruleset.clone(),
            decision,
            verdict: cert.verdict,
            reason,
            certificate: cert,
            response,
        }
    }
}

pub(crate) fn gate_reason(verdict: Verdict, ruleset: &str) -> String {
    let label = if ruleset == "1.0" {
        "V0".to_string()
    } else {
        format!("V{ruleset}")
    };
    match verdict {
        Verdict::Reprenable => format!("{label} : REPRENABLE — B est autorisé à reprendre."),
        Verdict::Corrompu => format!("{label} : CORROMPU — reprise bloquée."),
        Verdict::Partiel => {
            format!("{label} : PARTIEL — reprise bloquée (reste non repris comme achevé).")
        }
    }
}

pub fn sku_for(ruleset: &str) -> &'static str {
    if ruleset == RULESET_GRILLE {
        SKU_GATE
    } else {
        SKU_RECEIPT
    }
}
