import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "관리자",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
