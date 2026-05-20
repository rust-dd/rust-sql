pub trait EventSink: Send + Sync + 'static {
    fn emit<T: serde::Serialize>(&self, event: &str, payload: &T);
}

pub fn emit_typed<S: EventSink + ?Sized, T: serde::Serialize>(sink: &S, event: &str, payload: &T) {
    sink.emit(event, payload);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    struct RecordingSink {
        log: Mutex<Vec<(String, serde_json::Value)>>,
    }

    impl EventSink for RecordingSink {
        fn emit<T: serde::Serialize>(&self, event: &str, payload: &T) {
            let value = serde_json::to_value(payload).expect("serialize");
            self.log.lock().unwrap().push((event.to_string(), value));
        }
    }

    #[test]
    fn emit_forwards_to_sink() {
        #[derive(serde::Serialize)]
        struct Probe { n: u32, label: &'static str }

        let sink = Arc::new(RecordingSink { log: Mutex::new(Vec::new()) });
        emit_typed(&*sink, "probe", &Probe { n: 7, label: "hi" });

        let log = sink.log.lock().unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!(log[0].0, "probe");
        assert_eq!(log[0].1, serde_json::json!({"n": 7, "label": "hi"}));
    }
}
