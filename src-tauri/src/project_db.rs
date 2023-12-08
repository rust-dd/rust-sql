use serde::{Deserialize, Serialize};
use tauri::{Result, State};

use crate::AppState;

#[tauri::command]
pub async fn get_projects(app_state: State<'_, AppState>) -> Result<Vec<String>> {
    let project_db = app_state.project_db.lock().await;
    let project_db = project_db.as_ref().unwrap();

    let db = sled::open(&project_db.db_path).unwrap();
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
    let project_db = app_state.project_db.lock().await;
    let project_db = project_db.as_ref().unwrap();

    let project_details = project_db.get_connection_string(project.as_str())?;

    Ok(project_details)
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ProjectDetails {
    pub user: String,
    pub password: String,
    pub host: String,
    pub port: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectDB {
    pub db_path: String,
}

impl Default for ProjectDB {
    fn default() -> Self {
        Self::new()
    }
}

impl ProjectDB {
    pub fn new() -> Self {
        Self {
            db_path: String::from("project_db"),
        }
    }

    pub fn get_connection_string(&self, project: &str) -> Result<ProjectDetails> {
        let db = sled::open(&self.db_path).unwrap();
        let connection_string = db.get(project).unwrap();
        let mut project_details = ProjectDetails::default();

        if let Some(connection_string) = connection_string {
            let connection_string = connection_string.to_vec();
            let connection_string = String::from_utf8(connection_string).unwrap();
            let connection_string = connection_string.split(" ").collect::<Vec<&str>>();

            for connection_string in connection_string {
                let connection_string = connection_string.split("=").collect::<Vec<&str>>();
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
}

