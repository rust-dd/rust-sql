use serde::Serialize;
use tauri::Result;

use crate::common::enums::AppError;

#[derive(Serialize, Clone)]
pub struct AIModelInfo {
    pub id: String,
    pub label: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn ai_fetch_claude_models(api_key: &str) -> Result<Vec<AIModelInfo>> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.anthropic.com/v1/models?limit=100")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::DatabaseError(format!(
            "Claude API error ({}): {}",
            status, body
        ))
        .into());
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut models = Vec::new();
    if let Some(arr) = data.get("data").and_then(|d| d.as_array()) {
        for item in arr {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if id.is_empty() {
                continue;
            }
            let label = item
                .get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or(&id)
                .to_string();
            models.push(AIModelInfo { id, label });
        }
    }

    models.sort_by(|a, b| a.label.cmp(&b.label));
    Ok(models)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn ai_fetch_openai_models(api_key: &str) -> Result<Vec<AIModelInfo>> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::DatabaseError(format!(
            "OpenAI API error ({}): {}",
            status, body
        ))
        .into());
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    // Exclude non-chat and legacy model families
    let exclude_prefixes = [
        "dall-e",
        "tts-",
        "whisper",
        "text-embedding",
        "text-moderation",
        "davinci",
        "babbage",
        "curie",
        "ada",
        "codex-",
        "omni-moderation",
        "gpt-3.5",
        "gpt-4-",
        "ft:",
    ];

    // Skip dated snapshot variants like gpt-4o-2024-08-06 or gpt-4o-20240806
    let has_date_suffix = |id: &str| -> bool {
        let parts: Vec<&str> = id.split('-').collect();
        if parts.len() >= 2 {
            let last = parts[parts.len() - 1];
            if last.len() == 8 && last.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
            if parts.len() >= 4 {
                let y = parts[parts.len() - 3];
                let m = parts[parts.len() - 2];
                let d = parts[parts.len() - 1];
                if y.len() == 4
                    && m.len() == 2
                    && d.len() == 2
                    && y.chars().all(|c| c.is_ascii_digit())
                    && m.chars().all(|c| c.is_ascii_digit())
                    && d.chars().all(|c| c.is_ascii_digit())
                {
                    return true;
                }
            }
        }
        false
    };

    let mut models = Vec::new();
    if let Some(arr) = data.get("data").and_then(|d| d.as_array()) {
        for item in arr {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if id.is_empty() {
                continue;
            }
            let lower = id.to_lowercase();
            if exclude_prefixes.iter().any(|p| lower.starts_with(p)) {
                continue;
            }
            if has_date_suffix(&id) {
                continue;
            }
            models.push(AIModelInfo {
                label: id.clone(),
                id,
            });
        }
    }

    models.sort_by(|a, b| a.label.cmp(&b.label));
    Ok(models)
}
