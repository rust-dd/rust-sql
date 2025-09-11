use std::collections::BTreeMap;

use tauri::{Result, State};

use crate::common::BTreeVecStore;
use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_select(app_state: State<'_, AppState>) -> Result<BTreeVecStore> {
    let project_db = app_state.project_db.lock().await;
    let db = project_db.clone().unwrap();
    let mut projects = BTreeMap::new();

    if db.is_empty() {
        tracing::info!("No projects found in the database");
        return Ok(projects);
    }

    for p in db.iter() {
        let project = p.unwrap();

        let project = (
            String::from_utf8(project.0.to_vec()).unwrap(),
            bincode::deserialize(&project.1).unwrap(),
        );
        projects.insert(project.0, project.1);
    }
    Ok(projects)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_insert(
    project_id: &str,
    project_details: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<()> {
    let project_db = app_state.project_db.lock().await;
    let db = project_db.clone().unwrap();
    let project_details = bincode::serialize(&project_details).unwrap();
    db.insert(project_id, project_details).unwrap();
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_delete(project_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    let db = app_state.project_db.lock().await;
    let db = db.clone().unwrap();
    db.remove(project_id).unwrap();
    Ok(())
}
