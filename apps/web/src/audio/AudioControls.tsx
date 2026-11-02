import {
  MAX_AUDIO_MERGE_CLIPS,
  MAX_AUDIO_SPEED,
  MIN_AUDIO_SPEED,
  type AudioAssetSummaryDto,
  type AudioOperations,
} from "@editflow/shared";
import { useEffect, useState } from "react";
import {
  formatDuration,
  formatTimestamp,
  parseTimestamp,
  summarizeOperations,
} from "./operations";

type AudioControlsProps = {
  operations: AudioOperations;
  currentAssetId: string;
  totalDurationMs: number;
  availableAssets: AudioAssetSummaryDto[];
  disabled?: boolean;
  canUndo: boolean;
  validationError: string | null;
  onChange: (operations: AudioOperations) => void;
  onUndo: () => void;
  onReset: () => void;
};

function TimestampField({
  id,
  label,
  hint,
  value,
  disabled,
  allowEmpty,
  onCommit,
}: {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  disabled: boolean;
  allowEmpty: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(
    value === null ? "" : formatTimestamp(value),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value === null ? "" : formatTimestamp(value));
    setError(null);
  }, [value]);

  function commit() {
    if (draft.trim() === "") {
      if (allowEmpty) {
        setError(null);
        onCommit(null);
      } else {
        setError("Enter a timestamp.");
      }
      return;
    }

    const parsed = parseTimestamp(draft);

    if (parsed === null) {
      setError("Use seconds or m:ss, for example 1:23.5.");
      return;
    }

    setError(null);
    onCommit(parsed);
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        placeholder={allowEmpty ? "End of audio" : "0:00.000"}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className={`mt-1.5 w-full rounded-lg border bg-slate-950/70 px-3 py-2 text-sm tabular-nums text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 ${
          error
            ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/20"
            : "border-white/10 focus:border-cyan-300/60 focus:ring-cyan-300/20"
        }`}
      />
      <p
        id={`${id}-hint`}
        className={`mt-1.5 text-[11px] ${error ? "text-rose-300" : "text-slate-500"}`}
      >
        {error ?? hint}
      </p>
    </div>
  );
}

function RangeControl({
  id,
  label,
  value,
  minimum,
  maximum,
  step,
  displayValue,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  displayValue: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-slate-500">
          {displayValue}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={Math.min(maximum, Math.max(minimum, value))}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-cyan-300 disabled:opacity-60"
      />
    </div>
  );
}

