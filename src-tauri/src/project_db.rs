use serde::Serialize;
use tauri::{AppHandle, Manager, Result, State};

use crate::{constant::PROJECT_DB_PATH, AppState};

#[derive(Default, Serialize)]
pub struct ProjectDetails {
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}

#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<String>> {
  let app_state = app.state::<AppState>();
  let mut db = app_state.project_db.lock().await;
  if db.clone().is_none() {
    let app_dir = app.path_resolver().app_data_dir().unwrap();
    let db_path = app_dir.join(PROJECT_DB_PATH);
    let _db = sled::open(db_path).unwrap();
    *db = Some(_db);
  }
  let db = db.clone().unwrap();
  let projects = db
    .iter()
    .map(|r| {
      let (project, _) = r.unwrap();
      String::from_utf8(project.to_vec()).unwrap()
    })
    .collect();

  Ok(projects)
}

#[tauri::command]
pub async fn get_project_details(
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
pub async fn remove_project(project: String, app_state: State<'_, AppState>) -> Result<()> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project).unwrap();
  Ok(())
}

