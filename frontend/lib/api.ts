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
};

export type Purchase = {
  id: number;
  jan_code: string;
  product_name: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name: string | null;
  is_qualified: number; // 1 = qualified, 0 = not qualified
};

export type TaxSummary = {
  year: number;
  total_qualified: number;
  deductible_amount: number;
  threshold: number;
  is_qualified: boolean;
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

export type ChatResponse = {
  reply: string;
  escalation_level: "ai" | "registered_seller" | "pharmacist";
  responder_name: string;
  responder_title: string;
};

export type InventoryItem = {
  jan_code: string;
  product_name: string;
  category: string;
  remaining_doses: number;
  last_purchased_at: string;
  is_low_stock: boolean;
};

export async function sendChat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("チャットの送信に失敗しました");
  return res.json();
}

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

export type SymptomRecommendation = {
  reply: string;
  past_purchases_used: string[];
};

export async function getRecommendation(
  symptoms: string[],
  filters: string[]
): Promise<SymptomRecommendation> {
  const res = await fetch(`${API_BASE}/api/symptom/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptoms, filters }),
  });
  if (!res.ok) throw new Error("おすすめ薬の取得に失敗しました");
  return res.json();
}
