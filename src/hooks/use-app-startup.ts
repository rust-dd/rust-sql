import { useEffect } from "react";
import { startBackgroundUpdateCheck } from "@/lib/updater";
import { useProjectStore } from "@/stores/project-store";

export function useAppStartup() {
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    startBackgroundUpdateCheck();
  }, []);
}