export function AudioControls({
  operations,
  currentAssetId,
  totalDurationMs,
  availableAssets,
  disabled = false,
  canUndo,
  validationError,
  onChange,
  onUndo,
  onReset,
}: AudioControlsProps) {
  const mergeAssets = operations.mergeAssetIds
    .map((assetId) =>
      availableAssets.find((asset) => asset.id === assetId),
    )
    .filter((asset): asset is AudioAssetSummaryDto => asset !== undefined);

  const unselectedAssets = availableAssets.filter(
    (asset) =>
      asset.id !== currentAssetId &&
      !operations.mergeAssetIds.includes(asset.id),
  );

  function setStart(value: number) {
    const clamped = Math.min(
      Math.max(0, Math.round(value)),
      Math.max(0, totalDurationMs - 500),
    );

    onChange({
      ...operations,
      trim: {
        startMs: clamped,
        endMs:
          operations.trim.endMs !== null &&
          operations.trim.endMs <= clamped
            ? null
            : operations.trim.endMs,
      },
    });
  }

  function setEnd(value: number) {
    const clamped = Math.max(
      operations.trim.startMs + 500,
      Math.min(totalDurationMs, Math.round(value)),
    );

    onChange({
      ...operations,
      trim: {
        startMs: operations.trim.startMs,
        endMs: clamped >= totalDurationMs ? null : clamped,
      },
    });
  }

  function addMergeAsset(assetId: string) {
    if (
      operations.mergeAssetIds.includes(assetId) ||
      operations.mergeAssetIds.length >= MAX_AUDIO_MERGE_CLIPS
    ) {
      return;
    }

    onChange({
      ...operations,
      mergeAssetIds: [...operations.mergeAssetIds, assetId],
    });
  }

  function moveMergeAsset(index: number, offset: -1 | 1) {
    const target = index + offset;

    if (target < 0 || target >= operations.mergeAssetIds.length) {
      return;
    }

    const next = [...operations.mergeAssetIds];
    const [moved] = next.splice(index, 1);

    if (moved === undefined) {
      return;
    }

    next.splice(target, 0, moved);
    onChange({ ...operations, mergeAssetIds: next });
  }

  function removeMergeAsset(assetId: string) {
    onChange({
      ...operations,
      mergeAssetIds: operations.mergeAssetIds.filter(
        (candidate) => candidate !== assetId,
      ),
    });
  }

  const effectiveEnd = operations.trim.endMs ?? totalDurationMs;
  const mergedClips = mergeAssets.length + 1;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-labelledby="audio-controls-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="audio-controls-heading"
            className="text-sm font-semibold text-white"
          >
            Audio controls
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Trim with timestamps, change speed, and merge clips in playback
            order. Nothing is saved until you save a version.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled || !canUndo}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-200">
            Trim
          </h3>
          <span className="text-[11px] tabular-nums text-slate-500">
            Timeline {formatDuration(totalDurationMs)} · output{" "}
            {formatDuration(
              Math.max(
                0,
                (effectiveEnd - operations.trim.startMs) / operations.speed,
              ),
            )}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TimestampField
            id="audio-trim-start"
            label="Start timestamp"
            hint="Accepts seconds or m:ss. Default 0:00.000."
            value={operations.trim.startMs}
            disabled={disabled}
            allowEmpty={false}
            onCommit={(value) => {
              if (value !== null) {
                setStart(value);
              }
            }}
          />
          <TimestampField
            id="audio-trim-end"
            label="End timestamp"
            hint="Leave blank to keep the rest of the audio."
            value={operations.trim.endMs}
            disabled={disabled}
            allowEmpty
            onCommit={(value) => {
              if (value === null) {
                onChange({
                  ...operations,
                  trim: { ...operations.trim, endMs: null },
                });
              } else {
                setEnd(value);
              }
            }}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RangeControl
            id="audio-trim-start-range"
            label="Start"
            value={operations.trim.startMs}
            minimum={0}
            maximum={totalDurationMs}
            step={100}
            displayValue={formatDuration(operations.trim.startMs)}
            disabled={disabled}
            onChange={setStart}
          />
          <RangeControl
            id="audio-trim-end-range"
            label="End"
            value={effectiveEnd}
            minimum={Math.min(
              totalDurationMs,
              operations.trim.startMs + 500,
            )}
            maximum={totalDurationMs}
            step={100}
            displayValue={formatDuration(effectiveEnd)}
            disabled={disabled}
            onChange={setEnd}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-slate-200">
              Playback speed
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Pitch is preserved. Speed changes the final duration.
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-cyan-100">
            {operations.speed.toFixed(2)}×
          </span>
        </div>

        <input
          id="audio-speed"
          type="range"
          min={MIN_AUDIO_SPEED}
          max={MAX_AUDIO_SPEED}
          step={0.05}
          value={operations.speed}
          disabled={disabled}
          aria-label="Playback speed"
          onChange={(event) =>
            onChange({ ...operations, speed: Number(event.target.value) })
          }
          className="mt-3 w-full accent-cyan-300 disabled:opacity-60"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={Math.abs(operations.speed - preset) < 0.001}
              onClick={() => onChange({ ...operations, speed: preset })}
              className={`rounded-lg border px-2 py-1 text-[11px] font-medium tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40 ${
                Math.abs(operations.speed - preset) < 0.001
                  ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {preset}×
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-slate-200">
              Merge clips
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              The current clip plays first, then the clips below in this order.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-500">
            {mergedClips} {mergedClips === 1 ? "clip" : "clips"} ·{" "}
            {formatDuration(totalDurationMs)}
          </span>
        </div>

        <ol className="mt-3 space-y-2">
          <li className="flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.06] px-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-300/30 text-[11px] font-semibold text-cyan-100">
              1
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
              Current clip
            </span>
            <span className="text-[11px] tabular-nums text-slate-500">
              {formatDuration(availableAssets.find((asset) => asset.id === currentAssetId)?.durationMs ?? 0)}
            </span>
          </li>

          {mergeAssets.map((asset, index) => (
            <li
              key={asset.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-[11px] font-semibold text-slate-300">
                {index + 2}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">
                  {asset.name}
                </span>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {formatDuration(asset.durationMs)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => moveMergeAsset(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Move ${asset.name} earlier`}
                className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => moveMergeAsset(index, 1)}
                disabled={disabled || index === mergeAssets.length - 1}
                aria-label={`Move ${asset.name} later`}
                className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Down
              </button>
              <button
                type="button"
                onClick={() => removeMergeAsset(asset.id)}
                disabled={disabled}
                aria-label={`Remove ${asset.name} from merge`}
                className="rounded-md px-1.5 py-0.5 text-[11px] text-rose-300/80 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>

        {unselectedAssets.length > 0 ? (
          <div className="mt-3">
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Add another clip
            </p>
            <ul className="mt-2 space-y-1.5">
              {unselectedAssets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => addMergeAsset(asset.id)}
                    disabled={
                      disabled ||
                      operations.mergeAssetIds.length >= MAX_AUDIO_MERGE_CLIPS
                    }
                    aria-label={`Add ${asset.name} to merge`}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="truncate">{asset.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                      {formatDuration(asset.durationMs)} · Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : availableAssets.length <= 1 ? (
          <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-[11px] text-slate-500">
            Upload another clip to this project to merge audio.
          </p>
        ) : null}
      </div>

      {validationError ? (
        <p
          className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100"
          role="alert"
        >
          {validationError}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-slate-500">
        Current edit:{" "}
        {summarizeOperations(operations)}
      </p>
    </section>
  );
}
