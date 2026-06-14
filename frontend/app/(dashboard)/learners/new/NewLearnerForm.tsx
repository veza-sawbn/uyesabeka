"use client";

import { useActionState } from "react";

import { createLearner, type CreateLearnerState } from "@/app/(dashboard)/actions";
import type { Programme, Site } from "@/lib/types";

export default function NewLearnerForm({ sites, programmes }: { sites: Site[]; programmes: Programme[] }) {
  const [state, formAction, pending] = useActionState<CreateLearnerState, FormData>(createLearner, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560 }}>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="first_name">First name</label>
          <input className="input" id="first_name" name="first_name" required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="last_name">Last name</label>
          <input className="input" id="last_name" name="last_name" required />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="id_number">SA ID number (13 digits)</label>
        <input className="input" id="id_number" name="id_number" inputMode="numeric" maxLength={13} required />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="phone">Phone</label>
          <input className="input" id="phone" name="phone" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="site_id">Site</label>
          <select className="input" id="site_id" name="site_id" defaultValue="">
            <option value="">— Select —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="programme_id">Programme</label>
          <select className="input" id="programme_id" name="programme_id" defaultValue="">
            <option value="">— Select —</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="stipend_rate_per_day">Stipend rate per day (R)</label>
        <input className="input" id="stipend_rate_per_day" name="stipend_rate_per_day" inputMode="decimal" defaultValue="0" />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create learner"}
        </button>
        <a className="btn btn-ghost" href="/learners">Cancel</a>
      </div>
    </form>
  );
}
