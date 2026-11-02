import type { ProjectDto } from "@editflow/shared";
import { AppError } from "../../lib/app-error";
import { prisma } from "../../lib/prisma";
import type { CreateProjectInput } from "./project.schemas";

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toProjectDto(project: ProjectRecord): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listProjects(ownerId: string): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    select: projectSelect,
  });

  return projects.map(toProjectDto);
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId,
    },
    select: projectSelect,
  });

  return toProjectDto(project);
}

export async function deleteProject(
  ownerId: string,
  projectId: string,
): Promise<void> {
  const result = await prisma.project.deleteMany({
    where: {
      id: projectId,
      ownerId,
    },
  });

  if (result.count === 0) {
    throw new AppError(404, "Project not found.");
  }
}

export async function getOwnedProject(
  ownerId: string,
  projectId: string,
): Promise<{ id: string; name: string }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
    select: { id: true, name: true },
  });

  if (!project) {
    throw new AppError(404, "Project not found.");
  }

  return project;
}
