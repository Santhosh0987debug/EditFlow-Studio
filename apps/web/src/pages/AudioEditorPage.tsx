import type {
  AudioAssetDto,
  AudioAssetSummaryDto,
  AudioOperations,
  AudioVersionDto,
} from "@editflow/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { audioApi } from "../api/client";
import { getErrorMessage } from "../api/errors";
import { AudioControls } from "../audio/AudioControls";
import { AudioPreview } from "../audio/AudioPreview";
import { AudioUploader } from "../audio/AudioUploader";
import { AudioVersionHistory } from "../audio/AudioVersionHistory";
import {
  createDefaultOperations,
  downloadNameForBlob,
  effectiveTimelineDuration,
  formatDuration,
  operationsEqual,
  validateOperations,
} from "../audio/operations";
import { Brand } from "../components/Brand";
import { InlineSpinner, PageLoader } from "../components/PageLoader";
import { useProjects } from "../projects/useProjects";

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const NOTICE_STYLES: Record<Notice["type"], string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
};

function summarizeAudio(audio: AudioAssetDto): AudioAssetSummaryDto {
  return {
    id: audio.id,
    projectId: audio.projectId,
    name: audio.name,
    originalFilename: audio.originalFilename,
    mimeType: audio.mimeType,
    durationMs: audio.durationMs,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    byteSize: audio.byteSize,
    createdAt: audio.createdAt,
    updatedAt: audio.updatedAt,
    versionCount: audio.versionCount,
    latestVersion: audio.latestVersion,
  };
}

