"use server";

import { redirect } from "next/navigation";
import { unsubscribeAllAlerts } from "@/lib/alert-subscriptions";

export async function unsubscribeAlertsAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const result = await unsubscribeAllAlerts(token);

  if (result.status === "invalid") {
    redirect("/unsubscribe?status=invalid");
  }

  redirect(`/unsubscribe?status=done&count=${result.deactivated}`);
}
