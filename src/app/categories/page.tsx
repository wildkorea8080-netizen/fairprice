import type { Metadata } from "next";
import Link from "next/link";
import { getAppUrl } from "@/lib/app-config";
import { getPublicCategories } from "@/lib/public-categories";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${appUrl}/categories`,
  },
  description:
    "디지털, 생활용품, 식품 등 카테고리별 쿠팡 할인 상품과 가격 추적 특가를 확인하세요.",
  openGraph: {
    description:
      "페어프라이스에서 카테고리별 쿠팡 특가 상품과 가격 추적 정보를 확인하세요.",
    locale: "ko_KR",
    siteName: "페어프라이스",
    title: "카테고리별 쿠팡 특가",
    type: "website",
    url: `${appUrl}/categories`,
  },
  title: "카테고리별 쿠팡 특가",
};

export default async function CategoriesPage() {
  const categories = await getPublicCategories();

  return (
    <main className="flex-1 bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Categories
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">카테고리</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            수집한 쿠팡 상품을 카테고리별로 확인하고, 관심 카테고리의 특가를
            빠르게 탐색할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
        {categories.map((category) => (
          <Link
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            href={`/categories/${category.slug}`}
            key={category.slug}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{category.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {category.description}
                </p>
              </div>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-700">
                {category.productCount}개
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
