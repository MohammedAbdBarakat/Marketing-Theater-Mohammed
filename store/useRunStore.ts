"use client";
import { create } from "zustand";

export type PhaseStatus = "idle" | "running" | "done" | "error" | "waiting_for_selection" | "waiting_for_events";

export type TheaterLog = { phase: number; speaker: string; text: string; ts: number };

export type PhaseResult = {
  phase: 1 | 2 | 3 | 4;
  summary: string;
  artifacts: any[];
  candidates?: { id: string; name: string; rationale: string; highlights: string[] }[];
};

export type CalendarEntry = {
  id: string;
  date: string;
  channel: string;
  type: string;
  title: string;
  owner?: string;
  effort?: "low" | "med" | "high";
  description?: string;
  relatedEvents?: string[];
};

export type RunState = {
  runId?: string;
  status: PhaseStatus;
  currentPhase: 1 | 2 | 3 | 4 | 5 | 0;
  phases: Record<1 | 2 | 3 | 4 | 5, PhaseStatus>;
  theater: Record<1 | 2 | 3 | 4 | 5, TheaterLog[]>;
  results: Partial<Record<1 | 2 | 3 | 4, PhaseResult>>;
  selectedStrategyId?: string;
  calendar: Record<string, CalendarEntry[]>; // ISO date -> entries

  setRunId: (id: string) => void;
  setStatus: (s: PhaseStatus) => void;
  setPhaseStatus: (p: 1 | 2 | 3 | 4 | 5, s: PhaseStatus) => void;
  setCurrentPhase: (p: RunState["currentPhase"]) => void;
  pushLog: (log: TheaterLog) => void;
  setResult: (result: PhaseResult) => void;
  setSelectedStrategy: (id: string) => void;
  addCalendarEntries: (date: string, entries: CalendarEntry[]) => void;
  setCalendar: (calendar: Record<string, CalendarEntry[]>) => void;
  setTheater: (theater: Record<number, TheaterLog[]>) => void;
  reset: () => void;
};

export const useRunStore = create<RunState>()((set, get) => ({
  runId: undefined,
  status: "idle",
  currentPhase: 0,
  phases: { 1: "idle", 2: "idle", 3: "idle", 4: "idle", 5: "idle" },
  theater: { 1: [], 2: [], 3: [], 4: [], 5: [] },
  results: {},
  selectedStrategyId: undefined,
  calendar: {},

  setRunId: (id) => set({ runId: id }),
  setStatus: (s) => set({ status: s }),
  setPhaseStatus: (p, s) => set((st) => ({ phases: { ...st.phases, [p]: s } })),
  setCurrentPhase: (p) => set({ currentPhase: p }),
  pushLog: (log) =>
    set((st) => {
      const existing = st.theater[log.phase as 1 | 2 | 3 | 4 | 5] || [];
      // Dedup: check if same log exists (by text & speaker)
      const isDuplicate = existing.some(
        (l) => l.text === log.text && l.speaker === log.speaker && l.phase === log.phase
      );
      if (isDuplicate) return st;

      const max = 50;
      const next = [...existing, log].slice(-max);
      return { theater: { ...st.theater, [log.phase as 1 | 2 | 3 | 4 | 5]: next } };
    }),
  setTheater: (theater) => set({ theater: { ...theater } as any }),
  setResult: (result) =>
    set((st) => ({ results: { ...st.results, [result.phase]: result } })),
  setSelectedStrategy: (id) => set({ selectedStrategyId: id }),
  addCalendarEntries: (date, entries) =>
    set((st) => ({ calendar: { ...st.calendar, [date]: [...(st.calendar[date] || []), ...entries] } })),
  setCalendar: (calendar) => set({ calendar }),
  reset: () =>
    set({
      runId: undefined,
      status: "idle",
      currentPhase: 0,
      phases: { 1: "idle", 2: "idle", 3: "idle", 4: "idle", 5: "idle" },
      theater: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      results: {},
      selectedStrategyId: undefined,
      calendar: {},
    }),
}));
