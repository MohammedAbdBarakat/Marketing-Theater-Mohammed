"use client";
import { useEffect, useMemo, useState } from "react";
import type { PhaseResult } from "../../store/useRunStore";

type StrategyCandidate = {
  id: string;
  name: string | { title: string };
  rationale: string;
  highlights: string[];
};

type StrategyBrief = {
  goal: string;
  audience: string;
  campaignStyles: string[];
  alignWithEvents: boolean;
  region?: string;
};

type PhaseArtifactsSummary = { title: string; items: string[] };
type ChannelPlan = { channel: string; kpis: string[]; budget?: string; samplePost?: string };

function normalizeString(s: unknown) {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

function getCandidateTitle(c?: StrategyCandidate | null): string {
  if (!c) return "";
  if (typeof c.name === "string") return c.name;
  if (c.name && typeof c.name === "object" && "title" in c.name) return (c.name as { title: string }).title;
  return "";
}

function findPhase1Direction(artifacts: unknown, candidateName: string | undefined) {
  if (!candidateName) return null;
  if (!Array.isArray(artifacts)) return null;
  const target = normalizeString(candidateName);
  for (const a of artifacts) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    const title =
      (typeof rec.title === "string" && rec.title) ||
      (typeof rec.name === "string" && rec.name) ||
      "";
    if (!title) continue;
    if (normalizeString(title) === target) return rec;
  }
  return null;
}

function parsePhase2Artifacts(artifacts: unknown): PhaseArtifactsSummary[] {
  if (!Array.isArray(artifacts)) return [];
  const out: PhaseArtifactsSummary[] = [];
  for (const a of artifacts) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title : "Details";
    const items = Array.isArray(rec.items)
      ? rec.items.filter((x): x is string => typeof x === "string")
      : [];
    if (!items.length) continue;
    out.push({ title, items });
  }
  return out;
}

function parsePhase3Artifacts(artifacts: unknown): ChannelPlan[] {
  if (!Array.isArray(artifacts)) return [];
  const out: ChannelPlan[] = [];
  for (const a of artifacts) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    const channel = typeof rec.channel === "string" ? rec.channel : "";
    if (!channel) continue;
    const kpis = Array.isArray(rec.kpis)
      ? rec.kpis.filter((x): x is string => typeof x === "string")
      : [];
    out.push({
      channel,
      kpis,
      budget: typeof rec.budget === "string" ? rec.budget : undefined,
      samplePost: typeof rec.samplePost === "string" ? rec.samplePost : undefined,
    });
  }
  return out;
}

