import { notFound, redirect } from "next/navigation";

import { Btn, PageContent, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { LearnerDetail } from "@/lib/types";
import EditLearnerForm from "./EditLearnerForm";

export const dynamic = "force-dynamic";

export default async function EditLearnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const learnerId = Number(id);

  const user = await api.auth.me();
  if (user.role !== "provider_admin" && user.role !== "super_admin") {
    redirect(`/learners/${learnerId}`);
  }

  let learner: LearnerDetail;
  try {
    learner = await api.learners.get(learnerId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [sites, programmes] = await Promise.all([api.sites.list(), api.programmes.list()]);

  return (
    <>
      <PageHeader
        title={`Edit ${learner.full_name}`}
        actions={<Btn href={`/learners/${learnerId}`} icon="arrow-left">Back to profile</Btn>}
      />
      <PageContent>
        <EditLearnerForm learner={learner} sites={sites} programmes={programmes} />
      </PageContent>
    </>
  );
}
