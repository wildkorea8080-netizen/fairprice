import Link from "next/link";
import type { PublicCategory } from "@/lib/public-categories";

const discountFilters = [
  { label: "전체", value: null },
  { label: "10%+", value: 10 },
  { label: "20%+", value: 20 },
  { label: "30%+", value: 30 },
  { label: "50%+", value: 50 },
];

type DealFiltersProps = {
  activeCategory?: string;
  activeDiscount?: number;
  activeQuery?: string;
  categories?: PublicCategory[];
};

function getDealFilterHref(discount: number | null, query?: string) {
  const searchParams = new URLSearchParams();

  if (discount) {
    searchParams.set("discount", String(discount));
  }

  if (query?.trim()) {
    searchParams.set("q", query.trim());
  }

  const search = searchParams.toString();

  return search ? `/deals?${search}` : "/deals";
}

export function DealFilters({
  activeCategory,
  activeDiscount,
  activeQuery,
  categories = [],
}: DealFiltersProps) {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              할인율
            </p>
            <div className="flex flex-wrap gap-2">
              {discountFilters.map((filter) => {
                const isActive = filter.value === (activeDiscount ?? null);

                return (
                  <Link
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    href={getDealFilterHref(filter.value, activeQuery)}
                    key={filter.label}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
              카테고리
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  activeCategory
                    ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    : "border-slate-950 bg-slate-950 text-white"
                }`}
                href={getDealFilterHref(activeDiscount ?? null, activeQuery)}
              >
                전체
              </Link>
              {categories.map((category) => (
                <Link
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    activeCategory === category.slug
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  href={`/categories/${category.slug}`}
                  key={category.slug}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <form action="/deals" className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-semibold uppercase text-slate-500">
            검색
          </span>
          {activeDiscount ? (
            <input name="discount" type="hidden" value={activeDiscount} />
          ) : null}
          <div className="flex gap-2">
            <input
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 lg:w-72"
              defaultValue={activeQuery}
              name="q"
              placeholder="상품명 또는 키워드"
              type="search"
            />
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              type="submit"
            >
              검색
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
