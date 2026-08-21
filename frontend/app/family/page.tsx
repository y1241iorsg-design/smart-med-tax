"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  createFamilyMember,
  createPrescription,
  deleteFamilyMember,
  deletePrescription,
  getConditionOptions,
  getFamily,
  getPrescriptions,
  getRxCatalog,
  updateFamilyMember,
  type FamilyMember,
  type Prescription,
  type RxCatalogItem,
} from "@/lib/api";

type FamilyForm = {
  name: string;
  relationship: string;
  conditions: string[];
  currentMedications: string;
  allergies: string;
};

const EMPTY_FORM: FamilyForm = {
  name: "",
  relationship: "",
  conditions: [],
  currentMedications: "",
  allergies: "",
};

function splitItems(value: string): string[] {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinItems(items: string[]): string {
  return items.join("、");
}

function DetailRow({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-xs text-gray-700">
        {items.length > 0 ? items.join("、") : "登録なし"}
      </dd>
    </div>
  );
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [rxCatalog, setRxCatalog] = useState<RxCatalogItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FamilyForm>(EMPTY_FORM);
  const [rxMember, setRxMember] = useState("自分");
  const [rxCode, setRxCode] = useState("");
  const [rxSaving, setRxSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getFamily(),
      getConditionOptions(),
      getRxCatalog(),
      getPrescriptions(),
    ])
      .then(([family, options, catalog, rxList]) => {
        setMembers(family);
        setConditionOptions(options);
        setRxCatalog(catalog);
        setPrescriptions(rxList);
        if (family[0]) setRxMember(family[0].name);
        if (catalog[0]) setRxCode(catalog[0].code);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(member: FamilyMember) {
    setEditingId(member.id);
    setForm({
      name: member.name,
      relationship: member.relationship ?? "",
      conditions: [...member.conditions],
      currentMedications: joinItems(member.current_medications),
      allergies: joinItems(member.allergies),
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function toggleCondition(label: string) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.includes(label)
        ? current.conditions.filter((item) => item !== label)
        : [...current.conditions, label],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("名前を入力してください");
      return;
    }

    const data = {
      name,
      relationship: form.relationship.trim() || null,
      conditions: form.conditions,
      current_medications: splitItems(form.currentMedications),
      allergies: splitItems(form.allergies),
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        const created = await createFamilyMember(data);
        setMembers((current) => [...current, created]);
      } else {
        const updated = await updateFamilyMember(editingId, data);
        setMembers((current) =>
          current.map((member) =>
            member.id === editingId ? updated : member,
          ),
        );
      }
      closeForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: FamilyMember) {
    if (
      member.name === "自分" ||
      !window.confirm(`「${member.name}」を家族情報から削除しますか？`)
    ) {
      return;
    }

    setError(null);
    try {
      await deleteFamilyMember(member.id);
      setMembers((current) =>
        current.filter((item) => item.id !== member.id),
      );
      if (editingId === member.id) closeForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleAddPrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rxCode) return;
    setRxSaving(true);
    setError(null);
    try {
      const created = await createPrescription({
        family_member_name: rxMember,
        rx_code: rxCode,
      });
      setPrescriptions((current) => [created, ...current]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "処方薬の登録に失敗しました");
    } finally {
      setRxSaving(false);
    }
  }

  async function handleDeletePrescription(item: Prescription) {
    if (!window.confirm(`「${item.name}」の登録を削除しますか？`)) return;
    try {
      await deletePrescription(item.id);
      setPrescriptions((current) =>
        current.filter((rx) => rx.id !== item.id),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="bg-white px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">家族情報</h1>
            <p className="text-[11px] text-gray-500">
              同じ端末・同じアプリ内で家族の記録を共有・集計します
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-900 transition-colors"
            style={{ background: "#FFCCBC" }}
            aria-label="家族を追加"
            data-testid="family-add-button"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-5 py-4">
        <div
          className="mb-4 rounded-2xl p-3 text-[11px] leading-relaxed text-gray-600"
          style={{ background: "#E3F2FD" }}
        >
          家族を登録すると、お薬手帳・税制集計・検索時の持病注意表示を家族ごとにまとめられます。
          クラウドのアカウント連携は未対応で、この端末のアプリデータが共有の単位です。
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-4 rounded-2xl bg-white p-4 shadow-sm"
          >
            <h2 className="mb-3 text-sm font-bold text-gray-800">
              {editingId === null ? "家族を追加" : "家族情報を編集"}
            </h2>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-700">
                名前 <span className="text-red-600">*</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FFCCBC]"
                  placeholder="例：母"
                  maxLength={40}
                  required
                  data-testid="family-name-input"
                />
              </label>

              <label className="block text-xs font-medium text-gray-700">
                続柄
                <input
                  type="text"
                  value={form.relationship}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      relationship: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FFCCBC]"
                  placeholder="例：母親"
                />
              </label>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-700">
                  持病・注意事項（問診表から選択）
                </p>
                <div className="flex flex-wrap gap-1.5" data-testid="condition-checklist">
                  {conditionOptions.map((option) => {
                    const selected = form.conditions.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleCondition(option)}
                        className={`rounded-full px-2.5 py-1 text-[11px] ${
                          selected
                            ? "font-semibold text-gray-900"
                            : "bg-gray-100 text-gray-600"
                        }`}
                        style={selected ? { background: "#FFCCBC" } : undefined}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              {[
                {
                  key: "currentMedications" as const,
                  label: "服用中（OTCなど）",
                  placeholder: "例：A解熱鎮痛薬、I胃腸薬",
                },
                {
                  key: "allergies" as const,
                  label: "アレルギー",
                  placeholder: "例：そば、乳製品",
                },
              ].map((field) => (
                <label
                  key={field.key}
                  className="block text-xs font-medium text-gray-700"
                >
                  {field.label}
                  <input
                    type="text"
                    value={form[field.key]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FFCCBC]"
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>

            <p className="mt-2 text-[10px] text-gray-400">
              服用中・アレルギーは複数ある場合「、」で区切ってください
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-600 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-medium text-gray-900 disabled:opacity-50"
                style={{ background: "#FFCCBC" }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId === null ? (
                  "追加する"
                ) : (
                  "更新する"
                )}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: "#FFCCBC" }}
            />
          </div>
        ) : (
          <>
            <div className="space-y-3" data-testid="family-list">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl p-4"
                  style={{ background: "#FFF3E0" }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                        <Users
                          className="h-5 w-5"
                          style={{ color: "#FFCCBC" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-gray-800">
                          {member.name}
                        </h2>
                        <p className="text-[11px] text-gray-500">
                          {member.relationship || "続柄未登録"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(member)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-gray-600"
                        aria-label={`${member.name}の情報を編集`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {member.name !== "自分" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(member)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-red-600"
                          aria-label={`${member.name}を削除`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <dl className="grid gap-2 border-t border-[#B2DFDB] pt-3">
                    <DetailRow label="持病・注意事項" items={member.conditions} />
                    <DetailRow
                      label="服用中（OTCなど）"
                      items={member.current_medications}
                    />
                    <DetailRow label="アレルギー" items={member.allergies} />
                    <DetailRow
                      label="処方薬（登録のみ）"
                      items={prescriptions
                        .filter((rx) => rx.family_member_name === member.name)
                        .map((rx) => rx.name)}
                    />
                  </dl>
                </article>
              ))}
            </div>

            <section
              className="mt-5 rounded-2xl p-4"
              style={{ background: "#F3E5F5" }}
              data-testid="prescription-section"
            >
              <h2 className="mb-1 text-sm font-bold text-gray-800">
                処方薬の登録（高齢家族の管理用）
              </h2>
              <p className="mb-3 text-[11px] text-gray-500">
                診断・推奨は行いません。記録用のダミー名称から選んで登録できます。
              </p>
              <form onSubmit={handleAddPrescription} className="space-y-2">
                <label className="block text-xs text-gray-700">
                  対象の家族
                  <select
                    value={rxMember}
                    onChange={(e) => setRxMember(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gray-700">
                  処方薬（ダミー名）
                  <select
                    value={rxCode}
                    onChange={(e) => setRxCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    data-testid="rx-select"
                  >
                    {rxCatalog.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}（{item.category}）
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={rxSaving || !rxCode}
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-900 disabled:opacity-50"
                  style={{ background: "#E1BEE7" }}
                >
                  {rxSaving ? "登録中..." : "処方薬を登録"}
                </button>
              </form>

              <ul className="mt-3 space-y-2">
                {prescriptions.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {item.family_member_name} / {item.category}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePrescription(item)}
                      className="text-red-600"
                      aria-label={`${item.name}を削除`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {members.length <= 1 && (
              <div className="flex flex-col items-center py-10 text-center">
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "#FFF3E0" }}
                >
                  <Users className="h-7 w-7 text-gray-500" />
                </div>
                <p className="mb-1 text-sm text-gray-600">
                  家族の情報も登録できます
                </p>
                <p className="mb-4 text-xs text-gray-400">
                  持病・処方薬・税制対象購入を家族ごとにまとめられます
                </p>
                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "#FFCCBC" }}
                >
                  家族を追加
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
