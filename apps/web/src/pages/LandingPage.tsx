import type { MediaKind } from "@editflow/shared";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type MediaPreview = {
  kind: MediaKind;
  title: string;
  description: string;
  glyph: string;
  accent: string;
};

const mediaPreviews: MediaPreview[] = [
  {
    kind: "text",
    title: "Text",
    description:
      "Shape copy, structure, and tone through a clear, reviewable edit plan.",
    glyph: "Aa",
    accent: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/20",
  },
  {
    kind: "image",
    title: "Image",
    description:
      "Plan composition, style, and visual adjustments before a single pixel changes.",
    glyph: "▣",
    accent: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
  },
  {
    kind: "audio",
    title: "Audio",
    description:
      "Trim with timestamps, change speed, and merge clips in a chosen order.",
    glyph: "≋",
    accent: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  },
  {
    kind: "video",
    title: "Video",
    description:
      "Plan cuts, pacing, and corrections before the render begins.",
    glyph: "▶",
    accent: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
  },
];

export function LandingPage() {
  const { user, isLoading } = useAuth();
  const firstName = user?.name.split(" ")[0];
  const getStartedPath = user ? "/dashboard" : "/register";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-52 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-linear-to-br from-cyan-400 to-violet-500 text-sm font-bold text-slate-950">
            EF
          </span>
          <span className="text-sm font-semibold tracking-wide">
            EditFlow Studio
          </span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {isLoading ? (
            <span className="text-slate-500">Loading...</span>
          ) : user ? (
            <>
              <span className="hidden text-slate-400 sm:inline">
                Hi, {firstName}
              </span>
              <Link
                to="/dashboard"
                className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-slate-300 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative">
        <section
          className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24"
          aria-labelledby="hero-heading"
        >
          <div className="max-w-3xl">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.2em] text-cyan-300 uppercase">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />
                Text, image, and audio editors enabled
              </span>
              <span className="text-slate-500">Phase 5</span>
            </p>
            <h1
              id="hero-heading"
              className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-7xl"
            >
              EditFlow{" "}
              <span className="bg-linear-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                Studio
              </span>
            </h1>
            <p className="mt-4 text-sm font-medium tracking-[0.24em] text-cyan-300 uppercase">
              Prompt-first media editing workspace
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Describe the change you want in plain language. Edit text with AI
              proposals, shape images with non-destructive controls, and trim or
              merge audio clips. Save only what you approve. Video editing
              follows later.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                to={getStartedPath}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Get Started
                <span aria-hidden="true">→</span>
              </Link>
              {!isLoading && !user ? (
                <Link
                  to="/login"
                  className="text-sm text-slate-400 transition hover:text-white"
                >
                  Already have an account? Sign in
                </Link>
              ) : (
                <span className="text-sm text-slate-500">
                  Open the text editor from your dashboard.
                </span>
              )}
            </div>
          </div>
        </section>

        <section
          id="media"
          aria-labelledby="media-heading"
          className="mx-auto max-w-6xl scroll-mt-8 px-6 pb-24"
        >
          <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-10 sm:flex-row sm:items-end">
            <div>
              <h2
                id="media-heading"
                className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                Text, Image, Audio, Video
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                One prompt-first workspace for every kind of media you work
                with.
              </p>
            </div>
            <span className="text-xs font-medium tracking-[0.2em] text-slate-500 uppercase">
              Text, image, and audio live · more planned
            </span>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mediaPreviews.map((media) => (
              <li
                key={media.kind}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-semibold ring-1 ${media.accent}`}
                  aria-hidden="true"
                >
                  {media.glyph}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {media.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {media.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Text, image, and audio editing with version history · Video later.
          </p>
          <p>React · Express · Prisma</p>
        </div>
      </footer>
    </div>
  );
}
