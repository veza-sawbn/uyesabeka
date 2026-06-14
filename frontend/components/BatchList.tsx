"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmStipendBatch, downloadBatchCsv, payStipendBatch } from "@/app/(dashboard)/actions";
import { Badge } from "@/components/ui";
import { formatDate, formatRand } from "@/lib/format";
import type { StipendBatch } from "@/lib/types";

function triggerDownload(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BatchList({ batches, canManage }: { batches: StipendBatch[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (batches.length === 0) {
    return <div className="empty">No stipend batches yet. Run one to generate a payment file.</div>;
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed");
      else router.refresh();
    });
  }

  async function download(batch: StipendBatch) {
    setError(null);
    const res = await downloadBatchCsv(batch.id);
    if (!res.ok) setError(res.error);
    else triggerDownload(`stipend_batch_${batch.id}_${batch.period_start}.csv`, res.data);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <div className="error-box">{error}</div>}
      {batches.map((b) => (
        <div className="card detail-section" key={b.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="card-title">
                {formatDate(b.period_start)} – {formatDate(b.period_end)}
              </div>
              <div className="lc-id">
                {b.total_learners} learners · {b.total_days} days · {formatRand(b.total_amount_rand)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge status={b.status} />
              <button className="btn btn-ghost" onClick={() => download(b)}>
                <i className="ti ti-download" aria-hidden /> CSV
              </button>
              {canManage && b.status === "draft" && (
                <button className="btn btn-ghost" disabled={pending} onClick={() => act(() => confirmStipendBatch(b.id))}>
                  Confirm
                </button>
              )}
              {canManage && b.status === "confirmed" && (
                <button className="btn btn-primary" disabled={pending} onClick={() => act(() => payStipendBatch(b.id))}>
                  Mark paid
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
