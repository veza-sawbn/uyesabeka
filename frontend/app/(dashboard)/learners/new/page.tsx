import { redirect } from "next/navigation";

import { PageContent, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import NewLearnerForm from "./NewLearnerForm";

export const dynamic = "force-dynamic";

export default async function NewLearnerPage() {
  const user = await api.auth.me();
  if (user.role !== "provider_admin" && user.role !== "super_admin") {
    redirect("/learners");
  }

  const [sites, programmes] = await Promise.all([api.sites.list(), api.programmes.list()]);

  return (
    <>
      <PageHeader title="Add learner" subtitle="Create a new learner profile" />
      <PageContent>
        <NewLearnerForm sites={sites} programmes={programmes} />
      </PageContent>
    </>
  );
}
