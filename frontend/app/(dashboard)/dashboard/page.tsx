import HeatmapCalendar from "@/components/HeatmapCalendar";
import LearnerRegister from "@/components/LearnerRegister";
import { Btn, PageContent, PageHeader, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { formatLongDate, formatRand } from "@/lib/format";
import type { Attendance, RegisterItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOT: Record<string, string> = {
  critical: "dot-critical",
  warning: "dot-warning",
  info: "dot-info",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const sp = await searchParams;
  const user = await api.auth.me();
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [stats, alerts, heatmap, sites] = await Promise.all([
    api.dashboard.stats(),
    api.dashboard.alerts(),
    api.dashboard.heatmap(year, month),
    api.sites.list(),
  ]);

  // Resolve the register's site: explicit ?site, else the user's primary, else first.
  const selectedSiteId = sp.site ? Number(sp.site) : (user.site_id ?? sites[0]?.id ?? null);
  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;

  let register: RegisterItem[] = [];
  if (selectedSite) {
    const [learners, attendance] = await Promise.all([
      api.learners.list({ site_id: selectedSite.id, status: "active", page_size: 100 }),
      api.attendance.list({
        site_id: selectedSite.id,
        date_from: todayISO,
        date_to: todayISO,
        page_size: 200,
      }),
    ]);
    const byLearner = new Map<number, Attendance>();
    for (const a of attendance.items) byLearner.set(a.learner_id, a);
    register = learners.items.map((l) => {
      const att = byLearner.get(l.id);
      return {
        learner_id: l.id,
        name: l.full_name,
        id_number: l.id_number,
        checked_in: Boolean(att),
        check_in_time: att?.check_in_time ?? null,
        geofence: att?.geofence_result ?? null,
        verification: att?.verification_status ?? null,
        site_latitude: selectedSite.latitude,
        site_longitude: selectedSite.longitude,
      };
    });
  }

  const attendanceRate = stats.total_learners
    ? Math.round((stats.checked_in_today / stats.total_learners) * 100)
    : 0;
  const pendingRate = stats.total_learners
    ? Math.round((stats.pending_verification / stats.total_learners) * 100)
    : 0;

  const showSiteSelector = sites.length > 1 && user.role !== "mentor" && user.role !== "learner";

  // Only these roles can call POST /attendance/check-in (app/routers/attendance.py).
  const canCheckIn =
    register.length > 0 &&
    (user.role === "mentor" || user.role === "provider_admin" || user.role === "super_admin" || user.role === "learner");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={formatLongDate(today)}
        actions={
          canCheckIn && (
            <Btn href="#today-register" variant="primary" icon="clock-check">
              Record attendance
            </Btn>
          )
        }
      />
      <PageContent>
        {/* Row 1: 3 stat cards + alert card */}
        <div className="stat-grid">
          <StatCard
            label="Total learners"
            value={stats.total_learners}
            sub="Active enrolments"
            progress={{ pct: 100, color: "amber" }}
          />
          <StatCard
            label="Checked in today"
            value={stats.checked_in_today}
            sub={`${attendanceRate}% attendance rate`}
            progress={{ pct: attendanceRate, color: "forest" }}
          />
          <StatCard
            label="Pending verification"
            value={stats.pending_verification}
            sub={`${formatRand(stats.stipend_arrears_rand)} stipend due`}
            progress={{ pct: pendingRate, color: "amber" }}
          />

          <div className="alert-card">
            <div className="alert-head">
              {alerts.length} {alerts.length === 1 ? "flag needs" : "flags need"} attention
            </div>
            {alerts.slice(0, 5).map((a, i) => (
              <div className="alert-row" key={i}>
                <span className={`alert-dot ${DOT[a.severity] ?? "dot-info"}`} />
                <span>{a.message}</span>
              </div>
            ))}
            {alerts.length === 0 && <div className="alert-row"><span>All clear — no flags.</span></div>}
            <a className="alert-link" href="/attendance?verification_status=pending">
              View all →
            </a>
          </div>
        </div>

        {showSiteSelector && selectedSite && (
          <form method="get" style={{ margin: "14px 0 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="stat-label">Register site</span>
            <select className="select" name="site" defaultValue={String(selectedSite.id)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" type="submit">
              Show
            </button>
          </form>
        )}

        {/* Row 2: heatmap (flex) + learner register (340px) */}
        <div
          className="page-grid dashboard-row2"
          style={{ gridTemplateColumns: "1fr 340px", marginTop: 14, alignItems: "start" }}
        >
          <HeatmapCalendar initialDays={heatmap} year={year} month={month} />
          <LearnerRegister items={register} />
        </div>
      </PageContent>
    </>
  );
}