export function StrategySelectModal({
  open,
  items,
  recommendedId,
  onSelect,
  onClose,
  brief,
  results,
}: {
  open: boolean;
  items: StrategyCandidate[];
  recommendedId?: string;
  onSelect: (id: string) => Promise<void> | void;
  onClose: () => void;
  brief?: StrategyBrief;
  results?: Partial<Record<1 | 2 | 3 | 4, PhaseResult>>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setActiveId((prev) => prev || recommendedId || items[0]?.id || null);
  }, [open, recommendedId, items]);

  const active = useMemo(
    () => items.find((x) => x.id === activeId) || items.find((x) => x.id === recommendedId) || items[0] || null,
    [items, activeId, recommendedId]
  );

  const phase1 = results?.[1];
  const phase2 = results?.[2];
  const phase3 = results?.[3];

  const activeTitle = getCandidateTitle(active);

  const direction = useMemo(() => findPhase1Direction(phase1?.artifacts, activeTitle), [phase1?.artifacts, activeTitle]);
  const directionBullets = useMemo(
    () => (Array.isArray(direction?.bullets) ? direction.bullets.filter((x: unknown): x is string => typeof x === "string") : []),
    [direction]
  );
  const directionRisks = useMemo(
    () => (Array.isArray(direction?.risks) ? direction.risks.filter((x: unknown): x is string => typeof x === "string") : []),
    [direction]
  );

  const refinements = useMemo(() => parsePhase2Artifacts(phase2?.artifacts), [phase2?.artifacts]);
  const channels = useMemo(() => parsePhase3Artifacts(phase3?.artifacts), [phase3?.artifacts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg w-full max-w-5xl p-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Select a Strategy</div>
          <button className="text-sm" onClick={onClose} disabled={!!submittingId}>Close</button>
        </div>

        {brief ? (
          <div className="border rounded-lg p-3 mb-4 bg-gray-50">
            <div className="text-sm font-medium mb-1">Your Strategy Brief</div>
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <div><span className="text-gray-600">Goal:</span> {brief.goal}</div>
              <div><span className="text-gray-600">Audience:</span> {brief.audience}</div>
              <div><span className="text-gray-600">Channels:</span> {brief.campaignStyles?.join(", ") || "—"}</div>
              <div>
                <span className="text-gray-600">Align with events:</span>{" "}
                {brief.alignWithEvents ? "Yes" : "No"}
                {brief.alignWithEvents && brief.region ? ` (${brief.region})` : ""}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5 flex-1 min-h-0">
          <aside className="md:col-span-2 overflow-auto pr-1 min-h-0">
            <div className="space-y-3">
              {items.map((it) => {
                const isRecommended = it.id === recommendedId;
                const isActive = it.id === active?.id;
                const isSubmittingThis = submittingId === it.id;

                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    className={`w-full text-left border rounded p-3 cursor-pointer ${isActive ? "border-black bg-gray-50" : "hover:bg-gray-50"} ${isRecommended ? "border-blue-500" : ""} ${!!submittingId ? "opacity-70 pointer-events-none" : ""}`}
                    onClick={() => !submittingId && setActiveId(it.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!submittingId) setActiveId(it.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{getCandidateTitle(it)}</div>
                      {isRecommended && <span className="text-xs text-blue-600">Recommended</span>}
                    </div>
                    {typeof it.rationale === "string" ? (
                      <div className="text-sm text-gray-700 mt-1">{it.rationale}</div>
                    ) : null}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(it.highlights || []).map((h, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-gray-100">
                          {h}
                        </span>
                      ))}
                    </div>
                    <div className="pt-2 text-right">
                      <button
                        className={`text-sm px-3 py-1 rounded text-white ${isSubmittingThis ? "bg-gray-600 cursor-not-allowed" : "bg-black"}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (submittingId) return;

                          setSubmittingId(it.id);
                          try {
                            await onSelect(it.id);
                          } finally {
                            // Only reset if component is still mounted, though unmount usually clears state
                            setSubmittingId(null);
                          }
                        }}
                        type="button"
                        disabled={!!submittingId}
                      >
                        {isSubmittingThis ? "Selecting..." : "Choose"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="md:col-span-3 border rounded-lg p-3 overflow-auto min-h-0">
            {!active ? (
              <div className="text-sm text-gray-600">No strategies available.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-600">Details</div>
                  <div className="text-lg font-semibold">{getCandidateTitle(active)}</div>
                  {typeof active.rationale === "string" ? (
                    <div className="text-sm text-gray-700">{active.rationale}</div>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <div className="border rounded p-3">
                    <div className="text-sm font-medium mb-1">Phase 1 — Direction</div>
                    {phase1?.summary && typeof phase1.summary === "string" ? (
                      <div className="text-sm text-gray-700 mb-2">{phase1.summary}</div>
                    ) : null}
                    {directionBullets.length ? (
                      <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                        {directionBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-600">
                        No detailed bullets available for this direction yet.
                      </div>
                    )}
                    {directionRisks.length ? (
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 mb-1">Risks</div>
                        <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                          {directionRisks.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="border rounded p-3">
                    <div className="text-sm font-medium mb-1">Phase 2 — Refinements</div>
                    {phase2?.summary && typeof phase2.summary === "string" ? (
                      <div className="text-sm text-gray-700 mb-2">{phase2.summary}</div>
                    ) : null}
                    {refinements.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {refinements.map((g) => (
                          <div key={g.title} className="border rounded p-2 bg-gray-50">
                            <div className="text-xs font-medium mb-1">{g.title}</div>
                            <div className="flex flex-wrap gap-2">
                              {g.items.map((it, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded-full bg-white border">
                                  {it}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No refinements available.</div>
                    )}
                  </div>

                  <div className="border rounded p-3">
                    <div className="text-sm font-medium mb-1">Phase 3 — Channel Plan</div>
                    {phase3?.summary && typeof phase3.summary === "string" ? (
                      <div className="text-sm text-gray-700 mb-2">{phase3.summary}</div>
                    ) : null}
                    {channels.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {channels.map((c) => (
                          <div key={c.channel} className="border rounded p-2 bg-gray-50">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">{c.channel}</div>
                              {c.budget ? (
                                <div className="text-xs text-gray-600">Budget: {c.budget}</div>
                              ) : null}
                            </div>
                            {c.kpis.length ? (
                              <div className="text-xs text-gray-600 mt-1">
                                KPIs: {c.kpis.join(", ")}
                              </div>
                            ) : null}
                            {c.samplePost ? (
                              <div className="text-xs text-gray-700 mt-2 border rounded bg-white p-2">
                                {c.samplePost}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No channel plans available.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
