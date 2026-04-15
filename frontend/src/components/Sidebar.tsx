import { useAuth } from "../context/AuthContext";

export type ChatMode = "competitors" | "market";

interface SidebarProps {
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  onClose?: () => void;
}

const items: { id: ChatMode; title: string; desc: string; icon: string }[] = [
  {
    id: "competitors",
    title: "Анализ конкурентов",
    desc: "Кто рядом, чем сильны",
    icon: "👥",
  },
  {
    id: "market",
    title: "Анализ рынка",
    desc: "Размер, тренды, спрос",
    icon: "📊",
  },
];

export default function Sidebar({ mode, onModeChange, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="h-full w-full sm:w-[260px] flex-shrink-0 bg-panel border-r border-border flex flex-col">
      <div className="px-4 h-14 flex items-center justify-between border-b border-border">
        <div className="font-semibold tracking-tight">AVM Research</div>
        {onClose && (
          <button
            onClick={onClose}
            className="sm:hidden text-neutral-500 hover:text-neutral-900 text-xl leading-none"
            aria-label="Закрыть"
          >
            ×
          </button>
        )}
      </div>

      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider text-neutral-500 px-2 pt-2 pb-1">
          Режимы
        </div>
        {items.map((it) => {
          const active = it.id === mode;
          return (
            <button
              key={it.id}
              onClick={() => {
                onModeChange(it.id);
                onClose?.();
              }}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition border ${
                active
                  ? "bg-neutral-100 border-neutral-200"
                  : "bg-transparent border-transparent hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{it.icon}</span>
                <span className="font-medium text-sm">{it.title}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 ml-7">
                {it.desc}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="text-xs text-neutral-500 truncate mb-2">{user?.email}</div>
        <button
          onClick={logout}
          className="w-full text-sm bg-white hover:bg-neutral-100 border border-border rounded-lg py-2 transition"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
