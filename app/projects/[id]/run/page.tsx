"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "../../../../store/useProjectStore";
import { useRunStore } from "../../../../store/useRunStore";

import { PhaseStepper } from "../../../../components/run/PhaseStepper";
import { MeetingTheater } from "../../../../components/run/MeetingTheater";
import { PhaseResultCard } from "../../../../components/run/PhaseResultCard";
import { StrategySelectModal } from "../../../../components/run/StrategySelectModal";
import { selectStrategy, getLatestRunForProject, resetPhase4, startRun, stopRun, RunStatus } from "../../../../lib/api";
import { ConnectionStatus } from "../../../../components/run/ConnectionStatus";
import Link from "next/link";

export default function RunPage() {
  const { id } = useParams<{ id: string }>(); // Project ID
  const project = useProjectStore();
  const run = useRunStore();
  const [conn, setConn] = useState<"connecting" | "open" | "closed">("connecting");
  const [strategyPrompt, setStrategyPrompt] = useState<{ items: any[]; recommendedId?: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // ... (refreshRunDataFromDB kept as is, but fix setStatus)
  const refreshRunDataFromDB = async (runId: string) => {
    try {
      console.log("🔄 Syncing with Database...");
      const latest = await getLatestRunForProject(id);

      if (latest && latest.runId === runId) {
        if (latest.calendar) run.setCalendar(latest.calendar as any);
        if (latest.results) {
          Object.entries(latest.results).forEach(([phaseStr, data]: [string, any]) => {
            const p = parseInt(phaseStr) as 1 | 2 | 3 | 4;
            if ([1, 2, 3, 4].includes(p)) {
              run.setResult({ phase: p, summary: data.summary, artifacts: data.artifacts, candidates: data.candidates });
              run.setPhaseStatus(p, "done");
            }
          });
        }
        if (latest.status) run.setStatus(latest.status as RunStatus);
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
      await resetPhase4(run.runId);
      window.location.reload();
    } catch (err) {
      alert("Failed to reset run. Check console.");
      console.error(err);
      setIsResetting(false);
    }
  }

  // Unified Start/Stop/Resume Handlers
  const handleStart = async () => {
    if (!run.runId) return;
    setIsToggling(true);
    try {
      // If stopped or created, start/resume
      await startRun(run.runId);
      run.setStatus("active");
    } catch (e) { console.error(e); }
    setIsToggling(false);
  };

  const handleStop = async () => {
    if (!run.runId) return;
    setIsToggling(true);
    try {
      await stopRun(run.runId);
      run.setStatus("stopped_by_user");
    } catch (e) { console.error(e); }
    setIsToggling(false);
  };

  useEffect(() => {
    let mounted = true;
    let eventSource: any = null;

    async function initRun() {
      try {
        let activeRunId = run.runId;

        // 1. Initial Fetch
        if (!activeRunId) {
          const latest = await getLatestRunForProject(id);
          if (latest && mounted) {
            activeRunId = latest.runId;
            run.setRunId(latest.runId);
            if (latest.selectedStrategyId) run.setSelectedStrategy(latest.selectedStrategyId);
            if (latest.calendar) run.setCalendar(latest.calendar as any);
            if (latest.status) run.setStatus(latest.status as RunStatus);

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
          }
        }

        if (!activeRunId && mounted) return;
        if (!mounted || !activeRunId) return;

        // 2. EXPLICIT START (Only if not already running or completed)
        // Check local status or rely on backend idempotent start
        if (run.status === "created") {
          try {
            const { startRun } = await import("../../../../lib/api");
            await startRun(activeRunId);
            run.setStatus("active");
          } catch (e) { console.warn("Start run warning:", e); }
        }

        setConn("open");

        // 3. LISTEN
        const { connectStream } = await import("../../../../lib/sseClient");
        let authoritativeStatus = "unknown";

        eventSource = connectStream(
          activeRunId,
          {
            onEvent: async (ev: any) => {
              if (ev.type === "status_update") {
                authoritativeStatus = ev.status;
                run.setStatus(ev.status as RunStatus);
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
                  if (authoritativeStatus === "completed") return; // Stale check
                  setStrategyPrompt({ items: ev.items, recommendedId: ev.recommendedId });
                  break;
                case "calendar_day":
                  run.setPhaseStatus(4, "running");
                  run.setCurrentPhase(4);
                  run.addCalendarEntries(ev.date, ev.entries);
                  break;
                case "done":
                  run.setPhaseStatus(4, "done");
                  run.setCurrentPhase(5);
                  run.setStatus("completed"); // Fixed mapping
                  setConn("closed");
                  await refreshRunDataFromDB(activeRunId!);
                  break;
                case "error":
                  run.setStatus("failed"); // Fixed mapping
                  break;
              }
            },
            onError: (msg) => { console.log("SSE Retry/Error:", msg); }
          }
        );

      } catch (err) {
        if (mounted) { setConn("closed"); run.setStatus("failed"); } // Fixed mapping
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
  const status = run.status;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <PhaseStepper phases={run.phases} current={run.currentPhase || 1} />

        {/* Unified Control Bar */}
        <div className="flex items-center gap-4">
          <ConnectionStatus status={conn} />

          {/* Status Badge */}
          <div className={`text-xs px-2 py-1 rounded font-mono uppercase ${status === 'active' ? 'bg-green-100 text-green-800' :
            status === 'completed' ? 'bg-blue-100 text-blue-800' :
              status === 'failed' ? 'bg-red-100 text-red-800' :
                status === 'stopped_by_user' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
            }`}>
            {status || 'UNKNOWN'}
          </div>

          {/* Action Buttons */}
          {status === 'active' && (
            <button
              onClick={handleStop} disabled={isToggling}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isToggling ? '...' : 'Stop'}
            </button>
          )}

          {(status === 'stopped_by_user' || status === 'client_disconnected') && (
            <button
              onClick={handleStart} disabled={isToggling}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isToggling ? '...' : 'Resume'}
            </button>
          )}

          {(status === 'created' || status === undefined) && (
            <button
              onClick={handleStart} disabled={isToggling}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isToggling ? 'Starting...' : 'Start Run'}
            </button>
          )}
          {/* Retry Logic for failed state if needed */}
        </div>
      </div>

      <MeetingTheater logs={currentLogs} />

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((p) => {
          const res = run.results[p as 1 | 2 | 3 | 4];
          if (!res) return <div key={p} className="border rounded-lg p-4 text-sm text-gray-500">Waiting for Phase {p}...</div>;
          return <PhaseResultCard key={p} phase={p} summary={res.summary} artifacts={res.artifacts} />;
        })}
      </div>

      {strategyPrompt && (
        <StrategySelectModal
          open
          items={strategyPrompt.items}
          recommendedId={strategyPrompt.recommendedId}
          brief={project.strategy}
          results={run.results}
          onSelect={confirmStrategy}
          onClose={() => setStrategyPrompt(null)}
        />
      )}

      {run.status === "completed" && (
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