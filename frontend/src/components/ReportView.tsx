import { AnalysisReport, Segment } from "../api/client";

/* ── Colors from design system ── */
const C = {
  primary: "#1E40AF",
  secondary: "#3B82F6",
  cta: "#F59E0B",
  bg: "#F8FAFC",
  text: "#1E3A8A",
  muted: "#64748B",
};

const VERDICT_CFG: Record<
  string,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  GO: {
    label: "GO — запускаем",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  GO_CONDITIONAL: {
    label: "GO с условием",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  },
  PIVOT: {
    label: "PIVOT — менять оффер",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    icon: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  },
  NO_GO: {
    label: "NO GO",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
};

const CAT_STYLE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-amber-100 text-amber-800 border-amber-200",
  C: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const HEALTH_STYLE: Record<string, string> = {
  healthy: "text-emerald-600",
  moderate: "text-amber-600",
  unhealthy: "text-red-500",
};

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Здоровая",
  moderate: "Средняя",
  unhealthy: "Нездоровая",
};

/* ── Section wrapper ── */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
        <h2 className="text-sm font-semibold" style={{ color: C.text }}>
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ── KPI pill ── */
function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl px-4 py-3 text-center min-w-[120px]">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-lg font-semibold" style={{ color: C.text }}>
        {value}
      </div>
      {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Segment card ── */
function SegmentCard({ s, rank }: { s: Segment; rank: number }) {
  const medal = rank === 0 ? "1" : rank === 1 ? "2" : rank === 2 ? "3" : `${rank + 1}`;
  return (
    <div className="border border-neutral-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: C.primary }}
          >
            {medal}
          </span>
          <span className="font-medium text-sm truncate" style={{ color: C.text }}>
            {s.name}
          </span>
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${CAT_STYLE[s.category] || ""}`}
        >
          {s.category} · {Math.round(s.total_score)}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
        {s.struggling_moment && (
          <div className="col-span-full">
            <span className="text-neutral-500 text-xs block mb-0.5">Триггер</span>
            <span className="text-neutral-800">{s.struggling_moment}</span>
          </div>
        )}
        {s.core_job && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Задача</span>
            <span className="text-neutral-800">{s.core_job}</span>
          </div>
        )}
        {s.key_message && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Месседж</span>
            <span className="text-neutral-800">{s.key_message}</span>
          </div>
        )}
        {s.main_channel && (
          <div>
            <span className="text-neutral-500 text-xs block mb-0.5">Канал</span>
            <span className="text-neutral-800">{s.main_channel}</span>
          </div>
        )}
      </div>

      {/* Econ bar */}
      <div className="flex flex-wrap gap-3 text-xs pt-3 border-t border-neutral-100">
        <span>
          LTV/CAC:{" "}
          <strong className={HEALTH_STYLE[s.unit_econ.health] || ""}>
            {s.unit_econ.ltv_cac.toFixed(1)}
          </strong>
        </span>
        <span>Payback: {s.unit_econ.payback_months.toFixed(1)} мес</span>
        <span className={HEALTH_STYLE[s.unit_econ.health] || ""}>
          {HEALTH_LABEL[s.unit_econ.health] || s.unit_econ.health}
        </span>
      </div>

      {/* Score breakdown */}
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: "Job Fit", val: s.score_job_fit, w: 0.4 },
            { label: "Market", val: s.score_market_size, w: 0.25 },
            { label: "Econ", val: s.score_economics, w: 0.25 },
            { label: "Moat", val: s.score_moat, w: 0.1 },
          ].map((d) => (
            <div key={d.label} className="text-center">
              <div className="text-[10px] text-neutral-400">{d.label} (×{d.w})</div>
              <div className="text-xs font-medium" style={{ color: C.text }}>
                {Math.round(d.val)}
              </div>
              <div className="mt-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.val}%`, background: C.secondary }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main report ── */
export default function ReportView({ report }: { report: AnalysisReport }) {
  const v = VERDICT_CFG[report.verdict] || VERDICT_CFG.NO_GO;
  const segmentsSorted = [...report.segments].sort((a, b) => b.total_score - a.total_score);
  const aCount = report.segments.filter((s) => s.category === "A").length;
  const bCount = report.segments.filter((s) => s.category === "B").length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* ── Verdict hero ── */}
      <div className={`${v.bg} ${v.border} border-2 rounded-2xl p-6 shadow-sm`}>
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-full ${v.bg} flex items-center justify-center`}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={v.text}
            >
              <path d={v.icon} />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Вердикт анализа
            </div>
            <div className={`text-2xl font-bold ${v.text}`}>{v.label}</div>
            {report.verdict_condition && (
              <div className="text-sm mt-2 text-neutral-700">
                Условие: {report.verdict_condition}
              </div>
            )}
          </div>
        </div>

        {/* KPI row under verdict */}
        <div className="flex flex-wrap gap-3 mt-5">
          <KPI label="Сегментов" value={String(report.segments.length)} />
          <KPI label="Категория A" value={String(aCount)} sub="≥70 баллов" />
          <KPI label="Категория B" value={String(bCount)} sub="50-69 баллов" />
          <KPI label="Рисков" value={String(report.top_risks.length)} />
          <KPI label="Конкурентов" value={String(report.competitors.length)} />
        </div>
      </div>

      {/* ── Key insights row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.positioning && (
          <Section title="Позиционирование" icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
            <p className="text-sm text-neutral-800 leading-relaxed">{report.positioning}</p>
          </Section>
        )}
        {report.main_insight && (
          <Section title="Главный инсайт" icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z">
            <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
              {report.main_insight}
            </p>
          </Section>
        )}
      </div>

      {report.asymmetric_opportunity && (
        <Section title="Asymmetric Opportunity" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6">
          <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {report.asymmetric_opportunity}
          </p>
        </Section>
      )}

      {/* ── Segments ── */}
      {segmentsSorted.length > 0 && (
        <Section title={`Сегменты (${segmentsSorted.length})`} icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z">
          <div className="space-y-3">
            {segmentsSorted.map((s, i) => (
              <SegmentCard key={i} s={s} rank={i} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Risks ── */}
      {report.top_risks.length > 0 && (
        <Section title={`Топ рисков (${report.top_risks.length})`} icon="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z">
          <div className="space-y-3">
            {report.top_risks.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100"
              >
                <span
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    background:
                      r.score >= 15
                        ? "#EF4444"
                        : r.score >= 10
                          ? "#F59E0B"
                          : "#94A3B8",
                  }}
                >
                  {r.score}
                </span>
                <div className="flex-1 text-sm">
                  <div className="font-medium text-neutral-800 mb-1">{r.assumption}</div>
                  <div className="text-neutral-500 text-xs">
                    P={r.probability} × I={r.impact}
                  </div>
                  {r.experiment && (
                    <div className="mt-1.5 text-xs text-[#1E40AF] bg-[#1E40AF]/5 rounded-lg px-2.5 py-1.5">
                      Эксперимент: {r.experiment}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Competitors ── */}
      {report.competitors.length > 0 && (
        <Section title={`Конкуренты (${report.competitors.length})`} icon="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.competitors.map((c, i) => (
              <div
                key={i}
                className="border border-neutral-200 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm" style={{ color: C.text }}>
                    {c.name}
                  </span>
                  {c.pricing && (
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                      {c.pricing}
                    </span>
                  )}
                </div>
                {c.positioning && (
                  <div className="text-xs text-neutral-600 mb-2">{c.positioning}</div>
                )}
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs hover:underline cursor-pointer"
                    style={{ color: C.secondary }}
                  >
                    {c.url}
                  </a>
                )}
                {c.unmet_job && (
                  <div className="mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-2 py-1">
                    Незакрытое: {c.unmet_job}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Competitor Response ── */}
      {report.competitor_response && (
        <Section title="Реакция конкурентов" icon="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z">
          <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {report.competitor_response}
          </p>
        </Section>
      )}

      {/* ── Action plan ── */}
      {report.next_three_steps.length > 0 && (
        <Section title="Следующие 3 шага" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4">
          <ol className="space-y-2">
            {report.next_three_steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                  style={{ background: C.primary }}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-neutral-800">{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {report.plan_90d.length > 0 && (
        <Section title="90-дневный план" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
          <div className="space-y-2">
            {report.plan_90d.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg text-white"
                  style={{ background: i === 0 ? C.primary : i === 1 ? C.secondary : C.muted }}
                >
                  М{i + 1}
                </span>
                <span className="text-sm text-neutral-800">{s}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
