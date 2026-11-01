import type { AuthResponse, SessionResponse } from "@editflow/shared";
import { Router } from "express";
import { env } from "../../config/env";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
  verifySessionToken,
} from "../../lib/session";
import { parseBody } from "../../lib/validation";
import { loginSchema, registerSchema } from "./auth.schemas";
import { getUserById, loginUser, registerUser } from "./auth.service";

export const authRouter = Router();

authRouter.post("/register", async (request, response) => {
  const input = parseBody(registerSchema, request.body);
  const user = await registerUser(input);

  setSessionCookie(response, createSessionToken(user.id));

  const payload: AuthResponse = { user };
  response.status(201).json(payload);
});

authRouter.post("/login", async (request, response) => {
  const input = parseBody(loginSchema, request.body);
  const user = await loginUser(input);

  setSessionCookie(response, createSessionToken(user.id));

  const payload: AuthResponse = { user };
  response.status(200).json(payload);
});

authRouter.post("/logout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).send();
});

authRouter.get("/me", async (request, response) => {
  const token: unknown = request.cookies?.[env.sessionCookieName];

  if (typeof token !== "string") {
    const payload: SessionResponse = { user: null };
    response.status(200).json(payload);
    return;
  }

  const userId = verifySessionToken(token);

  if (!userId) {
    clearSessionCookie(response);
    const payload: SessionResponse = { user: null };
    response.status(200).json(payload);
    return;
  }

  const user = await getUserById(userId);

  if (!user) {
    clearSessionCookie(response);
    const payload: SessionResponse = { user: null };
    response.status(200).json(payload);
    return;
  }

  const payload: SessionResponse = { user };
  response.status(200).json(payload);
});
