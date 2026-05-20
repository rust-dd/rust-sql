pub mod session;

pub use session::TerminalRegistry;

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::Read;
use std::sync::Arc;

use crate::error::AppError;
use crate::events::EventSink;

pub async fn spawn<S: EventSink>(
    registry: &TerminalRegistry,
    sink: Arc<S>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let mut cmd = CommandBuilder::new_default_prog();
    cmd.env("TERM", "xterm-256color");

    pair.slave
        .spawn_command(cmd)
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    drop(pair.slave);

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let session = session::TerminalSession {
        writer,
        master: pair.master,
    };
    registry.insert(id.clone(), session).await;

    let terminal_id = id;
    let reader_sink = sink;
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    let event = format!("terminal-exit-{terminal_id}");
                    reader_sink.emit(&event, &serde_json::Value::Null);
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let event = format!("terminal-data-{terminal_id}");
                    reader_sink.emit(&event, &data);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}
