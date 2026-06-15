"use client";

import { useState, useTransition } from "react";

import { deleteUser } from "@/app/(dashboard)/actions";

export default function DeleteUserButton({ id, username }: { id: number; username: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteUser(id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button type="button" className="btn btn-ghost" onClick={onClick} disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="login-hint" style={{ color: "var(--red)" }}>{error}</span>}
    </div>
  );
}
