use portable_pty::{MasterPty, PtySize};
use std::{collections::HashMap, io::Write, sync::Arc};
use tokio::sync::Mutex;

use crate::error::AppError;

pub(crate) struct TerminalSession {
    pub(crate) writer: Box<dyn Write + Send>,
    pub(crate) master: Box<dyn MasterPty + Send>,
}

#[derive(Clone)]
pub struct TerminalRegistry {
    inner: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl Default for TerminalRegistry {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl TerminalRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub(crate) async fn insert(&self, id: String, session: TerminalSession) {
        self.inner.lock().await.insert(id, session);
    }

    pub async fn write(&self, id: &str, bytes: &[u8]) -> Result<(), AppError> {
        let mut sessions = self.inner.lock().await;
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| AppError::QueryFailed(format!("terminal not found: {id}")))?;
        session
            .writer
            .write_all(bytes)
            .map_err(|e| AppError::QueryFailed(e.to_string()))?;
        session
            .writer
            .flush()
            .map_err(|e| AppError::QueryFailed(e.to_string()))?;
        Ok(())
    }

    pub async fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), AppError> {
        let sessions = self.inner.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| AppError::QueryFailed(format!("terminal not found: {id}")))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::QueryFailed(e.to_string()))?;
        Ok(())
    }

    pub async fn kill(&self, id: &str) -> Result<(), AppError> {
        self.inner.lock().await.remove(id);
        Ok(())
    }

    /// Drop all sessions; their reader threads exit on next read after the master PTY is dropped.
    pub async fn drain_all(&self) {
        self.inner.lock().await.clear();
    }
}
