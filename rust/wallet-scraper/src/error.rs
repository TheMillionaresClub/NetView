use serde::{Deserialize, Serialize};
use wasm_bindgen::JsValue;

// ── Source-level error ───────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum SourceError {
    #[error("HTTP error ({0}): {1}")]
    Http(u16, String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Rate limited, retry after {0}ms")]
    RateLimit(u64),

    #[error("Request timed out")]
    Timeout,

    #[error("Not found")]
    NotFound,
}

impl From<reqwest_wasm::Error> for SourceError {
    fn from(err: reqwest_wasm::Error) -> Self {
        SourceError::Http(
            err.status().map(|s| s.as_u16()).unwrap_or(0),
            err.to_string(),
        )
    }
}

impl From<serde_json::Error> for SourceError {
    fn from(err: serde_json::Error) -> Self {
        SourceError::Parse(err.to_string())
    }
}

impl From<SourceError> for JsValue {
    fn from(err: SourceError) -> JsValue {
        JsValue::from_str(&err.to_string())
    }
}

// ── Non-fatal error report (collected per source) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceErrorReport {
    pub source_name: String,
    pub error: String,
}

impl SourceErrorReport {
    pub fn new(source_name: &str, err: &SourceError) -> Self {
        Self {
            source_name: source_name.to_string(),
            error: err.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_error_display() {
        let err = SourceError::Http(429, "Too Many Requests".into());
        assert_eq!(err.to_string(), "HTTP error (429): Too Many Requests");

        let err = SourceError::NotFound;
        assert_eq!(err.to_string(), "Not found");
    }

    #[test]
    fn error_report_serializes() {
        let report = SourceErrorReport::new("tonapi", &SourceError::Timeout);
        let json = serde_json::to_string(&report).unwrap();
        assert!(json.contains("tonapi"));
        assert!(json.contains("timed out"));
    }

    #[test]
    fn from_serde_error() {
        let bad_json = "not json";
        let serde_err = serde_json::from_str::<serde_json::Value>(bad_json).unwrap_err();
        let source_err: SourceError = serde_err.into();
        assert!(matches!(source_err, SourceError::Parse(_)));
    }
}
