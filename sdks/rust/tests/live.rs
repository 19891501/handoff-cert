//! Live tests against the preview (`HANDOFF_CERT_URL` or 127.0.0.1:8080).
//! Skipped when the server is down or `CI` is set without an explicit URL.

use handoff_cert::{Client, Error, GateDecision, Verdict, RULESET_GRILLE, RULESET_RECEIPT};
use serde_json::{json, Value};

fn live_client() -> Option<Client> {
    if std::env::var_os("CI").is_some() && std::env::var_os("HANDOFF_CERT_URL").is_none() {
        return None;
    }
    let client = match std::env::var("HANDOFF_CERT_URL") {
        Ok(url) if !url.is_empty() => Client::builder().base_url(url).build(),
        _ => Client::new(),
    };
    match client.catalogue() {
        Ok(_) => Some(client),
        Err(_) => None,
    }
}

fn kfp001() -> Value {
    json!({
        "from": "planner",
        "to": "executor",
        "task": "Passer en mode exécuteur après le plan",
        "state": { "known": { "issue": "311420" }, "version": "1" },
        "work_done": [{ "claim": "Le mode exécuteur a été confirmé.", "evidence_refs": ["sess1"] }],
        "work_remaining": ["Exécuter le plan"],
        "evidence": [{
            "id": "sess1",
            "type": "document",
            "source": "vscode-session",
            "timestamp": "2026-04-20T12:00:00Z",
            "status": "",
            "content": {
                "switchAgentObservedInSessionLog": false,
                "executorModeObservedAfterHandoff": false,
                "sourcePlannerModeStillPresentAfterHandoff": true
            }
        }]
    })
}

fn fail_token() -> Value {
    json!({
        "from": "psp",
        "to": "ledger",
        "task": "Encaisser la commande 9",
        "state": { "known": { "order": "ord_9" }, "version": "1" },
        "work_done": [{ "claim": "Le paiement a été confirmé.", "evidence_refs": ["p1"] }],
        "work_remaining": ["Écrire le ledger"],
        "evidence": [{
            "id": "p1",
            "type": "tool_result",
            "source": "probe",
            "timestamp": "2026-04-20T12:00:00Z",
            "status": "FAIL",
            "content": { "reason": "declined" }
        }]
    })
}

fn clean() -> Value {
    json!({
        "from": "agent_A",
        "to": "agent_B",
        "task": {
            "objective": "Valider le fichier client avant transmission",
            "constraints": ["Ne pas modifier le fichier"]
        },
        "state": {
            "known": { "file": "report.pdf", "size_bytes": 241112 },
            "unknown": [],
            "version": "1"
        },
        "work_done": [{ "claim": "Le fichier a été validé.", "evidence_refs": ["e1"] }],
        "work_remaining": ["Transmettre le fichier à l'archivage"],
        "evidence": [{
            "id": "e1",
            "type": "tool_result",
            "source": "validator_17",
            "timestamp": "2026-09-16T08:41:12Z",
            "status": "PASS",
            "content": { "validation_result": "PASS", "file": "report.pdf" }
        }],
        "uncertainties": []
    })
}

#[test]
fn live_catalogue_lists_12_sold_sku_stays_receipt() {
    let Some(c) = live_client() else {
        eprintln!("skip: preview down");
        return;
    };
    let cat = c.catalogue().unwrap();
    assert_eq!(cat.sku, "handoff-cert-v1");
    assert_eq!(cat.ruleset, "1.0");
    assert!(cat.rulesets.iter().any(|r| r == "1.2"));
    assert_eq!(cat.billing, "preview");
}

#[test]
fn live_certify_kfp001_v0_is_reprenable_frozen_receipt() {
    let Some(c) = live_client() else {
        return;
    };
    let res = c.certify(&kfp001(), None).unwrap();
    assert_eq!(res.certificate.verdict, Verdict::Reprenable);
    assert_eq!(res.certificate.ruleset, RULESET_RECEIPT);
    assert_eq!(res.offer.billing, "preview");
    assert_eq!(res.integrite, "non_fourni");
}

#[test]
fn live_certify_kfp001_12_is_corrompu_grille() {
    let Some(c) = live_client() else {
        return;
    };
    let res = c.certify(&kfp001(), Some(RULESET_GRILLE)).unwrap();
    assert_eq!(res.certificate.verdict, Verdict::Corrompu);
    assert_eq!(res.certificate.ruleset, RULESET_GRILLE);
}

#[test]
fn live_gate_resume_default_12_stops_kfp001() {
    let Some(c) = live_client() else {
        return;
    };
    let gate = c.gate_resume(&kfp001(), None).unwrap();
    assert_eq!(gate.decision, GateDecision::Stop);
    assert_eq!(gate.verdict, Verdict::Corrompu);
    assert_eq!(gate.ruleset, RULESET_GRILLE);
    assert!(!gate.ok());
}

#[test]
fn live_gate_resume_10_passes_kfp001_receipt_not_a_gate() {
    let Some(c) = live_client() else {
        return;
    };
    let gate = c.gate_resume(&kfp001(), Some(RULESET_RECEIPT)).unwrap();
    assert_eq!(gate.decision, GateDecision::Pass);
    assert_eq!(gate.verdict, Verdict::Reprenable);
    assert_eq!(gate.ruleset, RULESET_RECEIPT);
}

#[test]
fn live_fail_token_stops_on_both() {
    let Some(c) = live_client() else {
        return;
    };
    let g0 = c.gate_resume(&fail_token(), Some("1.0")).unwrap();
    let g2 = c.gate_resume(&fail_token(), Some("1.2")).unwrap();
    assert_eq!(g0.decision, GateDecision::Stop);
    assert_eq!(g2.decision, GateDecision::Stop);
}

#[test]
fn live_clean_passes_grille() {
    let Some(c) = live_client() else {
        return;
    };
    let gate = c.gate_resume(&clean(), None).unwrap();
    assert_eq!(gate.decision, GateDecision::Pass);
    assert_eq!(gate.verdict, Verdict::Reprenable);
}

#[test]
fn live_unknown_ruleset_client_side() {
    let Some(c) = live_client() else {
        return;
    };
    let err = c.certify(&kfp001(), Some("9.9")).unwrap_err();
    assert!(matches!(err, Error::UnknownRuleset { .. }));
}
