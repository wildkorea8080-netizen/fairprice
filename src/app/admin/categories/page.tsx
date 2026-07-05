import { saveCategory } from "@/app/admin/actions";
import { StatusNotice } from "@/components/admin/status-notice";
import { categories, getProductsByCategory } from "@/data/catalog";

type AdminCategoriesPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const { status } = await searchParams;

  return (
    <div>
      <StatusNotice status={status} />

      <div className="mb-5">
        <h2 className="text-2xl font-bold">카테고리 관리</h2>
        <p className="mt-1 text-sm text-slate-500">
          상품 분류, 노출명, 설명을 관리하기 위한 기본 화면입니다.
        </p>
      </div>

      <div className="grid gap-4">
        {categories.map((category) => {
          const productCount = getProductsByCategory(category.slug).length;

          return (
            <form
              key={category.slug}
              action={saveCategory}
              className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[0.8fr_1fr_auto] lg:items-end"
            >
              <input name="slug" type="hidden" value={category.slug} />

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">카테고리명</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={category.name}
                  name="name"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">설명</span>
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={category.description}
                  name="description"
                />
              </label>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                  상품 {productCount}개
                </span>
                <button
                  className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                  type="submit"
                >
                  저장
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
