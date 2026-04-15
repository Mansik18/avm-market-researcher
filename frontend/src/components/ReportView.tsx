import { AnalysisReport } from "../api/client";

const VERDICT_LABEL: Record<string, string> = {
  GO: "GO — запускаем",
  GO_CONDITIONAL: "GO с условием",
  PIVOT: "PIVOT — менять оффер",
  NO_GO: "NO GO",
};

const VERDICT_COLOR: Record<string, string> = {
  GO: "bg-emerald-50 border-emerald-200 text-emerald-800",
  GO_CONDITIONAL: "bg-amber-50 border-amber-200 text-amber-800",
  PIVOT: "bg-orange-50 border-orange-200 text-orange-800",
  NO_GO: "bg-red-50 border-red-200 text-red-800",
};

const CAT_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-neutral-100 text-neutral-700",
};

export default function ReportView({ report }: { report: AnalysisReport }) {
  const segmentsSorted = [...report.segments].sort((a, b) => b.total_score - a.total_score);
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div
        className={`border rounded-2xl p-5 shadow-sm ${VERDICT_COLOR[report.verdict]}`}
      >
        <div className="text-xs uppercase tracking-wider mb-1">Вердикт</div>
        <div className="text-2xl font-semibold">{VERDICT_LABEL[report.verdict] || report.verdict}</div>
        {report.verdict_condition && (
          <div className="text-sm mt-2">Условие: {report.verdict_condition}</div>
        )}
      </div>

      {report.positioning && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Позиционирование</h2>
          <div className="text-base">{report.positioning}</div>
        </section>
      )}

      {report.main_insight && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Главный инсайт</h2>
          <div className="text-base whitespace-pre-wrap">{report.main_insight}</div>
        </section>
      )}

      {report.asymmetric_opportunity && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Asymmetric Opportunity</h2>
          <div className="text-base whitespace-pre-wrap">{report.asymmetric_opportunity}</div>
        </section>
      )}

      {segmentsSorted.length > 0 && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Сегменты</h2>
          <div className="space-y-3">
            {segmentsSorted.map((s, i) => (
              <div key={i} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-medium flex-1">{s.name}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${CAT_COLOR[s.category] || ""}`}>
                    {s.category} · {Math.round(s.total_score)}
                  </span>
                </div>
                {s.struggling_moment && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <span className="text-neutral-500">Триггер: </span>{s.struggling_moment}
                  </div>
                )}
                {s.core_job && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <span className="text-neutral-500">Главная задача: </span>{s.core_job}
                  </div>
                )}
                {s.key_message && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <span className="text-neutral-500">Месседж: </span>{s.key_message}
                  </div>
                )}
                {s.main_channel && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <span className="text-neutral-500">Канал: </span>{s.main_channel}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 text-xs text-neutral-500 mt-2">
                  <span>LTV/CAC: {s.unit_econ.ltv_cac.toFixed(1)}</span>
                  <span>Payback: {s.unit_econ.payback_months.toFixed(1)} мес</span>
                  <span>{s.unit_econ.health}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.top_risks.length > 0 && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Топ рисков (RAT)</h2>
          <ol className="space-y-2">
            {report.top_risks.map((r, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium">
                  {r.assumption} <span className="text-neutral-500">· P×I = {r.score}</span>
                </div>
                <div className="text-neutral-600">Эксперимент: {r.experiment}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.competitors.length > 0 && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Конкуренты</h2>
          <div className="space-y-2">
            {report.competitors.map((c, i) => (
              <div key={i} className="border border-border rounded-xl p-3 text-sm">
                <div className="font-medium">
                  {c.name}
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-accent hover:underline text-xs"
                    >
                      {c.url}
                    </a>
                  )}
                </div>
                {c.positioning && <div className="text-neutral-600">{c.positioning}</div>}
                {c.pricing && <div className="text-neutral-500 text-xs mt-1">Цена: {c.pricing}</div>}
                {c.unmet_job && (
                  <div className="text-xs mt-1">
                    <span className="text-neutral-500">Незакрытый job: </span>{c.unmet_job}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {report.next_three_steps.length > 0 && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Следующие 3 шага</h2>
          <ol className="space-y-1 list-decimal list-inside text-sm">
            {report.next_three_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {report.plan_90d.length > 0 && (
        <section className="bg-panel border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">90-дневный план</h2>
          <ul className="space-y-1 text-sm">
            {report.plan_90d.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
