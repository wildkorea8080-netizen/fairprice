import { notFound } from "next/navigation";
import { updateProduct } from "@/app/admin/actions";
import { ProductForm } from "@/components/admin/product-form";
import { getProductBySlug, products } from "@/data/catalog";

type EditAdminProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export default async function EditAdminProductPage({ params }: EditAdminProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold">상품 수정</h2>
        <p className="mt-1 text-sm text-slate-500">
          샘플 상품 데이터를 기준으로 수정 폼을 미리 구성했습니다.
        </p>
      </div>

      <ProductForm action={updateProduct} product={product} submitLabel="수정 저장" />
    </div>
  );
}
