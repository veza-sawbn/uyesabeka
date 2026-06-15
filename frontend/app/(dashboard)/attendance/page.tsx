import AttendanceTable from "@/components/AttendanceTable";
import { Btn, EmptyState, Pagination, PageContent, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = {
  page?: string;
  learner_id?: string;
  site_id?: string;
  date_from?: string;
  date_to?: string;
  verification_status?: string;
  geofence_result?: string;
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const user = await api.auth.me();
  const canVerify =
    user.role === "provider_verifier" || user.role === "provider_admin" || user.role === "super_admin";

  // Only these roles can call POST /attendance/check-in (app/routers/attendance.py).
  const canCheckIn =
    user.role === "mentor" || user.role === "provider_admin" || user.role === "super_admin" || user.role === "learner";

  const [data, sites] = await Promise.all([
    api.attendance.list({
      page,
      page_size: 25,
      learner_id: sp.learner_id,
      site_id: sp.site_id,
      date_from: sp.date_from,
      date_to: sp.date_to,
      verification_status: sp.verification_status,
      geofence_result: sp.geofence_result,
    }),
    user.role === "mentor" ? Promise.resolve([]) : api.sites.list(),
  ]);

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") qs.set(k, String(v));
    qs.set("page", String(p));
    return `/attendance?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={formatLongDate(new Date())}
        actions={
          canCheckIn && (
            <Btn href="/dashboard#today-register" variant="primary" icon="clock-plus">
              Record check-in
            </Btn>
          )
        }
      />
      <PageContent>
        <form className="filter-row" method="get">
          <input className="search-input" type="date" name="date_from" defaultValue={sp.date_from} aria-label="From date" />
          <input className="search-input" type="date" name="date_to" defaultValue={sp.date_to} aria-label="To date" />
          {sites.length > 0 && (
            <select className="select" name="site_id" defaultValue={sp.site_id ?? ""}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <select className="select" name="verification_status" defaultValue={sp.verification_status ?? ""}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="select" name="geofence_result" defaultValue={sp.geofence_result ?? ""}>
            <option value="">All geofence</option>
            <option value="inside">Inside</option>
            <option value="outside">Outside</option>
          </select>
          <button className="btn btn-ghost" type="submit">
            <i className="ti ti-filter" aria-hidden /> Filter
          </button>
        </form>

        {data.items.length === 0 ? (
          <EmptyState message="No attendance records match your filters." />
        ) : (
          <AttendanceTable items={data.items} canVerify={canVerify} />
        )}

        <Pagination page={data.page} pages={data.pages} hrefFor={hrefFor} />
      </PageContent>
    </>
  );
}
