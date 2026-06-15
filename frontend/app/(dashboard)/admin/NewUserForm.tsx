"use client";

import { useActionState } from "react";

import { createUser, type FormState } from "@/app/(dashboard)/actions";
import { ALL_ROLES } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import type { Provider, Site } from "@/lib/types";

export default function NewUserForm({ providers, sites }: { providers: Provider[]; sites: Site[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createUser, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560, marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>Add user</div>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="full_name">Full name</label>
        <input className="input" id="full_name" name="full_name" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="role">Role</label>
          <select className="input" id="role" name="role" required defaultValue="">
            <option value="">— Select —</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="provider_id">Provider</label>
          <select className="input" id="provider_id" name="provider_id" defaultValue="">
            <option value="">— None —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="site_id">Site</label>
        <select className="input" id="site_id" name="site_id" defaultValue="">
          <option value="">— None —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add user"}
      </button>
    </form>
  );
}
