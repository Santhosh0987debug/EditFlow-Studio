import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  type ImageAssetListResponse,
  type ImageAssetResponse,
  type SaveImageVersionResponse,
} from "@editflow/shared";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { AppError } from "../../lib/app-error";
import { getUserId, parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/require-auth";
import { imageRequestSchema } from "./image.schemas";
import {
  exportEditedImage,
  getImageAsset,
  getImageFile,
  listImageAssets,
  renderAssetPreview,
  saveImageVersion,
  uploadImage,
} from "./image.service";

export const imageRouter = Router({ mergeParams: true });

const UNSUPPORTED_TYPE_MESSAGE =
  "Choose a JPEG, PNG, or WebP image. Other file types are not supported.";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
  },
  fileFilter: (_request, file, callback) => {
    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      callback(
        new AppError(400, UNSUPPORTED_TYPE_MESSAGE, {
          image: UNSUPPORTED_TYPE_MESSAGE,
        }),
      );
      return;
    }

    callback(null, true);
  },
});

imageRouter.use(requireAuth);

function readParam(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(404, `${label} not found.`);
  }

  return value;
}

function projectIdFrom(request: Request): string {
  return readParam(
    (request.params as Record<string, unknown>).projectId,
    "Project",
  );
}

function sendImage(
  response: Response,
  image: { data: Buffer; mimeType: string; filename?: string },
  download = false,
): void {
  if (download) {
    response.attachment(image.filename ?? "editflow-image");
  }

  response.type(image.mimeType);
  response.setHeader("Content-Length", image.data.byteLength);
  response.status(200).send(image.data);
}

imageRouter.get("/", async (request, response) => {
  const images = await listImageAssets(
    getUserId(request),
    projectIdFrom(request),
  );

  const payload: ImageAssetListResponse = { images };
  response.status(200).json(payload);
});

imageRouter.post("/", upload.single("image"), async (request, response) => {
  const file = request.file;

  if (!file) {
    const message = "Choose an image to upload.";
    throw new AppError(400, message, { image: message });
  }

  const image = await uploadImage(
    getUserId(request),
    projectIdFrom(request),
    { buffer: file.buffer, originalname: file.originalname },
  );

  const payload: ImageAssetResponse = { image };
  response.status(201).json(payload);
});

imageRouter.post("/:imageId/preview", async (request, response) => {
  const { operations } = parseBody(imageRequestSchema, request.body);
  const preview = await renderAssetPreview(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.imageId, "Image"),
    operations,
  );

  sendImage(response, { data: preview.data, mimeType: preview.mimeType });
});

imageRouter.post("/:imageId/export", async (request, response) => {
  const { operations } = parseBody(imageRequestSchema, request.body);
  const rendered = await exportEditedImage(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.imageId, "Image"),
    operations,
  );

  sendImage(response, rendered, true);
});

imageRouter.post("/:imageId/versions", async (request, response) => {
  const { operations } = parseBody(imageRequestSchema, request.body);
  const version = await saveImageVersion(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.imageId, "Image"),
    operations,
  );

  const payload: SaveImageVersionResponse = { version };
  response.status(201).json(payload);
});

imageRouter.get(
  "/:imageId/versions/:versionId/file",
  async (request, response) => {
    const file = await getImageFile(
      getUserId(request),
      projectIdFrom(request),
      readParam(request.params.imageId, "Image"),
      readParam(request.params.versionId, "Image version"),
    );

    sendImage(response, file, request.query.download === "1");
  },
);

imageRouter.get("/:imageId/file", async (request, response) => {
  const file = await getImageFile(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.imageId, "Image"),
  );

  sendImage(response, file);
});

imageRouter.get("/:imageId", async (request, response) => {
  const image = await getImageAsset(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.imageId, "Image"),
  );

  const payload: ImageAssetResponse = { image };
  response.status(200).json(payload);
});
