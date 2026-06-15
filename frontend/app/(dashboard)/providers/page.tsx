import { redirect } from "next/navigation";

import { DataTable, EmptyState, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { canSee } from "@/lib/auth";
import NewProviderForm from "./NewProviderForm";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const user = await api.auth.me();
  if (!canSee("providers", user.role)) redirect("/dashboard");
  const canCreate = user.role === "super_admin";

  const providers = await api.providers.list();

  return (
    <>
      <PageHeader title="Providers" subtitle={`${providers.length} total`} />
      <PageContent>
        {canCreate && <NewProviderForm />}

        {providers.length === 0 ? (
          <EmptyState message="No providers yet." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Name</Th>
                <Th>Registration number</Th>
                <Th>Contact email</Th>
              </>
            }
          >
            {providers.map((p) => (
              <tr key={p.id}>
                <Td>{p.name}</Td>
                <Td>{p.registration_number ?? "—"}</Td>
                <Td>{p.contact_email ?? "—"}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </PageContent>
    </>
  );
}
