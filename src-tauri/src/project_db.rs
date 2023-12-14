use serde::Serialize;
use tauri::{Result, State};

use crate::AppState;

#[derive(Default, Serialize)]
pub struct ProjectDetails {
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}

#[tauri::command]
pub async fn select_projects(app_state: State<'_, AppState>) -> Result<Vec<String>> {
  let project_db = app_state.project_db.lock().await;
  let mut projects = project_db
    .clone()
    .unwrap()
    .iter()
    .map(|r| {
      let (project, _) = r.unwrap();
      String::from_utf8(project.to_vec()).unwrap()
    })
    .collect::<Vec<String>>();
  projects.sort();
  Ok(projects)
}

#[tauri::command]
pub async fn select_project_details(
  project: String,
  app_state: State<'_, AppState>,
) -> Result<ProjectDetails> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  let connection_string = db.get(project).unwrap();
  let mut project_details = ProjectDetails::default();

  if let Some(connection_string) = connection_string {
    let connection_string = connection_string.to_vec();
    let connection_string = String::from_utf8(connection_string).unwrap();
    let connection_string = connection_string.split(' ').collect::<Vec<&str>>();

    for connection_string in connection_string {
      let connection_string = connection_string.split('=').collect::<Vec<&str>>();
      let key = connection_string[0];
      let value = connection_string[1];

      match key {
        "user" => project_details.user = value.to_string(),
        "password" => project_details.password = value.to_string(),
        "host" => project_details.host = value.to_string(),
        "port" => project_details.port = value.to_string(),
        _ => (),
      }
    }
  }
  Ok(project_details)
}

#[tauri::command]
pub async fn delete_project(project: String, app_state: State<'_, AppState>) -> Result<()> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project).unwrap();
  Ok(())
}
