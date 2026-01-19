"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Duration = { start: string; end: string };

export type ProjectState = {
  projectId?: string;
  name: string;
  // region removed
  duration: Duration;
  brand: {
    toneOfVoice: string[];
    primaryColors: string[];
    guidelinesUrls: string[];
    guidelinesText?: string;
    images: { id: string; name: string; previewUrl?: string }[];
    files: { id: string; name: string; type: string; size: number; url?: string }[];
  };
  strategy: {
    goal: string;
    audience: string;
    campaignStyles: string[];
    alignWithEvents: boolean;
    region?: string;
    timeWindow?: Duration;
    preferences?: { tags?: string[]; ugc?: boolean; constraints?: string };
  };
  setProjectId: (id: string) => void;
  updateMeta: (p: Partial<Pick<ProjectState, "name" | "duration">>) => void;
  updateBrand: (b: Partial<ProjectState["brand"]>) => void;
  updateStrategy: (s: Partial<ProjectState["strategy"]>) => void;
  reset: () => void;
};

// --- UPDATED DEFAULTS HERE ---
const defaults: Omit<ProjectState, "setProjectId" | "updateMeta" | "updateBrand" | "updateStrategy" | "reset"> = {
  name: "Untitled Project",
  // region removed
  duration: {
    start: new Date().toISOString().slice(0, 10),
    end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString().slice(0, 10),
  },
  brand: {
    toneOfVoice: ["Confident", "Witty", "Practical"],
    primaryColors: ["#0ea5e9", "#111827", "#f59e0b"],
    guidelinesUrls: [],
    guidelinesText: "",
    images: [],
    files: [],
  },
  strategy: {
    // UPDATED FOR JUMEIRAH YACHTS TEST
    goal: "Increase high-ticket charter bookings for corporate events and sunset cruises in Dubai.",
    audience: "Affluent tourists visiting Dubai (EU/UK/Russia) and Corporate Event Managers seeking luxury venues.",
    campaignStyles: ["Social", "Influencers", "Events"],
    alignWithEvents: true,
    region: "Europe", // Using EU as proxy for Dubai/Intl
    timeWindow: undefined,
    preferences: {
      tags: ["Luxury", "Sailing", "Burj Al Arab", "VIP"],
      ugc: true,
      constraints: "Must explicitly mention the ID/Passport requirement for all guests. Focus on safety."
    },
  },
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectId: undefined,
      ...defaults,
      setProjectId: (id) => set({ projectId: id }),
      updateMeta: (p) => set((s) => ({ ...s, ...p })),
      updateBrand: (b) => set((s) => ({ ...s, brand: { ...s.brand, ...b } })),
      updateStrategy: (u) => set((s) => ({ ...s, strategy: { ...s.strategy, ...u } })),
      reset: () => set(() => ({ projectId: undefined, ...defaults })),
    }),
    { name: "marketing:project" }
  )
);