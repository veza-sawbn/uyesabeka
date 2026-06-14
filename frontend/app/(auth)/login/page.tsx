"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { loginAction, type LoginState } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-left">
          <div className="login-eyebrow">TASAP Platform</div>
          <h1 className="login-h1">Training. Attendance. Stipends.</h1>
          <p className="login-tag">Real-time, audit-ready learnership administration.</p>
        </div>
        <div className="login-right">
          <form className="login-form" action={formAction}>
            <h2 className="login-title">Sign in to your account</h2>
            <p className="login-subtext">Enter your credentials to continue</p>

            {state?.error && <div className="error-box">{state.error}</div>}

            <input type="hidden" name="next" value={next} />
            <div className="form-field">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <input className="input" id="username" name="username" autoComplete="username" required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <button className="login-btn" type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>

            <p className="login-hint">
              Demo: <strong>admin</strong> / admin123 · <strong>mentor</strong> / mentor123 ·{" "}
              <strong>payroll</strong> / payroll123
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-wrap" />}>
      <LoginForm />
    </Suspense>
  );
}
