import { useState } from "react";
import { EntityDTO } from "../api/client";

/* ── Styles ── */
const C = { primary: "#1E40AF", secondary: "#3B82F6", text: "#1E3A8A" };

const CAT_STYLE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-neutral-100 text-neutral-600",
  D: "bg-purple-100 text-purple-800",
  X: "bg-slate-100 text-slate-600",
};

const VERDICT_STYLE: Record<string, { bg: string; text: string }> = {
  GO: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  GO_CONDITIONAL: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  PIVOT: { bg: "bg-orange-50 border-orange-200", text: "text-orange-800" },
  NO_GO: { bg: "bg-red-50 border-red-200", text: "text-red-800" },
};

const VERDICT_LABEL: Record<string, string> = {
  GO: "GO — запускаем", GO_CONDITIONAL: "GO с условием",
  PIVOT: "PIVOT — менять оффер", NO_GO: "NO GO",
};

const TYPE_ICON: Record<string, string> = {
  verdict: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  segment: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  competitor: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18",
  risk: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z",
  plan: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
};

function Icon({ type }: { type: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={TYPE_ICON[type] || TYPE_ICON.plan} />
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="mb-2">
      <span className="text-[11px] text-neutral-400 uppercase tracking-wide">{label}</span>
      <div className="text-sm text-neutral-800 leading-relaxed">{value}</div>
    </div>
  );
}

/* ── Verdict card (always expanded) ── */
function VerdictCard({ d }: { d: any }) {
  const v = VERDICT_STYLE[d.verdict] || VERDICT_STYLE.NO_GO;
  return (
    <div className={`${v.bg} border-2 rounded-2xl p-5`}>
      <div className={`text-xl font-bold ${v.text} mb-2`}>{VERDICT_LABEL[d.verdict] || d.verdict}</div>
      {d.verdict_condition && <div className="text-sm text-neutral-700 mb-2">{d.verdict_condition}</div>}
      {d.positioning && <InfoRow label="Позиционирование" value={d.positioning} />}
      {d.main_insight && <InfoRow label="Главный инсайт" value={d.main_insight} />}
      {d.asymmetric_opportunity && <InfoRow label="Непропорциональная возможность" value={d.asymmetric_opportunity} />}
      {d.competitor_response && <InfoRow label="Как ответят конкуренты" value={d.competitor_response} />}
    </div>
  );
}

