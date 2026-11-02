import type {
  AiStatusResponse,
  AiTextProposalDto,
  AiTextRequest,
  SaveTextVersionRequest,
  TextDocumentDto,
  TextVersionDto,
  TextVersionSource,
  TextVersionSummaryDto,
} from "@editflow/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { aiApi, textApi } from "../api/client";
import { getErrorMessage } from "../api/errors";
import { Brand } from "../components/Brand";
import { InlineSpinner, PageLoader } from "../components/PageLoader";
import { useProjects } from "../projects/useProjects";
import { AiAssistant } from "../editor/AiAssistant";
import { ComparisonPanel } from "../editor/ComparisonPanel";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { VersionHistory } from "../editor/VersionHistory";

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

type ProposalState = AiTextProposalDto & {
  baseContent: string;
};

const NOTICE_STYLES: Record<Notice["type"], string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
};

function summarizeVersion(version: TextVersionDto): TextVersionSummaryDto {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    source: version.source,
    characterCount: version.characterCount,
    createdAt: version.createdAt,
  };
}

export function EditorPage() {
  const {
    projects,
    isLoading: projectsLoading,
    loadError: projectsError,
    reload: reloadProjects,
  } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const selectedProject = projects.find((project) => project.id === projectId);

  const [document, setDocument] = useState<TextDocumentDto | null>(null);
  const [versions, setVersions] = useState<TextVersionSummaryDto[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [baselineTitle, setBaselineTitle] = useState("");
  const [baselineContent, setBaselineContent] = useState("");
  const [pendingSource, setPendingSource] =
    useState<TextVersionSource>("manual");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [isDocumentLoading, setIsDocumentLoading] = useState(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isVersionsLoading, setIsVersionsLoading] = useState(true);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [openingVersionId, setOpeningVersionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [isAiStatusLoading, setIsAiStatusLoading] = useState(true);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const [showSavedComparison, setShowSavedComparison] = useState(false);

  const loadSequence = useRef(0);

  const loadAiStatus = useCallback(async () => {
    setIsAiStatusLoading(true);
    setAiStatusError(null);

    try {
      setAiStatus(await aiApi.status());
    } catch (error) {
      setAiStatus(null);
      setAiStatusError(getErrorMessage(error));
    } finally {
      setIsAiStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAiStatus();
  }, [loadAiStatus]);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setSearchParams({ project: projects[0]!.id }, { replace: true });
    }
  }, [projectId, projects, setSearchParams]);

  const loadDocumentData = useCallback(async (id: string) => {
    const sequence = ++loadSequence.current;
    setIsDocumentLoading(true);
    setDocumentError(null);
    setIsVersionsLoading(true);
    setVersionsError(null);
    setProposal(null);
    setNotice(null);
    setShowSavedComparison(false);
    setActiveVersionId(null);

    const [documentResult, versionsResult] = await Promise.allSettled([
      textApi.getDocument(id),
      textApi.listVersions(id),
    ]);

    if (sequence !== loadSequence.current) {
      return;
    }

    if (documentResult.status === "fulfilled") {
      const nextDocument = documentResult.value.document;
      setDocument(nextDocument);
      setTitle(nextDocument?.latestVersion?.title ?? nextDocument?.title ?? "");
      setContent(nextDocument?.latestVersion?.content ?? "");
      setBaselineTitle(
        nextDocument?.latestVersion?.title ?? nextDocument?.title ?? "",
      );
      setBaselineContent(nextDocument?.latestVersion?.content ?? "");
      setPendingSource("manual");
    } else {
      setDocumentError(getErrorMessage(documentResult.reason));
    }

    if (versionsResult.status === "fulfilled") {
      setVersions(versionsResult.value.versions);
    } else {
      setVersionsError(getErrorMessage(versionsResult.reason));
    }

    setIsDocumentLoading(false);
    setIsVersionsLoading(false);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setIsDocumentLoading(false);
      setIsVersionsLoading(false);
      return;
    }

    void loadDocumentData(projectId);

    return () => {
      loadSequence.current += 1;
    };
  }, [projectId, loadDocumentData]);

  const isDirty = title !== baselineTitle || content !== baselineContent;
  const latestVersion = document?.latestVersion ?? null;
  const proposalChangedSinceGeneration =
    proposal !== null && content !== proposal.baseContent;

  function changeProject(nextProjectId: string) {
    if (!nextProjectId || nextProjectId === projectId) {
      return;
    }

    if (
      isDirty &&
      !window.confirm(
        "You have unsaved changes. Switch projects and discard them?",
      )
    ) {
      return;
    }

    setSearchParams({ project: nextProjectId }, { replace: true });
  }

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    setNotice(null);
  }

  function handleContentChange(nextContent: string) {
    setContent(nextContent);
    setPendingSource("manual");
    setNotice(null);
  }

  async function handleSave() {
    if (!projectId) {
      return;
    }

    if (!title.trim()) {
      setNotice({ type: "error", message: "Enter a document title." });
      return;
    }

    if (!content.trim()) {
      setNotice({
        type: "error",
        message: "Write some content before saving a version.",
      });
      return;
    }

    const input: SaveTextVersionRequest = {
      title: title.trim(),
      content,
      source: pendingSource,
    };

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await textApi.saveVersion(projectId, input);
      setDocument(response.document);
      setTitle(response.version.title);
      setContent(response.version.content);
      setBaselineTitle(response.version.title);
      setBaselineContent(response.version.content);
      setVersions((current) => [
        summarizeVersion(response.version),
        ...current.filter((version) => version.id !== response.version.id),
      ]);
      setActiveVersionId(response.version.id);
      setPendingSource("manual");
      setProposal(null);
      setShowSavedComparison(false);
      setNotice({
        type: "success",
        message: `Version ${response.version.version} saved. Earlier versions are unchanged.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenVersion(version: TextVersionSummaryDto) {
    if (!projectId) {
      return;
    }

    if (
      isDirty &&
      !window.confirm(
        `Open version ${version.version} and discard your unsaved changes?`,
      )
    ) {
      return;
    }

    setOpeningVersionId(version.id);
    setNotice(null);

    try {
      const response = await textApi.getVersion(projectId, version.id);
      setTitle(response.version.title);
      setContent(response.version.content);
      setPendingSource("restored");
      setActiveVersionId(response.version.id);
      setProposal(null);
      setShowSavedComparison(false);
      setNotice({
        type: "info",
        message: `Version ${response.version.version} reopened. Saving creates a new version; the original stays in history.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setOpeningVersionId(null);
    }
  }

  async function handleGenerate(input: AiTextRequest) {
    setIsGenerating(true);
    setAiError(null);
    setProposal(null);
    setShowSavedComparison(false);

    try {
      const response = await aiApi.generate(input);
      setProposal({
        ...response.proposal,
        baseContent: input.content,
      });
      setNotice({
        type: "info",
        message: "Review the proposal below. Nothing has been applied yet.",
      });
    } catch (error) {
      setAiError(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAcceptProposal() {
    if (!proposal || proposalChangedSinceGeneration) {
      return;
    }

    setContent(proposal.text);
    setPendingSource("ai_accepted");
    setProposal(null);
    setNotice({
      type: "success",
      message:
        "AI changes applied to the draft. Save a version to keep them; the original is unchanged.",
    });
  }

  function handleRejectProposal() {
    setProposal(null);
    setNotice({
      type: "info",
      message: "AI proposal rejected. Your text is unchanged.",
    });
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
                htmlFor="editor-project"
                className="shrink-0 text-xs text-slate-500"
              >
                Project
              </label>
              <select
                id="editor-project"
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
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6" role="alert">
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
            Text editor
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Create a project first
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            Text documents belong to projects. Create a project on the
            dashboard, then come back to write and save versions.
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
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6" role="alert">
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
              Text editor · {selectedProject?.name ?? "Choose a project"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Shape the text. Keep the original.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Draft in plain text or Markdown, generate an AI proposal, compare
              it side by side, and save only the versions you accept.
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
              {isDirty ? "Unsaved changes" : document ? "All changes saved" : "New document"}
            </span>
            {latestVersion ? (
              <button
                type="button"
                onClick={() => setShowSavedComparison((current) => !current)}
                aria-pressed={showSavedComparison}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                {showSavedComparison ? "Hide comparison" : "Compare saved"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty || !title.trim() || !content.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <InlineSpinner /> : null}
              {isSaving ? "Saving..." : "Save version"}
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
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 space-y-5">
            <section
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              aria-labelledby="editor-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="editor-heading" className="text-sm font-semibold text-white">
                    {document ? `Document · ${document.versionCount} versions` : "New text document"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {document
                      ? `Last saved ${new Date(document.updatedAt).toLocaleString()}`
                      : "Saving will create this project's first text version."}
                  </p>
                </div>
                {activeVersionId && document ? (
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                    Previous version open
                  </span>
                ) : null}
              </div>

              {isDocumentLoading ? (
                <div className="mt-4 space-y-3" role="status" aria-live="polite">
                  <span className="sr-only">Loading document...</span>
                  <div
                    className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
                    aria-hidden="true"
                  />
                  <div
                    className="h-80 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
                    aria-hidden="true"
                  />
                </div>
              ) : documentError ? (
                <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4" role="alert">
                  <p className="text-sm text-rose-100">{documentError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (projectId) {
                        void loadDocumentData(projectId);
                      }
                    }}
                    className="mt-3 rounded-lg border border-rose-200/30 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-200/10"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {!document ? (
                    <div className="mt-4 rounded-xl border border-dashed border-cyan-300/20 bg-cyan-400/[0.04] px-4 py-3 text-xs leading-5 text-cyan-100/80">
                      This project has no text yet. Add a title and content, then
                      save to create version 1.
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <label
                      htmlFor="document-title"
                      className="text-xs font-medium text-slate-300"
                    >
                      Document title
                    </label>
                    <input
                      id="document-title"
                      type="text"
                      maxLength={160}
                      value={title}
                      onChange={(event) => handleTitleChange(event.target.value)}
                      placeholder="Untitled document"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-lg font-semibold text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="document-content"
                      className="text-xs font-medium text-slate-300"
                    >
                      Content
                    </label>
                    <div className="mt-1.5">
                      <MarkdownEditor
                        id="document-content"
                        value={content}
                        onChange={handleContentChange}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </>
              )}
            </section>

            {proposal ? (
              <ComparisonPanel
                originalLabel="Before proposal"
                originalContent={proposal.baseContent}
                editedLabel="AI proposal"
                editedContent={proposal.text}
                notes={proposal.notes}
                actions={
                  <>
                    <p className="mr-auto text-xs leading-5 text-slate-400">
                      {proposal.provider}
                      {proposal.model ? ` · ${proposal.model}` : ""}
                    </p>
                    {proposalChangedSinceGeneration ? (
                      <p className="text-xs text-amber-200">
                        The draft changed after this proposal was generated.
                        Reject it and generate again.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleRejectProposal}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      Reject changes
                    </button>
                    <button
                      type="button"
                      onClick={handleAcceptProposal}
                      disabled={proposalChangedSinceGeneration}
                      className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Accept changes
                    </button>
                  </>
                }
              />
            ) : null}

            {!proposal && showSavedComparison && latestVersion ? (
              <ComparisonPanel
                compact
                originalLabel={`Saved version ${latestVersion.version}`}
                originalContent={latestVersion.content}
                editedLabel="Current draft"
                editedContent={content}
                actions={
                  <button
                    type="button"
                    onClick={() => setShowSavedComparison(false)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Close comparison
                  </button>
                }
              />
            ) : null}
          </div>

          <aside className="space-y-4">
            <AiAssistant
              status={aiStatus}
              isStatusLoading={isAiStatusLoading}
              statusError={aiStatusError}
              content={content}
              isGenerating={isGenerating}
              generateError={aiError}
              onRetryStatus={() => void loadAiStatus()}
              onGenerate={(input) => void handleGenerate(input)}
            />

            <VersionHistory
              versions={versions}
              isLoading={isVersionsLoading}
              loadError={versionsError}
              openingVersionId={openingVersionId}
              activeVersionId={activeVersionId}
              onOpen={(version) => void handleOpenVersion(version)}
              onRetry={() => {
                if (projectId) {
                  void loadDocumentData(projectId);
                }
              }}
            />
          </aside>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Text editing available · Image, audio, and video later.</p>
          <p>Originals are kept in version history.</p>
        </div>
      </footer>
    </div>
  );
}
