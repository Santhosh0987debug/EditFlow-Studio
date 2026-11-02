import { InlineSpinner } from "../components/PageLoader";

type ImagePreviewProps = {
  name: string;
  beforeUrl: string;
  afterUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function ImagePreview({
  name,
  beforeUrl,
  afterUrl,
  isLoading,
  error,
  onRetry,
}: ImagePreviewProps) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-label="Original versus edited image comparison"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="image-preview-heading"
            className="text-sm font-semibold text-white"
          >
            Before and after
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            The original never changes. The edited preview reflects your current
            controls.
          </p>
        </div>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <figure className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Before · Original
            </figcaption>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
              Preserved
            </span>
          </div>
          <div className="mt-2 flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 sm:min-h-64">
            <img
              src={beforeUrl}
              alt={`${name} before edits`}
              className="max-h-[28rem] w-full object-contain"
            />
          </div>
        </figure>

        <figure className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-cyan-200/80 uppercase">
              After · Edited
            </figcaption>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
              Preview
            </span>
          </div>
          <div className="relative mt-2 flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/70 sm:min-h-64">
            {afterUrl ? (
              <img
                src={afterUrl}
                alt={`${name} after edits`}
                className="max-h-[28rem] w-full object-contain"
              />
            ) : null}

            {isLoading && !afterUrl ? (
              <span className="text-xs text-slate-500">Rendering...</span>
            ) : null}

            {error ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center"
                role="alert"
              >
                <p className="text-xs leading-5 text-rose-100">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg border border-rose-200/30 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-200/10"
                >
                  Retry preview
                </button>
              </div>
            ) : null}
          </div>
        </figure>
      </div>
    </section>
  );
}
