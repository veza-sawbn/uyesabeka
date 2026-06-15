"use client";

import { useActionState } from "react";

import { type FormState, updateUser } from "@/app/(dashboard)/actions";
import { ALL_ROLES } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import type { AdminUser, Provider, Site } from "@/lib/types";

export default function EditUserForm({ user, providers, sites }: { user: AdminUser; providers: Provider[]; sites: Site[] }) {
  const action = updateUser.bind(null, user.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560 }}>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div className="form-field">
        <label className="form-label">Username</label>
        <input className="input" value={user.username} disabled />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" placeholder="Leave blank to keep current password" />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="full_name">Full name</label>
        <input className="input" id="full_name" name="full_name" defaultValue={user.full_name ?? ""} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="role">Role</label>
          <select className="input" id="role" name="role" defaultValue={user.role}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="provider_id">Provider</label>
          <select className="input" id="provider_id" name="provider_id" defaultValue={user.provider_id ?? ""}>
            <option value="">— None —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="site_id">Site</label>
        <select className="input" id="site_id" name="site_id" defaultValue={user.site_id ?? ""}>
          <option value="">— None —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a className="btn btn-ghost" href="/admin">Cancel</a>
      </div>
    </form>
  );
}
