// GitHub Pages向け静的モック実装。backend/routers/*.py のロジックを移植し、
// データは localStorage (lib/mock/store.ts) に保存する。各ブラウザ内だけのデータで、
// チーム間で共有はされない(GitHub Pages は静的ホスティングのため)。
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
} from "../apiTypes";
import { getDb, saveDb, type MockDb, type MockProductRow, type MockPurchaseRow } from "./store";
import {
  RX_CATALOG,
  CONDITION_OPTIONS,
  matchingConditionLabels,
  CATEGORY_PRODUCT_TERMS,
  FILTER_KEYWORDS,
  MOCK_PHARMACIES,
  detectSevereSymptom,
  matchCategoriesFromText,
  ESCALATION_MESSAGE,
  NON_DIAGNOSIS_DISCLAIMER,
  CLARIFYING_QUESTION,
  MEDS_QUESTION,
  NONE_MED_REPLIES,
} from "./seedData";

const THRESHOLD = 12_000;
const DEDUCTION_CAP = 88_000;
const FOLLOW_UP_STATUSES = ["改善", "変化なし", "悪化"] as const;
const VISIT_MESSAGE =
  "症状の改善が見られません。医療機関の受診をご検討ください。本サービスは診断を行うものではありません。";
const INTERACTION_DISCLAIMER =
  "本情報は添付文書の記載を転送したものであり、飲み合わせの安全性を判定するものではありません。最終的な判断は薬剤師または登録販売者にご相談ください。";
const PRICE_NOTE_SEARCH = "店舗横断の参考最安。最新価格は各購入ページで確認してください。";
const PRICE_NOTE_VENDOR = "参考価格。最新価格は購入ページでご確認ください。";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function findProduct(db: MockDb, janCode: string): MockProductRow | undefined {
  return db.products.find((p) => p.jan_code === janCode);
}

function toProductOut(p: MockProductRow): Product {
  return {
    jan_code: p.jan_code,
    name: p.name,
    generic_name: p.generic_name,
    efficacy: p.efficacy,
    category: p.category,
    is_qualified: p.is_qualified ? 1 : 0,
    dosage: p.dosage,
    side_effects: p.side_effects,
    precautions: p.precautions,
    pdf_url: p.pdf_url,
    price: p.price,
  };
}

function toPurchaseOut(row: MockPurchaseRow, product: MockProductRow): Purchase {
  return {
    id: row.id,
    jan_code: row.jan_code,
    product_name: product.name,
    category: product.category,
    price: row.price,
    quantity: row.quantity,
    purchased_at: row.purchased_at,
    store_name: row.store_name,
    purpose: row.purpose,
    memo: row.memo,
    is_qualified: product.is_qualified ? 1 : 0,
    family_member_name: row.family_member_name,
    follow_up_status: row.follow_up_status,
    follow_up_date: row.follow_up_date,
  };
}

function vendorStats(db: MockDb, janCode: string): { min: number | null; max: number | null; count: number } {
  const prices = db.vendorListings.filter((v) => v.jan_code === janCode).map((v) => v.price);
  if (prices.length === 0) return { min: null, max: null, count: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices), count: prices.length };
}

// --- 4.2/4.3 商品検索・購入支援 ---

export async function lookupJan(code: string): Promise<Product> {
  const db = getDb();
  const product = findProduct(db, code);
  if (!product) {
    throw new Error("この商品は登録されていません。手動で追加できます。");
  }
  return toProductOut(product);
}

export async function findProductsByName(query: string): Promise<Product[]> {
  const keyword = query.trim();
  if (!keyword) return [];
  const db = getDb();
  const matched = db.products.filter(
    (p) => p.name.includes(keyword) || p.generic_name.includes(keyword) || p.category.includes(keyword)
  );
  const rank = (p: MockProductRow) => {
    if (p.name === keyword) return 0;
    if (p.name.startsWith(keyword)) return 1;
    return 2;
  };
  matched.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.price !== b.price) return a.price - b.price;
    return a.name.localeCompare(b.name);
  });
  return matched.slice(0, 30).map(toProductOut);
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
  const db = getDb();
  const product = findProduct(db, data.jan_code);
  if (!product) throw new Error("商品が見つかりません");
  const row: MockPurchaseRow = {
    id: db.nextIds.purchase++,
    jan_code: data.jan_code,
    price: data.price,
    quantity: data.quantity,
    purchased_at: data.purchased_at,
    store_name: data.store_name ?? null,
    remaining_doses: null,
    purpose: data.purpose ?? null,
    memo: data.memo ?? null,
    family_member_name: data.family_member_name || "自分",
    follow_up_status: "未入力",
    follow_up_date: null,
    created_at: nowIso(),
  };
  db.purchases.push(row);
  saveDb(db);
  return toPurchaseOut(row, product);
}

