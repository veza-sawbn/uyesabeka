import { notFound } from "next/navigation";

import LearnerStatusControl from "@/components/LearnerStatusControl";
import { Badge, Btn, DataTable, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { initials } from "@/lib/auth";
import { formatDate, formatRand, formatTime } from "@/lib/format";
import type { Attendance, LearnerDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MiniHeatmap({ records }: { records: Attendance[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const present = new Set(records.map((r) => r.attendance_date));
  const todayISO = today.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(<div className="heat-cell heat-empty" key={`b${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    let cls = "heat-empty";
    if (present.has(iso)) cls = "heat-full";
    else if (weekend) cls = "heat-weekend";
    else if (iso <= todayISO) cls = "heat-low";
    cells.push(
      <div className={`heat-cell ${cls} ${iso === todayISO ? "heat-today" : ""}`} key={d} title={iso}>
        {d}
      </div>,
    );
  }
  return (
    <>
      <div className="heat-head-row" style={{ marginBottom: 4 }}>
        {DOW.map((d) => (
          <div className="heat-head" key={d}>{d}</div>
        ))}
      </div>
      <div className="heat-grid">{cells}</div>
    </>
  );
}

export default async function LearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const learnerId = Number(id);

  let learner: LearnerDetail;
  try {
    learner = await api.learners.get(learnerId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const user = await api.auth.me();
  const canManage = user.role === "provider_admin" || user.role === "super_admin";

  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [recent, monthRecords] = await Promise.all([
    api.attendance.list({ learner_id: learnerId, page_size: 10 }),
    api.attendance.list({ learner_id: learnerId, date_from: monthStart, date_to: monthEnd, page_size: 100 }),
  ]);

  const bank = learner.bank_details;

  return (
    <>
      <PageHeader
        title={learner.full_name}
        subtitle={`${learner.site_name ?? "No site"} · ${learner.programme_name ?? "No programme"}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {canManage && <Btn href={`/learners/${learner.id}/edit`} icon="edit">Edit profile</Btn>}
            <Btn href="/learners" icon="arrow-left">Back to learners</Btn>
          </div>
        }
      />
      <PageContent>
        <div className="detail-grid">
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card detail-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="lc-avatar" style={{ width: 48, height: 48, borderRadius: 10, fontSize: 15 }}>
                    {initials(learner.full_name)}
                  </div>
                  <div>
                    <div className="card-title">{learner.full_name}</div>
                    <div className="lc-id tabular">{learner.id_number}</div>
                    <div style={{ marginTop: 4 }}>
                      <Badge status={learner.status} />
                    </div>
                  </div>
                </div>
                {canManage && <LearnerStatusControl id={learner.id} status={learner.status} />}
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="kv-row"><span>Site</span><span>{learner.site_name ?? "—"}</span></div>
                <div className="kv-row"><span>Programme</span><span>{learner.programme_name ?? "—"}</span></div>
                <div className="kv-row"><span>Email</span><span>{learner.email ?? "—"}</span></div>
                <div className="kv-row"><span>Phone</span><span>{learner.phone ?? "—"}</span></div>
                <div className="kv-row"><span>Enrolment date</span><span>{formatDate(learner.enrolment_date)}</span></div>
                <div className="kv-row"><span>Stipend rate</span><span className="tabular">{formatRand(learner.stipend_rate_per_day)} / day</span></div>
              </div>
            </div>

            <div className="card detail-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="card-title">Bank details</div>
                <Badge status={learner.bank_details_status} />
              </div>
              <div className="kv-row"><span>Account holder</span><span>{bank?.account_holder ?? "—"}</span></div>
              <div className="kv-row"><span>Bank</span><span>{bank?.bank_name ?? "—"}</span></div>
              <div className="kv-row"><span>Account number</span><span className="tabular">{bank?.account_number_last4 ? `•••• ${bank.account_number_last4}` : "—"}</span></div>
              <div className="kv-row"><span>Branch code</span><span className="tabular">{bank?.branch_code ?? "—"}</span></div>
              {learner.bank_details_status === "pending" && (
                <p className="login-hint">Bank details are awaiting verification by a provider administrator.</p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card detail-section">
              <div className="card-title" style={{ marginBottom: 12 }}>
                Attendance this month
              </div>
              <MiniHeatmap records={monthRecords.items} />
            </div>

            <div>
              <div className="card-title" style={{ marginBottom: 8 }}>Recent records</div>
              {recent.items.length === 0 ? (
                <div className="empty">No attendance records yet.</div>
              ) : (
                <DataTable
                  head={
                    <>
                      <Th>Date</Th>
                      <Th>In</Th>
                      <Th>Out</Th>
                      <Th align="right">Hours</Th>
                      <Th>Geofence</Th>
                      <Th>Verified</Th>
                      <Th>Stipend</Th>
                    </>
                  }
                >
                  {recent.items.map((r) => (
                    <tr key={r.id}>
                      <Td>{formatDate(r.attendance_date)}</Td>
                      <Td>{formatTime(r.check_in_time)}</Td>
                      <Td>{formatTime(r.check_out_time)}</Td>
                      <Td align="right">{r.hours ?? "—"}</Td>
                      <Td><Badge status={r.geofence_result} /></Td>
                      <Td><Badge status={r.verification_status} /></Td>
                      <Td>{r.verification_status === "verified" ? "Yes" : "No"}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          </div>
        </div>
      </PageContent>
    </>
  );
}
