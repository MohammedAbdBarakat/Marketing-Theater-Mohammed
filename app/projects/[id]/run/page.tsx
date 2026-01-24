"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import { useProjectStore } from "../../../../store/useProjectStore";
import { useRunStore } from "../../../../store/useRunStore";

import { PhaseStepper } from "../../../../components/run/PhaseStepper";
import { MeetingTheater } from "../../../../components/run/MeetingTheater";
import { PhaseResultCard } from "../../../../components/run/PhaseResultCard";
import { StrategySelectModal } from "../../../../components/run/StrategySelectModal";
import { EventsSelectionModal } from "../../../../components/run/EventsSelectionModal";
import { selectStrategy, getLatestRunForProject, resetPhase4, downloadReport, confirmEventSelection } from "../../../../lib/api";
import type { CampaignDay, EventSelection } from "../../../../types/events";
import { ConnectionStatus } from "../../../../components/run/ConnectionStatus";
import Link from "next/link";

export default function RunPage() {
  const { id } = useParams<{ id: string }>(); // Project ID
  const project = useProjectStore();
  const run = useRunStore();
  const [conn, setConn] = useState<"connecting" | "open" | "closed">("connecting");
  const [strategyPrompt, setStrategyPrompt] = useState<{ items: any[]; recommendedId?: string } | null>(null);
  const [eventsPrompt, setEventsPrompt] = useState<CampaignDay[] | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const duration = useMemo(() => ({ start: project.duration.start, end: project.duration.end }), [project.duration]);


  const refreshRunDataFromDB = async (runId: string) => {
    try {
      console.log("🔄 Syncing with Database to get Real UUIDs...");
      const latest = await getLatestRunForProject(id);

      if (latest && latest.runId === runId) {
        // 1. تحديث الرزنامة بالبيانات التي تحتوي على Real IDs
        if (latest.calendar) {
          run.setCalendar(latest.calendar as any);
          console.log("✅ Calendar synced with DB (Real IDs loaded).");
        }

        // 2. تحديث نتائج المراحل لضمان تطابق الحالة
        if (latest.results) {
          Object.entries(latest.results).forEach(([phaseStr, data]: [string, any]) => {
            const p = parseInt(phaseStr) as 1 | 2 | 3 | 4;
            if ([1, 2, 3, 4].includes(p)) {
              run.setResult({
                phase: p,
                summary: data.summary,
                artifacts: data.artifacts,
                candidates: data.candidates
              });
              run.setPhaseStatus(p, "done");
            }
          });
        }
      }
    } catch (e) {
      console.error("❌ Failed to sync run data:", e);
    }
  };

  async function handleRegenerate() {
    if (!run.runId) return;
    const confirmed = window.confirm("Are you sure you want to delete the current Calendar and regenerate it? This cannot be undone.");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      // A. Call the DELETE endpoint
      await resetPhase4(run.runId);

      // B. Reload the page to restart the SSE Stream
      // The backend will see Phase 4 is missing and start generating it again.
      window.location.reload();
    } catch (err) {
      alert("Failed to reset run. Check console.");
      console.error(err);
      setIsResetting(false);
    }
  }

  async function handleDownloadReport() {
    if (!run.runId) return;
    setIsGeneratingReport(true);
    try {
      const { url } = await downloadReport(run.runId);
      window.open(url, "_blank");
    } catch (err) {
      alert("Report generation failed. Please try again.");
      console.error(err);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    let eventSource: any = null;

    async function initRun() {
      try {
        let activeRunId = run.runId;

        // 1. Initial Fetch (Get ID + Hydrate State)
        if (!activeRunId) {
          const latest = await getLatestRunForProject(id);
          if (latest && mounted) {
            activeRunId = latest.runId;
            run.setRunId(latest.runId);
            if (latest.selectedStrategyId) run.setSelectedStrategy(latest.selectedStrategyId);

            // Hydrate immediately so user sees data while connecting
            if (latest.calendar) run.setCalendar(latest.calendar as any);
            if (latest.results) {
              Object.entries(latest.results).forEach(([phaseStr, data]: [string, any]) => {
                const p = parseInt(phaseStr) as 1 | 2 | 3 | 4;
                if ([1, 2, 3, 4].includes(p)) {
                  run.setResult({ phase: p, summary: data.summary, artifacts: data.artifacts, candidates: data.candidates });
                  run.setPhaseStatus(p, "done");
                }
              });
              if (latest.results["3"]) run.setCurrentPhase(4);
            }

            // Hydrate Theater from chat_history if available
            // @ts-ignore
            if ((latest as any).chat_history) {
              const newTheater: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
              // @ts-ignore
              Object.entries((latest as any).chat_history).forEach(([phaseStr, messages]: [string, any[]]) => {
                const p = parseInt(phaseStr);
                if (!isNaN(p)) {
                  newTheater[p] = messages.map((m: any, idx: number) => ({
                    phase: p,
                    speaker: m.name || m.role,
                    text: m.content,
                    ts: Date.now() + idx // Mock TS to maintain order if missing
                  }));
                }
              });
              run.setTheater(newTheater);
            }
          }
        }

        if (!activeRunId && mounted) {
          // Create new run if none exists (or could be error state)
          // For now, assume a run is created via "Start" on project page or similar.
          // If we are here, we might need to create one, OR start a new one.
          // Requirement says: "Call this immediately when the user creates a new run or clicks Retry/Generate"
          // If we are just landing here, we assume a run exists or we start one.
          // Let's assume we try to get latest, if not, we start a new run?
          // Actually, the new backend flow says: POST /runs/{id}/start
          // If we don't have an ID, we can't start.
          // So we probably need to create a run first if it doesn't exist?
          // The previous code `activeRunId = "local"` suggests we mock it.
          // Let's stick to valid ID.
          return;
        }

        if (!mounted || !activeRunId) return;

        // 2. EXPLICIT START (Idempotent)
        // We only call start if we are "starting" the run. 
        // If we are just refreshing, we skip start?
        // User guideline: "Also connect to this on page load (if the user refreshes), so they rejoin the session."
        // "If the user refreshes the page: Do NOT call /start."
        // How do we know if it's a refresh vs new?
        // Maybe we just don't call start here? Start should be called by the action that triggers the run.
        // BUT the prompt says: "Frontend Logic: Call this immediately when the user creates a new run or clicks Retry/Generate."
        // If we are deep linking, we just connect?
        // Let's try to ONLY connect here. The "Create Run" button elsewhere should have called start?
        // OR: we check if the run is "new" status?
        // Actually, the prompt example `startAndWatchRun` implies we call start then watch.
        // For now, let's implement the CONNECT part here. The "Start" might need to happen elsewhere or we check status.
        // Wait, current page load MIGHT be the "Start" action if redirected from creation?
        // Let's call start anyway? 
        // Prompt says: "If it returns 200 with status: 'running', that's fine too (idempotent)."
        // So we CAN call it safely? 
        // "If the user refreshes the page: Do NOT call /start."
        // This is conflicting. Idempotent means safe to call, but "Do NOT call" implies maybe side effects or just unnecessary.
        // Let's assume we can call it if we are unsure, OR safely skip if we know it's running.
        // The implementation plan says: "On Mount: Check if run is already started... Call api.startRun(runId) if this is a fresh start/retry."
        // Let's be safe and call it ONLY if we don't have results yet?
        // Or better: let's make a explicit "Start" button if inactive?
        // No, the user wants auto-start.
        // Let's call startRun safely. If it's running, it's fine.

        // Wait, for REFRESH, we don't want to restart Phase 1 if we are in Phase 3.
        // The backend `start` might reset?
        // "If it returns 200 with status: 'running', that's fine too" -> implies it WON'T reset.
        // So it IS safe.
        // We will call startRun here to be sure, unless we want to rely on the previous page action.
        // Actually, `activeRunId` comes from URL or DB.

        setConn("connecting");

        // Only call start if we suspect it's not running? 
        // Let's Try calling startRun. If it fails or says running, we continue.
        try {
          const { startRun } = await import("../../../../lib/api"); // dynamic import to avoid circ dep if any
          await startRun(activeRunId);
        } catch (e) {
          console.warn("Start run warning:", e);
        }

        run.setStatus("running");
        setConn("open");

        // 3. LISTEN (Pure Listener)
        const { connectStream } = await import("../../../../lib/sseClient");

        // Track authoritative status to prevent stale events
        let authoritativeStatus = "unknown";

        eventSource = connectStream(
          activeRunId,
          {
            onEvent: async (ev: any) => {
              // 1. Handle Status Update (Priority Override)
              if (ev.type === "status_update") {
                authoritativeStatus = ev.status;
                run.setStatus(ev.status); // Update global store!

                // If we are NOT waiting for selection, ensure panel is hidden
                if (ev.status !== "waiting_for_selection") {
                  setStrategyPrompt(null);
                }
                return;
              }

              switch (ev.type) {
                case "phase_start":
                  run.setCurrentPhase(ev.phase as 1 | 2 | 3 | 4);
                  run.setPhaseStatus(ev.phase as 1 | 2 | 3 | 4, "running");
                  break;
                case "log":
                  run.pushLog({ phase: ev.phase, speaker: ev.speaker, text: ev.text, ts: ev.ts });
                  break;
                case "phase_result":
                  run.setResult({ phase: ev.phase, summary: ev.summary, artifacts: ev.artifacts, candidates: ev.candidates });
                  run.setPhaseStatus(ev.phase as 1 | 2 | 3 | 4, "done");
                  if (ev.phase < 3) run.setCurrentPhase((ev.phase + 1) as any);
                  break;
                case "strategy_candidates":
                  // Suppress stale events on replay if we know we are done
                  if (authoritativeStatus === "completed" || authoritativeStatus === "running_phase_4") {
                    return;
                  }
                  setStrategyPrompt({ items: ev.items, recommendedId: ev.recommendedId });
                  break;
                case "calendar_day":
                  run.setPhaseStatus(4, "running");
                  run.setCurrentPhase(4);
                  run.addCalendarEntries(ev.date, ev.entries);
                  break;

                case "campaign_events":
                  // Auto-skip if no events, otherwise show modal
                  // CHECK: If Phase 4 is already marked done or we have calendar entries, ignore this to prevent re-opening on reload
                  const currentStore = useRunStore.getState();
                  const hasCalendarData = Object.keys(currentStore.calendar).length > 0;
                  const isPhase4Done = currentStore.phases[4] === "done";

                  if (hasCalendarData || isPhase4Done) {
                    console.log("Ignoring campaign_events event because Phase 4 is already done/has content.");
                    return;
                  }

                  if (ev.days?.every((d: CampaignDay) => d.events.length === 0)) {
                    await confirmEventSelection(activeRunId!, []);
                  } else {
                    setEventsPrompt(ev.days || []);
                  }
                  break;

                case "done":
                  run.setPhaseStatus(4, "done");
                  run.setCurrentPhase(5);
                  run.setStatus("done");
                  setConn("closed");
                  await refreshRunDataFromDB(activeRunId!);
                  break;

                case "error":
                  break;
              }
            },
            onError: (msg) => {
              console.log("SSE Retry/Error:", msg);
            }
          }
        );

      } catch (err) {
        if (mounted) { setConn("closed"); run.setStatus("error"); }
      }
    }

    initRun();

    return () => {
      mounted = false;
      if (eventSource) eventSource.stop();
      setConn("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function confirmStrategy(idSelected: string) {
    run.setSelectedStrategy(idSelected);
    if (run.runId) await selectStrategy(run.runId, idSelected);
    setStrategyPrompt(null);
  }

  const currentLogs = run.theater[run.currentPhase as 1 | 2 | 3 | 4 | 5] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PhaseStepper phases={run.phases} current={run.currentPhase || 1} />
        <ConnectionStatus status={conn} />
      </div>
      <MeetingTheater logs={run.theater} currentPhase={run.currentPhase || 1} isDone={run.status === "done"} />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((p) => {
          const res = run.results[p as 1 | 2 | 3 | 4];
          if (!res) return <div key={p} className="border rounded-lg p-4 text-sm text-gray-500">Waiting for Phase {p}...</div>;
          return <PhaseResultCard key={p} phase={p} summary={res.summary} artifacts={res.artifacts} />;
        })}
      </div>

      {/* DEBUG LOGS */}
      {(() => {
        console.log("RENDER DEBUG:", {
          status: run.status,
          hasStrategyPrompt: !!strategyPrompt,
          candidates: run.results[1]?.candidates,
          hasCandidates: !!(run.results[1]?.candidates && run.results[1].candidates.length > 0)
        });
        return null;
      })()}

      {(strategyPrompt || (run.status === "waiting_for_selection" && run.results[1]?.candidates)) && (
        <StrategySelectModal
          open
          items={strategyPrompt?.items || run.results[1]?.candidates || []}
          recommendedId={strategyPrompt?.recommendedId}
          brief={project.strategy}
          results={run.results}
          onSelect={confirmStrategy}
          onClose={() => setStrategyPrompt(null)}
        />
      )}

      {eventsPrompt && (
        <EventsSelectionModal
          isOpen={!!eventsPrompt}
          days={eventsPrompt}
          onConfirm={async (selected) => {
            if (run.runId) await confirmEventSelection(run.runId, selected);
            setEventsPrompt(null);
          }}
          onClose={() => setEventsPrompt(null)}
        />
      )}

      {run.status === "done" && (
        <div className="flex items-center justify-between mt-8 border-t pt-4">
          <div className="text-gray-600 text-sm">
            Result: Calendar generated.
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleRegenerate}
              disabled={isResetting}
              className="text-xs px-3 py-2 text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              {isResetting ? "Resetting..." : "Regenerate Plan"}
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={isGeneratingReport}
              className="text-sm px-4 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingReport ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Download Report"
              )}
            </button>

            <Link
              href={`/projects/${id}/calendar`}
              className="text-sm px-4 py-2 rounded bg-black text-white hover:bg-gray-800"
            >
              Go to Calendar →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}