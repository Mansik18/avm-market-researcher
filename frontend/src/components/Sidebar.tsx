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
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="h-full w-full sm:w-[280px] flex-shrink-0 bg-panel border-r border-border flex flex-col">
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

      <div className="p-3 border-b border-border">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Новый проект"
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg px-3 text-sm"
          >
            +
          </button>
        </form>
      </div>

      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider text-neutral-500 px-2 pt-2 pb-1">
          Проекты
        </div>
        {projects.length === 0 && (
          <div className="px-2 py-3 text-sm text-neutral-500">
            Пока нет проектов. Создай первый.
          </div>
        )}
        {projects.map((p) => {
          const active = p.id === currentProjectId;
          return (
            <div
              key={p.id}
              className={`group rounded-lg border transition flex items-center ${
                active
                  ? "bg-neutral-100 border-neutral-200"
                  : "bg-transparent border-transparent hover:bg-neutral-50"
              }`}
            >
              <button
                onClick={() => onSelect(p.id)}
                className="flex-1 text-left px-3 py-2 min-w-0"
              >
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-neutral-500">
                  {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Удалить проект «${p.name}»?`)) {
                    await onDelete(p.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 px-2 text-neutral-400 hover:text-red-600"
                title="Удалить"
              >
                ×
              </button>
            </div>
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
