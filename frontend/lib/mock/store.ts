// GitHub Pages向け静的モックの「DB」。localStorage に保存する。
// backend/db.py のテーブル定義・シード処理に対応する。
import {
  MOCK_PRODUCTS,
  generateVendorListings,
  MOCK_EXPERTS,
  MOCK_EXPERT_SLOTS,
  type MockProductSeed,
  type MockVendorListing,
} from "./seedData";

const STORAGE_KEY = "smt_mock_db_v1";

export type MockProductRow = MockProductSeed;

export type MockPurchaseRow = {
  id: number;
  jan_code: string;
  price: number;
  quantity: number;
  purchased_at: string; // YYYY-MM-DD
  store_name: string | null;
  remaining_doses: number | null;
  purpose: string | null;
  memo: string | null;
  family_member_name: string;
  follow_up_status: string;
  follow_up_date: string | null;
  created_at: string;
};

export type MockFamilyMemberRow = {
  id: number;
  name: string;
  relationship: string | null;
  conditions: string[];
  current_medications: string[];
  allergies: string[];
};

export type MockPrescriptionRow = {
  id: number;
  family_member_name: string;
  rx_code: string;
  started_at: string | null;
  memo: string | null;
};

export type MockExpertRow = {
  id: number;
  name: string;
  title: string;
  area: string;
  rating: number;
  is_active: boolean;
};

export type MockExpertSlotRow = {
  id: number;
  expert_id: number;
  slot_at: string;
  is_booked: boolean;
};

export type MockBookingRow = {
  id: number;
  expert_id: number;
  slot_id: number;
  slot_at: string;
  share_handbook: boolean;
  handbook_snapshot: Record<string, unknown> | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export type MockDb = {
  version: 1;
  products: MockProductRow[];
  vendorListings: MockVendorListing[];
  purchases: MockPurchaseRow[];
  familyMembers: MockFamilyMemberRow[];
  prescriptions: MockPrescriptionRow[];
  experts: MockExpertRow[];
  expertSlots: MockExpertSlotRow[];
  bookings: MockBookingRow[];
  nextIds: {
    purchase: number;
    family: number;
    prescription: number;
    booking: number;
  };
};

function buildSeedDb(): MockDb {
  const products = MOCK_PRODUCTS.map((p) => ({ ...p }));
  const vendorListings = generateVendorListings(products);

  // backend/db.py _seed_vendors: 商品の表示価格をチャネル最安値に揃える
  for (const p of products) {
    const prices = vendorListings.filter((v) => v.jan_code === p.jan_code).map((v) => v.price);
    if (prices.length > 0) {
      p.price = Math.min(...prices);
    }
  }

  const familyMembers: MockFamilyMemberRow[] = [
    { id: 1, name: "自分", relationship: "本人", conditions: [], current_medications: [], allergies: [] },
  ];

  const experts: MockExpertRow[] = MOCK_EXPERTS.map((e, i) => ({
    id: i + 1,
    name: e.name,
    title: e.title,
    area: e.area,
    rating: e.rating,
    is_active: true,
  }));

  const expertSlots: MockExpertSlotRow[] = [];
  let slotId = 1;
  for (const expert of experts) {
    const slots = MOCK_EXPERT_SLOTS[expert.name] ?? [];
    for (const slotAt of slots) {
      expertSlots.push({ id: slotId++, expert_id: expert.id, slot_at: slotAt, is_booked: false });
    }
  }

  return {
    version: 1,
    products,
    vendorListings,
    purchases: [],
    familyMembers,
    prescriptions: [],
    experts,
    expertSlots,
    bookings: [],
    nextIds: { purchase: 1, family: 2, prescription: 1, booking: 1 },
  };
}

let cachedDb: MockDb | null = null;

export function getDb(): MockDb {
  if (typeof window === "undefined") {
    // ビルド時(SSGのプリレンダー)は必ずシードを返し、localStorage には触れない
    return buildSeedDb();
  }
  if (cachedDb) return cachedDb;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cachedDb = JSON.parse(raw) as MockDb;
      return cachedDb;
    }
  } catch {
    // 壊れたデータは無視してシードし直す
  }
  cachedDb = buildSeedDb();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: MockDb): void {
  cachedDb = db;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 保存できない場合(容量超過等)は無視。次回リロードでシードから再開する。
  }
}

export function resetDb(): MockDb {
  const fresh = buildSeedDb();
  saveDb(fresh);
  return fresh;
}
