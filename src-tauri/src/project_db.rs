use common::project::ProjectDetails;
use tauri::{Result, State};

use crate::AppState;

#[tauri::command]
pub async fn select_projects(app_state: State<'_, AppState>) -> Result<Vec<ProjectDetails>> {
  let project_db = app_state.project_db.lock().await;
  let mut projects = project_db
    .clone()
    .unwrap()
    .iter()
    .map(|r| {
      let (project_name, connection_string) = r.unwrap();
      let project_name = String::from_utf8(project_name.to_vec()).unwrap();
      let connection_string = connection_string.to_vec();
      let connection_string = String::from_utf8(connection_string).unwrap();
      let connection_string = connection_string.split(' ').collect::<Vec<&str>>();

      let mut project_details = ProjectDetails {
        name: project_name,
        ..Default::default()
      };

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

      project_details
    })
    .collect::<Vec<ProjectDetails>>();
  projects.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(projects)
}

#[tauri::command]
pub async fn delete_project(project: String, app_state: State<'_, AppState>) -> Result<()> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project).unwrap();
  Ok(())
}
