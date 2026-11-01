export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

export function InlineSpinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}
