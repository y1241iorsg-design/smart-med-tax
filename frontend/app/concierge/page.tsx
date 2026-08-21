"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Loader2, UserRound } from "lucide-react";
import {
  createBooking,
  getBookings,
  getExpertSlots,
  getExperts,
  type Booking,
  type Expert,
  type ExpertSlot,
} from "@/lib/api";

const PRIMARY = "#FFCCBC";
const PRIMARY_SOFT = "#FFF3E0";

export default function ConciergePage() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [slots, setSlots] = useState<ExpertSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedExpertId, setSelectedExpertId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [shareHandbook, setShareHandbook] = useState(true);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const data = await getBookings();
    setBookings(data);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [expertList] = await Promise.all([getExperts(), loadBookings()]);
        if (active) setExperts(expertList);
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "専門家情報の取得に失敗しました",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadBookings]);

  useEffect(() => {
    if (selectedExpertId == null) {
      setSlots([]);
      return;
    }
    let active = true;
    async function loadSlots() {
      setSlotsLoading(true);
      setError(null);
      try {
        const data = await getExpertSlots(selectedExpertId!);
        if (active) {
          setSlots(data);
          setSelectedSlotId(null);
        }
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "空き枠の取得に失敗しました",
          );
        }
      } finally {
        if (active) setSlotsLoading(false);
      }
    }
    void loadSlots();
    return () => {
      active = false;
    };
  }, [selectedExpertId]);

  async function handleConfirm() {
    if (selectedExpertId == null || selectedSlotId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking({
        expert_id: selectedExpertId,
        slot_id: selectedSlotId,
        share_handbook: shareHandbook,
        notes: notes.trim() || undefined,
      });
      setConfirmed(booking);
      await loadBookings();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "予約に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewBooking() {
    setConfirmed(null);
    setSelectedExpertId(null);
    setSelectedSlotId(null);
    setNotes("");
    setShareHandbook(true);
  }

  const selectedExpert = experts.find((e) => e.id === selectedExpertId);

  return (
    <main className="max-w-md mx-auto px-4 py-8 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold mb-1 text-gray-900">OTC コンシェルジュ</h1>
      <p className="text-sm text-gray-600 mb-4">
        薬剤師・登録販売者へのオンライン面談を予約できます。診断ではなく、事実データの共有と相談の場です。
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 mb-6">
        本サービスは診断・治療を行うものではありません。受診の要否や安全性の最終確認は専門家にご相談ください。
      </p>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-gray-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : confirmed ? (
        <div
          className="rounded-xl p-6 text-center mb-6"
          style={{ background: "#E8F5E9" }}
          data-testid="booking-confirmed"
        >
          <CalendarCheck className="mx-auto mb-2" size={32} color="#2E7D32" />
          <p className="font-bold text-green-900">
            {confirmed.expert_name} との面談を予約しました
          </p>
          <p className="text-sm mt-2 text-green-800">{confirmed.slot_at}</p>
          {confirmed.share_handbook && (
            <p className="text-xs mt-3 text-green-700">
              お薬手帳・家族情報を専門家へ共有します（事実データの転送のみ）
            </p>
          )}
          <button
            type="button"
            onClick={handleNewBooking}
            className="mt-4 text-sm font-medium underline"
            style={{ color: PRIMARY }}
          >
            別の予約をする
          </button>
        </div>
      ) : (
        <>
          <h2 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
            <UserRound size={16} />
            専門家を選ぶ
          </h2>
          <div className="space-y-2 mb-6">
            {experts.map((expert) => (
              <button
                key={expert.id}
                type="button"
                onClick={() => setSelectedExpertId(expert.id)}
                className="w-full text-left bg-white rounded-xl shadow-sm p-4 border-2 transition-all"
                style={{
                  borderColor:
                    selectedExpertId === expert.id ? PRIMARY : "transparent",
                  background:
                    selectedExpertId === expert.id ? PRIMARY_SOFT : "#fff",
                }}
                data-testid="pharmacist-card"
              >
                <p className="font-bold text-sm">{expert.name}</p>
                <p className="text-xs text-gray-500">
                  {expert.title} · {expert.area} · ★{expert.rating.toFixed(1)}
                </p>
              </button>
            ))}
          </div>

          {selectedExpert && (
            <>
              <h2 className="font-semibold text-sm text-gray-700 mb-3">空き枠を選ぶ</h2>
              {slotsLoading ? (
                <div className="flex justify-center py-6 text-gray-400">
                  <Loader2 className="animate-spin" size={22} />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500 mb-6">空き枠がありません</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className="py-3 rounded-xl text-sm border transition-colors"
                      style={
                        selectedSlotId === slot.id
                          ? {
                              background: PRIMARY,
                              color: "#1f2937",
                              borderColor: PRIMARY,
                            }
                          : {
                              background: "#fff",
                              borderColor: "#e5e7eb",
                              color: "#374151",
                            }
                      }
                      data-testid="time-slot"
                    >
                      {slot.slot_at}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-start gap-3 mb-4 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareHandbook}
                  onChange={(e) => setShareHandbook(e.target.checked)}
                  className="mt-1"
                  data-testid="share-handbook-checkbox"
                />
                <span>
                  相談開始時にお薬手帳・家族の登録情報（事実データ）を専門家へ共有する
                </span>
              </label>

              <label className="block mb-6">
                <span className="text-xs text-gray-500 mb-1 block">相談メモ（任意）</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="相談したい内容など"
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                  data-testid="booking-notes"
                />
              </label>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedSlotId == null || submitting}
                className="w-full text-gray-900 py-4 rounded-xl font-semibold disabled:opacity-40"
                style={{ background: PRIMARY }}
                data-testid="confirm-booking-button"
              >
                {submitting ? "予約中…" : "予約を確定する"}
              </button>
            </>
          )}
        </>
      )}

      {bookings.length > 0 && !confirmed && (
        <section className="mt-10">
          <h2 className="font-semibold text-sm text-gray-700 mb-3">予約一覧</h2>
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="bg-white rounded-xl p-4 shadow-sm text-sm"
                data-testid="booking-item"
              >
                <p className="font-medium">
                  {b.expert_name}（{b.expert_title}）
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {b.slot_at} · {b.status}
                  {b.share_handbook ? " · 手帳共有あり" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
