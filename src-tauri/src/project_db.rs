use common::{
  drivers::postgresql::Postgresql as PostgresqlDriver,
  enums::{Drivers, Project},
  projects::postgresql::Postgresql,
};
use tauri::{Result, State};

use crate::AppState;

#[tauri::command]
pub async fn select_projects(app_state: State<'_, AppState>) -> Result<Vec<(String, Project)>> {
  let project_db = app_state.project_db.lock().await;
  let mut projects = project_db
    .clone()
    .unwrap()
    .iter()
    .map(|r| {
      let (project, connection_string) = r.unwrap();
      let project = String::from_utf8(project.to_vec()).unwrap();
      let connection_string = String::from_utf8(connection_string.to_vec()).unwrap();
      let connection_string = connection_string.split(':').collect::<Vec<&str>>();
      let _driver = connection_string[0].to_string();
      let project_details = match _driver {
        d if d == Drivers::POSTGRESQL.to_string() => {
          let mut driver = PostgresqlDriver::default();

          for c in connection_string[1..].iter() {
            let c = c.split('=').collect::<Vec<&str>>();
            let key = c[0];
            let value = c[1];

            match key {
              "user" => driver.user = value.to_string(),
              "password" => driver.password = value.to_string(),
              "host" => driver.host = value.to_string(),
              "port" => driver.port = value.to_string(),
              _ => (),
            }
          }

          Project::POSTGRESQL(Postgresql {
            driver,
            ..Postgresql::default()
          })
        }
        _ => unreachable!(),
      };
      (project, project_details)
    })
    .collect::<Vec<(String, Project)>>();
  projects.sort_by(|a, b| a.0.cmp(&b.0));
  Ok(projects)
}

#[tauri::command]
pub async fn insert_project(project: Project, app_state: State<'_, AppState>) -> Result<Project> {
  let project_db = app_state.project_db.lock().await;
  let ref mut db = project_db.clone().unwrap();
  let connection_string = format!(
    "user={}:password={}:host={}:port={}",
    project.user, project.password, project.host, project.port,
  );
  db.insert(project.name.clone(), connection_string.as_str())
    .unwrap();
  Ok(project)
}

#[tauri::command]
pub async fn delete_project(project: String, app_state: State<'_, AppState>) -> Result<()> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project).unwrap();
  Ok(())
}
