use wasm_bindgen::JsValue;

#[derive(Debug, thiserror::Error)]
pub enum TonError {
    #[error("Rate limited, retry after {0}ms")]
    RateLimit(u64),

    #[error("API error ({0}): {1}")]
    ApiError(u16, String),

    #[error("Search timed out after 30 seconds")]
    Timeout,

    #[error("Deserialization error: {0}")]
    DeserializeError(String),

    #[error("JS error: {0}")]
    JsError(String),
}

impl From<TonError> for JsValue {
    fn from(err: TonError) -> JsValue {
        JsValue::from_str(&err.to_string())
    }
}

impl From<reqwest_wasm::Error> for TonError {
    fn from(err: reqwest_wasm::Error) -> Self {
        TonError::ApiError(
            err.status().map(|s| s.as_u16()).unwrap_or(0),
            err.to_string(),
        )
    }
}

impl From<serde_json::Error> for TonError {
    fn from(err: serde_json::Error) -> Self {
        TonError::DeserializeError(err.to_string())
    }
}