export async function getPurchases(year: number): Promise<Purchase[]> {
  const db = getDb();
  const rows = db.purchases
    .filter((p) => p.purchased_at.slice(0, 4) === String(year))
    .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : a.purchased_at > b.purchased_at ? -1 : 0));
  return rows.map((row) => toPurchaseOut(row, findProduct(db, row.jan_code)!));
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
  const db = getDb();
  const row = db.purchases.find((p) => p.id === id);
  if (!row) throw new Error("購入記録が見つかりません");
  row.price = data.price;
  row.quantity = data.quantity;
  row.purchased_at = data.purchased_at;
  row.store_name = data.store_name ?? null;
  row.purpose = data.purpose ?? null;
  row.memo = data.memo ?? null;
  row.family_member_name = data.family_member_name;
  saveDb(db);
  return toPurchaseOut(row, findProduct(db, row.jan_code)!);
}

export async function deletePurchase(id: number): Promise<void> {
  const db = getDb();
  const idx = db.purchases.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("購入記録が見つかりません");
  db.purchases.splice(idx, 1);
  saveDb(db);
}

export async function submitFollowUp(id: number, status: "改善" | "変化なし" | "悪化"): Promise<FollowUpResult> {
  if (!FOLLOW_UP_STATUSES.includes(status)) {
    throw new Error("status は 改善 / 変化なし / 悪化 のいずれかです");
  }
  const db = getDb();
  const row = db.purchases.find((p) => p.id === id);
  if (!row) throw new Error("購入記録が見つかりません");
  const date = today();
  row.follow_up_status = status;
  row.follow_up_date = date;
  saveDb(db);
  const recommend = status === "変化なし" || status === "悪化";
  return {
    id,
    follow_up_status: status,
    follow_up_date: date,
    recommend_medical_visit: recommend,
    message: recommend ? VISIT_MESSAGE : "",
  };
}

// --- 4.6 税制支援 ---

