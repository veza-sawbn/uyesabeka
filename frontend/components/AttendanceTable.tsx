"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { verifyAttendance } from "@/app/(dashboard)/actions";
import { Badge, DataTable, Td, Th } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import type { Attendance } from "@/lib/types";

export default function AttendanceTable({
  items,
  canVerify,
}: {
  items: Attendance[];
  canVerify: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectable = items.filter((i) => i.verification_status === "pending").map((i) => i.id);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id));

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable));
  }

  function run(ids: number[], status: "verified" | "rejected") {
    if (ids.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await verifyAttendance(ids, status);
      if (!res.ok) setError(res.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <>
      {canVerify && selected.size > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--amber-bg)",
            border: "0.5px solid var(--amber-light)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--amber-text)" }}>
            {selected.size} selected
          </span>
          <button className="btn btn-primary" disabled={pending} onClick={() => run([...selected], "verified")}>
            <i className="ti ti-check" aria-hidden /> Verify selected
          </button>
          <button className="btn btn-ghost" disabled={pending} onClick={() => run([...selected], "rejected")}>
            <i className="ti ti-x" aria-hidden /> Reject
          </button>
          {error && <span style={{ fontSize: 11, color: "var(--red)" }}>{error}</span>}
        </div>
      )}

      <DataTable
        head={
          <>
            {canVerify && (
              <Th>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </Th>
            )}
            <Th>Learner</Th>
            <Th>SA ID</Th>
            <Th>Site</Th>
            <Th>Date</Th>
            <Th>In</Th>
            <Th>Out</Th>
            <Th align="right">Hours</Th>
            <Th>Geofence</Th>
            <Th>Status</Th>
            <Th>Sign.</Th>
            {canVerify && <Th></Th>}
          </>
        }
      >
        {items.map((r) => (
          <tr key={r.id}>
            {canVerify && (
              <Td>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  disabled={r.verification_status !== "pending"}
                  onChange={() => toggle(r.id)}
                  aria-label={`Select record ${r.id}`}
                />
              </Td>
            )}
            <Td>{r.learner_name ?? `#${r.learner_id}`}</Td>
            <Td><span className="tabular">{r.learner_id_number ?? "—"}</span></Td>
            <Td>{r.site_name ?? "—"}</Td>
            <Td>{formatDate(r.attendance_date)}</Td>
            <Td>{formatTime(r.check_in_time)}</Td>
            <Td>{formatTime(r.check_out_time)}</Td>
            <Td align="right">{r.hours ?? "—"}</Td>
            <Td><Badge status={r.geofence_result} /></Td>
            <Td><Badge status={r.verification_status} /></Td>
            <Td>
              {r.signature_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.signature_url} alt="signature" style={{ height: 20, borderRadius: 3 }} />
              ) : (
                "—"
              )}
            </Td>
            {canVerify && (
              <Td>
                {r.verification_status === "pending" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-checkin" disabled={pending} onClick={() => run([r.id], "verified")}>
                      Verify
                    </button>
                    <button className="btn-review" disabled={pending} onClick={() => run([r.id], "rejected")}>
                      Reject
                    </button>
                  </div>
                )}
              </Td>
            )}
          </tr>
        ))}
      </DataTable>
    </>
  );
}
