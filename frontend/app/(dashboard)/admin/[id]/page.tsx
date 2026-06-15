import { notFound, redirect } from "next/navigation";

import { Btn, PageContent, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { canSee } from "@/lib/auth";
import EditUserForm from "./EditUserForm";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);

  const me = await api.auth.me();
  if (!canSee("admin", me.role)) redirect("/dashboard");

  const [users, providers, sites] = await Promise.all([api.users.list(), api.providers.list(), api.sites.list()]);
  const target = users.find((u) => u.id === userId);
  if (!target) notFound();

  return (
    <>
      <PageHeader title={`Edit ${target.username}`} actions={<Btn href="/admin" icon="arrow-left">Back to users</Btn>} />
      <PageContent>
        <EditUserForm user={target} providers={providers} sites={sites} />
      </PageContent>
    </>
  );
}
