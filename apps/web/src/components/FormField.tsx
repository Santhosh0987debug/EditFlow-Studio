import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  id,
  label,
  error,
  hint,
  className = "",
  ...inputProps
}: FormFieldProps) {
  const describedBy = error
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-2 w-full rounded-xl border bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition focus:outline-none focus:ring-2 ${
          error
            ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
            : "border-white/10 focus:border-cyan-300/60 focus:ring-cyan-300/20"
        } ${className}`}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
