import { useEffect, useState } from "react";
import { api } from "../api/client";

const PHASE_LABELS: Record<string, string> = {
  starting: "Запускаю…",
  market_research: "Собираю данные",
  segmentation: "Строю сегменты",
  deep_dive: "Глубокий анализ топ-5",
  synthesis: "Синтезирую отчёт",
  complete: "Готово",
};

const ALL_PHASES = ["market_research", "segmentation", "deep_dive", "synthesis"];

interface Props {
  projectId: number;
  runId: number;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export default function RunStream({ projectId, runId, onComplete, onError }: Props) {
  const [phase, setPhase] = useState("starting");
  const [detail, setDetail] = useState("Запускаю…");

  useEffect(() => {
    const url = api.runStreamUrl(projectId, runId);
    const es = new EventSource(url);

    es.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse(e.data);
        setPhase(d.phase || "starting");
        setDetail(d.detail || PHASE_LABELS[d.phase] || d.phase);
        if (d.status === "done") {
          es.close();
          onComplete();
        }
        if (d.status === "error") {
          es.close();
          onError(d.error || "Ошибка анализа");
        }
      } catch {}
    });

    es.onerror = () => {
      es.close();
      // Fallback: poll once to check if run is actually done
      api.getRun(projectId, runId).then((run) => {
        if (run.status === "done") onComplete();
        else if (run.status === "error") onError(run.error || "Ошибка");
        else onError("Потеряно соединение с сервером");
      }).catch(() => onError("Потеряно соединение"));
    };

    return () => es.close();
  }, [projectId, runId]);

  const currentIdx = ALL_PHASES.indexOf(phase);

  return (
    <div className="px-4 sm:px-6 py-6 border-t border-border bg-[#1E40AF]/5">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin" />
          <div className="text-base font-medium text-[#1E40AF]">Анализирую рынок</div>
        </div>
        <ol className="space-y-2.5">
          {ALL_PHASES.map((p, i) => {
            const state =
              phase === "complete"
                ? "done"
                : i < currentIdx
                  ? "done"
                  : i === currentIdx
                    ? "active"
                    : "pending";
            return (
              <li key={p} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    state === "done"
                      ? "bg-emerald-500"
                      : state === "active"
                        ? "bg-[#1E40AF] animate-pulse"
                        : "bg-neutral-300"
                  }`}
                />
                <span className={state === "pending" ? "text-neutral-400" : "text-neutral-800"}>
                  {PHASE_LABELS[p] || p}
                </span>
                {state === "active" && detail && (
                  <span className="text-xs text-neutral-500 ml-auto truncate max-w-[200px]">
                    {detail}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
