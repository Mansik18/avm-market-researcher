import { useMemo, useState } from "react";
import Sidebar, { ChatMode } from "../components/Sidebar";
import ChatWindow, { Message } from "../components/ChatWindow";
import MessageInput from "../components/MessageInput";
import { api } from "../api/client";

const modeMeta: Record<
  ChatMode,
  { title: string; emptyTitle: string; emptyHint: string; placeholder: string }
> = {
  competitors: {
    title: "Анализ конкурентов",
    emptyTitle: "Анализ конкурентов",
    emptyHint:
      "Опишите продукт или нишу — я соберу карту конкурентов, их сильные и слабые стороны.",
    placeholder: "Например: SaaS для планирования задач в РФ",
  },
  market: {
    title: "Анализ рынка",
    emptyTitle: "Анализ рынка",
    emptyHint:
      "Расскажите о рынке — я оценю объём, динамику, сегменты и ключевые тренды.",
    placeholder: "Например: рынок онлайн-образования в СНГ",
  },
};

export default function Chat() {
  const [mode, setMode] = useState<ChatMode>("competitors");
  const [byMode, setByMode] = useState<Record<ChatMode, Message[]>>({
    competitors: [],
    market: [],
  });
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const meta = modeMeta[mode];
  const messages = byMode[mode];

  const setMessages = (updater: (prev: Message[]) => Message[]) => {
    setByMode((s) => ({ ...s, [mode]: updater(s[mode]) }));
  };

  const send = async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await api.sendMessage(text, mode);
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Не удалось получить ответ: " +
          (err instanceof Error ? err.message : "ошибка сети"),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const headerTitle = useMemo(() => meta.title, [meta.title]);

  return (
    <div className="h-full w-full flex bg-bg text-neutral-900">
      {/* Desktop sidebar */}
      <div className="hidden sm:flex">
        <Sidebar mode={mode} onModeChange={setMode} />
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
              mode={mode}
              onModeChange={setMode}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <main className="flex-1 min-w-0 h-full flex flex-col">
        <header className="h-14 flex items-center gap-3 px-3 sm:px-6 border-b border-border">
          <button
            className="sm:hidden h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-neutral-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="font-medium">{headerTitle}</div>
        </header>

        <ChatWindow
          messages={messages}
          emptyTitle={meta.emptyTitle}
          emptyHint={meta.emptyHint}
          loading={loading}
        />

        <MessageInput
          onSend={send}
          disabled={loading}
          placeholder={meta.placeholder}
        />
      </main>
    </div>
  );
}
