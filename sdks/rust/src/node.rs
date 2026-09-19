//! `wrap_node` observes. `gate_node` is the attacked couple (certify + gate_resume).
//!
//! Default ruleset for `gate_node` is **1.2** (the paid grille). 1.0 stays a
//! frozen receipt: KFP-001 still PASSes under V0. No LangGraph crate dependency.

use serde_json::{json, Map, Value};

use crate::client::Client;
use crate::error::Error;
use crate::types::{GateDecision, RULESET_GRILLE};

/// LangGraph terminal. A STOP rewrites `goto` to this.
pub const LANGGRAPH_END: &str = "__end__";

/// True when `value` is a `Command` with a real `goto` (not `__end__`, not resume-only).
pub fn is_handoff_command(value: &Value) -> bool {
    let Some(obj) = value.as_object() else {
        return false;
    };
    if obj.get("resume").is_some() && obj.get("goto").is_none() {
        return false;
    }
    match obj.get("goto") {
        Some(Value::String(s)) => !s.is_empty() && s != LANGGRAPH_END,
        Some(Value::Array(items)) => items.iter().any(goto_item_is_handoff),
        Some(Value::Object(o)) => o
            .get("node")
            .and_then(Value::as_str)
            .is_some_and(|n| n != LANGGRAPH_END),
        _ => false,
    }
}

fn goto_item_is_handoff(item: &Value) -> bool {
    match item {
        Value::String(s) => !s.is_empty() && s != LANGGRAPH_END,
        Value::Object(o) => o
            .get("node")
            .and_then(Value::as_str)
            .is_some_and(|n| n != LANGGRAPH_END),
        _ => false,
    }
}

pub fn read_goto(command: &Value) -> Option<String> {
    let goto = command.get("goto")?;
    match goto {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => items.first().and_then(|item| match item {
            Value::String(s) => Some(s.clone()),
            Value::Object(o) => o.get("node").and_then(Value::as_str).map(str::to_string),
            _ => None,
        }),
        Value::Object(o) => o.get("node").and_then(Value::as_str).map(str::to_string),
        _ => None,
    }
}

/// Observer: never judges. Handoff commands pass through. No continuation_gate.
pub fn wrap_node<F>(node: F) -> impl Fn(Value) -> Value
where
    F: Fn(Value) -> Value,
{
    move |state| node(state)
}

fn packet_of(state: &Value) -> Option<Value> {
    let obj = state.as_object()?;
    if let Some(p) = obj.get("packet") {
        if !p.is_null() {
            return Some(p.clone());
        }
    }
    if let Some(p) = obj.get("handoff") {
        if !p.is_null() {
            return Some(p.clone());
        }
    }
    None
}

fn with_update(command: &Value, extra: Map<String, Value>) -> Value {
    let mut out = command.as_object().cloned().unwrap_or_default();
    let mut update = out
        .get("update")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    for (k, v) in extra {
        update.insert(k, v);
    }
    out.insert("update".into(), Value::Object(update));
    Value::Object(out)
}

fn stop_command(command: &Value, extra: Map<String, Value>) -> Value {
    let mut out = with_update(command, extra);
    if let Some(obj) = out.as_object_mut() {
        obj.insert("goto".into(), json!(LANGGRAPH_END));
        let mut update = obj
            .get("update")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        update.insert("continuation_gate".into(), json!("STOP"));
        obj.insert("update".into(), Value::Object(update));
    }
    out
}

