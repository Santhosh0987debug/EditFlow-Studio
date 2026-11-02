import { useRef, useState } from "react";
import { renderMarkdown } from "./markdown";

type MarkdownEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
};

const TOOLBAR_ACTIONS = [
  { label: "Bold", text: "B", prefix: "**", suffix: "**" },
  { label: "Italic", text: "I", prefix: "*", suffix: "*" },
] as const;

export function MarkdownEditor({
  id,
  value,
  onChange,
  disabled = false,
  maxLength = 60_000,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  function refocusSelection(start: number, end: number) {
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(start, end);
      }
    });
  }

  function wrapSelection(prefix: string, suffix: string) {
    const textarea = textareaRef.current;

    if (!textarea || disabled) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const nextValue =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);

    setMode("write");
    onChange(nextValue);
    refocusSelection(start + prefix.length, start + prefix.length + selected.length);
  }

  function prefixSelectedLines(prefix: string) {
    const textarea = textareaRef.current;

    if (!textarea || disabled) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const block = value.slice(lineStart, end);
    const nextBlock = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const nextValue =
      value.slice(0, lineStart) + nextBlock + value.slice(end);

    setMode("write");
    onChange(nextValue);
    refocusSelection(lineStart, lineStart + nextBlock.length);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              aria-label={action.label}
              title={action.label}
              disabled={disabled}
              onClick={() => wrapSelection(action.prefix, action.suffix)}
              className={`grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                action.label === "Italic" ? "italic" : "font-semibold"
              }`}
            >
              {action.text}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" aria-hidden="true" />
          <button
            type="button"
            aria-label="Heading"
            title="Heading"
            disabled={disabled}
            onClick={() => prefixSelectedLines("## ")}
            className="grid h-8 place-items-center rounded-md px-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            H2
          </button>
          <button
            type="button"
            aria-label="Bulleted list"
            title="Bulleted list"
            disabled={disabled}
            onClick={() => prefixSelectedLines("- ")}
            className="grid h-8 place-items-center rounded-md px-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            • List
          </button>
          <button
            type="button"
            aria-label="Quote"
            title="Quote"
            disabled={disabled}
            onClick={() => prefixSelectedLines("> ")}
            className="grid h-8 place-items-center rounded-md px-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ❝
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
          {(["write", "preview"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                mode === item
                  ? "bg-white text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          id={id}
          aria-label="Document content"
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          spellCheck
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write or paste your text here. Markdown formatting is supported."
          className="min-h-80 w-full resize-y rounded-b-xl bg-transparent px-4 py-4 text-sm leading-7 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      ) : (
        <div
          className="markdown-preview min-h-80 px-5 py-4 text-sm leading-7 text-slate-200"
          aria-label="Document preview"
        >
          {value.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
          ) : (
            <p className="text-slate-500">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 text-xs text-slate-500">
        <span>Markdown formatting supported</span>
        <span>
          {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
