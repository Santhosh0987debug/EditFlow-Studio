import {
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  type ImageFilter,
} from "@editflow/shared";
import { z } from "zod";

const imageFilters = [
  "none",
  "grayscale",
  "sepia",
  "blur",
  "sharpen",
] as const satisfies readonly ImageFilter[];

const percentage = (label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(0, `${label} cannot be below 0%.`)
    .max(100, `${label} cannot be above 100%.`);

const cropSchema = z
  .object({
    left: percentage("Crop left"),
    top: percentage("Crop top"),
    width: percentage("Crop width"),
    height: percentage("Crop height"),
  })
  .superRefine((crop, context) => {
    if (crop.width < 5) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: "Crop width must be at least 5%.",
      });
    }

    if (crop.height < 5) {
      context.addIssue({
        code: "custom",
        path: ["height"],
        message: "Crop height must be at least 5%.",
      });
    }

    if (crop.left + crop.width > 100) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: "Crop must stay inside the image's left and right edges.",
      });
    }

    if (crop.top + crop.height > 100) {
      context.addIssue({
        code: "custom",
        path: ["height"],
        message: "Crop must stay inside the image's top and bottom edges.",
      });
    }
  });

const resizeSide = (label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(
      MIN_IMAGE_DIMENSION,
      `${label} must be at least ${MIN_IMAGE_DIMENSION} pixels.`,
    )
    .max(
      MAX_IMAGE_DIMENSION,
      `${label} must be ${MAX_IMAGE_DIMENSION} pixels or fewer.`,
    )
    .nullable();

export const imageOperationsSchema = z.object({
  brightness: z
    .number({ error: "Brightness must be a number." })
    .int("Brightness must be a whole number.")
    .min(-100, "Brightness cannot be below -100.")
    .max(100, "Brightness cannot be above 100."),
  contrast: z
    .number({ error: "Contrast must be a number." })
    .int("Contrast must be a whole number.")
    .min(-100, "Contrast cannot be below -100.")
    .max(100, "Contrast cannot be above 100."),
  saturation: z
    .number({ error: "Saturation must be a number." })
    .int("Saturation must be a whole number.")
    .min(-100, "Saturation cannot be below -100.")
    .max(100, "Saturation cannot be above 100."),
  filter: z.enum(imageFilters, {
    error: "Choose a supported filter.",
  }),
  crop: cropSchema.nullable(),
  resize: z.object({
    width: resizeSide("Resize width"),
    height: resizeSide("Resize height"),
  }),
});

export const imageRequestSchema = z.object({
  operations: imageOperationsSchema,
});

export type ImageOperationsInput = z.infer<typeof imageOperationsSchema>;
