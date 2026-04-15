import { useEffect, useRef } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
  emptyTitle: string;
  emptyHint: string;
  loading?: boolean;
}

export default function ChatWindow({
  messages,
  emptyTitle,
  emptyHint,
  loading,
}: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-3xl sm:text-4xl font-semibold mb-3">
              {emptyTitle}
            </div>
            <div className="text-neutral-500 text-sm sm:text-base">
              {emptyHint}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed text-sm sm:text-base ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "bg-panel border border-border text-neutral-900 shadow-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-panel border border-border rounded-2xl px-4 py-3 text-neutral-500 text-sm shadow-sm">
              Думаю<span className="animate-pulse">…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
