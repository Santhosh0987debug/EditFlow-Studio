import type { Request } from "express";
import type { ZodType } from "zod";

export function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

export function getUserId(request: Request): string {
  if (!request.userId) {
    throw new Error("getUserId was called without authentication middleware.");
  }

  return request.userId;
}
