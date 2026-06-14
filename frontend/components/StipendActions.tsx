"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { runStipendBatch } from "@/app/(dashboard)/actions";
import { formatRand } from "@/lib/format";

export default function StipendActions({
  canManage,
  preview,
}: {
  canManage: boolean;
  preview: { total_learners: number; total_days: number; total_amount_rand: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await runStipendBatch();
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="ti ti-coin" aria-hidden /> Run stipend batch
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(28,25,23,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
          onClick={() => !pending && setOpen(false)}
        >
          <div className="card detail-section" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="card-title" style={{ marginBottom: 10 }}>
              Confirm stipend batch
            </div>
            <div className="kv-row"><span>Learners</span><span className="tabular">{preview.total_learners}</span></div>
            <div className="kv-row"><span>Verified days</span><span className="tabular">{preview.total_days}</span></div>
            <div className="kv-row"><span>Total amount</span><span className="tabular">{formatRand(preview.total_amount_rand)}</span></div>
            {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={confirm} disabled={pending}>
                {pending ? "Generating…" : "Confirm and generate"}
              </button>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
