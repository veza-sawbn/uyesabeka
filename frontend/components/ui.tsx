// Shared presentational primitives (spec §9.1). Server-component friendly:
// nothing here holds client state. Interactive widgets live in their own
// "use client" components.

import Link from "next/link";
import type { ReactNode } from "react";

import { statusBadgeClass } from "@/lib/format";

/* ---------- Page header (topbar) ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </div>
  );
}

export function PageContent({ children }: { children: ReactNode }) {
  return <div className="content">{children}</div>;
}

/* ---------- Buttons ---------- */
export function Btn({
  children,
  href,
  variant = "ghost",
  icon,
  type = "button",
  formAction,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost";
  icon?: string;
  type?: "button" | "submit";
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const cls = `btn ${variant === "primary" ? "btn-primary" : "btn-ghost"}`;
  const inner = (
    <>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link className={cls} href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} type={type} formAction={formAction}>
      {inner}
    </button>
  );
}

/* ---------- Badge ---------- */
export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{label ?? status}</span>;
}

/* ---------- Stat card (spec §4.4) ---------- */
export function StatCard({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  progress?: { pct: number; color: "amber" | "forest" };
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {progress && (
        <div className="progress">
          <div
            className={`progress-fill ${progress.color === "forest" ? "fill-forest" : "fill-amber"}`}
            style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Tables ---------- */
export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, align }: { children?: ReactNode; align?: "right" }) {
  return <th className={align === "right" ? "num" : undefined}>{children}</th>;
}

export function Td({ children, align }: { children?: ReactNode; align?: "right" }) {
  return <td className={align === "right" ? "num" : undefined}>{children}</td>;
}

/* ---------- Filters ---------- */
export function FilterRow({ children, action }: { children: ReactNode; action?: string }) {
  return (
    <form className="filter-row" action={action} method="get">
      {children}
    </form>
  );
}

export function SearchInput({
  name = "search",
  placeholder = "Search…",
  defaultValue,
}: {
  name?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return <input className="search-input" name={name} placeholder={placeholder} defaultValue={defaultValue} />;
}

export function SelectFilter({
  name,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <select className="select" name={name} defaultValue={defaultValue ?? ""}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty">{message}</div>;
}

/* ---------- Pagination (spec §5.3) ---------- */
export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const windowed: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let p = start; p <= end; p++) windowed.push(p);

  return (
    <div className="pagination">
      <Link className={`page-pill ${page <= 1 ? "disabled" : ""}`} href={hrefFor(Math.max(1, page - 1))}>
        ‹
      </Link>
      {windowed.map((p) => (
        <Link key={p} className={`page-pill ${p === page ? "active" : ""}`} href={hrefFor(p)}>
          {p}
        </Link>
      ))}
      <Link className={`page-pill ${page >= pages ? "disabled" : ""}`} href={hrefFor(Math.min(pages, page + 1))}>
        ›
      </Link>
    </div>
  );
}
