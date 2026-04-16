import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Project } from "../api/client";

interface SidebarProps {
  projects: Project[];
  currentProjectId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  onClose?: () => void;
}

export default function Sidebar({
  projects,
  currentProjectId,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName("");
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="h-full w-full sm:w-[280px] flex-shrink-0 bg-panel border-r border-border flex flex-col">
      <div className="px-4 h-14 flex items-center justify-between border-b border-border">
        <div className="font-semibold tracking-tight text-[#1E3A8A]">AVM Research</div>
        {onClose && (
          <button
            onClick={onClose}
            className="sm:hidden text-neutral-500 hover:text-neutral-900 text-xl leading-none cursor-pointer"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>

      {/* Create project section */}
      <div className="p-3 border-b border-border">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Новый проект
          </button>
        ) : (
          <div className="space-y-2">
            <label htmlFor="project-name" className="block text-xs font-medium text-neutral-600">
              Название проекта
            </label>
            <input
              id="project-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") { setShowForm(false); setNewName(""); }
              }}
              placeholder="Например: AI-планировщик"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/30 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={creating || !newName.trim()}
                className="flex-1 bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors duration-200 cursor-pointer"
              >
                {creating ? "Создаю…" : "Создать"}
              </button>
              <button
                onClick={() => { setShowForm(false); setNewName(""); }}
                className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {projects.length === 0 && !showForm && (
          <div className="px-3 py-8 text-center">
            <div className="text-neutral-400 mb-1">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div className="text-sm text-neutral-500 mb-1">Пока нет проектов</div>
            <div className="text-xs text-neutral-400">Создай первый — кнопка выше</div>
          </div>
        )}
        {projects.map((p) => {
          const active = p.id === currentProjectId;
          return (
            <div
              key={p.id}
              className={`group rounded-xl border transition-all duration-200 flex items-center cursor-pointer ${
                active
                  ? "bg-[#1E40AF]/5 border-[#1E40AF]/20 shadow-sm"
                  : "bg-transparent border-transparent hover:bg-neutral-50 hover:border-neutral-200"
              }`}
            >
              <button
                onClick={() => onSelect(p.id)}
                className="flex-1 text-left px-3 py-2.5 min-w-0 cursor-pointer"
              >
                <div className={`font-medium text-sm truncate ${active ? "text-[#1E40AF]" : ""}`}>
                  {p.name}
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {new Date(p.updated_at).toLocaleDateString("ru-RU")}
                </div>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Удалить проект «${p.name}»?`)) {
                    await onDelete(p.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 px-2 text-neutral-400 hover:text-red-500 transition-all cursor-pointer"
                title="Удалить"
                aria-label={`Удалить проект ${p.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="text-xs text-neutral-500 truncate mb-2">{user?.email}</div>
        <button
          onClick={logout}
          className="w-full text-sm bg-white hover:bg-neutral-100 border border-border rounded-lg py-2 transition-colors cursor-pointer"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
