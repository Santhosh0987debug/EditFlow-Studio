import type { ProjectDto } from "@editflow/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage, getFieldErrors } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { FormField } from "../components/FormField";
import { InlineSpinner } from "../components/PageLoader";
import { useProjects } from "../projects/useProjects";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

type Notice = {
  type: "success" | "error";
  message: string;
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const {
    projects,
    isLoading,
    loadError,
    isCreating,
    reload,
    createProject,
    deleteProject,
  } = useProjects();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const firstName = user?.name.split(" ")[0] ?? "there";
  const initials =
    user?.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() ?? "EF";

  function resetForm() {
    setName("");
    setDescription("");
    setFieldErrors({});
    setFormError(null);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setFieldErrors({ name: "Project name is required." });
      return;
    }

    try {
      await createProject({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      closeForm();
      setNotice({ type: "success", message: "Project created." });
    } catch (error) {
      const fields = getFieldErrors(error);
      setFieldErrors(fields ?? {});
      setFormError(
        fields
          ? "Please correct the highlighted fields."
          : getErrorMessage(error),
      );
    }
  }

  async function handleDelete(project: ProjectDto) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setDeletingId(project.id);

    try {
      await deleteProject(project.id);
      setNotice({ type: "success", message: "Project deleted." });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    setNotice(null);
    setIsLoggingOut(true);

    try {
      // Clearing the session makes the protected-route guard send the now
      // signed-out visitor to the login screen.
      await logout();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Brand to="/dashboard" />

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <span
              className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-xs font-semibold text-cyan-200"
              aria-hidden="true"
            >
              {initials}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? <InlineSpinner /> : null}
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              Workspace
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Your projects
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Welcome back, {firstName}. Open the text, image, or audio editor
              from any project, or create a new workspace for what you want to
              work on next.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isFormOpen) {
                closeForm();
              } else {
                setIsFormOpen(true);
              }
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden="true">{isFormOpen ? "×" : "+"}</span>
            {isFormOpen ? "Close form" : "New project"}
          </button>
        </div>

        <div className="mt-6 space-y-3" aria-live="polite">
          {notice ? (
            <div
              role={notice.type === "error" ? "alert" : "status"}
              className={`rounded-xl border px-4 py-3 text-sm ${
                notice.type === "error"
                  ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              }`}
            >
              {notice.message}
            </div>
          ) : null}
        </div>

        {isFormOpen ? (
          <section
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
            aria-labelledby="create-project-heading"
          >
            <h2
              id="create-project-heading"
              className="text-lg font-semibold text-white"
            >
              Create a project
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Give this workspace a clear name. Text documents, images, and
              audio are saved as versions inside their project.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              {formError ? (
                <div
                  className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <FormField
                id="project-name"
                label="Project name"
                type="text"
                required
                maxLength={120}
                autoFocus
                value={name}
                error={fieldErrors.name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Launch teaser"
              />

              <div>
                <label
                  htmlFor="project-description"
                  className="text-sm font-medium text-slate-200"
                >
                  Description{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="project-description"
                  rows={3}
                  maxLength={500}
                  value={description}
                  aria-invalid={
                    fieldErrors.description ? true : undefined
                  }
                  aria-describedby={
                    fieldErrors.description
                      ? "project-description-error"
                      : "project-description-hint"
                  }
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What are you planning to edit?"
                  className={`mt-2 w-full resize-y rounded-xl border bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition focus:outline-none focus:ring-2 ${
                    fieldErrors.description
                      ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
                      : "border-white/10 focus:border-cyan-300/60 focus:ring-cyan-300/20"
                  }`}
                />
                {fieldErrors.description ? (
                  <p
                    id="project-description-error"
                    className="mt-1.5 text-xs text-rose-300"
                  >
                    {fieldErrors.description}
                  </p>
                ) : (
                  <p
                    id="project-description-hint"
                    className="mt-1.5 text-xs text-slate-500"
                  >
                    {description.length}/500 characters
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isCreating}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? <InlineSpinner /> : null}
                  {isCreating ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="mt-10" aria-labelledby="project-list-heading">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="project-list-heading"
              className="text-sm font-semibold tracking-wide text-slate-300"
            >
              Projects
              {!isLoading ? (
                <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-normal text-slate-500">
                  {projects.length}
                </span>
              ) : null}
            </h2>
            {!isLoading && projects.length > 0 ? (
              <span className="text-xs text-slate-500">
                Most recently updated first
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-5" role="status" aria-live="polite">
              <span className="sr-only">Loading projects...</span>
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-hidden="true"
              >
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div
              className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6"
              role="alert"
            >
              <p className="text-sm text-rose-100">{loadError}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="mt-4 rounded-lg border border-rose-200/30 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-200/10"
              >
                Try again
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <span
                className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-xl text-cyan-200"
                aria-hidden="true"
              >
                +
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                No projects yet
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                Create a project to organize the media you want to edit. Your
                projects stay private to your account.
              </p>
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const isDeleting = deletingId === project.id;

                return (
                  <li
                    key={project.id}
                    className="flex min-h-44 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-xs font-semibold text-cyan-200"
                        aria-hidden="true"
                      >
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-500">
                        Project
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-white">
                      {project.name}
                    </h3>
                    <p
                      className={`mt-2 flex-1 text-sm leading-6 ${
                        project.description
                          ? "text-slate-400"
                          : "text-slate-500 italic"
                      }`}
                    >
                      {project.description || "No description yet."}
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                      <span className="text-xs text-slate-500">
                        Updated {formatDate(project.updatedAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/image-editor?project=${encodeURIComponent(project.id)}`}
                          aria-label={`Open image editor for ${project.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/20 bg-violet-400/10 px-2.5 py-1.5 text-xs font-medium text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                        >
                          Image
                        </Link>
                        <Link
                          to={`/audio-editor?project=${encodeURIComponent(project.id)}`}
                          aria-label={`Open audio editor for ${project.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          Audio
                        </Link>
                        <Link
                          to={`/editor?project=${encodeURIComponent(project.id)}`}
                          aria-label={`Open editor for ${project.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          Text
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(project)}
                          disabled={isDeleting}
                          aria-label={`Delete ${project.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                        {isDeleting ? (
                          <InlineSpinner />
                        ) : (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 6h12M8 3h4M6 6l.7 10h6.6L14 6M8.5 9v4.5M11.5 9v4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Text, image, and audio editing available · Video later.</p>
          <p>EditFlow Studio</p>
        </div>
      </footer>
    </div>
  );
}
