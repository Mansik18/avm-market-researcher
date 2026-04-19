import { useState } from "react";
import { PendingEditDTO, api } from "../api/client";

const FIELD_LABELS: Record<string, string> = {
  description: "Описание продукта",
  audience: "Аудитория",
  geography: "География",
  stage: "Стадия",
  price: "Цена",
  paying_customers: "Платящих клиентов",
  big_job: "Главная задача",
  pain_points: "Боли",
  current_solutions: "Текущие решения",
  competitors_mentioned: "Конкуренты",
  segment_hypotheses: "Гипотезы сегментов",
  notes: "Заметки",
};

function fmt(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  return String(v);
}

interface Props {
  projectId: number;
  edits: PendingEditDTO[];
  onChange: () => void;
}

export default function PendingEditsBanner({ projectId, edits, onChange }: Props) {
  const [busy, setBusy] = useState<number | null>(null);

  if (edits.length === 0) return null;

  const handleApprove = async (id: number) => {
    setBusy(id);
    try {
      await api.approveEdit(projectId, id);
      onChange();
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (id: number) => {
    setBusy(id);
    try {
      await api.rejectEdit(projectId, id);
      onChange();
    } finally {
      setBusy(null);
    }
  };

  const handleApproveAll = async () => {
    setBusy(-1);
    try {
      for (const e of edits) {
        await api.approveEdit(projectId, e.id);
      }
      onChange();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-3 sm:mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-amber-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z"/>
          </svg>
          Агент предлагает изменения ({edits.length})
        </div>
        {edits.length > 1 && (
          <button
            onClick={handleApproveAll}
            disabled={busy !== null}
            className="text-xs text-amber-900 hover:underline cursor-pointer disabled:opacity-50"
          >
            Принять все
          </button>
        )}
      </div>

      <div className="space-y-2">
        {edits.map((e) => (
          <div key={e.id} className="bg-white border border-amber-100 rounded-lg p-3">
            <div className="text-xs font-medium text-neutral-500 mb-1">
              {FIELD_LABELS[e.field] || e.field}
            </div>
            <div className="flex items-center gap-2 text-sm mb-2 flex-wrap">
              <span className="text-neutral-400 line-through truncate max-w-[200px]">{fmt(e.old_value)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8"
                strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              <span className="text-neutral-900 font-medium">{fmt(e.new_value)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(e.id)}
                disabled={busy !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg px-3 py-1 cursor-pointer disabled:opacity-50"
              >
                {busy === e.id ? "…" : "Принять"}
              </button>
              <button
                onClick={() => handleReject(e.id)}
                disabled={busy !== null}
                className="bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs rounded-lg px-3 py-1 cursor-pointer disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
