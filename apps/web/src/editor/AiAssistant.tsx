import type {
  AiStatusResponse,
  AiTextRequest,
  TextEditAction,
} from "@editflow/shared";
import { useState, type FormEvent } from "react";
import { InlineSpinner } from "../components/PageLoader";

const ACTIONS: Array<{ value: TextEditAction; label: string }> = [
  { value: "rewrite", label: "Rewrite" },
  { value: "grammar", label: "Grammar correction" },
  { value: "summarize", label: "Summarize" },
  { value: "expand", label: "Expand" },
  { value: "tone", label: "Change tone" },
  { value: "translate", label: "Translate" },
];

type AiAssistantProps = {
  status: AiStatusResponse | null;
  isStatusLoading: boolean;
  statusError: string | null;
  content: string;
  isGenerating: boolean;
  generateError: string | null;
  onRetryStatus: () => void;
  onGenerate: (input: AiTextRequest) => void;
};

export function AiAssistant({
  status,
  isStatusLoading,
  statusError,
  content,
  isGenerating,
  generateError,
  onRetryStatus,
  onGenerate,
}: AiAssistantProps) {
  const [action, setAction] = useState<TextEditAction>("rewrite");
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);

    if (!content.trim()) {
      setFieldError("Write some text before asking AI to edit it.");
      return;
    }

    if (action === "tone" && tone.trim().length < 2) {
      setFieldError("Describe the tone you want, for example “confident”.");
      return;
    }

    if (action === "translate" && targetLanguage.trim().length < 2) {
      setFieldError("Enter the language you want to translate into.");
      return;
    }

    onGenerate({
      action,
      content,
      ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      ...(action === "tone" ? { tone: tone.trim() } : {}),
      ...(action === "translate"
        ? { targetLanguage: targetLanguage.trim() }
        : {}),
    });
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="ai-assistant-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ai-assistant-heading" className="text-sm font-semibold text-white">
            AI text assistant
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Generate a proposal, then review it before accepting.
          </p>
        </div>
        <span
          className={`mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            status?.configured
              ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
              : "border-amber-300/20 bg-amber-400/10 text-amber-200"
          }`}
        >
          {isStatusLoading
            ? "Checking"
            : status?.configured
              ? "Ready"
              : "Not configured"}
        </span>
      </div>

      {isStatusLoading ? (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Checking AI configuration...</span>
          <div
            className="h-10 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            aria-hidden="true"
          />
          <div
            className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            aria-hidden="true"
          />
        </div>
      ) : statusError ? (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3">
          <p className="text-xs text-rose-100">{statusError}</p>
          <button
            type="button"
            onClick={onRetryStatus}
            className="mt-2 rounded-md border border-rose-200/30 px-2.5 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-200/10"
          >
            Check again
          </button>
        </div>
      ) : !status?.configured ? (
        <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/[0.07] p-3">
          <p className="text-xs font-semibold text-amber-100">
            AI editing is not configured
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            {status?.message ??
              "Add an AI provider to the server environment to enable editing actions."}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-amber-100/60">
            The rest of the editor, version history, and comparison tools work
            without an AI provider.
          </p>
        </div>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="ai-action"
              className="text-xs font-medium text-slate-300"
            >
              Action
            </label>
            <select
              id="ai-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value as TextEditAction);
                setFieldError(null);
              }}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
            >
              {ACTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {action === "tone" ? (
            <div>
              <label
                htmlFor="ai-tone"
                className="text-xs font-medium text-slate-300"
              >
                Target tone
              </label>
              <input
                id="ai-tone"
                type="text"
                maxLength={60}
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                placeholder="Confident, friendly, concise..."
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
              />
            </div>
          ) : null}

          {action === "translate" ? (
            <div>
              <label
                htmlFor="ai-target-language"
                className="text-xs font-medium text-slate-300"
              >
                Target language
              </label>
              <input
                id="ai-target-language"
                type="text"
                maxLength={60}
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                placeholder="Spanish, French, Japanese..."
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="ai-instruction"
              className="text-xs font-medium text-slate-300"
            >
              Editing prompt{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="ai-instruction"
              rows={3}
              maxLength={500}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Add any direction, such as “keep it under 120 words”."
              className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>

          {fieldError || generateError ? (
            <div
              className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100"
              role="alert"
            >
              {fieldError ?? generateError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? <InlineSpinner /> : null}
            {isGenerating ? "Generating proposal..." : "Generate proposal"}
          </button>
          <p className="text-center text-[11px] text-slate-500">
            Nothing is applied until you accept.
          </p>
        </form>
      )}
    </section>
  );
}
