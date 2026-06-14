// Display formatting helpers. Rand uses comma thousands + dot decimals to
// match the spec's "R xxx,xxx.xx" convention.

export function formatRand(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return "R " + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "verified":
    case "active":
    case "inside":
    case "paid":
      return "badge-green";
    case "pending":
    case "outside":
    case "draft":
      return "badge-amber";
    case "rejected":
    case "suspended":
      return "badge-red";
    default:
      return "badge-neutral";
  }
}
