// Same-origin /api/* is proxied to the backend via next.config rewrites.
// Set NEXT_PUBLIC_API_URL only if you need to call the backend directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  category: string;
  price: number;
  quantity: number;
  purchased_at: string;
  store_name: string | null;
  purpose: string | null;
  memo: string | null;
  is_qualified: number;
  family_member_name: string;
  follow_up_status: string;
  follow_up_date: string | null;
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
  by_member?: { name: string; total_qualified: number }[];
};

export async function lookupJan(code: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/jan/${code}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "検索に失敗しました");
  }
  return res.json();
}

export async function findProductsByName(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(
    `${API_BASE}/api/products/find?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error("商品名検索に失敗しました");
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
  family_member_name?: string;
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
  current_meds?: string[];
  awaiting_meds?: boolean;
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

export type ProductSearchResult = Product & {
  overlap_warning: boolean;
  condition_warnings?: string[];
  vendor_min_price?: number | null;
  vendor_max_price?: number | null;
  vendor_count?: number;
  price_note?: string;
};

export async function searchProducts(
  symptoms: string[],
  filters: string[] = [],
  currentMeds: string[] = [],
  conditions: string[] = []
): Promise<ProductSearchResult[]> {
  const res = await fetch(`${API_BASE}/api/products/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symptoms,
      filters,
      current_meds: currentMeds,
      conditions,
    }),
  });
  if (!res.ok) throw new Error("商品検索に失敗しました");
  return res.json();
}

export type VendorListing = {
  store_name: string;
  price: number;
  in_stock: boolean;
  url: string;
  is_lowest?: boolean;
  price_note?: string;
};

export type PriceCompare = {
  jan_code: string;
  product_name: string;
  min_price: number;
  max_price: number;
  vendors: VendorListing[];
  disclaimer: string;
};

export async function getProductVendors(janCode: string): Promise<VendorListing[]> {
  const res = await fetch(`${API_BASE}/api/products/${janCode}/vendors`);
  if (!res.ok) throw new Error("購入先情報の取得に失敗しました");
  return res.json();
}

export async function getPriceCompare(janCode: string): Promise<PriceCompare> {
  const res = await fetch(`${API_BASE}/api/products/${janCode}/price-compare`);
  if (!res.ok) throw new Error("価格比較の取得に失敗しました");
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

export type FamilyMember = {
  id: number;
  name: string;
  relationship: string | null;
  conditions: string[];
  current_medications: string[];
  allergies: string[];
};

export async function getFamily(): Promise<FamilyMember[]> {
  const res = await fetch(`${API_BASE}/api/family`);
  if (!res.ok) throw new Error("家族情報の取得に失敗しました");
  return res.json();
}

export async function getConditionOptions(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/family/condition-options`);
  if (!res.ok) throw new Error("持病リストの取得に失敗しました");
  return res.json();
}

export type RxCatalogItem = {
  code: string;
  name: string;
  generic_name: string;
  category: string;
};

export type Prescription = {
  id: number;
  family_member_name: string;
  rx_code: string;
  name: string;
  generic_name: string;
  category: string;
  started_at: string | null;
  memo: string | null;
};

export async function getRxCatalog(): Promise<RxCatalogItem[]> {
  const res = await fetch(`${API_BASE}/api/prescriptions/catalog`);
  if (!res.ok) throw new Error("処方薬リストの取得に失敗しました");
  return res.json();
}

export async function getPrescriptions(
  familyMemberName?: string
): Promise<Prescription[]> {
  const qs = familyMemberName
    ? `?family_member_name=${encodeURIComponent(familyMemberName)}`
    : "";
  const res = await fetch(`${API_BASE}/api/prescriptions${qs}`);
  if (!res.ok) throw new Error("処方薬登録の取得に失敗しました");
  return res.json();
}

export async function createPrescription(data: {
  family_member_name: string;
  rx_code: string;
  started_at?: string;
  memo?: string;
}): Promise<Prescription> {
  const res = await fetch(`${API_BASE}/api/prescriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "処方薬の登録に失敗しました");
  }
  return res.json();
}

export async function deletePrescription(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/prescriptions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "処方薬の削除に失敗しました");
  }
}

export async function createFamilyMember(
  data: Omit<FamilyMember, "id">
): Promise<FamilyMember> {
  const res = await fetch(`${API_BASE}/api/family`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "家族の追加に失敗しました");
  }
  return res.json();
}

export async function updateFamilyMember(
  id: number,
  data: Omit<FamilyMember, "id">
): Promise<FamilyMember> {
  const res = await fetch(`${API_BASE}/api/family/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "家族の更新に失敗しました");
  }
  return res.json();
}

export async function deleteFamilyMember(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/family/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "家族の削除に失敗しました");
  }
}

export async function updatePurchase(
  id: number,
  data: {
    price: number;
    quantity: number;
    purchased_at: string;
    store_name?: string;
    purpose?: string;
    memo?: string;
    family_member_name: string;
  }
): Promise<Purchase> {
  const res = await fetch(`${API_BASE}/api/purchases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "更新に失敗しました");
  }
  return res.json();
}

export async function deletePurchase(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/purchases/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("削除に失敗しました");
}

export type FollowUpResult = {
  id: number;
  follow_up_status: string;
  follow_up_date: string;
  recommend_medical_visit: boolean;
  message: string;
};

export async function submitFollowUp(
  id: number,
  status: "改善" | "変化なし" | "悪化"
): Promise<FollowUpResult> {
  const res = await fetch(`${API_BASE}/api/purchases/${id}/follow-up`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "経過の更新に失敗しました");
  }
  return res.json();
}

// --- 5.1 OTC コンシェルジュ ---

export type Expert = {
  id: number;
  name: string;
  title: string;
  area: string;
  rating: number;
};

export type ExpertSlot = {
  id: number;
  expert_id: number;
  slot_at: string;
  is_booked: boolean;
};

export type Booking = {
  id: number;
  expert_id: number;
  expert_name: string;
  expert_title: string;
  slot_id: number;
  slot_at: string;
  share_handbook: boolean;
  handbook_snapshot: Record<string, unknown> | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export async function getExperts(): Promise<Expert[]> {
  const res = await fetch(`${API_BASE}/api/concierge/experts`);
  if (!res.ok) throw new Error("専門家一覧の取得に失敗しました");
  return res.json();
}

export async function getExpertSlots(expertId: number): Promise<ExpertSlot[]> {
  const res = await fetch(`${API_BASE}/api/concierge/experts/${expertId}/slots`);
  if (!res.ok) throw new Error("空き枠の取得に失敗しました");
  return res.json();
}

export async function getBookings(): Promise<Booking[]> {
  const res = await fetch(`${API_BASE}/api/concierge/bookings`);
  if (!res.ok) throw new Error("予約一覧の取得に失敗しました");
  return res.json();
}

export async function createBooking(data: {
  expert_id: number;
  slot_id: number;
  share_handbook: boolean;
  notes?: string;
}): Promise<Booking> {
  const res = await fetch(`${API_BASE}/api/concierge/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "予約に失敗しました");
  }
  return res.json();
}
