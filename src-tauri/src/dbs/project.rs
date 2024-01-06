use common::{
  drivers::postgresql::Postgresql as PostgresqlDriver,
  enums::{Drivers, Project},
  projects::postgresql::Postgresql,
};
use tauri::{Result, State};

use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
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
      let _driver = _driver.split('=').collect::<Vec<&str>>()[1];
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
            name: project.clone(),
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

#[tauri::command(rename_all = "snake_case")]
pub async fn insert_project(project: Project, app_state: State<'_, AppState>) -> Result<Project> {
  let project_db = app_state.project_db.lock().await;
  let db = project_db.clone().unwrap();
  match project {
    Project::POSTGRESQL(project) => {
      let driver = &project.driver;
      let connection_string = format!(
        "driver=POSTGRESQL:user={}:password={}:host={}:port={}",
        driver.user, driver.password, driver.host, driver.port,
      );
      db.insert(&project.name, &*connection_string).unwrap();
      Ok(Project::POSTGRESQL(project))
    }
  }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_project(project_name: &str, app_state: State<'_, AppState>) -> Result<String> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project_name).unwrap();
  Ok(project_name.to_string())
}