export function AudioEditorPage() {
  const {
    projects,
    isLoading: projectsLoading,
    loadError: projectsError,
    reload: reloadProjects,
  } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const selectedProject = projects.find((project) => project.id === projectId);

  const [audio, setAudio] = useState<AudioAssetSummaryDto[]>([]);
  const [isAudioLoading, setIsAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);

  const [detail, setDetail] = useState<AudioAssetDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);

  const [operations, setOperations] = useState<AudioOperations>(
    createDefaultOperations,
  );
  const [baselineOperations, setBaselineOperations] = useState<AudioOperations>(
    createDefaultOperations,
  );
  const [history, setHistory] = useState<AudioOperations[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const listSequence = useRef(0);
  const detailSequence = useRef(0);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setSearchParams({ project: projects[0]!.id }, { replace: true });
    }
  }, [projectId, projects, setSearchParams]);

  const loadAudio = useCallback(async (id: string) => {
    const sequence = ++listSequence.current;
    setIsAudioLoading(true);
    setAudioError(null);
    setAudio([]);
    setSelectedAudioId(null);
    setDetail(null);
    setDetailError(null);
    setPreviewUrl(null);
    setPreviewError(null);
    setNotice(null);
    setUploadError(null);

    try {
      const response = await audioApi.list(id);

      if (sequence !== listSequence.current) {
        return;
      }

      setAudio(response.audio);
      setSelectedAudioId(response.audio[0]?.id ?? null);
    } catch (error) {
      if (sequence === listSequence.current) {
        setAudioError(getErrorMessage(error));
      }
    } finally {
      if (sequence === listSequence.current) {
        setIsAudioLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!projectId) {
      setIsAudioLoading(false);
      return;
    }

    void loadAudio(projectId);

    return () => {
      listSequence.current += 1;
    };
  }, [projectId, loadAudio]);

  useEffect(() => {
    if (!projectId || !selectedAudioId) {
      setIsDetailLoading(false);
      setDetail(null);
      setDetailError(null);
      return;
    }

    const sequence = ++detailSequence.current;
    setIsDetailLoading(true);
    setDetailError(null);
    setPreviewUrl(null);
    setPreviewError(null);

    audioApi
      .get(projectId, selectedAudioId)
      .then((response) => {
        if (sequence !== detailSequence.current) {
          return;
        }

        const nextAudio = response.audio;
        const nextOperations =
          nextAudio.latestVersion?.operations ?? createDefaultOperations();

        setDetail(nextAudio);
        setOperations(nextOperations);
        setBaselineOperations(nextOperations);
        setHistory([]);
        setActiveVersionId(nextAudio.latestVersion?.id ?? null);
      })
      .catch((error: unknown) => {
        if (sequence === detailSequence.current) {
          setDetailError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (sequence === detailSequence.current) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      detailSequence.current += 1;
    };
  }, [projectId, selectedAudioId, detailNonce]);

  const detailId = detail?.id ?? null;

  const mergedDurationMs =
    detail === null
      ? 0
      : operations.mergeAssetIds.reduce((total, assetId) => {
          return (
            total +
            (audio.find((candidate) => candidate.id === assetId)?.durationMs ??
              0)
          );
        }, detail.durationMs);

  const validationError = detail
    ? validateOperations(operations, mergedDurationMs)
    : null;

  const editedDurationMs = detail
    ? effectiveTimelineDuration(operations, mergedDurationMs)
    : 0;

  useEffect(() => {
    if (!projectId || !detailId) {
      setIsPreviewLoading(false);
      return;
    }

    if (validationError) {
      setIsPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);

    const timer = window.setTimeout(() => {
      audioApi
        .preview(projectId, detailId, operations)
        .then((blob) => {
          if (cancelled) {
            return;
          }

          setPreviewUrl(URL.createObjectURL(blob));
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreviewError(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsPreviewLoading(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, detailId, operations, previewNonce, validationError]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (validationError) {
      setPreviewUrl(null);
    }
  }, [validationError]);

  const isDirty =
    detail !== null && !operationsEqual(operations, baselineOperations);

  function changeProject(nextProjectId: string) {
    if (!nextProjectId || nextProjectId === projectId) {
      return;
    }

    if (
      isDirty &&
      !window.confirm(
        "You have unsaved audio edits. Switch projects and discard them?",
      )
    ) {
      return;
    }

    setSearchParams({ project: nextProjectId }, { replace: true });
  }

  function handleSelectAudio(audioId: string) {
    if (audioId === selectedAudioId) {
      return;
    }

    if (
      isDirty &&
      !window.confirm(
        "You have unsaved audio edits. Open another clip and discard them?",
      )
    ) {
      return;
    }

    setSelectedAudioId(audioId);
  }

  function handleOperationsChange(next: AudioOperations) {
    if (operationsEqual(next, operations)) {
      return;
    }

    setHistory((current) => [...current.slice(-49), operations]);
    setOperations(next);
    setNotice(null);
  }

  function handleUndo() {
    const previous = history[history.length - 1];

    if (!previous) {
      return;
    }

    setHistory(history.slice(0, -1));
    setOperations(previous);
    setNotice(null);
  }

  function handleReset() {
    handleOperationsChange(createDefaultOperations());
  }

  function handleUseVersion(version: AudioVersionDto) {
    const nextOperations = version.operations ?? createDefaultOperations();

    if (!operationsEqual(nextOperations, operations)) {
      setHistory((current) => [...current.slice(-49), operations]);
      setOperations(nextOperations);
    }

    setActiveVersionId(version.id);
    setNotice({
      type: "info",
      message:
        version.source === "original"
          ? "Original settings restored in the editor. Save a version to keep any new edit; the original audio stays unchanged."
          : `Settings from version ${version.version} loaded. Saving creates a new version; earlier versions stay unchanged.`,
    });
  }

  async function handleUpload(file: File) {
    if (!projectId) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setNotice(null);

    try {
      const response = await audioApi.upload(projectId, file);
      const uploaded = response.audio;

      setAudio((current) => [
        summarizeAudio(uploaded),
        ...current.filter((candidate) => candidate.id !== uploaded.id),
      ]);
      setSelectedAudioId(uploaded.id);
      setNotice({
        type: "success",
        message:
          "Audio uploaded. The original is preserved and ready for editing.",
      });
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    if (!projectId || !detail || validationError) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await audioApi.saveVersion(projectId, detail.id, {
        operations,
      });
      const version = response.version;
      const nextDetail: AudioAssetDto = {
        ...detail,
        versions: [
          version,
          ...detail.versions.filter(
            (candidate) => candidate.id !== version.id,
          ),
        ],
        latestVersion: version,
        versionCount: detail.versionCount + 1,
        updatedAt: version.createdAt,
      };

      setDetail(nextDetail);
      setAudio((current) =>
        current.map((candidate) =>
          candidate.id === nextDetail.id
            ? summarizeAudio(nextDetail)
            : candidate,
        ),
      );
      setBaselineOperations(operations);
      setActiveVersionId(version.id);
      setNotice({
        type: "success",
        message: `Version ${version.version} saved. The original and earlier versions are unchanged.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    if (!projectId || !detail || validationError) {
      return;
    }

    setIsExporting(true);
    setNotice(null);

    try {
      const blob = await audioApi.exportAudio(projectId, detail.id, operations);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = downloadNameForBlob(detail.name, blob.type);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice({
        type: "success",
        message: "Edited audio exported as an MP3 with your current settings.",
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsExporting(false);
    }
  }

  if (projectsLoading && projects.length === 0) {
    return <PageLoader label="Loading your projects..." />;
  }

  const header = (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Brand to="/dashboard" />
          <Link
            to="/dashboard"
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white sm:hidden"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {projects.length > 0 ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <label
                htmlFor="audio-editor-project"
                className="shrink-0 text-xs text-slate-500"
              >
                Project
              </label>
              <select
                id="audio-editor-project"
                aria-label="Project"
                value={projectId ?? ""}
                onChange={(event) => changeProject(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20 sm:max-w-64"
              >
                {!projectId ? <option value="">Choose a project</option> : null}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Link
            to="/dashboard"
            className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white sm:inline-flex"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </header>
  );

  if (projectsError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div
            className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6"
            role="alert"
          >
            <h1 className="text-lg font-semibold text-white">
              Projects could not be loaded
            </h1>
            <p className="mt-2 text-sm text-rose-100">{projectsError}</p>
            <button
              type="button"
              onClick={() => void reloadProjects()}
              className="mt-4 rounded-lg border border-rose-200/30 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-200/10"
            >
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
            Audio editor
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Create a project first
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            Audio clips belong to projects. Create a project on the dashboard,
            then come back to upload, trim, change speed, and merge audio.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
          >
            Go to dashboard
          </Link>
        </main>
      </div>
    );
  }

  if (projectId && !selectedProject) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div
            className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6"
            role="alert"
          >
            <h1 className="text-lg font-semibold text-white">
              Project not found
            </h1>
            <p className="mt-2 text-sm text-rose-100">
              This project does not exist or belongs to another account.
            </p>
            <Link
              to="/dashboard"
              className="mt-4 inline-flex rounded-lg border border-rose-200/30 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-200/10"
            >
              Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {header}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              Audio editor - {selectedProject?.name ?? "Choose a project"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Cut, speed up, and layer sound.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Trim with timestamps, adjust playback speed, and merge clips in
              order while comparing the result with the preserved original.
              Save each edit as its own version or export a finished MP3.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                isDirty
                  ? "border-amber-300/20 bg-amber-400/10 text-amber-200"
                  : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
              }`}
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDirty ? "bg-amber-300" : "bg-emerald-400"
                }`}
                aria-hidden="true"
              />
              {isDirty
                ? "Unsaved edits"
                : detail
                  ? "All edits saved"
                  : "Choose audio"}
            </span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!detail || !isDirty || isSaving || validationError !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <InlineSpinner /> : null}
              {isSaving ? "Saving..." : "Save edited version"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={!detail || isExporting || validationError !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? <InlineSpinner /> : null}
              {isExporting ? "Exporting..." : "Export edited audio"}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-3" aria-live="polite">
          {notice ? (
            <div
              role={notice.type === "error" ? "alert" : "status"}
              className={`rounded-xl border px-4 py-3 text-sm ${NOTICE_STYLES[notice.type]}`}
            >
              {notice.message}
            </div>
          ) : null}
          {uploadError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              {uploadError}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 space-y-5">
            {audioError ? (
              <div
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6"
                role="alert"
              >
                <h2 className="text-lg font-semibold text-white">
                  Audio could not be loaded
                </h2>
                <p className="mt-2 text-sm text-rose-100">{audioError}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (projectId) {
                      void loadAudio(projectId);
                    }
                  }}
                  className="mt-4 rounded-lg border border-rose-200/30 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-200/10"
                >
                  Try again
                </button>
              </div>
            ) : isAudioLoading ? (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                role="status"
                aria-live="polite"
              >
                <span className="sr-only">Loading audio...</span>
                <div
                  className="h-10 w-40 animate-pulse rounded-lg bg-white/[0.06]"
                  aria-hidden="true"
                />
                <div
                  className="mt-4 h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
                  aria-hidden="true"
                />
              </div>
            ) : audio.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 sm:px-8">
                <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
                  Empty project
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Add the first audio clip
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  Upload an MP3, WAV, OGG, or M4A file. The original is
                  preserved, and every saved edit becomes a separate version you
                  can play or download later.
                </p>
                <div className="mt-5 max-w-md">
                  <AudioUploader
                    isUploading={isUploading}
                    onUpload={(file) => void handleUpload(file)}
                  />
                </div>
              </div>
            ) : detailError ? (
              <div
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6"
                role="alert"
              >
                <h2 className="text-lg font-semibold text-white">
                  Audio could not be loaded
                </h2>
                <p className="mt-2 text-sm text-rose-100">{detailError}</p>
                <button
                  type="button"
                  onClick={() => setDetailNonce((current) => current + 1)}
                  className="mt-4 rounded-lg border border-rose-200/30 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-200/10"
                >
                  Try again
                </button>
              </div>
            ) : isDetailLoading && !detail ? (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                role="status"
                aria-live="polite"
              >
                <span className="sr-only">Loading audio...</span>
                <div
                  className="h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
                  aria-hidden="true"
                />
              </div>
            ) : detail && projectId ? (
              <>
                <AudioPreview
                  name={detail.name}
                  beforeUrl={audioApi.originalFileUrl(projectId, detail.id)}
                  afterUrl={previewUrl}
                  originalDurationMs={detail.durationMs}
                  editedDurationMs={editedDurationMs}
                  mergedClips={operations.mergeAssetIds.length + 1}
                  isLoading={isPreviewLoading}
                  error={previewError}
                  onRetry={() => setPreviewNonce((current) => current + 1)}
                />
                <AudioControls
                  operations={operations}
                  currentAssetId={detail.id}
                  totalDurationMs={mergedDurationMs}
                  availableAssets={audio}
                  disabled={isSaving || isExporting}
                  canUndo={history.length > 0}
                  validationError={validationError}
                  onChange={handleOperationsChange}
                  onUndo={handleUndo}
                  onReset={handleReset}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-400">
                Choose an audio clip from the list to start editing.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {audio.length > 0 ? (
              <AudioUploader
                isUploading={isUploading}
                onUpload={(file) => void handleUpload(file)}
              />
            ) : null}

            {audio.length > 0 && projectId ? (
              <section
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                aria-labelledby="audio-list-heading"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2
                    id="audio-list-heading"
                    className="text-sm font-semibold text-white"
                  >
                    Audio clips
                  </h2>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-500">
                    {audio.length}
                  </span>
                </div>

                <ul className="mt-3 space-y-2">
                  {audio.map((clip) => {
                    const isSelected = clip.id === selectedAudioId;

                    return (
                      <li key={clip.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectAudio(clip.id)}
                          aria-label={`Open audio ${clip.name}`}
                          aria-pressed={isSelected}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                            isSelected
                              ? "border-cyan-300/30 bg-cyan-400/[0.07]"
                              : "border-white/10 bg-slate-950/40 hover:border-white/20"
                          }`}
                        >
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-slate-950 text-cyan-200"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                              <path
                                d="M4 9v2M7 6v8M10 3v14M13 6v8M16 9v2"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-white">
                              {clip.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              {formatDuration(clip.durationMs)} ·{" "}
                              {clip.versionCount}{" "}
                              {clip.versionCount === 1 ? "version" : "versions"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {detail && projectId ? (
              <AudioVersionHistory
                projectId={projectId}
                audioId={detail.id}
                versions={detail.versions}
                activeVersionId={activeVersionId}
                onUseVersion={handleUseVersion}
              />
            ) : null}
          </aside>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Text, image, and audio editing available - Video later.</p>
          <p>Originals are kept in version history.</p>
        </div>
      </footer>
    </div>
  );
}