/* ── Generic expandable card ── */
export default function EntityCard({ entity, defaultOpen = false }: { entity: EntityDTO; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const d = entity.data;

  if (entity.type === "verdict") return <VerdictCard d={d} />;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-neutral-50/50 transition-colors"
      >
        <Icon type={entity.type} />
        <span className="flex-1 font-medium text-sm truncate" style={{ color: C.text }}>
          {entity.name}
        </span>

        {/* Segment badge */}
        {entity.type === "segment" && d.category && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CAT_STYLE[d.category] || ""}`}>
            {Math.round(d.total_score || 0)} · {d.category}
          </span>
        )}

        {/* Competitor pricing */}
        {entity.type === "competitor" && d.pricing && (
          <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{d.pricing}</span>
        )}

        {/* Risk score */}
        {entity.type === "risk" && (
          <span className="text-xs font-bold text-white px-2 py-0.5 rounded"
            style={{ background: d.score >= 15 ? "#EF4444" : d.score >= 10 ? "#F59E0B" : "#94A3B8" }}>
            {d.score}
          </span>
        )}

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8"
          strokeWidth="2" strokeLinecap="round"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-neutral-100 text-sm pt-3">
          {entity.type === "segment" && <SegmentBody d={d} />}
          {entity.type === "competitor" && <CompetitorBody d={d} />}
          {entity.type === "risk" && <RiskBody d={d} />}
          {entity.type === "plan" && <PlanBody d={d} />}
        </div>
      )}
    </div>
  );
}

/* ── Body renderers ── */

function SegmentBody({ d }: { d: any }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <InfoRow label="Когда возникает потребность" value={d.struggling_moment} />
        <InfoRow label="Что хочет сделать клиент" value={d.core_job} />
        <InfoRow label="Как привлечь внимание" value={d.key_message} />
        <InfoRow label="Где искать этих людей" value={d.main_channel} />
      </div>
      {/* 4 Forces */}
      {(d.force_added_value > 0 || d.force_barriers > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-emerald-50 rounded-lg p-2 text-xs">
            <div className="text-emerald-700 font-medium mb-1">За переключение</div>
            <div className="flex justify-between"><span>Ценность</span><span>{Math.round(d.force_added_value)}</span></div>
            <div className="flex justify-between"><span>Острота боли</span><span>{Math.round(d.force_problem_severity)}</span></div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-xs">
            <div className="text-red-700 font-medium mb-1">Против переключения</div>
            <div className="flex justify-between"><span>Барьеры</span><span>{Math.round(d.force_barriers)}</span></div>
            <div className="flex justify-between"><span>Привычка</span><span>{Math.round(d.force_habit_strength)}</span></div>
          </div>
        </div>
      )}
      {/* Devil's advocate */}
      {d.devils_advocate && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-xs text-red-800 mb-3">
          <span className="font-medium">Контраргумент: </span>{d.devils_advocate}
        </div>
      )}
      {/* Unit econ */}
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>LTV/CAC: <strong className={d.unit_econ?.ltv_cac >= 3 ? "text-emerald-600" : d.unit_econ?.ltv_cac >= 1 ? "text-amber-600" : "text-red-500"}>
          {(d.unit_econ?.ltv_cac || 0).toFixed(1)}</strong></span>
        <span>Окупаемость: {(d.unit_econ?.payback_months || 0).toFixed(1)} мес</span>
        {d.unit_econ?.is_fragile && <span className="text-orange-600 bg-orange-50 px-1.5 rounded">хрупкая</span>}
      </div>
    </>
  );
}

function CompetitorBody({ d }: { d: any }) {
  return (
    <>
      {d.positioning && <InfoRow label="Позиционирование" value={d.positioning} />}
      {d.strengths?.length > 0 && (
        <div className="mb-2">
          <span className="text-[11px] text-neutral-400 uppercase tracking-wide">Сильные</span>
          <ul className="text-xs text-neutral-700">{d.strengths.map((s: string, i: number) => <li key={i}>+ {s}</li>)}</ul>
        </div>
      )}
      {d.weaknesses?.length > 0 && (
        <div className="mb-2">
          <span className="text-[11px] text-neutral-400 uppercase tracking-wide">Слабые</span>
          <ul className="text-xs text-neutral-700">{d.weaknesses.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
        </div>
      )}
      {d.unmet_job && <div className="text-xs bg-amber-50 text-amber-800 rounded-lg px-2 py-1 mb-2">Что не закрывают: {d.unmet_job}</div>}
      {d.user_quotes?.length > 0 && (
        <div className="space-y-1 mb-2">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Отзывы</span>
          {d.user_quotes.map((q: string, i: number) => (
            <div key={i} className="text-xs text-neutral-700 bg-neutral-50 rounded-lg px-2 py-1 border-l-2 border-neutral-300 italic">"{q}"</div>
          ))}
        </div>
      )}
      {d.sources?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {d.sources.map((s: any, i: number) => {
            let domain = s.url;
            try { domain = new URL(s.url).hostname.replace("www.", ""); } catch {}
            return <a key={i} href={s.url} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#3B82F6] hover:underline bg-blue-50 rounded px-1.5 py-0.5">{domain}</a>;
          })}
        </div>
      )}
    </>
  );
}

function RiskBody({ d }: { d: any }) {
  return (
    <>
      <div className="text-neutral-400 text-xs mb-1">Вероятность: {d.probability}/5 · Последствия: {d.impact}/5</div>
      {d.metric && (
        <div className="text-xs text-neutral-600 mb-1">
          Метрика: <strong>{d.metric}</strong>
          {d.threshold && <> · Порог: <strong className="text-red-600">{d.threshold}</strong></>}
        </div>
      )}
      {d.experiment && (
        <div className="text-xs text-[#1E40AF] bg-[#1E40AF]/5 rounded-lg px-2.5 py-1.5">Как проверить: {d.experiment}</div>
      )}
    </>
  );
}

function PlanBody({ d }: { d: any }) {
  return (
    <>
      {d.next_three_steps?.length > 0 && (
        <div className="mb-3">
          <span className="text-[11px] text-neutral-400 uppercase tracking-wide">Следующие 3 шага</span>
          <ol className="space-y-1 mt-1">
            {d.next_three_steps.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: C.primary }}>{i + 1}</span>
                <span className="text-sm">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {d.plan_90d?.length > 0 && (
        <div>
          <span className="text-[11px] text-neutral-400 uppercase tracking-wide">90-дневный план</span>
          <div className="space-y-1 mt-1">
            {d.plan_90d.map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-2 bg-neutral-50 rounded-lg p-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ background: i === 0 ? C.primary : i === 1 ? C.secondary : "#94A3B8" }}>М{i + 1}</span>
                <span className="text-sm">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
