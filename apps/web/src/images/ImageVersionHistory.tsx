import type { ImageVersionDto } from "@editflow/shared";
import { imageApi } from "../api/client";
import { formatBytes, formatDimensions } from "./operations";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ImageVersionHistoryProps = {
  projectId: string;
  imageId: string;
  versions: ImageVersionDto[];
  activeVersionId: string | null;
  onUseVersion: (version: ImageVersionDto) => void;
};

export function ImageVersionHistory({
  projectId,
  imageId,
  versions,
  activeVersionId,
  onUseVersion,
}: ImageVersionHistoryProps) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="image-versions-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="image-versions-heading"
          className="text-sm font-semibold text-white"
        >
          Saved versions
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
          {versions.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Each save adds a version. Older versions and the original stay
        downloadable.
      </p>

      {versions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
          No saved versions yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {versions.map((version) => {
            const isActive = version.id === activeVersionId;

            return (
              <li
                key={version.id}
                className={`rounded-xl border p-3 transition ${
                  isActive
                    ? "border-cyan-300/30 bg-cyan-400/[0.07]"
                    : "border-white/10 bg-slate-950/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      v{version.version} ·{" "}
                      {version.source === "original" ? "Original" : "Edited"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatDimensions(version.width, version.height)} ·{" "}
                      {formatBytes(version.byteSize)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {dateFormatter.format(new Date(version.createdAt))}
                    </p>
                  </div>
                  {isActive ? (
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
                      Active
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUseVersion(version)}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    {version.source === "original"
                      ? "Restore original settings"
                      : `Use settings from version ${version.version}`}
                  </button>
                  <a
                    href={imageApi.versionFileUrl(
                      projectId,
                      imageId,
                      version.id,
                      true,
                    )}
                    download
                    className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-cyan-200/80 transition hover:bg-cyan-400/10 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Download v{version.version}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
