"use client";

import { useActionState } from "react";

import { createSite, type FormState } from "@/app/(dashboard)/actions";
import type { Provider } from "@/lib/types";

export default function NewSiteForm({ providers, showProvider }: { providers: Provider[]; showProvider: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSite, {});

  return (
    <form action={formAction} className="card detail-section" style={{ maxWidth: 560, marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 8 }}>Add site</div>
      {state?.error && <div className="error-box">{state.error}</div>}

      <div className="form-field">
        <label className="form-label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="address">Address</label>
        <input className="input" id="address" name="address" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="latitude">Latitude</label>
          <input className="input" id="latitude" name="latitude" inputMode="decimal" required />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="longitude">Longitude</label>
          <input className="input" id="longitude" name="longitude" inputMode="decimal" required />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showProvider ? "1fr 1fr" : "1fr", gap: 12 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="geofence_radius_meters">Geofence radius (m)</label>
          <input className="input" id="geofence_radius_meters" name="geofence_radius_meters" inputMode="numeric" defaultValue="150" />
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

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add site"}
      </button>
    </form>
  );
}
