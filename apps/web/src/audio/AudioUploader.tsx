import {
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
} from "@editflow/shared";
import { useRef, useState } from "react";
import { InlineSpinner } from "../components/PageLoader";

const ALLOWED_TYPES = new Set<string>(ALLOWED_AUDIO_MIME_TYPES);
const MAX_SIZE_LABEL = "25 MB";

type AudioUploaderProps = {
  isUploading: boolean;
  onUpload: (file: File) => void;
};

export function AudioUploader({
  isUploading,
  onUpload,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      setValidationError(
        "Choose an MP3, WAV, OGG, or M4A audio file. Other file types are not supported.",
      );
      return;
    }

    if (file.size === 0) {
      setValidationError("The selected file is empty.");
      return;
    }

    if (file.size > MAX_AUDIO_BYTES) {
      setValidationError(`The audio file must be ${MAX_SIZE_LABEL} or smaller.`);
      return;
    }

    setValidationError(null);
    onUpload(file);
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="audio-upload-heading"
    >
      <h2 id="audio-upload-heading" className="text-sm font-semibold text-white">
        Upload audio
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        MP3, WAV, OGG, or M4A up to {MAX_SIZE_LABEL} and 10 minutes. The
        original is stored separately from every saved edit.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          chooseFile(event.dataTransfer.files[0]);
        }}
        className={`mt-3 rounded-xl border border-dashed px-3 py-4 text-center transition ${
          isDragging
            ? "border-cyan-300/60 bg-cyan-400/10"
            : "border-white/15 bg-slate-950/40"
        }`}
      >
        <p className="text-xs text-slate-400">Drop audio here, or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <InlineSpinner /> : null}
          {isUploading ? "Uploading..." : "Choose audio"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"
          aria-label="Upload audio"
          disabled={isUploading}
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="sr-only"
        />
      </div>

      {validationError ? (
        <p className="mt-3 text-xs text-rose-300" role="alert">
          {validationError}
        </p>
      ) : null}
    </section>
  );
}
