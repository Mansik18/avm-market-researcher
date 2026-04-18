import { EntityDTO } from "../api/client";
import EntityCard from "./EntityCard";

const TYPE_ORDER = ["verdict", "segment", "competitor", "risk", "plan"];
const TYPE_LABELS: Record<string, string> = {
  verdict: "Вердикт",
  segment: "Сегменты",
  competitor: "Конкуренты",
  risk: "Риски",
  plan: "План действий",
};

export default function EntityCanvas({ entities }: { entities: EntityDTO[] }) {
  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    label: TYPE_LABELS[t] || t,
    items: entities.filter((e) => e.type === t).sort((a, b) => a.rank - b.rank),
  })).filter((g) => g.items.length > 0);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        Нет данных. Запустите анализ.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {grouped.map((g) => (
        <section key={g.type}>
          {g.type !== "verdict" && (
            <h2 className="text-sm font-semibold text-[#1E3A8A] mb-2">
              {g.label} ({g.items.length})
            </h2>
          )}
          <div
            className={
              g.type === "competitor"
                ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
                : "space-y-2"
            }
          >
            {g.items.map((e) => (
              <EntityCard
                key={e.id}
                entity={e}
                defaultOpen={g.type === "verdict" || (g.type === "segment" && e.rank < 3)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
