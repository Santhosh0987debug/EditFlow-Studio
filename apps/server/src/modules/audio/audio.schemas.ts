import {
  MAX_AUDIO_MERGE_CLIPS,
  MAX_AUDIO_SPEED,
  MIN_AUDIO_DURATION_MS,
  MIN_AUDIO_SPEED,
} from "@editflow/shared";
import { z } from "zod";

const timestamp = (label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number of milliseconds.`)
    .min(0, `${label} cannot be negative.`);

export const audioOperationsSchema = z
  .object({
    trim: z
      .object({
        startMs: timestamp("Trim start"),
        endMs: timestamp("Trim end").nullable(),
      })
      .superRefine((trim, context) => {
        if (trim.endMs !== null && trim.endMs <= trim.startMs) {
          context.addIssue({
            code: "custom",
            path: ["endMs"],
            message: "Trim end must be after the trim start.",
          });
        }

        if (
          trim.endMs !== null &&
          trim.endMs - trim.startMs < MIN_AUDIO_DURATION_MS
        ) {
          context.addIssue({
            code: "custom",
            path: ["endMs"],
            message: "The trimmed audio must be at least 0.5 seconds long.",
          });
        }
      }),
    speed: z
      .number({ error: "Playback speed must be a number." })
      .min(
        MIN_AUDIO_SPEED,
        `Playback speed must be at least ${MIN_AUDIO_SPEED}×.`,
      )
      .max(
        MAX_AUDIO_SPEED,
        `Playback speed must be at most ${MAX_AUDIO_SPEED}×.`,
      ),
    mergeAssetIds: z
      .array(
        z
          .string({ error: "Merged audio clips must be valid asset IDs." })
          .min(1, "Merged audio clips must be valid asset IDs."),
      )
      .max(
        MAX_AUDIO_MERGE_CLIPS,
        `You can merge at most ${MAX_AUDIO_MERGE_CLIPS} additional clips.`,
      ),
  })
  .superRefine((operations, context) => {
    const seen = new Set<string>();

    for (const assetId of operations.mergeAssetIds) {
      if (seen.has(assetId)) {
        context.addIssue({
          code: "custom",
          path: ["mergeAssetIds"],
          message: "Each clip can only be merged once.",
        });
        return;
      }

      seen.add(assetId);
    }
  });

export const audioRequestSchema = z.object({
  operations: audioOperationsSchema,
});

export type AudioOperationsInput = z.infer<typeof audioOperationsSchema>;
