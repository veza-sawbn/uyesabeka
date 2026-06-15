"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { checkInLearner } from "@/app/(dashboard)/actions";
import { initials } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import type { GeofenceResult, RegisterItem, VerificationStatus } from "@/lib/types";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";

interface CardState {
  checked_in: boolean;
  check_in_time: string | null;
  geofence: GeofenceResult | null;
  verification: VerificationStatus | null;
  busy: boolean;
  needsOverride: boolean;
  pendingSignature: string | null;
  error: string | null;
}

function geoClass(geofence: GeofenceResult | null): string {
  if (geofence === "inside") return "inside";
  if (geofence === "outside") return "outside";
  if (geofence === "rejected") return "rejected";
  return "";
}

// Resolve the device position, falling back to the site coordinates (the mentor
// is physically on-site) when geolocation is unavailable or denied.
function getPosition(item: RegisterItem): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ latitude: item.site_latitude, longitude: item.site_longitude });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: item.site_latitude, longitude: item.site_longitude }),
      { timeout: 5000 },
    );
  });
}

export default function LearnerRegister({ items }: { items: RegisterItem[] }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<Record<number, CardState>>(() =>
    Object.fromEntries(
      items.map((it) => [
        it.learner_id,
        {
          checked_in: it.checked_in,
          check_in_time: it.check_in_time,
          geofence: it.geofence,
          verification: it.verification,
          busy: false,
          needsOverride: false,
          pendingSignature: null,
          error: null,
        } as CardState,
      ]),
    ),
  );
  const [signingId, setSigningId] = useState<number | null>(null);
  const [padError, setPadError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);
  const signingItem = items.find((it) => it.learner_id === signingId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.id_number.includes(q),
    );
  }, [items, search]);

  async function handleCheckIn(item: RegisterItem, override: boolean, signatureData: string | null) {
    setState((s) => ({ ...s, [item.learner_id]: { ...s[item.learner_id], busy: true, error: null } }));
    const pos = await getPosition(item);
    const res = await checkInLearner({
      learner_id: item.learner_id,
      latitude: pos.latitude,
      longitude: pos.longitude,
      override,
      signature_data: signatureData ?? undefined,
    });
    setState((s) => {
      const prev = s[item.learner_id];
      if (res.ok) {
        return {
          ...s,
          [item.learner_id]: {
            ...prev,
            busy: false,
            checked_in: true,
            check_in_time: res.data.check_in_time,
            geofence: res.data.geofence_result,
            verification: res.data.verification_status,
            needsOverride: false,
            pendingSignature: null,
            error: null,
          },
        };
      }
      const outside = /override/i.test(res.error);
      return {
        ...s,
        [item.learner_id]: {
          ...prev,
          busy: false,
          needsOverride: outside,
          pendingSignature: outside ? signatureData : null,
          error: outside ? null : res.error,
        },
      };
    });
    setSigningId(null);
  }

  function openSignaturePad(item: RegisterItem) {
    setPadError(null);
    setSigningId(item.learner_id);
  }

  function handleConfirmSign(override: boolean) {
    if (!signingItem) return;
    const dataUrl = padRef.current?.toDataURL() ?? null;
    if (!dataUrl) {
      setPadError("Please sign before confirming.");
      return;
    }
    setPadError(null);
    void handleCheckIn(signingItem, override, dataUrl);
  }

  function renderCta(item: RegisterItem, cs: CardState) {
    if (cs.checked_in) {
      return (
        <span className="timestamp-pill">
          <i className="ti ti-check" aria-hidden />
          {formatTime(cs.check_in_time)}
        </span>
      );
    }
    if (cs.verification === "rejected") {
      return (
        <button className="btn-review" onClick={() => router.push(`/attendance?learner_id=${item.learner_id}`)}>
          Review
        </button>
      );
    }
    if (cs.needsOverride) {
      return (
        <button
          className="btn-override"
          disabled={cs.busy}
          onClick={() => handleCheckIn(item, true, cs.pendingSignature)}
        >
          {cs.busy ? "…" : "Override"}
        </button>
      );
    }
    return (
      <button className="btn-checkin" disabled={cs.busy} onClick={() => openSignaturePad(item)}>
        {cs.busy ? "…" : "Check in"}
      </button>
    );
  }

  return (
    <div id="today-register" className="card detail-section" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-title" style={{ marginBottom: 10 }}>
        Today&apos;s register
      </div>

      <div className="register-search">
        <i className="ti ti-search" aria-hidden />
        <input
          ref={searchRef}
          placeholder="Search learners…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="register-list">
        {filtered.length === 0 && <div className="empty">No learners on today&apos;s register.</div>}
        {filtered.map((item) => {
          const cs = state[item.learner_id];
          return (
            <div key={item.learner_id} className={`learner-card ${cs.checked_in ? "checked-in" : ""}`}>
              <div className={`lc-avatar ${cs.checked_in ? geoClass(cs.geofence) || "inside" : ""}`}>
                {initials(item.name)}
              </div>
              <div className="lc-info">
                <div className="lc-name">{item.name}</div>
                <div className="lc-id">{item.id_number}</div>
                {cs.geofence && (
                  <span className={`geo-pill geo-${cs.geofence}`}>
                    {cs.geofence === "inside" && <i className="ti ti-map-pin" aria-hidden />}
                    {cs.geofence}
                  </span>
                )}
                {cs.error && (
                  <div style={{ fontSize: 9, color: "var(--red)", marginTop: 3 }}>{cs.error}</div>
                )}
              </div>
              <div className="lc-cta">{renderCta(item, cs)}</div>
            </div>
          );
        })}
      </div>

      <button className="fab" aria-label="Check in" onClick={() => searchRef.current?.focus()}>
        <i className="ti ti-clock-plus" />
      </button>

      {signingItem && (
        <div className="signature-modal-backdrop" onClick={() => setSigningId(null)}>
          <div className="signature-modal" onClick={(e) => e.stopPropagation()}>
            <div className="signature-modal-title">Sign to confirm check-in</div>
            <div className="signature-modal-name">{signingItem.name}</div>
            <SignaturePad key={signingItem.learner_id} ref={padRef} />
            <div className="signature-hint">Sign with your finger or mouse above</div>
            {padError && <div className="signature-error">{padError}</div>}
            <div className="signature-actions">
              <button className="btn btn-ghost" type="button" onClick={() => padRef.current?.clear()}>
                Clear
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setSigningId(null)}>
                Cancel
              </button>
              <button
                className="btn-checkin"
                type="button"
                disabled={state[signingItem.learner_id]?.busy}
                onClick={() => handleConfirmSign(false)}
              >
                {state[signingItem.learner_id]?.busy ? "…" : "Confirm check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
