use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize)]
pub enum ProjectConnectionStatus {
    Connected,
    Connecting,
    #[default]
    Disconnected,
    Failed,
}

impl std::error::Error for ProjectConnectionStatus {}
impl fmt::Display for ProjectConnectionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProjectConnectionStatus::Connected => write!(f, "Connected"),
            ProjectConnectionStatus::Connecting => write!(f, "Connecting"),
            ProjectConnectionStatus::Disconnected => write!(f, "Disconnected"),
            ProjectConnectionStatus::Failed => write!(f, "Failed"),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Connection timed out")]
    ConnectionTimeout,
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Query timed out")]
    QueryTimeout,
    #[error("Query failed: {0}")]
    QueryFailed(String),
    #[error("Project not found: {0}")]
    ProjectNotFound(String),
    #[error("Client not connected: {0}")]
    ClientNotConnected(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<AppError> for tauri::Error {
    fn from(e: AppError) -> Self {
        tauri::Error::Io(std::io::Error::other(e.to_string()))
    }
}

/// Flatten an error and everything it wraps into one message.
///
/// `tokio_postgres::Error` displays as the bare word "db error"; the message
/// the server actually sent — the missing relation, the syntax position, the
/// constraint name — lives in its source. Reporting only the top level gave
/// users "Query failed: db error" for every failure.
pub fn error_chain(e: &dyn std::error::Error) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(cause) = src {
        let text = cause.to_string();
        // Some wrappers already embed their source; do not repeat it.
        if !msg.contains(&text) {
            msg.push_str(": ");
            msg.push_str(&text);
        }
        src = cause.source();
    }
    msg
}

/// Convert a Postgres error into a query failure, keeping the server's message.
pub fn query_failed(e: tokio_postgres::Error) -> AppError {
    AppError::QueryFailed(error_chain(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    #[derive(Debug)]
    struct Inner;
    impl fmt::Display for Inner {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "relation \"x\" does not exist")
        }
    }
    impl std::error::Error for Inner {}

    #[derive(Debug)]
    struct Outer(Inner);
    impl fmt::Display for Outer {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "db error")
        }
    }
    impl std::error::Error for Outer {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            Some(&self.0)
        }
    }

    #[test]
    fn the_wrapped_message_is_kept() {
        assert_eq!(
            error_chain(&Outer(Inner)),
            "db error: relation \"x\" does not exist"
        );
    }

    #[test]
    fn an_already_embedded_message_is_not_repeated() {
        #[derive(Debug)]
        struct Embedding(Inner);
        impl fmt::Display for Embedding {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "failed: relation \"x\" does not exist")
            }
        }
        impl std::error::Error for Embedding {
            fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
                Some(&self.0)
            }
        }
        assert_eq!(
            error_chain(&Embedding(Inner)),
            "failed: relation \"x\" does not exist"
        );
    }

    #[test]
    fn an_error_without_a_source_is_unchanged() {
        assert_eq!(error_chain(&Inner), "relation \"x\" does not exist");
    }
}
