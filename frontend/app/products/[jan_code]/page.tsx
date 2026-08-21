// 静的エクスポート(GitHub Pages向けモック)では動的ルートを全件事前生成する必要があるため、
// このファイルはサーバーコンポーネントのままにし、実際のUIは ProductDetailClient に分離する。
import { MOCK_PRODUCTS } from "@/lib/mock/seedData";
import ProductDetailClient from "./ProductDetailClient";

export function generateStaticParams() {
  return MOCK_PRODUCTS.map((p) => ({ jan_code: p.jan_code }));
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
