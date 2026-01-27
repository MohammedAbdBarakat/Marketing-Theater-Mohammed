"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useRunStore, type CalendarEntry } from "../../../../../store/useRunStore";
import { getLatestRunForProject } from "../../../../../lib/api";
import { StudioModal } from "../../../../../components/studio/StudioModal";

function defaultBaseText(entry: CalendarEntry) {
  return [
    `Create assets for this calendar entry:`,
    `- Date: ${entry.date}`,
    `- Channel: ${entry.channel}`,
    `- Type: ${entry.type}`,
    `- Title: ${entry.title}`,
    ``,
    `Write in brand voice and include a clear CTA.`,
  ].join("\n");
}

export default function CalendarDayPage() {
  const { id, date } = useParams<{ id: string; date: string }>();
  const run = useRunStore();

  const [dayEntries, setDayEntries] = useState<CalendarEntry[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Studio State
  const [studioOpen, setStudioOpen] = useState(false);
  const [selectedForStudio, setSelectedForStudio] = useState<CalendarEntry | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingDay(true);
      setError(null);
      try {
        const fromStore = (run.calendar && run.calendar[date]) || [];
        if (fromStore.length) {
          if (!mounted) return;
          setDayEntries(fromStore);
          return;
        }

        const snap = await getLatestRunForProject(id);

        // Helper to normalize keys (e.g. "2026-01-21 00:00:00" -> "2026-01-21")
        // Duplicated from calendar/page.tsx to ensure consistent behavior on direct reload
        const normalize = (cal: Record<string, CalendarEntry[]>) => {
          const norm: Record<string, CalendarEntry[]> = {};
          if (!cal) return norm;
          for (const [key, list] of Object.entries(cal)) {
            const d = key.split(" ")[0].split("T")[0];
            if (dayjs(d).isValid()) {
              norm[d] = [...(norm[d] || []), ...list];
            }
          }
          return norm;
        };

        const normalizedCalendar = normalize(snap?.calendar as unknown as Record<string, CalendarEntry[]>);
        const fromSnap: CalendarEntry[] = normalizedCalendar[date] || [];

        if (snap) {
          run.setRunId(snap.runId);
          run.setCalendar(normalizedCalendar);
          run.setPhaseStatus(4, "done");
          run.setCurrentPhase(5);
          run.setStatus("done");
        }
        if (!mounted) return;
        setDayEntries(fromSnap);
      } catch (_err) {
        if (!mounted) return;
        setError("Failed to load day entries.");
        setDayEntries([]);
      } finally {
        if (mounted) setLoadingDay(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date]);

  const prettyDate = useMemo(() => {
    const d = dayjs(date);
    if (!d.isValid()) return date;
    return d.format("dddd, MMM D, YYYY");
  }, [date]);

  const openStudio = (entry: CalendarEntry) => {
    setSelectedForStudio(entry);
    setStudioOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-gray-600">
            <Link href={`/projects/${id}/calendar`} className="underline">
              Calendar
            </Link>{" "}
            / {prettyDate}
          </div>
          <h1 className="text-2xl font-semibold">Day Plan</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${id}/calendar`}
            className="px-3 py-2 rounded border"
          >
            Back to Calendar
          </Link>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loadingDay ? (
        <div className="border rounded-lg p-4 text-sm text-gray-600">
          Loading day...
        </div>
      ) : dayEntries.length === 0 ? (
        <div className="border rounded-lg p-4 text-sm text-gray-600">
          No events scheduled for this day.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-1">
          <div className="text-sm text-gray-500 mb-2">Select an event to open the Asset Studio.</div>
          {dayEntries.map((e) => (
            <button
              key={e.id}
              className="w-full text-left border rounded-lg p-4 hover:bg-gray-50 hover:shadow-sm transition-all flex items-start justify-between group"
              onClick={() => openStudio(e)}
            >
              <div>
                <div className="text-lg font-medium group-hover:text-blue-600">{e.title}</div>
                <div className="text-sm text-gray-600">
                  {e.channel} • {e.type}
                </div>
                {e.description && (
                  <div className="mt-2 text-sm text-gray-500">{e.description}</div>
                )}
              </div>
              <div className="px-3 py-1 bg-gray-100 rounded text-xs text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                Open Studio →
              </div>
            </button>
          ))}
        </div>
      )}

      {studioOpen && selectedForStudio && (
        <StudioModal
          assetId={selectedForStudio.id}
          runId={run.runId || "mock-run-id"} // Safe fallback or ensure runId is present
          initialContext={{
            title: selectedForStudio.title,
            channel: selectedForStudio.channel,
            type: selectedForStudio.type,
            date: selectedForStudio.date, // Pass date explicitly
            baseText: defaultBaseText(selectedForStudio) // Or fetch real base text if stored
          }}
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  );
}