import type { ReactNode } from "react";

type ComparisonPanelProps = {
  originalLabel?: string;
  originalContent: string;
  editedLabel?: string;
  editedContent: string;
  notes?: string[];
  actions?: ReactNode;
  compact?: boolean;
};

function ComparisonPane({
  label,
  content,
  accent,
}: {
  label: string;
  content: string;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-slate-950/60">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className={`text-xs font-semibold tracking-wide uppercase ${accent}`}>
          {label}
        </span>
        <span className="text-[11px] text-slate-500">
          {content.length.toLocaleString()} characters
        </span>
      </div>
      <pre className="max-h-96 flex-1 overflow-auto px-4 py-4 font-sans text-sm leading-7 whitespace-pre-wrap text-slate-200">
        {content || "No text yet."}
      </pre>
    </div>
  );
}

export function ComparisonPanel({
  originalLabel = "Original",
  originalContent,
  editedLabel = "Edited",
  editedContent,
  notes,
  actions,
  compact = false,
}: ComparisonPanelProps) {
  return (
    <section
      className={`rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.04] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
      aria-label="Original versus edited comparison"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          Side-by-side comparison
        </h3>
        <span className="text-[11px] text-slate-400">
          Original content is never overwritten
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ComparisonPane
          label={originalLabel}
          content={originalContent}
          accent="text-slate-400"
        />
        <ComparisonPane
          label={editedLabel}
          content={editedContent}
          accent="text-cyan-300"
        />
      </div>

      {notes && notes.length > 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            What changed
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300"
                  aria-hidden="true"
                />
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
