use crate::enums::Project;

pub fn project_matcher(project_name: String, project: Project) -> (String, Project) {
  match project {
    Project::POSTGRESQL(project) => (project_name, Project::POSTGRESQL(project)),
    _ => unreachable!(),
  }
}
