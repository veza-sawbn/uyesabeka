"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLearnerStatus } from "@/app/(dashboard)/actions";

export default function LearnerStatusControl({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next = status === "active" ? "suspended" : "active";
  const label = status === "active" ? "Suspend" : "Activate";

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await setLearnerStatus(id, next);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="btn btn-ghost" onClick={apply} disabled={pending}>
        <i className={`ti ti-${status === "active" ? "user-off" : "user-check"}`} aria-hidden />
        {pending ? "…" : label}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--red)" }}>{error}</span>}
    </div>
  );
}
