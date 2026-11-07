//! Error type shared by the core services.

/// Errors returned by the core.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    /// The database rejected a statement or the connection failed.
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    /// A value could not be (de)serialized.
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Input failed a validation rule.
    #[error("validation failed: {0}")]
    Validation(String),

    /// The requested record does not exist.
    #[error("not found: {0}")]
    NotFound(String),
}

/// Convenience alias for results from the core.
pub type CoreResult<T> = Result<T, CoreError>;
