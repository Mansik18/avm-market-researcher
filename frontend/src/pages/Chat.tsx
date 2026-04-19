import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow, { Message } from "../components/ChatWindow";
import MessageInput from "../components/MessageInput";
import ReportView from "../components/ReportView";
import EntityCanvas from "../components/EntityCanvas";
import RunStream from "../components/RunStream";
import PendingEditsBanner from "../components/PendingEditsBanner";
import {
  AnalysisReport,
  EntityDTO,
  HistoryMessage,
  PendingEditDTO,
  Project,
  ProjectContextOut,
  api,
} from "../api/client";

const PROJECT_KEY = "avm_current_project";

type Tab = "chat" | "report";

export default function Chat() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(() => {
    const v = localStorage.getItem(PROJECT_KEY);
    return v ? Number(v) : null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ProjectContextOut | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [reportVersions, setReportVersions] = useState<{ version: number; created_at: string | null; current?: boolean }[]>([]);
  const [currentReportVersion, setCurrentReportVersion] = useState<number | undefined>();
  const [tab, setTab] = useState<Tab>("chat");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [entities, setEntities] = useState<EntityDTO[]>([]);
  const [pendingEdits, setPendingEdits] = useState<PendingEditDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
      if (data.length > 0 && currentProjectId == null) {
        setCurrentProjectId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить проекты");
    }
  }, [currentProjectId]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (currentProjectId != null) {
      localStorage.setItem(PROJECT_KEY, String(currentProjectId));
    }
  }, [currentProjectId]);

  // Load conversation + context when project changes
  useEffect(() => {
    if (currentProjectId == null) {
      setMessages([]);
      setContext(null);
      setReport(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [ctx, hist] = await Promise.all([
          api.getContext(currentProjectId),
          api.getHistory(currentProjectId),
        ]);
        if (!alive) return;
        setContext(ctx);
        setMessages(
          hist.messages.map((m: HistoryMessage, i: number) => ({
            id: `${currentProjectId}-${i}`,
            role: m.role,
            content: m.content,
          }))
        );
        if (ctx.has_report) {
          const [r, v, ents] = await Promise.all([
            api.getReport(currentProjectId),
            api.getReportVersions(currentProjectId),
            api.getEntities(currentProjectId),
          ]);
          if (alive) {
            setReport(r);
            setReportVersions(v.versions);
            setCurrentReportVersion(v.versions.find((x) => x.current)?.version);
            setEntities(ents);
          }
        } else {
          setReport(null);
          setReportVersions([]);
          setCurrentReportVersion(undefined);
          setEntities([]);
        }
        // Load pending edits (agent proposals awaiting approval)
        try {
          const pe = await api.listPendingEdits(currentProjectId);
          if (alive) setPendingEdits(pe);
        } catch {}
        // If there's no history yet — trigger the cold-start greeting
        if (hist.messages.length === 0) {
          const res = await api.intakeTurn(currentProjectId, "");
          if (!alive) return;
          setMessages([
            {
              id: `${currentProjectId}-0`,
              role: "assistant",
              content: res.assistant_message.content,
            },
          ]);
          setContext(res.context);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentProjectId]);

  const createProject = async (name: string) => {
    const p = await api.createProject(name);
    await refreshProjects();
    setCurrentProjectId(p.id);
    setTab("chat");
  };

  const deleteProject = async (id: number) => {
    await api.deleteProject(id);
    if (id === currentProjectId) setCurrentProjectId(null);
    await refreshProjects();
  };

  const send = async (text: string) => {
    if (currentProjectId == null) return;
    setError(null);
    const userMsg: Message = {
      id: `${currentProjectId}-u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const res = await api.intakeTurn(currentProjectId, text);
      const botMsg: Message = {
        id: `${currentProjectId}-a-${Date.now()}`,
        role: "assistant",
        content: res.assistant_message.content,
      };
      setMessages((prev) => [...prev, botMsg]);
      setContext(res.context);
      // Refresh pending edits — agent may have proposed new changes
      try {
        const pe = await api.listPendingEdits(currentProjectId);
        setPendingEdits(pe);
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setChatLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (currentProjectId == null) return;
    setError(null);
    try {
      const run = await api.startRun(currentProjectId);
      setActiveRunId(run.id);
      setTab("chat"); // stay on chat tab to show RunStream
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить анализ");
    }
  };

  const onRunComplete = async () => {
    if (currentProjectId == null) return;
    try {
      const [ents, ctx, v] = await Promise.all([
        api.getEntities(currentProjectId, activeRunId ?? undefined),
        api.getContext(currentProjectId),
        api.getReportVersions(currentProjectId),
      ]);
      setEntities(ents);
      setContext(ctx);
      setReportVersions(v.versions);
      setCurrentReportVersion(v.versions.find((x) => x.current)?.version);
      // Also load legacy report for ReportView fallback
      if (ctx.has_report) {
        const r = await api.getReport(currentProjectId);
        setReport(r);
      }
      setTab("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки результатов");
    } finally {
      setActiveRunId(null);
    }
  };

  const onRunError = (msg: string) => {
    setError(msg);
    setActiveRunId(null);
  };

  const refreshPendingEdits = async () => {
    if (currentProjectId == null) return;
    try {
      const [pe, ctx] = await Promise.all([
        api.listPendingEdits(currentProjectId),
        api.getContext(currentProjectId),
      ]);
      setPendingEdits(pe);
      setContext(ctx);
    } catch {}
  };

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return (
    <div className="h-full w-full flex bg-bg text-neutral-900">
      {/* Desktop sidebar */}
      <div className="hidden sm:flex">
        <Sidebar
          projects={projects}
          currentProjectId={currentProjectId}
          onSelect={(id) => {
            setCurrentProjectId(id);
            setTab("chat");
          }}
          onCreate={createProject}
          onDelete={deleteProject}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-[82%] max-w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              projects={projects}
              currentProjectId={currentProjectId}
              onSelect={(id) => {
                setCurrentProjectId(id);
                setTab("chat");
                setMobileOpen(false);
              }}
              onCreate={async (name) => {
                await createProject(name);
                setMobileOpen(false);
              }}
              onDelete={deleteProject}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 h-full flex flex-col">
        <header className="h-14 flex items-center gap-3 px-3 sm:px-6 border-b border-border">
          <button
            className="sm:hidden h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-neutral-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="font-medium flex-1 truncate">
            {currentProject ? currentProject.name : "Выбери или создай проект"}
          </div>
          {currentProject && report && (
            <div className="hidden sm:flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5 text-sm">
              <button
                onClick={() => setTab("chat")}
                className={`px-3 py-1 rounded-md ${tab === "chat" ? "bg-white shadow-sm" : "text-neutral-600"}`}
              >
                Интервью
              </button>
              <button
                onClick={() => setTab("report")}
                className={`px-3 py-1 rounded-md ${tab === "report" ? "bg-white shadow-sm" : "text-neutral-600"}`}
              >
                Отчёт
              </button>
            </div>
          )}
        </header>

        {!currentProject && (
          <div className="flex-1 flex items-center justify-center px-4 text-center">
            <div>
              <div className="text-2xl font-semibold mb-2">Начни с проекта</div>
              <div className="text-neutral-500">
                Слева создай проект — я задам пару вопросов о продукте и потом запущу анализ рынка.
              </div>
            </div>
          </div>
        )}

        {currentProject && tab === "chat" && (
          <>
            {error && (
              <div className="mx-3 sm:mx-6 mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {currentProjectId != null && pendingEdits.length > 0 && (
              <PendingEditsBanner
                projectId={currentProjectId}
                edits={pendingEdits}
                onChange={refreshPendingEdits}
              />
            )}

            <ChatWindow
              messages={messages}
              emptyTitle="Интервью"
              emptyHint="Расскажи о своём продукте — я задам уточняющие вопросы."
              loading={chatLoading}
            />

            {/* SSE live stream — shown while run is active */}
            {activeRunId && currentProjectId && (
              <RunStream
                projectId={currentProjectId}
                runId={activeRunId}
                onComplete={onRunComplete}
                onError={onRunError}
              />
            )}

            {/* Bottom bar: input + optional analyze button */}
            {!activeRunId && (
              <div className="border-t border-border">
                {context && (context.ready_for_analysis || report) && (
                  <div className="px-3 sm:px-6 pt-3 flex justify-center">
                    <button
                      onClick={runAnalysis}
                      className="inline-flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl px-5 py-2 text-sm font-medium shadow-md shadow-[#1E40AF]/15 transition-all duration-200 cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M21 3v5h-5"/>
                      </svg>
                      {report ? "Перезапустить глобальный анализ рынка" : "Запустить анализ рынка"}
                    </button>
                  </div>
                )}
                <MessageInput
                  onSend={send}
                  disabled={chatLoading}
                  placeholder={report ? "Задай вопрос по отчёту или дополни контекст…" : "Ответь на вопрос…"}
                />
              </div>
            )}
          </>
        )}

        {currentProject && tab === "report" && (
          <div className="flex-1 overflow-y-auto">
            {entities.length > 0 ? (
              <EntityCanvas entities={entities} />
            ) : report ? (
              <ReportView
                report={report}
                versions={reportVersions}
                currentVersion={currentReportVersion}
                onVersionChange={async (v) => {
                  if (currentProjectId == null) return;
                  setCurrentReportVersion(v);
                  const r = await api.getReportVersion(currentProjectId, v);
                  setReport(r);
                }}
              />
            ) : (
              <div className="flex items-center justify-center py-20 text-neutral-500">
                Нет отчёта. Запусти анализ.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
