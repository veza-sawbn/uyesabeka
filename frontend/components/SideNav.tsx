"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/(dashboard)/actions";
import { canSee, initials } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import type { User } from "@/lib/types";

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ key: "dashboard", href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" }],
  },
  {
    label: "Manage",
    items: [
      { key: "learners", href: "/learners", label: "Learners", icon: "users" },
      { key: "attendance", href: "/attendance", label: "Attendance", icon: "clock" },
      { key: "stipends", href: "/stipends", label: "Stipends", icon: "coin" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { key: "programmes", href: "/programmes", label: "Programmes", icon: "book" },
      { key: "sites", href: "/sites", label: "Sites", icon: "building" },
      { key: "providers", href: "/providers", label: "Providers", icon: "building-community" },
    ],
  },
  {
    label: "Admin",
    items: [{ key: "admin", href: "/admin", label: "Users", icon: "shield-lock" }],
  },
];

// Top-level items shown in the mobile bottom tab bar (spec §9.3). Anything
// else remains reachable via "More", which opens the full sidebar.
const TAB_BAR_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Home", icon: "layout-dashboard" },
  { key: "learners", href: "/learners", label: "Learners", icon: "users" },
  { key: "attendance", href: "/attendance", label: "Attendance", icon: "clock" },
  { key: "stipends", href: "/stipends", label: "Stipends", icon: "coin" },
];

export default function SideNav({ user }: { user: User }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Toggle navigation"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-2 z-50 hidden h-8 w-8 items-center justify-center rounded-md bg-[var(--charcoal)] text-white max-md:flex"
      >
        <i className="ti ti-menu-2" />
      </button>

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-title">TASAP</div>
          <div className="brand-sub">Programme management</div>
        </div>

        <div className="user-chip">
          <div className="user-avatar">{initials(user.full_name ?? user.username)}</div>
          <div>
            <div className="user-name">{user.full_name ?? user.username}</div>
            <div className="user-role">{roleLabel(user.role)}</div>
          </div>
        </div>

        {GROUPS.map((group) => {
          const visible = group.items.filter((item) => canSee(item.key, user.role));
          if (visible.length === 0) return null;
          return (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {visible.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <i className={`ti ti-${item.icon} nav-icon`} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="sidebar-footer">
          <form action={logoutAction}>
            <button type="submit" className="signout">
              <i className="ti ti-logout" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <nav className="tab-bar" aria-label="Primary">
        {TAB_BAR_ITEMS.filter((item) => canSee(item.key, user.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`tab-item ${active ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`tab-item ${open ? "active" : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          <i className="ti ti-menu-2" aria-hidden />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
