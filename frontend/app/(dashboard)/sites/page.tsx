import { redirect } from "next/navigation";

import { DataTable, EmptyState, PageContent, PageHeader, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { canSee, isCrossProviderRole } from "@/lib/auth";
import NewSiteForm from "./NewSiteForm";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const user = await api.auth.me();
  if (!canSee("sites", user.role)) redirect("/dashboard");
  const canCreate = user.role === "provider_admin" || user.role === "super_admin";
  const crossProvider = isCrossProviderRole(user.role);

  const [sites, providers] = await Promise.all([
    api.sites.list(),
    crossProvider && canCreate ? api.providers.list() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Sites" subtitle={`${sites.length} total`} />
      <PageContent>
        {canCreate && <NewSiteForm providers={providers} showProvider={crossProvider} />}

        {sites.length === 0 ? (
          <EmptyState message="No sites yet." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th align="right">Latitude</Th>
                <Th align="right">Longitude</Th>
                <Th align="right">Geofence radius (m)</Th>
              </>
            }
          >
            {sites.map((s) => (
              <tr key={s.id}>
                <Td>{s.name}</Td>
                <Td>{s.address ?? "—"}</Td>
                <Td align="right"><span className="tabular">{s.latitude}</span></Td>
                <Td align="right"><span className="tabular">{s.longitude}</span></Td>
                <Td align="right">{s.geofence_radius_meters}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </PageContent>
    </>
  );
}
