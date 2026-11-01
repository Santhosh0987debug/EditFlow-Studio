import type { ProjectListResponse, ProjectResponse } from "@editflow/shared";
import { Router } from "express";
import { parseBody, getUserId } from "../../lib/validation";
import { requireAuth } from "../../middleware/require-auth";
import { createProjectSchema } from "./project.schemas";
import {
  createProject,
  deleteProject,
  listProjects,
} from "./project.service";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", async (request, response) => {
  const projects = await listProjects(getUserId(request));

  const payload: ProjectListResponse = { projects };
  response.status(200).json(payload);
});

projectsRouter.post("/", async (request, response) => {
  const input = parseBody(createProjectSchema, request.body);
  const project = await createProject(getUserId(request), input);

  const payload: ProjectResponse = { project };
  response.status(201).json(payload);
});

projectsRouter.delete("/:id", async (request, response) => {
  await deleteProject(getUserId(request), request.params.id);
  response.status(204).send();
});
