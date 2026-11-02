import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
} from "@editflow/shared";
import { useRef, useState } from "react";
import { InlineSpinner } from "../components/PageLoader";

const ALLOWED_TYPES = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
const MAX_SIZE_LABEL = "10 MB";

type ImageUploaderProps = {
  isUploading: boolean;
  onUpload: (file: File) => void;
};

export function ImageUploader({
  isUploading,
  onUpload,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      setValidationError(
        "Choose a JPEG, PNG, or WebP image. Other file types are not supported.",
      );
      return;
    }

    if (file.size === 0) {
      setValidationError("The selected file is empty.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setValidationError(`The image must be ${MAX_SIZE_LABEL} or smaller.`);
      return;
    }

    setValidationError(null);
    onUpload(file);
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="image-upload-heading"
    >
      <h2 id="image-upload-heading" className="text-sm font-semibold text-white">
        Upload an image
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        JPEG, PNG, or WebP up to {MAX_SIZE_LABEL}. The original is stored
        separately from every saved edit.
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
        <p className="text-xs text-slate-400">Drop an image here, or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <InlineSpinner /> : null}
          {isUploading ? "Uploading..." : "Choose image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
          aria-label="Upload image"
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
