import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage, getFieldErrors } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { InlineSpinner } from "../components/PageLoader";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
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
      await register({ name, email, password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const fields = getFieldErrors(error);
      setFieldErrors(fields ?? {});
      setFormError(
        fields
          ? "Please correct the highlighted fields."
          : getErrorMessage(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Start with a project"
      subtitle="Set up your account, then organize the work you want to edit."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            Sign in
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
          id="register-name"
          label="Name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada Lovelace"
        />

        <FormField
          id="register-email"
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
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          error={fieldErrors.password}
          hint="Use at least 8 characters."
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a password"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <InlineSpinner /> : null}
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
