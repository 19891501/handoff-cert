//! HTTP client for GET/POST `/api/v1/certify`.
//!
//! Does not judge locally. Does not invent a 1.2 engine. Not on crates.io.
//! Billing is whatever the server returns (preview until `X402_PAY_TO` is set).

use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use ureq::Agent;

use crate::error::Error;
use crate::types::{
    is_sold_ruleset, Catalogue, CertifyResponse, GateResult, DEFAULT_BASE_URL, ENDPOINT,
    RULESET_GRILLE,
};

const VERSION: &str = env!("CARGO_PKG_VERSION");

pub(crate) struct RawRequest {
    pub method: &'static str,
    pub url: String,
    pub payment: Option<String>,
    pub body: Option<Value>,
}

pub(crate) struct RawResponse {
    pub status: u16,
    pub body: Value,
}

pub(crate) trait Transport: Send + Sync {
    fn execute(&self, req: RawRequest) -> Result<RawResponse, Error>;
}

struct UreqTransport {
    agent: Agent,
    user_agent: String,
}

impl Transport for UreqTransport {
    fn execute(&self, req: RawRequest) -> Result<RawResponse, Error> {
        match req.method {
            "GET" => {
                let mut builder = self
                    .agent
                    .get(&req.url)
                    .header("Accept", "application/json")
                    .header("User-Agent", &self.user_agent);
                if let Some(payment) = req.payment.as_deref().filter(|p| !p.is_empty()) {
                    builder = builder.header("X-PAYMENT", payment);
                }
                finish(builder.call())
            }
            "POST" => {
                let mut builder = self
                    .agent
                    .post(&req.url)
                    .header("Accept", "application/json")
                    .header("User-Agent", &self.user_agent)
                    .header("Content-Type", "application/json");
                if let Some(payment) = req.payment.as_deref().filter(|p| !p.is_empty()) {
                    builder = builder.header("X-PAYMENT", payment);
                }
                let body = req.body.unwrap_or(Value::Null);
                finish(builder.send_json(&body))
            }
            other => Err(Error::Transport {
                message: format!("method {other}"),
            }),
        }
    }
}

fn finish(
    result: Result<ureq::http::Response<ureq::Body>, ureq::Error>,
) -> Result<RawResponse, Error> {
    match result {
        Ok(mut response) => {
            let status = response.status().as_u16();
            let body = match response.body_mut().read_json::<Value>() {
                Ok(v) => v,
                Err(_) => Value::Null,
            };
            Ok(RawResponse { status, body })
        }
        Err(ureq::Error::StatusCode(code)) => Ok(RawResponse {
            status: code,
            body: Value::Null,
        }),
        Err(err) => Err(Error::Transport {
            message: err.to_string(),
        }),
    }
}

struct Inner {
    base_url: String,
    payment: Option<String>,
    transport: Arc<dyn Transport>,
}

/// Synchronous client for `/api/v1/certify`.
///
/// `certify` omits `ruleset` unless asked (server default = frozen receipt 1.0).
/// `gate_resume` defaults to **1.2** (paid grille). CERT+GATE on 1.0 is dead —
/// KFP-001 is the first counter-example (world CORROMPU, V0 REPRENABLE, gate PASS).
#[derive(Clone)]
pub struct Client {
    inner: Arc<Inner>,
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

impl Client {
    pub fn new() -> Self {
        Self::builder().build()
    }

    pub fn builder() -> ClientBuilder {
        ClientBuilder::default()
    }

