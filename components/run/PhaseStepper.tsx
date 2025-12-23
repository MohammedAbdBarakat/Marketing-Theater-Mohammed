"use client";
export function PhaseStepper({
  phases,
  current,
}: {
  phases: Record<1 | 2 | 3 | 4 | 5, string>;
  current: number;
}) {
  // --- RENAMED PHASES ---
  const items: { id: 1 | 2 | 3 | 4 | 5; label: string }[] = [
    { id: 1, label: "Strategy" },
    { id: 2, label: "Creative" },
    { id: 3, label: "Analysis" },
    { id: 4, label: "Planning" },
    { id: 5, label: "Production" },
  ];
  return (
    <div className="flex items-center gap-3">
      {items.map((p) => {
        const active = current === p.id;
        const state = phases[p.id as 1 | 2 | 3 | 4 | 5];
        return (
          <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded border ${active ? 'bg-black text-white' : ''}`}>
            <span className="text-xs font-medium">{p.label}</span>
            <span className="text-[10px] uppercase tracking-wide opacity-70">{state}</span>
          </div>
        );
      })}
    </div>
  );
}