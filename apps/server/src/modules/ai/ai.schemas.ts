import { z } from "zod";

export const textEditActionSchema = z.enum([
  "rewrite",
  "grammar",
  "summarize",
  "expand",
  "tone",
  "translate",
]);

export const aiTextRequestSchema = z
  .object({
    action: textEditActionSchema,
    content: z
      .string()
      .min(1, "Document content cannot be empty.")
      .max(60_000, "Document content must be 60,000 characters or fewer.")
      .refine(
        (value) => value.trim().length > 0,
        "Document content cannot be empty.",
      ),
    instruction: z
      .string()
      .trim()
      .max(500, "Instructions must be 500 characters or fewer.")
      .optional(),
    tone: z
      .string()
      .trim()
      .min(2, "Describe a target tone.")
      .max(60, "Tone must be 60 characters or fewer.")
      .optional(),
    targetLanguage: z
      .string()
      .trim()
      .min(2, "Enter a target language.")
      .max(60, "Target language must be 60 characters or fewer.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "tone" && !value.tone) {
      context.addIssue({
        code: "custom",
        path: ["tone"],
        message: "Enter the tone you want to use.",
      });
    }

    if (value.action === "translate" && !value.targetLanguage) {
      context.addIssue({
        code: "custom",
        path: ["targetLanguage"],
        message: "Enter the language to translate into.",
      });
    }
  });

export const aiProposalOutputSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "The AI provider returned empty text.")
      .max(60_000, "The AI provider returned text that is too long."),
    notes: z
      .array(
        z
          .string()
          .trim()
          .min(1, "AI notes cannot be empty.")
          .max(240, "AI notes must be 240 characters or fewer."),
      )
      .min(1, "The AI provider must return at least one note.")
      .max(6, "The AI provider returned too many notes."),
  })
  .strict();

export type AiTextRequestInput = z.infer<typeof aiTextRequestSchema>;
export type AiProposalOutput = z.infer<typeof aiProposalOutputSchema>;