    /// Test double. Never used in production.
    #[cfg(test)]
    pub(crate) fn with_transport(
        base_url: impl Into<String>,
        transport: Arc<dyn Transport>,
    ) -> Self {
        Self {
            inner: Arc::new(Inner {
                base_url: trim_slash(&base_url.into()),
                payment: None,
                transport,
            }),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.inner.base_url
    }

    pub fn certify_url(&self) -> String {
        format!("{}{ENDPOINT}", self.inner.base_url)
    }

    /// GET `/api/v1/certify` — SKU, sold rulesets, x402 catalogue. Public.
    pub fn catalogue(&self) -> Result<Catalogue, Error> {
        let raw = self.inner.transport.execute(RawRequest {
            method: "GET",
            url: self.certify_url(),
            payment: None,
            body: None,
        })?;
        if raw.status != 200 {
            return Err(Error::from_status(raw.status, raw.body));
        }
        serde_json::from_value(raw.body).map_err(|e| Error::Protocol {
            message: format!("catalogue invalide: {e}"),
            body: Value::Null,
        })
    }

    /// POST `/api/v1/certify`.
    ///
    /// `paquet` is the handoff packet (from/to/task/…), not the HTTP envelope.
    /// `ruleset = None` → frozen receipt 1.0 (SKU `handoff-cert-v1`).
    /// Pass `"1.2"` for the paid grille. Unknown rulesets fail closed.
    pub fn certify(&self, paquet: &Value, ruleset: Option<&str>) -> Result<CertifyResponse, Error> {
        let payload = encode_body(paquet, ruleset)?;
        let raw = self.inner.transport.execute(RawRequest {
            method: "POST",
            url: self.certify_url(),
            payment: self.inner.payment.clone(),
            body: Some(payload),
        })?;
        if raw.status != 200 {
            return Err(Error::from_status(raw.status, raw.body));
        }
        serde_json::from_value(raw.body.clone()).map_err(|e| Error::Protocol {
            message: format!("réponse certify invalide: {e}"),
            body: raw.body,
        })
    }

    /// HTTP equivalent of `gateResume`.
    ///
    /// B resumes only if the notary says REPRENABLE. Default ruleset is **1.2**.
    pub fn gate_resume(&self, paquet: &Value, ruleset: Option<&str>) -> Result<GateResult, Error> {
        let chosen = ruleset.unwrap_or(RULESET_GRILLE);
        check_ruleset(chosen)?;
        let response = self.certify(paquet, Some(chosen))?;
        Ok(GateResult::from_response(response))
    }
}

/// Builder. `base_url` defaults to `HANDOFF_CERT_URL` or `http://127.0.0.1:8080`.
#[derive(Clone, Debug)]
pub struct ClientBuilder {
    base_url: Option<String>,
    timeout: Duration,
    payment: Option<String>,
    user_agent: String,
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self {
            base_url: std::env::var("HANDOFF_CERT_URL").ok(),
            timeout: Duration::from_secs(30),
            payment: None,
            user_agent: format!("handoff-cert-rust/{VERSION}"),
        }
    }
}

impl ClientBuilder {
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Optional `X-PAYMENT` (x402 exact / EIP-3009). Never invents a nonce.
    pub fn payment(mut self, payment: impl Into<String>) -> Self {
        let value = payment.into();
        self.payment = if value.is_empty() { None } else { Some(value) };
        self
    }

    pub fn user_agent(mut self, ua: impl Into<String>) -> Self {
        self.user_agent = ua.into();
        self
    }

