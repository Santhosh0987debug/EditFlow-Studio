import type { TextVersionSummaryDto, TextVersionSource } from "@editflow/shared";
import { InlineSpinner } from "../components/PageLoader";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SOURCE_LABELS: Record<TextVersionSource, string> = {
  manual: "Manual",
  ai_accepted: "AI accepted",
  restored: "Reopened",
};

const SOURCE_STYLES: Record<TextVersionSource, string> = {
  manual: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  ai_accepted: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
  restored: "border-amber-300/20 bg-amber-400/10 text-amber-200",
};

type VersionHistoryProps = {
  versions: TextVersionSummaryDto[];
  isLoading: boolean;
  loadError: string | null;
  openingVersionId: string | null;
  activeVersionId: string | null;
  onOpen: (version: TextVersionSummaryDto) => void;
  onRetry: () => void;
};

export function VersionHistory({
  versions,
  isLoading,
  loadError,
  openingVersionId,
  activeVersionId,
  onOpen,
  onRetry,
}: VersionHistoryProps) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="version-history-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="version-history-heading"
          className="text-sm font-semibold text-white"
        >
          Version history
        </h2>
        {!isLoading ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
            {versions.length}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Loading version history...</span>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
          <p className="text-xs text-rose-100">{loadError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md border border-rose-200/30 px-2.5 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-200/10"
          >
            Try again
          </button>
        </div>
      ) : versions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-5 text-slate-500">
          No saved versions yet. Save the current draft to create version 1.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {versions.map((version) => {
            const isOpening = openingVersionId === version.id;
            const isActive = activeVersionId === version.id;

            return (
              <li
                key={version.id}
                className={`rounded-xl border p-3 transition ${
                  isActive
                    ? "border-cyan-300/30 bg-cyan-400/[0.06]"
                    : "border-white/10 bg-slate-950/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">
                      v{version.version} · {version.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {dateFormatter.format(new Date(version.createdAt))} ·{" "}
                      {version.characterCount.toLocaleString()} chars
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      SOURCE_STYLES[version.source]
                    }`}
                  >
                    {SOURCE_LABELS[version.source]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(version)}
                  disabled={isOpening}
                  aria-label={`Open version ${version.version}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOpening ? <InlineSpinner /> : null}
                  {isOpening ? "Opening..." : "Open version"}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