export async function getTaxSummary(year: number): Promise<TaxSummary> {
  const db = getDb();
  const qualifiedRows = db.purchases.filter((p) => {
    if (p.purchased_at.slice(0, 4) !== String(year)) return false;
    const product = findProduct(db, p.jan_code);
    return !!product?.is_qualified;
  });
  const total = qualifiedRows.reduce((sum, r) => sum + r.price * r.quantity, 0);
  const rawDeductible = Math.max(0, total - THRESHOLD);
  const deductible = Math.min(rawDeductible, DEDUCTION_CAP);

  const byMemberMap = new Map<string, number>();
  for (const row of qualifiedRows) {
    const name = row.family_member_name || "自分";
    byMemberMap.set(name, (byMemberMap.get(name) ?? 0) + row.price * row.quantity);
  }
  const byMember = Array.from(byMemberMap.entries())
    .map(([name, totalQualified]) => ({ name, total_qualified: totalQualified }))
    .sort((a, b) => (b.total_qualified !== a.total_qualified ? b.total_qualified - a.total_qualified : a.name.localeCompare(b.name)));

  return {
    year,
    total_qualified: total,
    deductible_amount: deductible,
    raw_deductible_amount: rawDeductible,
    threshold: THRESHOLD,
    deduction_cap: DEDUCTION_CAP,
    is_qualified: total > THRESHOLD,
    cap_applied: rawDeductible > DEDUCTION_CAP,
    by_member: byMember,
  };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerBlobDownload(content: string, mime: string, filename: string, bom = false): void {
  const parts: (string | BlobPart)[] = bom ? ["\ufeff", content] : [content];
  const blob = new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadTaxExport(year: number, format: "csv" | "xml"): Promise<void> {
  const db = getDb();
  const rows = db.purchases
    .filter((p) => p.purchased_at.slice(0, 4) === String(year))
    .map((p) => ({ row: p, product: findProduct(db, p.jan_code)! }))
    .filter((x) => !!x.product)
    .sort((a, b) => (a.row.purchased_at > b.row.purchased_at ? 1 : a.row.purchased_at < b.row.purchased_at ? -1 : 0));

  if (format === "csv") {
    const header = [
      "医療を受けた方",
      "病院・薬局などの名称",
      "医療費の区分",
      "支払った医療費の額",
      "補てんされる金額",
      "購入日",
      "商品名",
      "一般名",
      "数量",
      "税制対象",
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const { row, product } of rows) {
      const subtotal = row.price * row.quantity;
      lines.push(
        [
          row.family_member_name || "自分",
          row.store_name || "ドラッグストア等",
          "医薬品購入",
          subtotal,
          0,
          row.purchased_at,
          product.name,
          product.generic_name,
          row.quantity,
          product.is_qualified ? "○" : "×",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    triggerBlobDownload(lines.join("\r\n"), "text/csv;charset=utf-8", `kakutei_shinkoku_selfmed_${year}.csv`, true);
    return;
  }

  const items = rows
    .map(({ row, product }) => {
      const subtotal = row.price * row.quantity;
      return `  <明細>
    <医療を受けた方>${xmlEscape(row.family_member_name || "自分")}</医療を受けた方>
    <病院薬局などの名称>${xmlEscape(row.store_name || "ドラッグストア等")}</病院薬局などの名称>
    <医療費の区分>医薬品購入</医療費の区分>
    <支払った医療費の額>${xmlEscape(subtotal)}</支払った医療費の額>
    <補てんされる金額>0</補てんされる金額>
    <購入日>${xmlEscape(row.purchased_at)}</購入日>
    <商品名>${xmlEscape(product.name)}</商品名>
    <一般名>${xmlEscape(product.generic_name)}</一般名>
    <税制対象>${product.is_qualified ? "1" : "0"}</税制対象>
  </明細>`;
    })
    .join("\n");
  const xml = `<?xml version='1.0' encoding='utf-8'?>\n<確定申告準備_セルフメディケーション税制 年度="${year}" 備考="所得税の確定申告準備用。e-Tax公式スキーマではありません。">\n${items}\n</確定申告準備_セルフメディケーション税制>\n`;
  triggerBlobDownload(xml, "application/xml", `kakutei_shinkoku_selfmed_${year}.xml`);
}

// --- 4.5 在庫 / レシート取込 ---

export async function getInventory(): Promise<InventoryItem[]> {
  const db = getDb();
  const withDoses = db.purchases.filter((p) => p.remaining_doses !== null);
  const latestByJan = new Map<string, MockPurchaseRow>();
  for (const row of withDoses) {
    const current = latestByJan.get(row.jan_code);
    if (
      !current ||
      row.purchased_at > current.purchased_at ||
      (row.purchased_at === current.purchased_at && row.id > current.id)
    ) {
      latestByJan.set(row.jan_code, row);
    }
  }
  const items: InventoryItem[] = [];
  for (const row of latestByJan.values()) {
    const product = findProduct(db, row.jan_code);
    if (!product) continue;
    items.push({
      jan_code: row.jan_code,
      product_name: product.name,
      category: product.category,
      remaining_doses: row.remaining_doses ?? 0,
      last_purchased_at: row.purchased_at,
      is_low_stock: (row.remaining_doses ?? 0) <= 3,
    });
  }
  items.sort((a, b) => a.product_name.localeCompare(b.product_name));
  return items;
}

const RECEIPT_MOCK_ITEMS = [
  { jan_code: "4987117709559", price: 980, store: "マツキヨ渋谷店" },
  { jan_code: "4987028112014", price: 1280, store: "マツキヨ渋谷店" },
];

export async function uploadReceipt(): Promise<{ imported: number; date: string; store: string }> {
  const db = getDb();
  const date = today();
  let imported = 0;
  for (const item of RECEIPT_MOCK_ITEMS) {
    const product = findProduct(db, item.jan_code);
    if (!product) continue;
    db.purchases.push({
      id: db.nextIds.purchase++,
      jan_code: item.jan_code,
      price: item.price,
      quantity: 1,
      purchased_at: date,
      store_name: item.store,
      remaining_doses: null,
      purpose: null,
      memo: null,
      family_member_name: "自分",
      follow_up_status: "未入力",
      follow_up_date: null,
      created_at: nowIso(),
    });
    imported += 1;
  }
  saveDb(db);
  return { imported, date, store: "マツキヨ渋谷店" };
}

// --- 4.1 AIチャット相談 ---

function awaitingMedsReply(history: ChatTurn[]): boolean {
  if (history.length < 2) return false;
  const prior = history.slice(0, -1);
  for (let i = prior.length - 1; i >= 0; i--) {
    const turn = prior[i];
    if (turn.role === "assistant") {
      return turn.text.includes("普段から飲んでいる薬");
    }
    if (turn.role === "user") break;
  }
  return false;
}

function symptomsFromHistory(history: ChatTurn[]): string[] {
  const found: string[] = [];
  for (const turn of history) {
    if (turn.role === "user") found.push(...matchCategoriesFromText(turn.text));
  }
  return Array.from(new Set(found));
}

function parseCurrentMeds(text: string): string[] {
  const cleaned = text.trim();
  const normalized = cleaned.replace(/　/g, " ");
  if (NONE_MED_REPLIES.includes(normalized.toLowerCase()) || NONE_MED_REPLIES.includes(normalized)) return [];
  if (["なし", "特になし", "ありません"].some((x) => normalized.startsWith(x))) return [];
  const parts = cleaned.split(/[、,，/・\n]+|\s{2,}/);
  const meds = parts.map((p) => p.trim()).filter((p) => p && !NONE_MED_REPLIES.includes(p));
  return meds.slice(0, 10);
}

export async function sendChatTurn(history: ChatTurn[]): Promise<ChatApiResponse> {
  const latest = history[history.length - 1].text;

  if (detectSevereSymptom(latest)) {
    return { reply: ESCALATION_MESSAGE, escalate: true, ready_for_search: false, extracted_symptoms: [] };
  }

  if (awaitingMedsReply(history)) {
    let symptoms = symptomsFromHistory(history.slice(0, -1));
    if (symptoms.length === 0) symptoms = matchCategoriesFromText(latest);
    const meds = parseCurrentMeds(latest);
    const medsNote =
      meds.length > 0
        ? `服用中として「${meds.join("・")}」を検索の参考にします。`
        : "服用中の薬は特にないものとして検索します。";
    const reply = `${medsNote}\n${symptoms.length ? symptoms.join("・") : "症状"}に関連するOTC医薬品の情報を一覧で表示します。\n${NON_DIAGNOSIS_DISCLAIMER}`;
    return {
      reply,
      escalate: false,
      ready_for_search: symptoms.length > 0,
      extracted_symptoms: symptoms,
      current_meds: meds,
      awaiting_meds: false,
    };
  }

  const matched = matchCategoriesFromText(latest);
  if (matched.length > 0) {
    const label = matched.join("・");
    const reply = `${label}に関連する情報が見つかりそうです。\n${MEDS_QUESTION}`;
    return {
      reply,
      escalate: false,
      ready_for_search: false,
      extracted_symptoms: matched,
      current_meds: [],
      awaiting_meds: true,
    };
  }

  return { reply: CLARIFYING_QUESTION, escalate: false, ready_for_search: false, extracted_symptoms: [] };
}

// --- 4.2/4.3 商品検索・価格比較 ---

function pastPurchaseNames(db: MockDb): Set<string> {
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const rows = db.purchases
    .filter((p) => p.purchased_at >= cutoff)
    .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : -1))
    .slice(0, 10);
  return new Set(rows.map((r) => findProduct(db, r.jan_code)?.name).filter((n): n is string => !!n));
}

export async function searchProducts(
  symptoms: string[],
  filters: string[] = [],
  currentMeds: string[] = [],
  conditions: string[] = []
): Promise<ProductSearchResult[]> {
  const db = getDb();
  const terms = new Set<string>();
  for (const symptom of symptoms) {
    for (const term of CATEGORY_PRODUCT_TERMS[symptom] ?? []) terms.add(term);
  }

  let matched = db.products.filter((p) => Array.from(terms).some((t) => p.efficacy.includes(t)));

  const activeFilters = filters.filter((f) => f in FILTER_KEYWORDS);
  if (activeFilters.length > 0) {
    const filterWords = activeFilters.flatMap((f) => FILTER_KEYWORDS[f]);
    matched = matched.filter((p) =>
      filterWords.some((w) => p.name.includes(w) || p.generic_name.includes(w) || p.efficacy.includes(w))
    );
  }

  if (filters.includes("過去購入品を優先")) {
    const pastNames = pastPurchaseNames(db);
    matched = [...matched].sort((a, b) => {
      const aIn = pastNames.has(a.name) ? 0 : 1;
      const bIn = pastNames.has(b.name) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      if (a.price !== b.price) return a.price - b.price;
      return a.generic_name.localeCompare(b.generic_name);
    });
  } else {
    matched = [...matched].sort((a, b) => (a.price !== b.price ? a.price - b.price : a.generic_name.localeCompare(b.generic_name)));
  }

  return matched.map((p) => {
    const stats = vendorStats(db, p.jan_code);
    const displayPrice = stats.min ?? p.price;
    return {
      ...toProductOut(p),
      price: displayPrice,
      overlap_warning: currentMeds.some((med) => p.generic_name.includes(med)),
      condition_warnings: matchingConditionLabels(p.precautions || "", conditions),
      vendor_min_price: stats.min,
      vendor_max_price: stats.max,
      vendor_count: stats.count,
      price_note: PRICE_NOTE_SEARCH,
    };
  });
}

function vendorRows(db: MockDb, janCode: string): VendorListing[] {
  const rows = db.vendorListings
    .filter((v) => v.jan_code === janCode)
    .sort((a, b) => (a.price !== b.price ? a.price - b.price : a.store_name.localeCompare(b.store_name)));
  if (rows.length === 0) return [];
  const minPrice = rows[0].price;
  return rows.map((r) => ({
    store_name: r.store_name,
    price: r.price,
    in_stock: true,
    url: r.url,
    is_lowest: r.price === minPrice,
    price_note: PRICE_NOTE_VENDOR,
  }));
}

export async function getProductVendors(janCode: string): Promise<VendorListing[]> {
  const db = getDb();
  if (!findProduct(db, janCode)) throw new Error("この商品は登録されていません");
  return vendorRows(db, janCode);
}

export async function getPriceCompare(janCode: string): Promise<PriceCompare> {
  const db = getDb();
  const product = findProduct(db, janCode);
  if (!product) throw new Error("この商品は登録されていません");
  const vendors = vendorRows(db, janCode);
  if (vendors.length === 0) throw new Error("価格情報がありません");
  const prices = vendors.map((v) => v.price);
  return {
    jan_code: product.jan_code,
    product_name: product.name,
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    vendors,
    disclaimer: "表示は参考価格です。在庫状況は扱いません。最新の販売価格は各購入ページでご確認ください。",
  };
}

// --- 4.7 薬局検索 ---

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_371_000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function getNearbyPharmacies(lat: number, lon: number): Promise<Pharmacy[]> {
  // 静的モックでは外部API(Overpass)へは接続せず、常にモックデータを返す。
  return MOCK_PHARMACIES.map((p) => ({
    name: p.name,
    address: p.address,
    phone: p.phone,
    lat: p.lat,
    lon: p.lon,
    opening_hours: p.opening_hours,
    distance_m: haversineM(lat, lon, p.lat, p.lon),
  })).sort((a, b) => a.distance_m - b.distance_m);
}

// --- 4.4 飲み合わせチェック ---

function parseIngredients(genericName: string): string[] {
  const parts = genericName.replace(/・/g, " ").replace(/\//g, " ").split(/\s+/);
  return parts.map((p) => p.trim()).filter((p) => p.length >= 2);
}

export async function checkInteractions(janCodes: string[]): Promise<InteractionCheckResult> {
  const db = getDb();
  const rows = db.products.filter((p) => janCodes.includes(p.jan_code));
  if (rows.length < 2) throw new Error("比較対象の商品が2件以上必要です");

  const ingredientMap = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const ing of parseIngredients(row.generic_name)) {
      if (!ingredientMap.has(ing)) ingredientMap.set(ing, new Set());
      ingredientMap.get(ing)!.add(row.name);
    }
  }
  const overlaps = Array.from(ingredientMap.entries())
    .filter(([, names]) => names.size > 1)
    .map(([ingredient, names]) => ({ ingredient, product_names: Array.from(names) }));

  return {
    overlaps,
    precaution_notes: rows.map((r) => ({
      product_name: r.name,
      generic_name: r.generic_name,
      precautions: r.precautions,
    })),
    disclaimer: INTERACTION_DISCLAIMER,
  };
}

// --- 4.9 家族情報共有 ---

export async function getFamily(): Promise<FamilyMember[]> {
  const db = getDb();
  return db.familyMembers.map((m) => ({ ...m, conditions: [...m.conditions], current_medications: [...m.current_medications], allergies: [...m.allergies] }));
}

export async function getConditionOptions(): Promise<string[]> {
  return [...CONDITION_OPTIONS];
}

function normalizeConditions(conditions: string[]): string[] {
  const allowed = new Set(CONDITION_OPTIONS);
  return conditions.filter((c) => allowed.has(c));
}

export async function createFamilyMember(data: Omit<FamilyMember, "id">): Promise<FamilyMember> {
  const db = getDb();
  if (db.familyMembers.some((m) => m.name === data.name)) {
    throw new Error("同じ名前の家族が既に登録されています");
  }
  const row = {
    id: db.nextIds.family++,
    name: data.name,
    relationship: data.relationship,
    conditions: normalizeConditions(data.conditions),
    current_medications: [...data.current_medications],
    allergies: [...data.allergies],
  };
  db.familyMembers.push(row);
  saveDb(db);
  return { ...row };
}

export async function updateFamilyMember(id: number, data: Omit<FamilyMember, "id">): Promise<FamilyMember> {
  const db = getDb();
  const row = db.familyMembers.find((m) => m.id === id);
  if (!row) throw new Error("家族が見つかりません");
  if (db.familyMembers.some((m) => m.name === data.name && m.id !== id)) {
    throw new Error("同じ名前の家族が既に登録されています");
  }
  row.name = data.name;
  row.relationship = data.relationship;
  row.conditions = normalizeConditions(data.conditions);
  row.current_medications = [...data.current_medications];
  row.allergies = [...data.allergies];
  saveDb(db);
  return { ...row };
}

export async function deleteFamilyMember(id: number): Promise<void> {
  const db = getDb();
  const row = db.familyMembers.find((m) => m.id === id);
  if (!row) throw new Error("家族が見つかりません");
  if (row.name === "自分") throw new Error("「自分」は削除できません");
  db.familyMembers = db.familyMembers.filter((m) => m.id !== id);
  saveDb(db);
}

// --- 処方薬登録 ---

function rxCatalogByCode(): Map<string, RxCatalogItem> {
  return new Map(RX_CATALOG.map((item) => [item.code, item]));
}

export async function getRxCatalog(): Promise<RxCatalogItem[]> {
  return RX_CATALOG.map((item) => ({ ...item }));
}

export async function getPrescriptions(familyMemberName?: string): Promise<Prescription[]> {
  const db = getDb();
  const catalog = rxCatalogByCode();
  let rows = db.prescriptions;
  if (familyMemberName) rows = rows.filter((r) => r.family_member_name === familyMemberName);
  rows = [...rows].sort((a, b) => b.id - a.id);
  return rows.map((row) => {
    const item = catalog.get(row.rx_code);
    return {
      id: row.id,
      family_member_name: row.family_member_name,
      rx_code: row.rx_code,
      name: item?.name ?? row.rx_code,
      generic_name: item?.generic_name ?? "",
      category: item?.category ?? "",
      started_at: row.started_at,
      memo: row.memo,
    };
  });
}

export async function createPrescription(data: {
  family_member_name: string;
  rx_code: string;
  started_at?: string;
  memo?: string;
}): Promise<Prescription> {
  const db = getDb();
  const catalog = rxCatalogByCode();
  const item = catalog.get(data.rx_code);
  if (!item) throw new Error("未登録の処方薬コードです");
  if (!db.familyMembers.some((m) => m.name === data.family_member_name)) {
    throw new Error("家族メンバーが見つかりません");
  }
  const row = {
    id: db.nextIds.prescription++,
    family_member_name: data.family_member_name,
    rx_code: data.rx_code,
    started_at: data.started_at ?? null,
    memo: data.memo ?? null,
  };
  db.prescriptions.push(row);
  saveDb(db);
  return {
    id: row.id,
    family_member_name: row.family_member_name,
    rx_code: row.rx_code,
    name: item.name,
    generic_name: item.generic_name,
    category: item.category,
    started_at: row.started_at,
    memo: row.memo,
  };
}

export async function deletePrescription(id: number): Promise<void> {
  const db = getDb();
  const idx = db.prescriptions.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("処方薬登録が見つかりません");
  db.prescriptions.splice(idx, 1);
  saveDb(db);
}

// --- 5.1 OTC コンシェルジュ ---

function buildHandbookSnapshot(db: MockDb): Record<string, unknown> {
  const purchases = [...db.purchases]
    .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : -1))
    .slice(0, 50)
    .map((row) => {
      const product = findProduct(db, row.jan_code);
      return {
        id: row.id,
        jan_code: row.jan_code,
        purchased_at: row.purchased_at,
        price: row.price,
        quantity: row.quantity,
        purpose: row.purpose,
        memo: row.memo,
        family_member_name: row.family_member_name,
        follow_up_status: row.follow_up_status,
        product_name: product?.name,
        generic_name: product?.generic_name,
        category: product?.category,
      };
    });
  return {
    disclaimer: "本データは利用者が登録した事実情報の転送です。診断・治療方針の決定・安全性判定を含むものではありません。",
    purchases,
    family_members: db.familyMembers.map((m) => ({
      name: m.name,
      relationship: m.relationship,
      conditions: m.conditions,
      current_medications: m.current_medications,
      allergies: m.allergies,
    })),
  };
}

