"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { ensureDatabaseUser } from "@/lib/users";

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();

  redirect(`/admin/products?status=created&title=${encodeURIComponent(title)}`);
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();

  redirect(`/admin/products?status=updated&slug=${encodeURIComponent(slug)}`);
}

export async function hideProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isActive: false },
    where: { slug },
  });

  redirect(`/admin/products?status=hidden&slug=${encodeURIComponent(slug)}`);
}

export async function restoreProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isActive: true },
    where: { slug },
  });

  redirect(
    `/admin/products?status=restored&view=hidden&slug=${encodeURIComponent(slug)}`,
  );
}

export async function toggleFeaturedProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();
  const nextFeatured = String(formData.get("nextFeatured")) === "true";

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isFeatured: nextFeatured },
    where: { slug },
  });

  redirect(
    `/admin/products?status=${nextFeatured ? "featured" : "unfeatured"}&slug=${encodeURIComponent(slug)}`,
  );
}

export async function addProductNote(formData: FormData) {
  const admin = await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  if (!note) {
    redirect("/admin/products?status=note-required");
  }

  const [adminUser, product] = await Promise.all([
    ensureDatabaseUser(admin),
    prisma.product.findUnique({
      select: { id: true },
      where: { slug },
    }),
  ]);

  if (!adminUser || !product) {
    redirect("/admin/products?status=note-failed");
  }

  await prisma.adminProductNote.create({
    data: {
      adminUserId: adminUser.id,
      note,
      productId: product.id,
    },
  });

  redirect(`/admin/products?status=note-saved&slug=${encodeURIComponent(slug)}`);
}

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();

  redirect(`/admin/categories?status=saved&slug=${encodeURIComponent(slug)}`);
}
