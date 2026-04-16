import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow, { Message } from "../components/ChatWindow";
import MessageInput from "../components/MessageInput";
import ReportView from "../components/ReportView";
import {
  AnalysisReport,
  HistoryMessage,
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
  const [tab, setTab] = useState<Tab>("chat");
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
          const r = await api.getReport(currentProjectId);
          if (alive) setReport(r);
        } else {
          setReport(null);
        }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setChatLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (currentProjectId == null) return;
    setAnalyzing(true);
    setError(null);
    try {
      const r = await api.analyze(currentProjectId);
      setReport(r);
      setTab("report");
      // Refresh context so has_report flag updates
      const ctx = await api.getContext(currentProjectId);
      setContext(ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Анализ не удался");
    } finally {
      setAnalyzing(false);
    }
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

            <ChatWindow
              messages={messages}
              emptyTitle="Интервью"
              emptyHint="Расскажи о своём продукте — я задам уточняющие вопросы."
              loading={chatLoading}
            />

            {/* CTA: analysis button — centered, prominent, appears after intake is done */}
            {context && context.ready_for_analysis && !report && !analyzing && (
              <div className="px-4 sm:px-6 py-4 border-t border-border bg-gradient-to-t from-[#1E40AF]/5 to-transparent">
                <div className="max-w-lg mx-auto text-center">
                  <div className="text-sm text-neutral-500 mb-3">
                    Контекст собран. Готово к запуску.
                  </div>
                  <button
                    onClick={runAnalysis}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl px-8 py-3.5 text-base font-medium shadow-lg shadow-[#1E40AF]/20 hover:shadow-xl hover:shadow-[#1E40AF]/30 transition-all duration-200 cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      <path d="M21 3v5h-5"/>
                    </svg>
                    Запустить анализ рынка
                  </button>
                </div>
              </div>
            )}

            {/* Analyzing state — replaces CTA */}
            {analyzing && (
              <div className="px-4 sm:px-6 py-6 border-t border-border">
                <div className="max-w-lg mx-auto text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-5 h-5 border-2 border-[#1E40AF] border-t-transparent rounded-full animate-spin" />
                    <div className="text-sm font-medium text-[#1E40AF]">Анализирую рынок</div>
                  </div>
                  <div className="text-xs text-neutral-400">
                    4 фазы: сбор данных → сегментация → глубокий анализ → синтез. Обычно 1-3 мин.
                  </div>
                </div>
              </div>
            )}

            {/* Input — only visible when NOT ready for analysis or already has report */}
            {(!context?.ready_for_analysis || report) && !analyzing && (
              <MessageInput
                onSend={send}
                disabled={chatLoading}
                placeholder="Ответь на вопрос…"
              />
            )}
          </>
        )}

        {currentProject && tab === "report" && report && (
          <div className="flex-1 overflow-y-auto">
            <ReportView report={report} />
          </div>
        )}
      </main>
    </div>
  );
}
