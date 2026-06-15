import { redirect } from "next/navigation";

import { DataTable, EmptyState, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { canSee, isCrossProviderRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import NewProgrammeForm from "./NewProgrammeForm";

export const dynamic = "force-dynamic";

export default async function ProgrammesPage() {
  const user = await api.auth.me();
  if (!canSee("programmes", user.role)) redirect("/dashboard");
  const canCreate = user.role === "provider_admin" || user.role === "super_admin";
  const crossProvider = isCrossProviderRole(user.role);

  const [programmes, providers] = await Promise.all([
    api.programmes.list(),
    crossProvider && canCreate ? api.providers.list() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Programmes" subtitle={`${programmes.length} total`} />
      <PageContent>
        {canCreate && <NewProgrammeForm providers={providers} showProvider={crossProvider} />}

        {programmes.length === 0 ? (
          <EmptyState message="No programmes yet." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Name</Th>
                <Th>Sector</Th>
                <Th>Start date</Th>
                <Th>End date</Th>
              </>
            }
          >
            {programmes.map((p) => (
              <tr key={p.id}>
                <Td>{p.name}</Td>
                <Td>{p.sector ?? "—"}</Td>
                <Td>{formatDate(p.start_date)}</Td>
                <Td>{formatDate(p.end_date)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </PageContent>
    </>
  );
}
