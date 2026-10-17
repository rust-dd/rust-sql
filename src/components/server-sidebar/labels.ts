import { projectName } from "@/stores/project-store";
import type { ProjectMap } from "@/types";

export function serverGroupLabel(projects: ProjectMap, pids: string[]): string {
  const [first] = pids;
  if (!first) return "";
  if (pids.length === 1) return projectName(projects, first);
  const details = projects[first];
  return details ? `${details.host}:${details.port}` : first;
}

/** A shared server row shows only the address, so its database rows carry the connection name. */
export function databaseConnectionHint(
  projects: ProjectMap,
  pids: string[],
  pid: string,
  dbName: string,
): string | undefined {
  if (pids.length === 1) return undefined;
  const name = projectName(projects, pid);
  return name === dbName ? undefined : name;
}
