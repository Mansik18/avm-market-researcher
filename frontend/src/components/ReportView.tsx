import { useState } from "react";
import { AnalysisReport, Segment } from "../api/client";

/* ── Design tokens ── */
const C = {
  primary: "#1E40AF",
  secondary: "#3B82F6",
  bg: "#F8FAFC",
  text: "#1E3A8A",
  muted: "#64748B",
};

/* ── Verdict config ── */
const VERDICT_CFG: Record<
  string,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  GO: {
    label: "GO — запускаем",
    bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  GO_CONDITIONAL: {
    label: "GO с условием",
    bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  },
  PIVOT: {
    label: "PIVOT — менять оффер",
    bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800",
    icon: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  },
  NO_GO: {
    label: "NO GO",
    bg: "bg-red-50", border: "border-red-200", text: "text-red-800",
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
};

const CAT_STYLE: Record<string, { bg: string; label: string }> = {
  A: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "A — приоритет" },
  B: { bg: "bg-amber-100 text-amber-800 border-amber-200", label: "B — второй эшелон" },
  C: { bg: "bg-neutral-100 text-neutral-600 border-neutral-200", label: "C — отложить" },
};

const HEALTH_CFG: Record<string, { color: string; label: string }> = {
  healthy: { color: "text-emerald-600", label: "Здоровая" },
  moderate: { color: "text-amber-600", label: "Средняя" },
  unhealthy: { color: "text-red-500", label: "Слабая" },
};

/* ── Score axis explanations ── */
const SCORE_AXES = [
  { key: "job_fit", label: "Попадание в боль", color: "#1E40AF" },
  { key: "market_size", label: "Размер рынка", color: "#3B82F6" },
  { key: "economics", label: "Экономика", color: "#6366F1" },
  { key: "moat", label: "Конкурентное преимущество", color: "#8B5CF6" },
];

const SCORE_TOOLTIP = "Оценка по 4 факторам (0-100):\n• Попадание в боль — решает ли реальную проблему\n• Размер рынка — сколько людей готовы платить\n• Экономика — сходится ли юнит-экономика\n• Конкурентное преимущество — есть ли то, что сложно скопировать";

/* ── Helpers ── */
function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50/50 cursor-pointer hover:bg-neutral-50 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
        <h2 className="text-sm font-semibold flex-1 text-left" style={{ color: C.text }}>{title}</h2>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl px-4 py-3 text-center min-w-[100px]">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-lg font-semibold" style={{ color: C.text }}>{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-neutral-800 leading-relaxed">{value}</div>
    </div>
  );
}

/* ── Score bar with label ── */
function ScoreBar({ axis, value }: { axis: typeof SCORE_AXES[number]; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-600">{axis.label}</span>
        <span className="font-semibold" style={{ color: axis.color }}>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: axis.color }} />
      </div>
    </div>
  );
}

