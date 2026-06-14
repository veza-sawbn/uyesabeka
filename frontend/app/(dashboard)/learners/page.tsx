import { Badge, Btn, DataTable, EmptyState, Pagination, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { formatRand } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = {
  page?: string;
  search?: string;
  status?: string;
  site_id?: string;
};

export default async function LearnersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const user = await api.auth.me();

  const [data, sites] = await Promise.all([
    api.learners.list({
      page,
      page_size: 25,
      search: sp.search,
      status: sp.status,
      site_id: sp.site_id,
    }),
    user.role === "mentor" ? Promise.resolve([]) : api.sites.list(),
  ]);

  const canFilterSite = sites.length > 0;
  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    if (sp.search) qs.set("search", sp.search);
    if (sp.status) qs.set("status", sp.status);
    if (sp.site_id) qs.set("site_id", sp.site_id);
    qs.set("page", String(p));
    return `/learners?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Learners"
        subtitle={`${data.total} total`}
        actions={
          (user.role === "provider_admin" || user.role === "super_admin") && (
            <Btn href="/learners/new" variant="primary" icon="user-plus">
              Add learner
            </Btn>
          )
        }
      />
      <PageContent>
        <form className="filter-row" method="get">
          <input className="search-input" name="search" placeholder="Search name or ID number…" defaultValue={sp.search} />
          <select className="select" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          {canFilterSite && (
            <select className="select" name="site_id" defaultValue={sp.site_id ?? ""}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost" type="submit">
            <i className="ti ti-filter" aria-hidden /> Filter
          </button>
        </form>

        {data.items.length === 0 ? (
          <EmptyState message="No learners match your filters." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Full name</Th>
                <Th>SA ID number</Th>
                <Th>Site</Th>
                <Th>Status</Th>
                <Th align="right">Stipend / day</Th>
                <Th>Bank details</Th>
                <Th></Th>
              </>
            }
          >
            {data.items.map((l) => (
              <tr key={l.id}>
                <Td>{l.full_name}</Td>
                <Td>
                  <span className="tabular">{l.id_number}</span>
                </Td>
                <Td>{l.site_name ?? "—"}</Td>
                <Td>
                  <Badge status={l.status} />
                </Td>
                <Td align="right">{formatRand(l.stipend_rate_per_day)}</Td>
                <Td>
                  <Badge status={l.bank_details_status} />
                </Td>
                <Td>
                  <a className="row-link" href={`/learners/${l.id}`}>
                    View →
                  </a>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}

        <Pagination page={data.page} pages={data.pages} hrefFor={hrefFor} />
      </PageContent>
    </>
  );
}