export async function getExperts(): Promise<Expert[]> {
  const db = getDb();
  return db.experts
    .filter((e) => e.is_active)
    .sort((a, b) => (b.rating !== a.rating ? b.rating - a.rating : a.id - b.id))
    .map((e) => ({ id: e.id, name: e.name, title: e.title, area: e.area, rating: e.rating }));
}

export async function getExpertSlots(expertId: number): Promise<ExpertSlot[]> {
  const db = getDb();
  const expert = db.experts.find((e) => e.id === expertId && e.is_active);
  if (!expert) throw new Error("専門家が見つかりません");
  return db.expertSlots
    .filter((s) => s.expert_id === expertId && !s.is_booked)
    .sort((a, b) => a.id - b.id)
    .map((s) => ({ ...s }));
}

function toBookingOut(db: MockDb, booking: MockDb["bookings"][number]): Booking {
  const expert = db.experts.find((e) => e.id === booking.expert_id);
  return {
    id: booking.id,
    expert_id: booking.expert_id,
    expert_name: expert?.name ?? "",
    expert_title: expert?.title ?? "",
    slot_id: booking.slot_id,
    slot_at: booking.slot_at,
    share_handbook: booking.share_handbook,
    handbook_snapshot: booking.handbook_snapshot,
    notes: booking.notes,
    status: booking.status,
    created_at: booking.created_at,
  };
}

