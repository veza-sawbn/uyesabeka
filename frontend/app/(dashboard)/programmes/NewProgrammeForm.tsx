"use client";

import { useActionState } from "react";

import { createProgramme, type FormState } from "@/app/(dashboard)/actions";
import type { Provider } from "@/lib/types";

export default function NewProgrammeForm({ providers, showProvider }: { providers: Provider[]; showProvider: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProgramme, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560, marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>Add programme</div>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div className="form-field">
        <label className="form-label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="sector">Sector</label>
          <input className="input" id="sector" name="sector" />
        </div>
        {showProvider && (
          <div className="form-field">
            <label className="form-label" htmlFor="provider_id">Provider</label>
            <select className="input" id="provider_id" name="provider_id" defaultValue="">
              <option value="">— Select —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="start_date">Start date</label>
          <input className="input" id="start_date" name="start_date" type="date" />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="end_date">End date</label>
          <input className="input" id="end_date" name="end_date" type="date" />
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add programme"}
      </button>
    </form>
  );
}
