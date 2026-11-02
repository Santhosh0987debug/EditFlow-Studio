import type { ReactNode } from "react";
import { Brand } from "./Brand";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-48 left-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <Brand />

        <div className="grid flex-1 items-center gap-14 py-12 lg:grid-cols-[1fr_28rem]">
          <section className="hidden max-w-lg lg:block">
            <p className="text-xs font-semibold tracking-[0.24em] text-cyan-300 uppercase">
              Prompt-first media editing
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white">
              One calm workspace for every edit.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Write and version text now. Image, audio, and video editing
              workflows will arrive in later milestones.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {[
                "Projects stay private to your account.",
                "Sessions are protected with secure cookies.",
                "Text editing and version history are enabled.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full max-w-md justify-self-center rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8 lg:justify-self-end">
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>

            <div className="mt-7">{children}</div>
            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-slate-400">
              {footer}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
