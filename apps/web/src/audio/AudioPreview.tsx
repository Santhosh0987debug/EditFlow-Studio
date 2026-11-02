import { InlineSpinner } from "../components/PageLoader";
import { formatDuration } from "./operations";

type AudioPreviewProps = {
  name: string;
  beforeUrl: string;
  afterUrl: string | null;
  originalDurationMs: number;
  editedDurationMs: number;
  mergedClips: number;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function AudioPreview({
  name,
  beforeUrl,
  afterUrl,
  originalDurationMs,
  editedDurationMs,
  mergedClips,
  isLoading,
  error,
  onRetry,
}: AudioPreviewProps) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-label="Original versus edited audio comparison"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Before and after
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            The preserved original and the current edit render as separate MP3
            previews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tabular-nums text-slate-400">
            {mergedClips} {mergedClips === 1 ? "clip" : "clips"} ·{" "}
            {formatDuration(editedDurationMs)}
          </span>
          {isLoading ? (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-100"
              role="status"
            >
              <InlineSpinner />
              Rendering preview
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <figure className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 p-3">
          <figcaption className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Before - Original
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-normal tracking-normal normal-case text-slate-500">
              Preserved
            </span>
          </figcaption>
          <audio
            controls
            preload="metadata"
            src={beforeUrl}
            aria-label={`${name} original audio`}
            className="mt-3 w-full"
          >
            Your browser does not support audio playback.
          </audio>
          <p className="mt-2 text-[11px] tabular-nums text-slate-500">
            {formatDuration(originalDurationMs)}
          </p>
        </figure>

        <figure className="min-w-0 rounded-xl border border-cyan-300/20 bg-slate-950/70 p-3">
          <figcaption className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.14em] text-cyan-200/80 uppercase">
            After - Edited
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-normal tracking-normal text-cyan-100 normal-case">
              Preview
            </span>
          </figcaption>

          {afterUrl ? (
            <audio
              controls
              preload="metadata"
              src={afterUrl}
              aria-label={`${name} edited audio preview`}
              className="mt-3 w-full"
            >
              Your browser does not support audio playback.
            </audio>
          ) : (
            <div className="mt-3 flex h-10 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500">
              {isLoading ? "Rendering preview..." : "Preview not ready."}
            </div>
          )}

          {error ? (
            <div
              className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-center"
              role="alert"
            >
              <p className="text-[11px] leading-5 text-rose-100">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 rounded-lg border border-rose-200/30 px-3 py-1.5 text-[11px] font-medium text-rose-100 transition hover:bg-rose-200/10"
              >
                Retry preview
              </button>
            </div>
          ) : null}
        </figure>
      </div>
    </section>
  );
}
