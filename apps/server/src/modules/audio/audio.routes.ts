import { createReadStream } from "node:fs";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  type AudioAssetListResponse,
  type AudioAssetResponse,
  type SaveAudioVersionResponse,
} from "@editflow/shared";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { AppError } from "../../lib/app-error";
import { getUserId, parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/require-auth";
import { audioRequestSchema } from "./audio.schemas";
import {
  exportEditedAudio,
  getAudioAsset,
  getAudioFile,
  listAudioAssets,
  renderAssetPreview,
  saveAudioVersion,
  uploadAudio,
} from "./audio.service";

export const audioRouter = Router({ mergeParams: true });

const UNSUPPORTED_TYPE_MESSAGE =
  "Choose an MP3, WAV, OGG, or M4A audio file. Other file types are not supported.";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
  },
  fileFilter: (_request, file, callback) => {
    if (
      !ALLOWED_AUDIO_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_AUDIO_MIME_TYPES)[number],
      )
    ) {
      callback(
        new AppError(400, UNSUPPORTED_TYPE_MESSAGE, {
          audio: UNSUPPORTED_TYPE_MESSAGE,
        }),
      );
      return;
    }

    callback(null, true);
  },
});

audioRouter.use(requireAuth);

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

function sendRenderedAudio(
  response: Response,
  audio: { data: Buffer; mimeType: string; filename?: string },
  download = false,
): void {
  if (download) {
    response.attachment(audio.filename ?? "editflow-audio");
  }

  response.type(audio.mimeType);
  response.setHeader("Content-Length", audio.data.byteLength);
  response.status(200).send(audio.data);
}

/**
 * Stream audio with byte-range support so browsers can seek without
 * downloading the whole file. Storage keys never leave the server.
 */
function sendStoredAudio(
  request: Request,
  response: Response,
  audio: {
    absolutePath: string;
    byteSize: number;
    mimeType: string;
    filename: string;
  },
  download: boolean,
): void {
  response.setHeader("Accept-Ranges", "bytes");
  response.type(audio.mimeType);

  if (download) {
    response.attachment(audio.filename);
  }

  const range = request.headers.range;

  if (!range) {
    response.setHeader("Content-Length", audio.byteSize);
    createReadStream(audio.absolutePath)
      .on("error", () => response.destroy())
      .pipe(response);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match) {
    response
      .status(416)
      .setHeader("Content-Range", `bytes */${audio.byteSize}`)
      .end();
    return;
  }

  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;

  if (match[1] === "" && match[2] !== "") {
    // Suffix range: bytes=-500 means the final 500 bytes.
    start = Math.max(0, audio.byteSize - Number(match[2]));
    end = audio.byteSize - 1;
  } else if (Number.isNaN(end)) {
    end = audio.byteSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= audio.byteSize ||
    end < start
  ) {
    response
      .status(416)
      .setHeader("Content-Range", `bytes */${audio.byteSize}`)
      .end();
    return;
  }

  end = Math.min(end, audio.byteSize - 1);

  response.status(206);
  response.setHeader(
    "Content-Range",
    `bytes ${start}-${end}/${audio.byteSize}`,
  );
  response.setHeader("Content-Length", end - start + 1);
  createReadStream(audio.absolutePath, { start, end })
    .on("error", () => response.destroy())
    .pipe(response);
}

audioRouter.get("/", async (request, response) => {
  const audio = await listAudioAssets(
    getUserId(request),
    projectIdFrom(request),
  );

  const payload: AudioAssetListResponse = { audio };
  response.status(200).json(payload);
});

audioRouter.post("/", upload.single("audio"), async (request, response) => {
  const file = request.file;

  if (!file) {
    const message = "Choose an audio file to upload.";
    throw new AppError(400, message, { audio: message });
  }

  const audio = await uploadAudio(
    getUserId(request),
    projectIdFrom(request),
    { buffer: file.buffer, originalname: file.originalname },
  );

  const payload: AudioAssetResponse = { audio };
  response.status(201).json(payload);
});

audioRouter.post("/:audioId/preview", async (request, response) => {
  const { operations } = parseBody(audioRequestSchema, request.body);
  const preview = await renderAssetPreview(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.audioId, "Audio clip"),
    operations,
  );

  sendRenderedAudio(response, preview);
});

audioRouter.post("/:audioId/export", async (request, response) => {
  const { operations } = parseBody(audioRequestSchema, request.body);
  const rendered = await exportEditedAudio(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.audioId, "Audio clip"),
    operations,
  );

  sendRenderedAudio(response, rendered, true);
});

audioRouter.post("/:audioId/versions", async (request, response) => {
  const { operations } = parseBody(audioRequestSchema, request.body);
  const version = await saveAudioVersion(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.audioId, "Audio clip"),
    operations,
  );

  const payload: SaveAudioVersionResponse = { version };
  response.status(201).json(payload);
});

audioRouter.get(
  "/:audioId/versions/:versionId/file",
  async (request, response) => {
    const file = await getAudioFile(
      getUserId(request),
      projectIdFrom(request),
      readParam(request.params.audioId, "Audio clip"),
      readParam(request.params.versionId, "Audio version"),
    );

    sendStoredAudio(request, response, file, request.query.download === "1");
  },
);

audioRouter.get("/:audioId/file", async (request, response) => {
  const file = await getAudioFile(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.audioId, "Audio clip"),
  );

  sendStoredAudio(request, response, file, request.query.download === "1");
});

audioRouter.get("/:audioId", async (request, response) => {
  const audio = await getAudioAsset(
    getUserId(request),
    projectIdFrom(request),
    readParam(request.params.audioId, "Audio clip"),
  );

  const payload: AudioAssetResponse = { audio };
  response.status(200).json(payload);
});
