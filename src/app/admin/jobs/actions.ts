"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { requeueFailedCollectionJobs } from "@/lib/collection-jobs";
import { isDatabaseConfigured } from "@/lib/prisma";

export async function retryFailedCollectionJobs() {
  await requireAdmin("/admin/jobs");

  if (!isDatabaseConfigured()) {
    redirect("/admin/jobs?status=database-required");
  }

  const count = await requeueFailedCollectionJobs();

  redirect(`/admin/jobs?status=failed-requeued&count=${count}`);
}
