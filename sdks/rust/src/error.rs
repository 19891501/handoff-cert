//! Fail closed. Never invent a verdict. Never invent a payment.

use std::fmt;

use serde_json::Value;

/// Errors from [`crate::Client`]. None of these is a certificate.
#[derive(Debug)]
pub enum Error {
    /// `ruleset` is not `1.0` / `1.1` / `1.2`. Client fails closed before HTTP.
    UnknownRuleset { ruleset: String },
    /// HTTP 400 — JSON invalide, ruleset inconnu, or certification impossible.
    BadRequest {
        status: u16,
        erreur: String,
        body: Value,
    },
    /// HTTP 402 — x402 payment required. Preview billing does not raise this.
    PaymentRequired {
        status: u16,
        error: String,
        body: Value,
    },
    /// Network / timeout / unreadable response. Not a verdict.
    Transport { message: String },
    /// Wire JSON missing a required field or carrying an unknown verdict.
    Protocol { message: String, body: Value },
}

impl Error {
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::BadRequest { status, .. } | Error::PaymentRequired { status, .. } => {
                Some(*status)
            }
            Error::Protocol { .. } | Error::UnknownRuleset { .. } | Error::Transport { .. } => None,
        }
    }

    pub(crate) fn from_status(status: u16, body: Value) -> Self {
        if status == 402 {
            let error = body
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("paiement requis")
                .to_string();
            return Error::PaymentRequired {
                status,
                error,
                body,
            };
        }
        let erreur = body
            .get("erreur")
            .and_then(Value::as_str)
            .unwrap_or("certification impossible")
            .to_string();
        if status == 400 && erreur.starts_with("ruleset inconnu") {
            let ruleset = erreur
                .split_once(':')
                .map(|(_, rest)| rest.trim().to_string())
                .unwrap_or_default();
            return Error::UnknownRuleset { ruleset };
        }
        if status == 400 {
            return Error::BadRequest {
                status,
                erreur,
                body,
            };
        }
        Error::Protocol {
            message: erreur,
            body,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::UnknownRuleset { ruleset } => write!(f, "ruleset inconnu: {ruleset}"),
            Error::BadRequest { erreur, .. } => write!(f, "{erreur}"),
            Error::PaymentRequired { error, .. } => write!(f, "{error}"),
            Error::Transport { message } => write!(f, "certify injoignable: {message}"),
            Error::Protocol { message, .. } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for Error {}