/// Grille: `certify` then STOP unless REPRENABLE.
///
/// `wrap_node` stays the observer. `gate_node` is the attacked couple.
/// Default ruleset **1.2**. Missing packet → STOP `paquet_absent` (fail closed).
pub fn gate_node<F>(
    node: F,
    client: Client,
    ruleset: Option<&str>,
) -> impl Fn(Value) -> Result<Value, Error>
where
    F: Fn(Value) -> Value,
{
    let ruleset = ruleset.unwrap_or(RULESET_GRILLE).to_string();
    move |state| {
        let result = node(state.clone());
        if !is_handoff_command(&result) {
            return Ok(result);
        }
        let Some(packet) = packet_of(&state) else {
            let mut extra = Map::new();
            extra.insert("continuation_error".into(), json!("paquet_absent"));
            return Ok(stop_command(&result, extra));
        };
        let gate = match client.gate_resume(&packet, Some(&ruleset)) {
            Ok(g) => g,
            Err(Error::UnknownRuleset { .. }) => {
                return Err(Error::UnknownRuleset {
                    ruleset: ruleset.clone(),
                })
            }
            Err(_) => {
                let mut extra = Map::new();
                extra.insert(
                    "continuation_error".into(),
                    json!(format!("ruleset_{ruleset}_unavailable")),
                );
                return Ok(stop_command(&result, extra));
            }
        };
        if gate.decision == GateDecision::Stop {
            let mut extra = Map::new();
            extra.insert("continuation_verdict".into(), json!(gate.verdict.as_str()));
            return Ok(stop_command(&result, extra));
        }
        let mut extra = Map::new();
        extra.insert("continuation_gate".into(), json!("PASS"));
        extra.insert("continuation_verdict".into(), json!(gate.verdict.as_str()));
        Ok(with_update(&result, extra))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::{Client, RawRequest, RawResponse, Transport};
    use crate::error::Error;
    use serde_json::json;
    use std::sync::Arc;

    struct Mock(fn(&RawRequest) -> RawResponse);

    impl Transport for Mock {
        fn execute(&self, req: RawRequest) -> Result<RawResponse, Error> {
            Ok((self.0)(&req))
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

    fn client(handler: fn(&RawRequest) -> RawResponse) -> Client {
        Client::with_transport("http://cert.test", Arc::new(Mock(handler)))
    }

    fn kfp001() -> Value {
        json!({ "from": "planner", "to": "executor", "task": "mode" })
    }

    #[test]
    fn wrap_node_never_judges() {
        let node = |_| json!({ "goto": "executor", "update": { "step": 1 } });
        let wrapped = wrap_node(node);
        let out = wrapped(json!({ "packet": kfp001() }));
        assert_eq!(out["goto"], "executor");
        assert!(out["update"].get("continuation_gate").is_none());
    }

    #[test]
    fn gate_node_default_12_stops_kfp001() {
        let gated = gate_node(
            |_| json!({ "goto": "executor", "update": { "step": 1 } }),
            client(|req| {
                assert_eq!(req.body.as_ref().unwrap()["ruleset"], "1.2");
                RawResponse {
                    status: 200,
                    body: cert("CORROMPU", "1.2"),
                }
            }),
            None,
        );
        let out = gated(json!({ "packet": kfp001() })).unwrap();
        assert_eq!(out["goto"], LANGGRAPH_END);
        assert_eq!(out["update"]["continuation_gate"], "STOP");
        assert_eq!(out["update"]["continuation_verdict"], "CORROMPU");
    }

    #[test]
    fn gate_node_10_lets_kfp001_through() {
        let gated = gate_node(
            |_| json!({ "goto": "executor", "update": { "step": 1 } }),
            client(|_| RawResponse {
                status: 200,
                body: cert("REPRENABLE", "1.0"),
            }),
            Some("1.0"),
        );
        let out = gated(json!({ "packet": kfp001() })).unwrap();
        assert_eq!(out["goto"], "executor");
        assert_eq!(out["update"]["continuation_gate"], "PASS");
    }

    #[test]
    fn gate_node_missing_packet_fail_closed() {
        let gated = gate_node(
            |_| json!({ "goto": "executor" }),
            client(|_| panic!("no HTTP without a packet")),
            None,
        );
        let out = gated(json!({ "order": 1 })).unwrap();
        assert_eq!(out["goto"], LANGGRAPH_END);
        assert_eq!(out["update"]["continuation_error"], "paquet_absent");
    }

    #[test]
    fn resume_only_is_not_a_handoff() {
        assert!(!is_handoff_command(&json!({ "resume": "yes" })));
        assert!(!is_handoff_command(&json!({ "goto": "__end__" })));
        assert!(is_handoff_command(&json!({ "goto": "executor" })));
    }

    #[test]
    fn read_goto_string() {
        assert_eq!(
            read_goto(&json!({ "goto": "fulfillment_agent" })).as_deref(),
            Some("fulfillment_agent")
        );
    }
}
