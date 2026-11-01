import type { CreateProjectRequest, ProjectDto } from "@editflow/shared";
import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "../api/client";
import { getErrorMessage } from "../api/errors";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await projectsApi.list();
      setProjects(response.projects);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const createProject = async (
    input: CreateProjectRequest,
  ): Promise<ProjectDto> => {
    setIsCreating(true);

    try {
      const response = await projectsApi.create(input);
      setProjects((current) => [response.project, ...current]);
      return response.project;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    await projectsApi.delete(projectId);
    setProjects((current) =>
      current.filter((project) => project.id !== projectId),
    );
  };

  return {
    projects,
    isLoading,
    loadError,
    isCreating,
    reload: loadProjects,
    createProject,
    deleteProject,
  };
}
