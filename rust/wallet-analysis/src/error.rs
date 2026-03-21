use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON deserialization failed: {0}")]
    Json(#[from] serde_json::Error),

    #[error("API returned error: {0}")]
    Api(String),

    #[error("Parse error: {0}")]
    Parse(String),
}

pub type Result<T> = std::result::Result<T, AnalysisError>;
