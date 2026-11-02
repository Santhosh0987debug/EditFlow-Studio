import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/app-error";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};

    for (const issue of error.issues) {
      const field = issue.path.join(".") || "form";
      fields[field] ??= issue.message;
    }

    response.status(400).json({
      error: "Please correct the highlighted fields.",
      fields,
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const isAudio = error.field === "audio";
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? isAudio
          ? "The audio file must be 25 MB or smaller."
          : "The image must be 10 MB or smaller."
        : isAudio
          ? "The audio upload could not be processed."
          : "The image upload could not be processed.";

    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: message,
      fields: { [isAudio ? "audio" : "image"]: message },
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    response.status(409).json({
      error: "A record with that value already exists.",
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "The request body must be valid JSON." });
    return;
  }

  console.error("Unhandled API error:", error);
  response.status(500).json({
    error: "Something went wrong. Please try again.",
  });
};
