"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Check,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  deletePurchase,
  getPurchases,
  submitFollowUp,
  type Purchase,
  updatePurchase,
} from "@/lib/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const PRIMARY = "#1565C0";
const PRIMARY_SOFT = "#E3F2FD";
const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-gray-800";

type EditForm = {
  price: string;
  quantity: string;
  purchased_at: string;
  store_name: string;
  purpose: string;
  memo: string;
  family_member_name: string;
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function HandbookPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [memberFilter, setMemberFilter] = useState("すべて");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [followUpId, setFollowUpId] = useState<number | null>(null);

  async function loadPurchases(selectedYear: number) {
    setLoading(true);
    setError(null);
    try {
      setPurchases(await getPurchases(selectedYear));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "購入履歴の取得に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setEditingId(null);
    setEditForm(null);
    void loadPurchases(year);
  }, [year]);

  const otherMembers = Array.from(
    new Set(
      purchases
        .map((purchase) => purchase.family_member_name)
        .filter((name) => name && name !== "自分"),
    ),
  );
  const memberOptions = ["すべて", "自分", ...otherMembers];
  const filteredPurchases =
    memberFilter === "すべて"
      ? purchases
      : purchases.filter(
          (purchase) => purchase.family_member_name === memberFilter,
        );

  function startEditing(purchase: Purchase) {
    setEditingId(purchase.id);
    setEditForm({
      price: String(purchase.price),
      quantity: String(purchase.quantity),
      purchased_at: purchase.purchased_at.slice(0, 10),
      store_name: purchase.store_name ?? "",
      purpose: purchase.purpose ?? "",
      memo: purchase.memo ?? "",
      family_member_name: purchase.family_member_name,
    });
    setError(null);
  }

  function updateEditField(field: keyof EditForm, value: string) {
    setEditForm((current) => (current ? { ...current, [field]: value } : null));
  }

  async function handleSave(id: number) {
    if (!editForm) return;

    const price = Number(editForm.price);
    const quantity = Number(editForm.quantity);
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !editForm.purchased_at ||
      !editForm.family_member_name.trim()
    ) {
      setError("金額・数量・購入日・家族名を確認してください");
      return;
    }

    setSavingId(id);
    setError(null);
    try {
      await updatePurchase(id, {
        price,
        quantity,
        purchased_at: editForm.purchased_at,
        store_name: editForm.store_name.trim(),
        purpose: editForm.purpose.trim(),
        memo: editForm.memo.trim(),
        family_member_name: editForm.family_member_name.trim(),
      });
      setEditingId(null);
      setEditForm(null);
      await loadPurchases(year);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "更新に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(purchase: Purchase) {
    if (!window.confirm(`「${purchase.product_name}」の記録を削除しますか？`)) {
      return;
    }

    setSavingId(purchase.id);
    setError(null);
    try {
      await deletePurchase(purchase.id);
      if (editingId === purchase.id) {
        setEditingId(null);
        setEditForm(null);
      }
      await loadPurchases(year);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "削除に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  async function handleFollowUp(
    purchaseId: number,
    status: "改善" | "変化なし" | "悪化",
  ) {
    setFollowUpId(purchaseId);
    setError(null);
    try {
      await submitFollowUp(purchaseId, status);
      await loadPurchases(year);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "経過の更新に失敗しました",
      );
    } finally {
      setFollowUpId(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pt-6 pb-4 bg-white">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-800">OTCお薬手帳</h1>
            <p className="text-[11px] text-gray-500">購入履歴の管理</p>
          </div>
          <Link
            href="/scan"
            className="w-9 h-9 rounded-xl text-white flex items-center justify-center transition-colors shrink-0"
            style={{ background: PRIMARY }}
            data-testid="add-record-button"
            aria-label="購入記録を追加"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {YEAR_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setYear(option)}
              className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                year === option ? "text-white" : "text-gray-700"
              }`}
              style={{
                background: year === option ? PRIMARY : PRIMARY_SOFT,
              }}
              data-testid={year === option ? "year-select" : undefined}
            >
              {option}年
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pt-3 pb-1">
          {memberOptions.map((member) => (
            <button
              key={member}
              type="button"
              onClick={() => setMemberFilter(member)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                memberFilter === member ? "text-white" : "text-gray-700"
              }`}
              style={{
                background: memberFilter === member ? PRIMARY : PRIMARY_SOFT,
              }}
            >
              {member}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 py-4">
        {error && (
          <div className="bg-red-50 text-red-700 rounded-2xl p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: PRIMARY }}
            />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: PRIMARY_SOFT }}
            >
              <BookOpen className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 mb-1">
              {purchases.length === 0
                ? "まだ購入記録がありません"
                : "この家族の購入記録はありません"}
            </p>
            {purchases.length === 0 && (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  お薬を購入したら記録を残しましょう
                </p>
                <Link
                  href="/scan"
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ background: PRIMARY }}
                >
                  記録を追加
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <Link
              href="/interaction"
              className="block w-full mb-4 py-2.5 rounded-xl text-sm font-medium text-center text-white"
              style={{ background: PRIMARY }}
            >
              飲み合わせ・成分重複を確認
            </Link>

            <div className="space-y-3" data-testid="purchase-list">
              {filteredPurchases.map((purchase) => (
                <article
                  key={purchase.id}
                  className="rounded-2xl p-4"
                  style={{ background: PRIMARY_SOFT }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-sm text-gray-800">
                        {purchase.product_name}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-gray-700">
                          {purchase.category || "カテゴリ未設定"}
                        </span>
                        {Boolean(purchase.is_qualified) && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium text-gray-800"
                            style={{ background: "#FFF9C4" }}
                          >
                            <Receipt className="w-3 h-3" />
                            税制対象
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-gray-800">
                        ¥{purchase.price.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-600">
                        数量 {purchase.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-600 mb-2 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-gray-700">
                      <User className="w-3 h-3" />
                      {purchase.family_member_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(purchase.purchased_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {purchase.store_name || "店舗未入力"}
                    </span>
                  </div>

                  <p
                    className="text-xs text-gray-700 mb-1"
                    data-testid="purchase-purpose"
                  >
                    目的：{purchase.purpose || "未入力"}
                  </p>
                  <p
                    className="text-xs text-gray-600"
                    data-testid="purchase-memo"
                  >
                    メモ：{purchase.memo || "未入力"}
                  </p>

                  {purchase.follow_up_status === "未入力" && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-bold text-gray-800 mb-2">
                        経過はいかがですか？
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleFollowUp(purchase.id, "改善")}
                          disabled={followUpId === purchase.id}
                          className="py-1.5 rounded-lg bg-white text-xs font-medium text-gray-700 disabled:opacity-50"
                          data-testid="follow-up-improve"
                        >
                          改善
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFollowUp(purchase.id, "変化なし")}
                          disabled={followUpId === purchase.id}
                          className="py-1.5 rounded-lg bg-white text-xs font-medium text-gray-700 disabled:opacity-50"
                          data-testid="follow-up-same"
                        >
                          変化なし
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFollowUp(purchase.id, "悪化")}
                          disabled={followUpId === purchase.id}
                          className="py-1.5 rounded-lg bg-white text-xs font-medium text-gray-700 disabled:opacity-50"
                          data-testid="follow-up-worse"
                        >
                          悪化
                        </button>
                      </div>
                    </div>
                  )}

                  {(purchase.follow_up_status === "変化なし" ||
                    purchase.follow_up_status === "悪化") && (
                    <div
                      className="mt-3 rounded-xl p-3 text-xs text-gray-800"
                      style={{ background: "#FFEBEE" }}
                      data-testid="visit-recommend-banner"
                    >
                      <p className="font-bold mb-1">受診推奨</p>
                      <p>
                        症状が続く場合や悪化した場合は、医療機関への受診をご検討ください。本サービスは診断を行うものではありません。
                      </p>
                    </div>
                  )}

                  {editingId === purchase.id && editForm && (
                    <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] text-gray-600">
                          金額
                          <input
                            type="number"
                            min="0"
                            value={editForm.price}
                            onChange={(event) =>
                              updateEditField("price", event.target.value)
                            }
                            className={INPUT_CLASS}
                          />
                        </label>
                        <label className="text-[11px] text-gray-600">
                          数量
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editForm.quantity}
                            onChange={(event) =>
                              updateEditField("quantity", event.target.value)
                            }
                            className={INPUT_CLASS}
                          />
                        </label>
                      </div>
                      <label className="block text-[11px] text-gray-600">
                        購入日
                        <input
                          type="date"
                          value={editForm.purchased_at}
                          onChange={(event) =>
                            updateEditField("purchased_at", event.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        家族名
                        <input
                          type="text"
                          value={editForm.family_member_name}
                          onChange={(event) =>
                            updateEditField(
                              "family_member_name",
                              event.target.value,
                            )
                          }
                          className={INPUT_CLASS}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        店舗
                        <input
                          type="text"
                          value={editForm.store_name}
                          onChange={(event) =>
                            updateEditField("store_name", event.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        目的
                        <input
                          type="text"
                          value={editForm.purpose}
                          onChange={(event) =>
                            updateEditField("purpose", event.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        メモ
                        <textarea
                          value={editForm.memo}
                          onChange={(event) =>
                            updateEditField("memo", event.target.value)
                          }
                          rows={2}
                          className={`${INPUT_CLASS} resize-none`}
                        />
                      </label>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSave(purchase.id)}
                          disabled={savingId === purchase.id}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-white disabled:opacity-50"
                          style={{ background: PRIMARY }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(null);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-xs font-medium text-gray-700"
                        >
                          <X className="w-3.5 h-3.5" />
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-3 pt-2 border-t border-blue-200">
                    <button
                      type="button"
                      onClick={() => startEditing(purchase)}
                      disabled={savingId === purchase.id}
                      className="flex items-center gap-1 text-xs font-medium disabled:opacity-50"
                      style={{ color: PRIMARY }}
                      data-testid="purchase-edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(purchase)}
                      disabled={savingId === purchase.id}
                      className="flex items-center gap-1 text-xs font-medium text-red-700 disabled:opacity-50"
                      data-testid="purchase-delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      削除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
