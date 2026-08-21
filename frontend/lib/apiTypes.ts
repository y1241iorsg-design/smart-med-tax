// api.ts の実装(httpApi / mockApi)で共有する型定義。

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

export type InventoryItem = {
  jan_code: string;
  product_name: string;
  category: string;
  remaining_doses: number;
  last_purchased_at: string;
  is_low_stock: boolean;
};

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatApiResponse = {
  reply: string;
  escalate: boolean;
  ready_for_search: boolean;
  extracted_symptoms: string[];
  current_meds?: string[];
  awaiting_meds?: boolean;
};

export type ProductSearchResult = Product & {
  overlap_warning: boolean;
  condition_warnings?: string[];
  vendor_min_price?: number | null;
  vendor_max_price?: number | null;
  vendor_count?: number;
  price_note?: string;
};

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

export type Pharmacy = {
  name: string;
  address: string;
  phone: string | null;
  lat: number;
  lon: number;
  opening_hours: string | null;
  distance_m: number;
};

export type InteractionCheckResult = {
  overlaps: { ingredient: string; product_names: string[] }[];
  precaution_notes: { product_name: string; generic_name: string; precautions: string }[];
  disclaimer: string;
};

export type FamilyMember = {
  id: number;
  name: string;
  relationship: string | null;
  conditions: string[];
  current_medications: string[];
  allergies: string[];
};

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

export type FollowUpResult = {
  id: number;
  follow_up_status: string;
  follow_up_date: string;
  recommend_medical_visit: boolean;
  message: string;
};

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
