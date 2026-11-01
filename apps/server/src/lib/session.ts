import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

const TOKEN_ISSUER = "editflow-studio";
const TOKEN_AUDIENCE = "editflow-web";

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionDurationMs,
  };
}

export function createSessionToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, {
    algorithm: "HS256",
    subject: userId,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: "7d",
  });
}

export function verifySessionToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(env.sessionCookieName, token, sessionCookieOptions());
}

export function clearSessionCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  response.clearCookie(env.sessionCookieName, options);
}
