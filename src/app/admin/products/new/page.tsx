import { createProduct } from "@/app/admin/actions";
import { ProductForm } from "@/components/admin/product-form";

export default function NewAdminProductPage() {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold">새 상품 등록</h2>
        <p className="mt-1 text-sm text-slate-500">
          쿠팡 원본 링크와 파트너스 링크를 함께 입력하는 등록 폼입니다.
        </p>
      </div>

      <ProductForm action={createProduct} submitLabel="상품 등록" />
    </div>
  );
}
