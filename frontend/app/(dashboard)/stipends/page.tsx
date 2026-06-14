import BatchList from "@/components/BatchList";
import StipendActions from "@/components/StipendActions";
import { Badge, DataTable, EmptyState, PageContent, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { formatRand } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StipendsPage() {
  const user = await api.auth.me();
  const canManage =
    user.role === "provider_payroll" || user.role === "provider_admin" || user.role === "super_admin";

  const [summary, preview, batches] = await Promise.all([
    api.stipends.summary(),
    api.stipends.preview(),
    api.stipends.list(),
  ]);

  const monthLabel = new Date(summary.period_start).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title="Stipends"
        subtitle={monthLabel}
        actions={
          <StipendActions
            canManage={canManage}
            preview={{
              total_learners: preview.total_learners,
              total_days: preview.total_days,
              total_amount_rand: preview.total_amount_rand,
            }}
          />
        }
      />
      <PageContent>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <StatCard label="Learners" value={summary.total_learners} sub="With verified days" />
          <StatCard label="Verified days" value={summary.total_verified_days} sub={monthLabel} />
          <StatCard label="Amount due" value={formatRand(summary.total_amount_rand)} sub="This period" />
          <StatCard
            label="Batch status"
            value={summary.current_batch_status ?? "None"}
            sub="Current period"
          />
        </div>

        <h3 className="card-title" style={{ margin: "20px 0 10px" }}>
          Projected payments — {monthLabel}
        </h3>
        {preview.lines.length === 0 ? (
          <EmptyState message="No verified attendance days in this period yet." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Learner</Th>
                <Th align="right">Verified days</Th>
                <Th align="right">Daily rate</Th>
                <Th align="right">Total due</Th>
                <Th>Status</Th>
              </>
            }
          >
            {preview.lines.map((l) => (
              <tr key={l.learner_id}>
                <Td>{l.learner_name}</Td>
                <Td align="right">{l.verified_days}</Td>
                <Td align="right">{formatRand(l.daily_rate)}</Td>
                <Td align="right">{formatRand(l.total_amount)}</Td>
                <Td>
                  <Badge status="draft" label="Projected" />
                </Td>
              </tr>
            ))}
          </DataTable>
        )}

        <h3 className="card-title" style={{ margin: "24px 0 10px" }}>
          Batch history
        </h3>
        <BatchList batches={batches} canManage={canManage} />
      </PageContent>
    </>
  );
}
