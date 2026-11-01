import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiClientError } from "../api/client";
import { getErrorMessage, getFieldErrors } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { getRedirectPath } from "../auth/redirect";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { InlineSpinner } from "../components/PageLoader";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (error) {
      const fields = getFieldErrors(error);
      setFieldErrors(fields ?? {});
      setFormError(
        fields
          ? "Please correct the highlighted fields."
          : getErrorMessage(error),
      );
      if (error instanceof ApiClientError && error.status === 401) {
        setFormError(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to EditFlow"
      subtitle="Pick up where you left off and keep your projects moving."
      footer={
        <p>
          New to EditFlow Studio?{" "}
          <Link
            to="/register"
            className="font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {formError ? (
          <div
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <FormField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />

        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <InlineSpinner /> : null}
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
