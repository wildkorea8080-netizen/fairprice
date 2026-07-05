import { categories, formatPrice, type Product } from "@/data/catalog";

type ProductFormProps = {
  action: (formData: FormData) => Promise<void>;
  product?: Product;
  submitLabel: string;
};

export function ProductForm({ action, product, submitLabel }: ProductFormProps) {
  return (
    <form action={action} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <input name="slug" type="hidden" value={product?.slug ?? ""} />

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">상품명</span>
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.title}
            name="title"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">브랜드</span>
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.brand}
            name="brand"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">카테고리</span>
          <select
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.category.slug ?? categories[0]?.slug}
            name="category"
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">파트너스 링크</span>
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.partnerUrl}
            name="partnerUrl"
            type="url"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">정가</span>
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.originalPrice}
            min="0"
            name="originalPrice"
            type="number"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-700">현재가</span>
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            defaultValue={product?.price}
            min="0"
            name="price"
            type="number"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-bold text-slate-700">상품 설명</span>
        <textarea
          className="min-h-28 rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          defaultValue={product?.description}
          name="description"
        />
      </label>

      {product ? (
        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          현재 표시 가격: <strong>{formatPrice(product.price)}</strong>, 할인율{" "}
          <strong>{product.discountRate}%</strong>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
