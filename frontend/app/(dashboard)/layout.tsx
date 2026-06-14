import { redirect } from "next/navigation";

import SideNav from "@/components/SideNav";
import SiteRail from "@/components/SiteRail";
import { api } from "@/lib/api";
import type { SiteHeadcount, User } from "@/lib/types";

// Auth guard + app shell (spec §3.4, §9.1). Middleware already blocks
// unauthenticated access; here we resolve the user for the chrome.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: User;
  try {
    user = await api.auth.me();
  } catch {
    redirect("/login");
  }

  // The site rail is hidden for learners (no site-level visibility, spec §3.4).
  let sites: SiteHeadcount[] = [];
  if (user.role !== "learner") {
    try {
      sites = await api.dashboard.sites();
    } catch {
      sites = [];
    }
  }

  return (
    <div className="app-shell">
      <SideNav user={user} />
      <div className="main-area">
        {user.role !== "learner" && <SiteRail initial={sites} />}
        {children}
      </div>
    </div>
  );
}
