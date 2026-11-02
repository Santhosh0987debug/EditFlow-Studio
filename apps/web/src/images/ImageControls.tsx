import {
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  type ImageCrop,
  type ImageOperations,
} from "@editflow/shared";
import { useEffect, useState } from "react";
import { IMAGE_FILTER_OPTIONS } from "./operations";

type ImageControlsProps = {
  operations: ImageOperations;
  disabled?: boolean;
  canUndo: boolean;
  onChange: (operations: ImageOperations) => void;
  onUndo: () => void;
  onReset: () => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function ResizeField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  function handleChange(raw: string) {
    setDraft(raw);

    if (raw.trim() === "") {
      onChange(null);
      return;
    }

    const parsed = Number(raw);

    if (
      Number.isInteger(parsed) &&
      parsed >= MIN_IMAGE_DIMENSION &&
      parsed <= MAX_IMAGE_DIMENSION
    ) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    if (draft.trim() === "") {
      setDraft("");
      return;
    }

    const parsed = Number(draft);

    if (
      !Number.isInteger(parsed) ||
      parsed < MIN_IMAGE_DIMENSION ||
      parsed > MAX_IMAGE_DIMENSION
    ) {
      setDraft(value === null ? "" : String(value));
      return;
    }

    setDraft(String(parsed));
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_IMAGE_DIMENSION}
        max={MAX_IMAGE_DIMENSION}
        placeholder="Auto"
        value={draft}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60"
      />
    </div>
  );
}

function RangeControl({
  id,
  label,
  value,
  disabled,
  onChange,
  displayValue,
}: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  displayValue?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-slate-500">
          {displayValue ?? value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={-100}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-cyan-300 disabled:opacity-60"
      />
    </div>
  );
}

export function ImageControls({
  operations,
  disabled = false,
  canUndo,
  onChange,
  onUndo,
  onReset,
}: ImageControlsProps) {
  const crop = operations.crop;

  function updateCrop(patch: Partial<ImageCrop>) {
    if (!crop) {
      return;
    }

    const next = { ...crop };

    if (patch.left !== undefined) {
      next.left = clamp(patch.left, 0, 100 - crop.width);
    }

    if (patch.top !== undefined) {
      next.top = clamp(patch.top, 0, 100 - crop.height);
    }

    if (patch.width !== undefined) {
      next.width = clamp(patch.width, 5, 100 - crop.left);
    }

    if (patch.height !== undefined) {
      next.height = clamp(patch.height, 5, 100 - crop.top);
    }

    onChange({ ...operations, crop: next });
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
      aria-labelledby="image-controls-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="image-controls-heading"
            className="text-sm font-semibold text-white"
          >
            Adjustments
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Every change is previewed before anything is saved.
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

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <RangeControl
          id="image-brightness"
          label="Brightness"
          value={operations.brightness}
          disabled={disabled}
          onChange={(brightness) => onChange({ ...operations, brightness })}
          displayValue={`${operations.brightness > 0 ? "+" : ""}${operations.brightness}`}
        />
        <RangeControl
          id="image-contrast"
          label="Contrast"
          value={operations.contrast}
          disabled={disabled}
          onChange={(contrast) => onChange({ ...operations, contrast })}
          displayValue={`${operations.contrast > 0 ? "+" : ""}${operations.contrast}`}
        />
        <RangeControl
          id="image-saturation"
          label="Saturation"
          value={operations.saturation}
          disabled={disabled}
          onChange={(saturation) => onChange({ ...operations, saturation })}
          displayValue={`${operations.saturation > 0 ? "+" : ""}${operations.saturation}`}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="image-filter"
            className="text-xs font-medium text-slate-300"
          >
            Filter
          </label>
          <select
            id="image-filter"
            value={operations.filter}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...operations,
                filter: event.target.value as ImageOperations["filter"],
              })
            }
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60"
          >
            {IMAGE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-300">Resize</p>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <ResizeField
              id="image-resize-width"
              label="Width (px)"
              value={operations.resize.width}
              disabled={disabled}
              onChange={(width) =>
                onChange({
                  ...operations,
                  resize: { ...operations.resize, width },
                })
              }
            />
            <ResizeField
              id="image-resize-height"
              label="Height (px)"
              value={operations.resize.height}
              disabled={disabled}
              onChange={(height) =>
                onChange({
                  ...operations,
                  resize: { ...operations.resize, height },
                })
              }
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
            Fits inside the target and never enlarges. Leave one side blank to
            keep the aspect ratio.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-3.5">
        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-300">
          <input
            type="checkbox"
            checked={crop !== null}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...operations,
                crop: event.target.checked
                  ? { left: 10, top: 10, width: 80, height: 80 }
                  : null,
              })
            }
            className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-300"
          />
          Crop image
        </label>

        {crop ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["left", "Left", 100 - crop.width],
                ["top", "Top", 100 - crop.height],
                ["width", "Width", 100 - crop.left],
                ["height", "Height", 100 - crop.top],
              ] as const
            ).map(([key, label, maximum]) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`image-crop-${key}`}
                    className="text-[11px] text-slate-400"
                  >
                    {label}
                  </label>
                  <span className="text-[11px] tabular-nums text-slate-500">
                    {crop[key]}%
                  </span>
                </div>
                <input
                  id={`image-crop-${key}`}
                  type="range"
                  min={key === "width" || key === "height" ? 5 : 0}
                  max={maximum}
                  step={1}
                  value={crop[key]}
                  disabled={disabled}
                  onChange={(event) =>
                    updateCrop({ [key]: Number(event.target.value) })
                  }
                  className="mt-1.5 w-full accent-cyan-300 disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
