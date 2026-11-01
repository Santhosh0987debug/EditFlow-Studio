import type { RequestHandler } from "express";
import { env } from "../config/env";
import { clearSessionCookie, verifySessionToken } from "../lib/session";

export const requireAuth: RequestHandler = (request, response, next) => {
  const token: unknown = request.cookies?.[env.sessionCookieName];

  if (typeof token !== "string") {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const userId = verifySessionToken(token);

  if (!userId) {
    clearSessionCookie(response);
    response.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }

  request.userId = userId;
  next();
};
