use crate::enums::Project;

pub fn project_matcher(project: Project) -> (String, Project) {
  match project {
    Project::POSTGRESQL(project) => (project.name.clone(), Project::POSTGRESQL(project)),
  }
}