export async function getBookings(): Promise<Booking[]> {
  const db = getDb();
  return [...db.bookings].sort((a, b) => b.id - a.id).map((b) => toBookingOut(db, b));
}

export async function createBooking(data: {
  expert_id: number;
  slot_id: number;
  share_handbook: boolean;
  notes?: string;
}): Promise<Booking> {
  const db = getDb();
  const expert = db.experts.find((e) => e.id === data.expert_id && e.is_active);
  if (!expert) throw new Error("専門家が見つかりません");
  const slot = db.expertSlots.find((s) => s.id === data.slot_id && s.expert_id === data.expert_id);
  if (!slot) throw new Error("予約枠が見つかりません");
  if (slot.is_booked) throw new Error("この枠は既に予約済みです");

  const snapshot = data.share_handbook ? buildHandbookSnapshot(db) : null;
  const booking = {
    id: db.nextIds.booking++,
    expert_id: data.expert_id,
    slot_id: data.slot_id,
    slot_at: slot.slot_at,
    share_handbook: data.share_handbook,
    handbook_snapshot: snapshot,
    notes: data.notes ?? null,
    status: "confirmed",
    created_at: nowIso(),
  };
  db.bookings.push(booking);
  slot.is_booked = true;
  saveDb(db);
  return toBookingOut(db, booking);
}
