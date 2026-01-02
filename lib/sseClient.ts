"use client";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import { appendCalendarDay, savePhaseResult } from "./api";
import { IS_REMOTE, API_BASE } from "./config";

export type StreamEvent =
  | { type: "phase_start"; phase: number; title: string; participants: string[] }
  | { type: "log"; phase: number; speaker: string; text: string; ts: number }
  | { type: "phase_result"; phase: number; summary: string; artifacts: any[]; candidates?: any[] }
  | { type: "strategy_candidates"; items: any[]; recommendedId?: string }
  | { type: "calendar_day"; date: string; entries: any[] }
  | { type: "error"; message: string }
  | { type: "done" };

type Callbacks = {
  onEvent: (e: StreamEvent) => void;
  onError?: (msg: string) => void;
};

export function simulateRunStream(
  params: {
    runId: string;
    startDateISO: string;
    endDateISO: string;
    getSelectedStrategyId: () => string | undefined;
  },
  cb: Callbacks
): { stop: () => void; skipPhase: (phase: number) => void } {
  const timers: number[] = [];
  let stopped = false;

  function emit(e: StreamEvent) {
    cb.onEvent(e);
  }

  function schedule(fn: () => void, ms: number) {
    if (stopped) return;
    const id = window.setTimeout(fn, ms);
    timers.push(id);
  }

  async function runPhase(phase: 1 | 2 | 3) {
    const titles: Record<number, string> = {
      1: "Ideation Roundtable",
      2: "Creative Polish",
      3: "Channel Planning",
    };
    const participants: Record<number, string[]> = {
      1: ["CEO", "Creative Director", "Media Buyer"],
      2: ["Creative Director", "Copywriter", "Art Director"],
      3: ["Media Buyer"],
    };
    emit({ type: "phase_start", phase, title: titles[phase], participants: participants[phase] });

    const speakers = participants[phase];
    const lines = phase === 1 ? 12 : phase === 2 ? 10 : 8;
    for (let i = 0; i < lines; i++) {
      await new Promise<void>((res) =>
        schedule(() => {
          const speaker = speakers[i % speakers.length];
          emit({
            type: "log",
            phase,
            speaker,
            text:
              phase === 1
                ? sampleIdeationLog(i)
                : phase === 2
                  ? samplePolishLog(i)
                  : sampleChannelLog(i),
            ts: Date.now(),
          });
          res();
        }, 350 + Math.random() * 300)
      );
    }

    // Result per phase
    const result = phaseResults(phase);
    emit({ type: "phase_result", ...result });
    await savePhaseResult(params.runId, result);

    if (phase === 3) {
      const candidates = strategyCandidates();
      emit({ type: "strategy_candidates", ...candidates });
    }
  }

  async function runCalendarForSelected() {
    // Wait until selection exists
    let guard = 0;
    while (!params.getSelectedStrategyId() && guard < 240 && !stopped) {
      await new Promise<void>((r) => schedule(() => r(), 250));
      guard++;
    }
    if (!params.getSelectedStrategyId() || stopped) return;

    // Generate day-by-day calendar within duration window
    const start = dayjs(params.startDateISO);
    const end = dayjs(params.endDateISO);
    let cursor = start.clone();
    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      const entries = sampleEntriesForDate(cursor.toISOString());
      if (entries.length) {
        emit({ type: "calendar_day", date: cursor.format("YYYY-MM-DD"), entries });
        await appendCalendarDay(params.runId, cursor.format("YYYY-MM-DD"), entries);
      }
      await new Promise<void>((r) => schedule(() => r(), 200));
      cursor = cursor.add(1, "day");
    }
    emit({ type: "done" });
  }

  async function orchestrate() {
    await runPhase(1);
    await runPhase(2);
    await runPhase(3);
    await runCalendarForSelected();
  }

  orchestrate();

  return {
    stop() {
      stopped = true;
      timers.forEach((t) => clearTimeout(t));
    },
    skipPhase(_phase: number) {
      // No-op in simulation; could fast-forward by clearing timers
    },
  };

  // Helpers
  function phaseResults(phase: 1 | 2 | 3): any {
    if (phase === 1)
      return {
        phase,
        summary: "Three strong strategy directions synthesized from ideation.",
        artifacts: [
          { id: nanoid(6), title: "Momentum Launch", bullets: ["High-energy teasers", "UGC contests", "Cross-channel stunts"], risks: ["Production bandwidth", "Brand drift"] },
          { id: nanoid(6), title: "Trust & Proof", bullets: ["Founder stories", "Expert co-signs", "Use-case demos"], risks: ["Dry tone", "Long lead"] },
          { id: nanoid(6), title: "Hometown Hero", bullets: ["Local events", "Cause tie-ins", "Neighborhood media"], risks: ["Regional dilution", "Ops overhead"] },
        ],
      };
    if (phase === 2)
      return {
        phase,
        summary: "Refined directions with value props, tone, and pillars.",
        artifacts: [
          { title: "Value Props", items: ["Fastest to value", "Delightful UX", "Community-first"] },
          { title: "Tone", items: ["Confident", "Witty", "Practical"] },
          { title: "Content Pillars", items: ["Proof", "People", "Play"] },
        ],
      };
    return {
      phase,
      summary: "Channel plans with sample posts and budgets.",
      artifacts: [
        { channel: "TikTok", kpis: ["Views", "Saves"], budget: "$8-12k/mo", samplePost: "POV: You just discovered..." },
        { channel: "Email", kpis: ["CTR", "Reply"], budget: "$1-2k/mo", samplePost: "Subject: 3-minute wins" },
        { channel: "IRL Events", kpis: ["Signups", "Leads"], budget: "$5-8k/mo", samplePost: "Meetup playbook v1" },
      ],
    };
  }

  function strategyCandidates() {
    const items = [
      { id: "A", name: "Momentum Launch", rationale: "High reach burst with UGC flywheel.", highlights: ["UGC contests", "Creator collabs", "Hype window"] },
      { id: "B", name: "Trust & Proof", rationale: "Compounding credibility via proofs.", highlights: ["Case studies", "Expert features", "Tested offers"] },
      { id: "C", name: "Hometown Hero", rationale: "Local depth and community.", highlights: ["Event cadence", "Cause tie-ins", "Press angles"] },
    ];
    return { items, recommendedId: "B" };
  }

  function sampleEntriesForDate(dateISO: string) {
    const d = dayjs(dateISO);
    const weekday = d.day();
    const entries: any[] = [];
    if (weekday === 2) {
      entries.push({ id: nanoid(6), date: d.format("YYYY-MM-DD"), channel: "TikTok", type: "Video", title: "Duet a creator", effort: "med", owner: "Social", description: "Duet a mid-tier creator’s tutorial with our product overlay.", relatedEvents: ["#UGCWeek"] });
    }
    if (weekday === 4) {
      entries.push({ id: nanoid(6), date: d.format("YYYY-MM-DD"), channel: "Email", type: "Newsletter", title: "3-Minute Wins", effort: "low", owner: "CRM", description: "Tips newsletter featuring 3 quick wins with CTA.", relatedEvents: ["#WebinarNextWeek"] });
    }
    if (weekday === 6) {
      entries.push({ id: nanoid(6), date: d.format("YYYY-MM-DD"), channel: "Events", type: "Meetup", title: "Coffee & Q&A", effort: "high", owner: "Field", description: "Local meetup with founder Q&A", relatedEvents: ["Local Tech Fest"] });
    }
    return entries;
  }

  function sampleIdeationLog(i: number) {
    const msgs = [
      "What if we flip the reveal?",
      "Users do the setup, we amplify.",
      "Creator collab week one.",
      "Hook is the before/after.",
      "We seed insiders on day 0.",
      "Risks: production bottlenecks.",
      "Counter: templated briefs.",
      "Need a cause partner.",
      "Geo-first press angle.",
      "Earned media checklist.",
      "Okay, three directions forming.",
      "Aligning on constraints...",
    ];
    return msgs[i % msgs.length];
  }

  function samplePolishLog(i: number) {
    const msgs = [
      "Value props tightened.",
      "Tone: confident, witty, practical.",
      "Pillars: Proof, People, Play.",
      "Templating hooks now.",
      "Brand-safe color ramps.",
      "Risks documented.",
      "Visual language: bold sans.",
      "Motion: gentle parallax.",
      "Check ADA contrast.",
      "Polish complete.",
    ];
    return msgs[i % msgs.length];
  }

  function sampleChannelLog(i: number) {
    const msgs = [
      "TikTok: 3x/week, creator-led.",
      "Email: weekly wins.",
      "IG: reels + carousels.",
      "Events: monthly meetups.",
      "KPIs: saves, CTR, signups.",
      "Budget ranges drafted.",
      "Sample posts attached.",
      "Comparative report ready.",
    ];
    return msgs[i % msgs.length];
  }
}

export function attach(cb: Callbacks) {
  return cb;
}

export function connectStream(
  runId: string,
  cb: Callbacks
) {
  if (IS_REMOTE) {
    const es = new EventSource(`${API_BASE}/runs/${runId}/stream`, { withCredentials: true } as any);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        cb.onEvent(data);
      } catch (e) {
        cb.onError?.(`SSE parse error`);
      }
    };
    es.onerror = () => {
      cb.onError?.("SSE error");
    };
    return {
      stop() { es.close(); },
      skipPhase() { },
    };
  }
  // For mock mode, we need the extra params to simulate, but we'll extract them from a global or passed differently
  // For now, we'll keep the mock simulation as is, but wrapped to match signature if possible,
  // or just throw for mock if data missing. BUT, to keep mock working, we might need a separate mock-manager.
  // HOWEVER, the user specifically asked for "Pure Listener".
  // Let's just update the signature and rely on remote mostly, or pass mock params via a separate channel if needed.
  // Actually, the original code passed params to simulateRunStream.
  // Let's keep a "simulate" fallback but make the main entry point simple.
  return { stop: () => { }, skipPhase: () => { } }; // Mock temporarily disabled via this path, use simulateRunStream directly if needed
}
