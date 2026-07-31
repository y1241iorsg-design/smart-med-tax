"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  createFamilyMember,
  deleteFamilyMember,
  getFamily,
  updateFamilyMember,
  type FamilyMember,
} from "@/lib/api";

type FamilyForm = {
  name: string;
  relationship: string;
  conditions: string;
  currentMedications: string;
  allergies: string;
};

const EMPTY_FORM: FamilyForm = {
  name: "",
  relationship: "",
  conditions: "",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FamilyForm>(EMPTY_FORM);

  useEffect(() => {
    getFamily()
      .then(setMembers)
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
      conditions: joinItems(member.conditions),
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
      conditions: splitItems(form.conditions),
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

  return (
    <div className="animate-fade-in">
      <header className="bg-white px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">家族情報</h1>
            <p className="text-[11px] text-gray-500">
              家族ごとの情報をまとめて管理
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors"
            style={{ background: "#1565C0" }}
            aria-label="家族を追加"
            data-testid="family-add-button"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-5 py-4">
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
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
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
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
                  placeholder="例：母親"
                />
              </label>

              {[
                {
                  key: "conditions" as const,
                  label: "持病",
                  placeholder: "例：高血圧、花粉症",
                },
                {
                  key: "currentMedications" as const,
                  label: "服用中",
                  placeholder: "例：薬の名前を「、」で区切って入力",
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
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>

            <p className="mt-2 text-[10px] text-gray-400">
              複数ある場合は「、」で区切って入力してください
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
                className="flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#1565C0" }}
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
              style={{ color: "#1565C0" }}
            />
          </div>
        ) : (
          <>
            <div className="space-y-3" data-testid="family-list">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl p-4"
                  style={{ background: "#E3F2FD" }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                        <Users
                          className="h-5 w-5"
                          style={{ color: "#1565C0" }}
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

                  <dl className="grid gap-2 border-t border-blue-200 pt-3">
                    <DetailRow label="持病" items={member.conditions} />
                    <DetailRow
                      label="服用中"
                      items={member.current_medications}
                    />
                    <DetailRow label="アレルギー" items={member.allergies} />
                  </dl>
                </article>
              ))}
            </div>

            {members.length <= 1 && (
              <div className="flex flex-col items-center py-10 text-center">
                <div
                  className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "#E3F2FD" }}
                >
                  <Users className="h-7 w-7 text-gray-500" />
                </div>
                <p className="mb-1 text-sm text-gray-600">
                  家族の情報も登録できます
                </p>
                <p className="mb-4 text-xs text-gray-400">
                  必要な情報を家族ごとにまとめておきましょう
                </p>
                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "#1565C0" }}
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
