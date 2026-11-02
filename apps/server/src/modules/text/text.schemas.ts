import { z } from "zod";

const versionSourceSchema = z.enum(["manual", "ai_accepted", "restored"]);

export const saveTextVersionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Document title is required.")
    .max(160, "Document title must be 160 characters or fewer."),
  content: z
    .string()
    .min(1, "Document content cannot be empty.")
    .max(60_000, "Document content must be 60,000 characters or fewer.")
    .refine(
      (value) => value.trim().length > 0,
      "Document content cannot be empty.",
    ),
  source: versionSourceSchema.default("manual"),
});

export type SaveTextVersionInput = z.infer<typeof saveTextVersionSchema>;
