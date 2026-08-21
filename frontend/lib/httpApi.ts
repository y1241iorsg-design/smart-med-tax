// バックエンド(FastAPI)を実際に呼び出す実装。
// Same-origin /api/* is proxied to the backend via next.config rewrites.
// Set NEXT_PUBLIC_API_URL only if you need to call the backend directly.
import type {
  Product,
  Purchase,
  TaxSummary,
  InventoryItem,
  ChatTurn,
  ChatApiResponse,
  ProductSearchResult,
  VendorListing,
  PriceCompare,
  Pharmacy,
  InteractionCheckResult,
  FamilyMember,
  RxCatalogItem,
  Prescription,
  FollowUpResult,
  Expert,
  ExpertSlot,
  Booking,
} from "./apiTypes";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  const res = await fetch(`${API_BASE}/api/products/find?q=${encodeURIComponent(q)}`);
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

export async function downloadTaxExport(year: number, format: "csv" | "xml"): Promise<void> {
  const url = `${API_BASE}/api/tax/export?year=${year}&fmt=${format}`;
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
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

export async function sendChatTurn(history: ChatTurn[]): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  if (!res.ok) throw new Error("チャットの送信に失敗しました");
  return res.json();
}

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

export async function getNearbyPharmacies(lat: number, lon: number): Promise<Pharmacy[]> {
  const res = await fetch(`${API_BASE}/api/pharmacies/nearby?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("薬局情報の取得に失敗しました");
  return res.json();
}

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

export async function getRxCatalog(): Promise<RxCatalogItem[]> {
  const res = await fetch(`${API_BASE}/api/prescriptions/catalog`);
  if (!res.ok) throw new Error("処方薬リストの取得に失敗しました");
  return res.json();
}

export async function getPrescriptions(familyMemberName?: string): Promise<Prescription[]> {
  const qs = familyMemberName ? `?family_member_name=${encodeURIComponent(familyMemberName)}` : "";
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
  const res = await fetch(`${API_BASE}/api/prescriptions/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "処方薬の削除に失敗しました");
  }
}

export async function createFamilyMember(data: Omit<FamilyMember, "id">): Promise<FamilyMember> {
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

export async function updateFamilyMember(id: number, data: Omit<FamilyMember, "id">): Promise<FamilyMember> {
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

export async function submitFollowUp(id: number, status: "改善" | "変化なし" | "悪化"): Promise<FollowUpResult> {
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
