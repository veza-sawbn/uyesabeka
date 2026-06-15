"use client";

import { useActionState } from "react";

import { createProvider, type FormState } from "@/app/(dashboard)/actions";

export default function NewProviderForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProvider, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560, marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>Add provider</div>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div className="form-field">
        <label className="form-label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="registration_number">Registration number</label>
          <input className="input" id="registration_number" name="registration_number" />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="contact_email">Contact email</label>
          <input className="input" id="contact_email" name="contact_email" type="email" />
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add provider"}
      </button>
    </form>
  );
}
