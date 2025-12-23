"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import { useProjectStore } from "../../../../store/useProjectStore";
import { useRunStore } from "../../../../store/useRunStore";
import { startStream } from "../../../../lib/sseClient";
import { PhaseStepper } from "../../../../components/run/PhaseStepper";
import { MeetingTheater } from "../../../../components/run/MeetingTheater";
import { PhaseResultCard } from "../../../../components/run/PhaseResultCard";
import { StrategySelectModal } from "../../../../components/run/StrategySelectModal";
import { selectStrategy, getLatestRunForProject, resetPhase4 } from "../../../../lib/api";
import { ConnectionStatus } from "../../../../components/run/ConnectionStatus";
import Link from "next/link";

export default function RunPage() {
  const { id } = useParams<{ id: string }>(); // Project ID
  const project = useProjectStore();
  const run = useRunStore();
  const [conn, setConn] = useState<"connecting" | "open" | "closed">("connecting");
  const [strategyPrompt, setStrategyPrompt] = useState<{ items: any[]; recommendedId?: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

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
                  if([1,2,3,4].includes(p)) {
                      run.setResult({ phase: p, summary: data.summary, artifacts: data.artifacts, candidates: data.candidates });
                      run.setPhaseStatus(p, "done");
                  }
               });
               if(latest.results["3"]) run.setCurrentPhase(4);
            }
          }
        }

        if (!activeRunId && mounted) activeRunId = "local"; 
        if (!mounted || !activeRunId) return;

        // 2. Start Stream
        run.setStatus("running");
        setConn("open");

        eventSource = startStream(
          {
            runId: activeRunId,
            startDateISO: dayjs(duration.start).toISOString(),
            endDateISO: dayjs(duration.end).toISOString(),
            getSelectedStrategyId: () => run.selectedStrategyId,
          },
          {
            onEvent: async (ev: any) => {
              switch (ev.type) {
                case "phase_start":
                  run.setCurrentPhase(ev.phase as 1|2|3|4);
                  run.setPhaseStatus(ev.phase as 1|2|3|4, "running");
                  break;
                case "log":
                  run.pushLog({ phase: ev.phase, speaker: ev.speaker, text: ev.text, ts: ev.ts });
                  break;
                case "phase_result":
                  run.setResult({ phase: ev.phase, summary: ev.summary, artifacts: ev.artifacts, candidates: ev.candidates });
                  run.setPhaseStatus(ev.phase as 1|2|3|4, "done");
                  if (ev.phase < 4) run.setCurrentPhase((ev.phase + 1) as any);
                  break;
                case "strategy_candidates":
                  setStrategyPrompt({ items: ev.items, recommendedId: ev.recommendedId });
                  break;
                case "calendar_day":
                  run.setPhaseStatus(4, "running");
                  run.setCurrentPhase(4);
                  // أثناء الـ Stream نستخدم البيانات المؤقتة للعرض فقط
                  run.addCalendarEntries(ev.date, ev.entries);
                  break;
                
                case "done":
                  // 🌟 هنا يحدث السحر: الاستبدال الفوري بالبيانات الحقيقية
                  run.setPhaseStatus(4, "done");
                  run.setCurrentPhase(5);
                  run.setStatus("done");
                  setConn("closed");
                  
                  // استدعاء المزامنة فوراً
                  await refreshRunDataFromDB(activeRunId!);
                  break;
                  
                case "error":
                  run.setStatus("error");
                  setConn("closed");
                  break;
              }
            },
          }
        );

      } catch (err) {
        if(mounted) { setConn("closed"); run.setStatus("error"); }
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

  const currentLogs = run.theater[run.currentPhase as 1|2|3|4|5] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PhaseStepper phases={run.phases} current={run.currentPhase || 1} />
        <ConnectionStatus status={conn} />
      </div>
      <MeetingTheater logs={currentLogs} />
      <div className="grid gap-4 md:grid-cols-3">
        {[1,2,3].map((p) => {
          const res = run.results[p as 1|2|3|4];
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

       {run.status === "done" && (
        <div className="rounded bg-green-50 border border-green-200 p-4 flex items-center justify-between">
          <div className="text-green-800 text-sm">
            <strong>Run completed.</strong> Open the Calendar to view details and generate assets.
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleRegenerate}
              disabled={isResetting}
              className="text-xs px-3 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isResetting ? "Resetting..." : "♻️ Regenerate Plan"}
            </button>
            
            <Link 
              href={`/projects/${id}/calendar`}
              className="text-xs px-3 py-2 rounded bg-green-700 text-white hover:bg-green-800"
            >
              Go to Calendar →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}