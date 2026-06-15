"use client";

import { useActionState } from "react";

import { type FormState, updateLearner } from "@/app/(dashboard)/actions";
import type { LearnerDetail, Programme, Site } from "@/lib/types";

export default function EditLearnerForm({
  learner,
  sites,
  programmes,
}: {
  learner: LearnerDetail;
  sites: Site[];
  programmes: Programme[];
}) {
  const action = updateLearner.bind(null, learner.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560 }}>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="first_name">First name</label>
          <input className="input" id="first_name" name="first_name" defaultValue={learner.first_name} required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="last_name">Last name</label>
          <input className="input" id="last_name" name="last_name" defaultValue={learner.last_name} required />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" defaultValue={learner.email ?? ""} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="phone">Phone</label>
          <input className="input" id="phone" name="phone" defaultValue={learner.phone ?? ""} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="site_id">Site</label>
          <select className="input" id="site_id" name="site_id" defaultValue={learner.site_id ?? ""}>
            <option value="">— None —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="programme_id">Programme</label>
          <select className="input" id="programme_id" name="programme_id" defaultValue={learner.programme_id ?? ""}>
            <option value="">— None —</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="stipend_rate_per_day">Stipend rate per day (R)</label>
        <input
          className="input"
          id="stipend_rate_per_day"
          name="stipend_rate_per_day"
          inputMode="decimal"
          defaultValue={learner.stipend_rate_per_day}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a className="btn btn-ghost" href={`/learners/${learner.id}`}>Cancel</a>
      </div>
    </form>
  );
}