/* ── Segment card ── */
function SegmentCard({ s, rank }: { s: Segment; rank: number }) {
  const [expanded, setExpanded] = useState(rank < 3);
  const cat = CAT_STYLE[s.category] || CAT_STYLE.C;
  const health = HEALTH_CFG[s.unit_econ.health] || HEALTH_CFG.unhealthy;
  const scores = [s.score_job_fit, s.score_market_size, s.score_economics, s.score_moat];

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-neutral-50/50 transition-colors text-left"
      >
        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: C.primary }}>{rank + 1}</span>
        <span className="flex-1 min-w-0 font-medium text-sm truncate" style={{ color: C.text }}>
          {s.name}
        </span>
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cat.bg}`}
          title={SCORE_TOOLTIP}>
          {Math.round(s.total_score)} · {s.category}
        </span>
        <span className={`shrink-0 text-xs ${health.color}`}>
          LTV/CAC {s.unit_econ.ltv_cac.toFixed(1)}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted}
          strokeWidth="2" strokeLinecap="round" className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Details — expandable */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-neutral-100">
          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
            <InfoRow label="Когда возникает потребность" value={s.struggling_moment} />
            <InfoRow label="Что хочет сделать клиент" value={s.core_job} />
            <InfoRow label="Как привлечь внимание" value={s.key_message} />
            <InfoRow label="Где искать этих людей" value={s.main_channel} />
            {s.switch_story && <div className="col-span-full"><InfoRow label="Путь к покупке" value={s.switch_story} /></div>}
          </div>

          {/* Score breakdown */}
          <div className="pt-3 border-t border-neutral-100">
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
              Оценка привлекательности сегмента (0-100)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {SCORE_AXES.map((axis, i) => (
                <ScoreBar key={axis.key} axis={axis} value={scores[i]} />
              ))}
            </div>
          </div>

          {/* Devil's Advocate */}
          {s.devils_advocate && (
            <div className="mt-3 pt-3 border-t border-neutral-100">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                </svg>
                <div>
                  <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide mb-0.5">Контраргумент</div>
                  <div className="text-xs text-red-800 leading-relaxed">{s.devils_advocate}</div>
                </div>
              </div>
            </div>
          )}

          {/* Unit economics */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-3 mt-3 border-t border-neutral-100">
            <span className="text-neutral-500">
              LTV/CAC: <strong className={health.color}>{s.unit_econ.ltv_cac.toFixed(1)}</strong>
            </span>
            <span className="text-neutral-500">
              Окупаемость: <strong>{s.unit_econ.payback_months.toFixed(1)} мес</strong>
            </span>
            <span className={`${health.color}`}>
              Экономика: {health.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/*  MAIN REPORT                                                     */
/* ══════════════════════════════════════════════════════════════════ */
interface ReportViewProps {
  report: AnalysisReport;
  versions?: { version: number; created_at: string | null; current?: boolean }[];
  currentVersion?: number;
  onVersionChange?: (v: number) => void;
}

type ReportTab = "summary" | "segments" | "competitors" | "plan";

const REPORT_TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id: "summary", label: "Сводка", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "segments", label: "Сегменты", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "competitors", label: "Конкуренты", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
  { id: "plan", label: "Риски и план", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
];

export default function ReportView({ report, versions, currentVersion, onVersionChange }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const v = VERDICT_CFG[report.verdict] || VERDICT_CFG.NO_GO;
  const segmentsSorted = [...report.segments].sort((a, b) => b.total_score - a.total_score);
  const aCount = report.segments.filter((s) => s.category === "A").length;
  const bCount = report.segments.filter((s) => s.category === "B").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

      {/* ── Top bar: version selector + tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1 overflow-x-auto">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.id
                  ? "bg-white shadow-sm text-[#1E3A8A]"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* Version selector — visible when any versions exist */}
        {versions && versions.length >= 1 && onVersionChange && (
          <select
            value={currentVersion ?? versions[versions.length - 1]?.version}
            onChange={(e) => onVersionChange(Number(e.target.value))}
            className="text-xs bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:border-[#3B82F6] outline-none"
          >
            {versions.map((ver) => (
              <option key={ver.version} value={ver.version}>
                v{ver.version}{ver.current ? " (текущая)" : ""}{ver.created_at ? ` — ${new Date(ver.created_at).toLocaleString("ru-RU")}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Verdict hero — always visible ── */}
      <div className={`${v.bg} ${v.border} border-2 rounded-2xl p-5 shadow-sm mb-5`}>
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-10 h-10 rounded-full ${v.bg} flex items-center justify-center`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={v.text}>
              <path d={v.icon} />
            </svg>
          </div>
          <div className="flex-1">
            <div className={`text-xl font-bold ${v.text}`}>{v.label}</div>
            {report.verdict_condition && (
              <div className="text-sm mt-1 text-neutral-700">{report.verdict_condition}</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <KPI label="Сегментов" value={String(report.segments.length)} />
          <KPI label="A" value={String(aCount)} sub="приоритет" />
          <KPI label="B" value={String(bCount)} sub="второй" />
          <KPI label="Рисков" value={String(report.top_risks.length)} />
          <KPI label="Конкурентов" value={String(report.competitors.length)} />
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/*  TAB: SUMMARY                             */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.positioning && (
              <Section title="Позиционирование" icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
                <p className="text-sm text-neutral-800 leading-relaxed">{report.positioning}</p>
              </Section>
            )}
            {report.main_insight && (
              <Section title="Главный инсайт" icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{report.main_insight}</p>
              </Section>
            )}
          </div>
          {report.asymmetric_opportunity && (
            <Section title="Непропорциональная возможность" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6">
              <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{report.asymmetric_opportunity}</p>
            </Section>
          )}
          {report.competitor_response && (
            <Section title="Как ответят конкуренты" icon="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z">
              <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{report.competitor_response}</p>
            </Section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/*  TAB: SEGMENTS                            */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "segments" && (
        <div className="space-y-2">
          {segmentsSorted.length === 0 && (
            <div className="text-center py-12 text-neutral-500">Сегменты не найдены</div>
          )}
          {segmentsSorted.map((s, i) => (
            <SegmentCard key={i} s={s} rank={i} />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/*  TAB: COMPETITORS                         */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "competitors" && (
        <div className="space-y-4">
          {report.competitors.length === 0 && (
            <div className="text-center py-12 text-neutral-500">Конкуренты не найдены</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.competitors.map((c, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm" style={{ color: C.text }}>{c.name}</span>
                  {c.pricing && (
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{c.pricing}</span>
                  )}
                </div>
                {c.positioning && <div className="text-xs text-neutral-600 mb-2">{c.positioning}</div>}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer"
                    className="text-xs hover:underline cursor-pointer block mb-2" style={{ color: C.secondary }}>{c.url}</a>
                )}
                {(c.strengths.length > 0 || c.weaknesses.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    {c.strengths.length > 0 && (
                      <div>
                        <div className="text-neutral-400 mb-1">Сильные стороны</div>
                        <ul className="space-y-0.5">{c.strengths.map((s, j) => <li key={j} className="text-neutral-700">+ {s}</li>)}</ul>
                      </div>
                    )}
                    {c.weaknesses.length > 0 && (
                      <div>
                        <div className="text-neutral-400 mb-1">Слабые стороны</div>
                        <ul className="space-y-0.5">{c.weaknesses.map((s, j) => <li key={j} className="text-neutral-700">- {s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
                {c.unmet_job && (
                  <div className="mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-2 py-1">
                    Что не закрывают: {c.unmet_job}
                  </div>
                )}
                {c.sources && c.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.sources.map((src, j) => (
                      <a key={j} href={src.url} target="_blank" rel="noreferrer"
                        className="text-[10px] text-[#3B82F6] hover:underline bg-blue-50 rounded px-1.5 py-0.5 cursor-pointer"
                        title={src.title || src.url}>
                        {new URL(src.url).hostname.replace("www.", "")}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/*  TAB: RISKS & PLAN                        */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === "plan" && (
        <div className="space-y-5">
          {/* Sources — all Exa URLs used in this analysis */}
          {report.sources && report.sources.length > 0 && (
            <Section title={`Источники данных (${report.sources.length})`} icon="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.21a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5">
                {report.sources.map((src, i) => {
                  let domain = src.url;
                  try { domain = new URL(src.url).hostname.replace("www.", ""); } catch {}
                  return (
                    <a key={i} href={src.url} target="_blank" rel="noreferrer"
                      className="text-xs text-[#3B82F6] hover:underline bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 cursor-pointer"
                      title={src.title || src.url}>
                      {domain}
                    </a>
                  );
                })}
              </div>
            </Section>
          )}
          {/* Risks */}
          {report.top_risks.length > 0 && (
            <Section title={`Рискованные допущения (${report.top_risks.length})`} icon="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z">
              <p className="text-xs text-neutral-500 mb-3">
                Что мы предполагаем как правду, но не проверили. Чем выше балл — тем опаснее. Для каждого предложен эксперимент.
              </p>
              <div className="space-y-2">
                {report.top_risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: r.score >= 15 ? "#EF4444" : r.score >= 10 ? "#F59E0B" : "#94A3B8" }}>
                      {r.score}
                    </span>
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-neutral-800 mb-0.5">{r.assumption}</div>
                      <div className="text-neutral-400 text-xs mb-1.5">
                        Вероятность: {r.probability}/5 · Последствия: {r.impact}/5
                      </div>
                      {r.experiment && (
                        <div className="text-xs text-[#1E40AF] bg-[#1E40AF]/5 rounded-lg px-2.5 py-1.5">
                          Как проверить: {r.experiment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Next steps */}
          {report.next_three_steps.length > 0 && (
            <Section title="Следующие 3 шага" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4">
              <ol className="space-y-2">
                {report.next_three_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                      style={{ background: C.primary }}>{i + 1}</span>
                    <span className="text-sm text-neutral-800">{s}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* 90-day plan */}
          {report.plan_90d.length > 0 && (
            <Section title="План на 90 дней" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
              <div className="space-y-2">
                {report.plan_90d.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg text-white"
                      style={{ background: i === 0 ? C.primary : i === 1 ? C.secondary : C.muted }}>
                      М{i + 1}
                    </span>
                    <span className="text-sm text-neutral-800">{s}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