    pub fn build(self) -> Client {
        let base_url = trim_slash(
            self.base_url
                .as_deref()
                .filter(|s| !s.is_empty())
                .unwrap_or(DEFAULT_BASE_URL),
        );
        let agent: Agent = Agent::config_builder()
            .timeout_global(Some(self.timeout))
            .http_status_as_error(false)
            .build()
            .into();
        Client {
            inner: Arc::new(Inner {
                base_url,
                payment: self.payment,
                transport: Arc::new(UreqTransport {
                    agent,
                    user_agent: self.user_agent,
                }),
            }),
        }
    }
}

fn trim_slash(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn check_ruleset(ruleset: &str) -> Result<(), Error> {
    if is_sold_ruleset(ruleset) {
        Ok(())
    } else {
        Err(Error::UnknownRuleset {
            ruleset: ruleset.to_string(),
        })
    }
}

fn encode_body(paquet: &Value, ruleset: Option<&str>) -> Result<Value, Error> {
    match ruleset {
        None | Some("") => Ok(json!({ "paquet": paquet })),
        Some(r) => {
            check_ruleset(r)?;
            Ok(json!({ "paquet": paquet, "ruleset": r }))
        }
    }
}

/// Module-level POST `/api/v1/certify`. Default ruleset: omit → 1.0 receipt.
pub fn certify(paquet: &Value) -> Result<CertifyResponse, Error> {
    Client::new().certify(paquet, None)
}

/// Module-level POST with an explicit ruleset.
pub fn certify_with(paquet: &Value, ruleset: &str) -> Result<CertifyResponse, Error> {
    Client::new().certify(paquet, Some(ruleset))
}

/// Module-level HTTP `gateResume`. Default ruleset **1.2** (grille).
pub fn gate_resume(paquet: &Value) -> Result<GateResult, Error> {
    Client::new().gate_resume(paquet, None)
}

/// `gateResume` with an explicit ruleset (`1.0` receipt / `1.1` notary / `1.2` grille).
pub fn gate_resume_with(paquet: &Value, ruleset: &str) -> Result<GateResult, Error> {
    Client::new().gate_resume(paquet, Some(ruleset))
}

/// Module-level GET `/api/v1/certify`.
pub fn catalogue() -> Result<Catalogue, Error> {
    Client::new().catalogue()
}

#[cfg(test)]
pub(crate) fn encode_body_for_test(paquet: &Value, ruleset: Option<&str>) -> Result<Value, Error> {
    encode_body(paquet, ruleset)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{GateDecision, Verdict, SKU_GATE, SKU_RECEIPT};
    use serde_json::json;

    struct Mock {
        handler: Box<dyn Fn(&RawRequest) -> RawResponse + Send + Sync>,
    }

    impl Mock {
        fn new(handler: impl Fn(&RawRequest) -> RawResponse + Send + Sync + 'static) -> Arc<Self> {
            Arc::new(Self {
                handler: Box::new(handler),
            })
        }
    }

    impl Transport for Mock {
        fn execute(&self, req: RawRequest) -> Result<RawResponse, Error> {
            Ok((self.handler)(&req))
        }
    }

    fn cert(verdict: &str, ruleset: &str) -> Value {
        json!({
            "certificate": {
                "verdict": verdict,
                "confidence": 0.99,
                "missing": [],
                "conflicts": [],
                "warnings": [],
                "certificate_id": "hc_test",
                "ruleset": ruleset,
                "input_hash": "sha256:abc",
                "timestamp": "2026-09-19T00:00:00Z"
            },
            "integrite": "non_fourni",
            "offer": {
                "sku": "handoff-cert-v1",
                "price_eur": 0.001,
                "currency": "EUR",
                "billing": "preview",
                "unit": "certificat"
            },
            "payment": { "billing": "preview" }
        })
    }

    fn kfp001() -> Value {
        json!({
            "from": "planner",
            "to": "executor",
            "task": "Passer en mode exécuteur après le plan"
        })
    }

    fn client(mock: Arc<Mock>) -> Client {
        Client::with_transport("http://cert.test", mock)
    }

    #[test]
    fn unknown_ruleset_fails_closed_before_http() {
        let mock = Mock::new(|_| panic!("must not hit transport"));
        let err = client(mock)
            .certify(&kfp001(), Some("2.0"))
            .expect_err("unknown");
        match err {
            Error::UnknownRuleset { ruleset } => assert_eq!(ruleset, "2.0"),
            other => panic!("{other}"),
        }
    }

    #[test]
    fn certify_omits_ruleset_for_receipt() {
        let mock = Mock::new(|req| {
            assert_eq!(req.method, "POST");
            let body = req.body.as_ref().unwrap();
            assert!(body.get("ruleset").is_none());
            assert!(body.get("paquet").is_some());
            RawResponse {
                status: 200,
                body: cert("REPRENABLE", "1.0"),
            }
        });
        let res = client(mock).certify(&kfp001(), None).unwrap();
        assert_eq!(res.certificate.verdict, Verdict::Reprenable);
        assert_eq!(res.certificate.ruleset, "1.0");
        assert_eq!(res.offer.sku, SKU_RECEIPT);
        assert_eq!(res.offer.billing, "preview");
        assert!(res.payment.as_ref().unwrap().is_preview());
    }

    #[test]
    fn gate_resume_default_is_grille_12() {
        let mock = Mock::new(|req| {
            assert_eq!(req.body.as_ref().unwrap()["ruleset"], "1.2");
            RawResponse {
                status: 200,
                body: cert("CORROMPU", "1.2"),
            }
        });
        let gate = client(mock).gate_resume(&kfp001(), None).unwrap();
        assert_eq!(gate.decision, GateDecision::Stop);
        assert_eq!(gate.verdict, Verdict::Corrompu);
        assert_eq!(gate.ruleset, "1.2");
        assert_eq!(gate.couple, "CERT+GATE");
        assert_eq!(gate.sku(), SKU_GATE);
        assert!(!gate.ok());
        assert!(gate.reason.contains("CORROMPU"));
        assert_eq!(gate.response.offer.billing, "preview");
    }

    #[test]
    fn gate_resume_10_on_kfp001_still_passes_receipt() {
        let mock = Mock::new(|req| {
            assert_eq!(req.body.as_ref().unwrap()["ruleset"], "1.0");
            RawResponse {
                status: 200,
                body: cert("REPRENABLE", "1.0"),
            }
        });
        let gate = client(mock).gate_resume(&kfp001(), Some("1.0")).unwrap();
        assert_eq!(gate.decision, GateDecision::Pass);
        assert_eq!(gate.verdict, Verdict::Reprenable);
        assert_eq!(gate.sku(), SKU_RECEIPT);
        assert!(gate.reason.contains("V0"));
        assert!(gate.ok());
    }

    #[test]
    fn http_400_is_bad_request() {
        let mock = Mock::new(|_| RawResponse {
            status: 400,
            body: json!({ "erreur": "JSON invalide" }),
        });
        let err = client(mock).certify(&json!({}), None).expect_err("400");
        match err {
            Error::BadRequest { status, erreur, .. } => {
                assert_eq!(status, 400);
                assert_eq!(erreur, "JSON invalide");
            }
            other => panic!("{other}"),
        }
    }

    #[test]
    fn http_402_is_payment_required_never_a_certificate() {
        let mock = Mock::new(|_| RawResponse {
            status: 402,
            body: json!({
                "x402Version": 1,
                "error": "X-PAYMENT required",
                "accepts": []
            }),
        });
        let err = client(mock).certify(&kfp001(), None).expect_err("402");
        match err {
            Error::PaymentRequired {
                status,
                error,
                body,
            } => {
                assert_eq!(status, 402);
                assert_eq!(error, "X-PAYMENT required");
                assert_eq!(body["x402Version"], 1);
            }
            other => panic!("{other}"),
        }
    }

    #[test]
    fn catalogue_get() {
        let mock = Mock::new(|req| {
            assert_eq!(req.method, "GET");
            RawResponse {
                status: 200,
                body: json!({
                    "sku": "handoff-cert-v1",
                    "endpoint": "/api/v1/certify",
                    "price_eur": 0.001,
                    "billing": "preview",
                    "method": "POST",
                    "ruleset": "1.0",
                    "rulesets": ["1.0", "1.1", "1.2"],
                    "x402": { "enforced": false, "payTo": null }
                }),
            }
        });
        let cat = client(mock).catalogue().unwrap();
        assert_eq!(cat.sku, SKU_RECEIPT);
        assert_eq!(cat.ruleset, "1.0");
        assert_eq!(cat.rulesets, ["1.0", "1.1", "1.2"]);
        assert_eq!(cat.billing, "preview");
    }

    #[test]
    fn encode_empty_ruleset_is_receipt() {
        let body = encode_body_for_test(&kfp001(), Some("")).unwrap();
        assert!(body.get("ruleset").is_none());
    }
}
