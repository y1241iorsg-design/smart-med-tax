const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SQLite returns is_qualified as 0 or 1 (integer). Both are treated as
// truthy/falsy in JS, so conditional rendering (product.is_qualified ? ...) works.
export type Product = {
  jan_code: string;
  name: string;
  generic_name: string;
  efficacy: string;
  category: string;
  is_qualified: number; // 1 = qualified, 0 = not qualified
  dosage: string;
  side_effects: string;
  precautions: string;
  pdf_url: string;
  price: number;
};

export type Purchase = {
  id: number;
  jan_code: string;
  product_name: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name: string | null;
  purpose: string | null;
  memo: string | null;
  is_qualified: number;
};

export type TaxSummary = {
  year: number;
  total_qualified: number;
  deductible_amount: number;
  raw_deductible_amount: number;
  threshold: number;
  deduction_cap: number;
  is_qualified: boolean;
  cap_applied: boolean;
};

export async function lookupJan(code: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/jan/${code}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "検索に失敗しました");
  }
  return res.json();
}

export async function addPurchase(data: {
  jan_code: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name?: string;
  purpose?: string;
  memo?: string;
}): Promise<Purchase> {
  const res = await fetch(`${API_BASE}/api/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "追加に失敗しました");
  }
  return res.json();
}

export async function getPurchases(year: number): Promise<Purchase[]> {
  const res = await fetch(`${API_BASE}/api/purchases?year=${year}`);
  if (!res.ok) throw new Error("購入履歴の取得に失敗しました");
  return res.json();
}

export async function getTaxSummary(year: number): Promise<TaxSummary> {
  const res = await fetch(`${API_BASE}/api/tax/summary?year=${year}`);
  if (!res.ok) throw new Error("税制サマリの取得に失敗しました");
  return res.json();
}

export function getTaxExportUrl(year: number, format: "csv" | "xml"): string {
  return `${API_BASE}/api/tax/export?year=${year}&fmt=${format}`;
}

export type InventoryItem = {
  jan_code: string;
  product_name: string;
  category: string;
  remaining_doses: number;
  last_purchased_at: string;
  is_low_stock: boolean;
};

export async function getInventory(): Promise<InventoryItem[]> {
  const res = await fetch(`${API_BASE}/api/inventory`);
  if (!res.ok) throw new Error("在庫情報の取得に失敗しました");
  return res.json();
}

export async function uploadReceipt(): Promise<{ imported: number; date: string; store: string }> {
  const res = await fetch(`${API_BASE}/api/receipt/upload`, { method: "POST" });
  if (!res.ok) throw new Error("レシート取込に失敗しました");
  return res.json();
}

// --- 4.1 AIチャット相談 ---

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatApiResponse = {
  reply: string;
  escalate: boolean;
  ready_for_search: boolean;
  extracted_symptoms: string[];
};

export async function sendChatTurn(history: ChatTurn[]): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  if (!res.ok) throw new Error("チャットの送信に失敗しました");
  return res.json();
}

// --- 4.2 OTC医薬品レコメンド / 4.3 購入支援 ---

export type ProductSearchResult = Product & { overlap_warning: boolean };

export async function searchProducts(
  symptoms: string[],
  filters: string[] = [],
  currentMeds: string[] = []
): Promise<ProductSearchResult[]> {
  const res = await fetch(`${API_BASE}/api/products/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms, filters, current_meds: currentMeds }),
  });
  if (!res.ok) throw new Error("商品検索に失敗しました");
  return res.json();
}

export type VendorListing = {
  store_name: string;
  price: number;
  in_stock: boolean;
  url: string;
};

export async function getProductVendors(janCode: string): Promise<VendorListing[]> {
  const res = await fetch(`${API_BASE}/api/products/${janCode}/vendors`);
  if (!res.ok) throw new Error("購入先情報の取得に失敗しました");
  return res.json();
}

// --- 4.7 薬局検索 ---

export type Pharmacy = {
  name: string;
  address: string;
  phone: string | null;
  lat: number;
  lon: number;
  opening_hours: string | null;
  distance_m: number;
};

export async function getNearbyPharmacies(lat: number, lon: number): Promise<Pharmacy[]> {
  const res = await fetch(`${API_BASE}/api/pharmacies/nearby?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("薬局情報の取得に失敗しました");
  return res.json();
}

// --- 4.4 飲み合わせチェック ---

export type InteractionCheckResult = {
  overlaps: { ingredient: string; product_names: string[] }[];
  precaution_notes: { product_name: string; generic_name: string; precautions: string }[];
  disclaimer: string;
};

export async function checkInteractions(janCodes: string[]): Promise<InteractionCheckResult> {
  const res = await fetch(`${API_BASE}/api/interactions/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jan_codes: janCodes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "飲み合わせチェックに失敗しました");
  }
  return res.json();
}
