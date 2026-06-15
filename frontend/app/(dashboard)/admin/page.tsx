import { redirect } from "next/navigation";

import { Btn, DataTable, EmptyState, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { canSee } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import DeleteUserButton from "./DeleteUserButton";
import NewUserForm from "./NewUserForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await api.auth.me();
  if (!canSee("admin", me.role)) redirect("/dashboard");

  const [users, providers, sites] = await Promise.all([
    api.users.list(),
    api.providers.list(),
    api.sites.list(),
  ]);

  return (
    <>
      <PageHeader title="Users" subtitle={`${users.length} total`} />
      <PageContent>
        <NewUserForm providers={providers} sites={sites} />

        {users.length === 0 ? (
          <EmptyState message="No users yet." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Username</Th>
                <Th>Full name</Th>
                <Th>Role</Th>
                <Th>Provider</Th>
                <Th>Site</Th>
                <Th></Th>
              </>
            }
          >
            {users.map((u) => {
              const provider = providers.find((p) => p.id === u.provider_id);
              const site = sites.find((s) => s.id === u.site_id);
              return (
                <tr key={u.id}>
                  <Td>{u.username}</Td>
                  <Td>{u.full_name ?? "—"}</Td>
                  <Td>{roleLabel(u.role)}</Td>
                  <Td>{provider?.name ?? "—"}</Td>
                  <Td>{site?.name ?? "—"}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn href={`/admin/${u.id}`}>Edit</Btn>
                      {u.id !== me.id && <DeleteUserButton id={u.id} username={u.username} />}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </PageContent>
    </>
  );
}
