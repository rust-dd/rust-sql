import { useEffect } from "react";
import { updater } from "@/lib/platform";
import { useProjectStore } from "@/stores/project-store";

export function useAppStartup() {
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    updater.startBackgroundUpdateCheck();
  }, []);
}
