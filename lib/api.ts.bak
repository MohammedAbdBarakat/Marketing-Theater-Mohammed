"use client";
import { nanoid } from "nanoid";
import { IS_REMOTE } from "./config";
import { http } from "./http";

export type Duration = { start: string; end: string };

export type ProjectMeta = {
  id: string;
  name: string;
  region: string;
  duration: Duration;
  createdAt: string;
  updatedAt: string;
  brand?: BrandInputs;
  strategy?: StrategyInputs;
};

export type BrandInputs = {
  toneOfVoice: string[];
  primaryColors: string[]; // hex
  guidelinesUrls: string[]; // deprecated; prefer guidelinesText
  guidelinesText?: string;
  images: { id: string; name: string; previewUrl?: string }[];
  files: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
  }[];
};

export type StrategyInputs = {
  goal: string;
  audience: string;
  campaignStyles: string[]; // chips
  alignWithEvents: boolean;
  region?: string;
  timeWindow?: Duration;
  preferences?: { tags?: string[]; ugc?: boolean; constraints?: string };
};

export type PhaseResult = {
  phase: 1 | 2 | 3 | 4;
  summary: string;
  artifacts: any[];
  candidates?: {
    id: string;
    name: string;
    rationale: string;
    highlights: string[];
  }[];
};

export type CalendarEntry = {
  id: string;
  date: string; // ISO date
  channel: string;
  type: string; // content type
  title: string;
  owner?: string;
  effort?: "low" | "med" | "high";
  description?: string;
  relatedEvents?: string[];
};

export type RunSnapshot = {
  runId: string;
  projectId: string;
  createdAt: string;
  results: Record<string, PhaseResult>; // "1","2","3","4"
  selectedStrategyId?: string;
  calendar: Record<string, CalendarEntry[]>; // date -> entries
};

export type Asset =
  | { id: string; kind: "image"; url: string; alt?: string }
  | { id: string; kind: "carousel"; items: { url: string; alt?: string }[] }
  | { id: string; kind: "video"; title: string; script: string; thumbnailUrl?: string }
  | { id: string; kind: "text"; title: string; text: string };

export type AssetVersion = {
  id: string;
  projectId: string;
  entryId: string;
  date: string;
  createdAt: string;
  baseText: string;
  changeRequest?: string;
  uploadPrompt?: string;
  assets: Asset[];
};

// Simple localStorage-backed simulation
const LS_PROJECTS = "sim:projects";
const LS_RUNS = "sim:runs";
const LS_ASSET_VERSIONS = "sim:assetVersions";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

type EntryLike = Pick<CalendarEntry, "id" | "date" | "channel" | "type" | "title">;

function versionKey(projectId: string, entryId: string) {
  return `${projectId}:${entryId}`;
}

function defaultBaseTextForEntry(entry: EntryLike) {
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

function svgPlaceholder(params: { title: string; subtitle: string; bg: string }) {
  const esc = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${params.bg}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="70" y="240" font-size="64" font-family="Arial, sans-serif" fill="#fff" font-weight="700">${esc(params.title)}</text>
  <text x="70" y="320" font-size="32" font-family="Arial, sans-serif" fill="#e5e7eb">${esc(params.subtitle)}</text>
  <text x="70" y="560" font-size="24" font-family="Arial, sans-serif" fill="#9ca3af">Marketing Theater — Demo Asset</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seedFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function generateAssetsMock(params: {
  entry: EntryLike;
  baseText: string;
  imageOverrideUrl?: string;
}) {
  const { entry, baseText, imageOverrideUrl } = params;
  const seed = seedFromString(`${entry.id}:${baseText}`);
  const palette = ["#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#f59e0b"];
  const bg1 = palette[seed % palette.length];
  const bg2 = palette[(seed + 2) % palette.length];
  const bg3 = palette[(seed + 4) % palette.length];

  const caption = `“${entry.title}” — ${entry.channel} ${entry.type}. ${baseText
    .split("\n")
    .slice(-1)[0]
    ?.trim() || "Tap to learn more."}`;
  const videoScript = [
    `Hook: ${entry.title} (5s)`,
    `Problem: show the pain (8s)`,
    `Solution: show the product (10s)`,
    `Proof: quick testimonial/stat (6s)`,
    `CTA: try it today (4s)`,
  ].join("\n");

  const imageUrl =
    imageOverrideUrl ||
    svgPlaceholder({
      title: entry.title,
      subtitle: `${entry.channel} • ${entry.type}`,
      bg: bg1,
    });
  const carouselItems = [
    svgPlaceholder({
      title: entry.title,
      subtitle: "Slide 1 — Hook",
      bg: bg1,
    }),
    svgPlaceholder({
      title: entry.title,
      subtitle: "Slide 2 — Proof",
      bg: bg2,
    }),
    svgPlaceholder({
      title: entry.title,
      subtitle: "Slide 3 — CTA",
      bg: bg3,
    }),
  ];

  const assets: Asset[] = [
    { id: nanoid(8), kind: "text", title: "Caption", text: caption },
    { id: nanoid(8), kind: "image", url: imageUrl, alt: entry.title },
    {
      id: nanoid(8),
      kind: "carousel",
      items: carouselItems.map((url, i) => ({ url, alt: `${entry.title} — Slide ${i + 1}` })),
    },
    {
      id: nanoid(8),
      kind: "video",
      title: "Video Concept",
      script: videoScript,
      thumbnailUrl: svgPlaceholder({
        title: entry.title,
        subtitle: "Video thumbnail (demo)",
        bg: bg2,
      }),
    },
  ];
  return assets;
}

export async function createProject(input: {
  name: string;
  region: string;
  duration: Duration;
}): Promise<{ projectId: string }> {
  if (IS_REMOTE) {
    return http<{ projectId: string }>(`/projects`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  const id = nanoid(8);
  const projects = read<Record<string, ProjectMeta>>(LS_PROJECTS, {});
  const now = new Date().toISOString();
  projects[id] = {
    id,
    name: input.name || "Untitled Project",
    region: input.region || "US",
    duration: input.duration,
    createdAt: now,
    updatedAt: now,
  };
  write(LS_PROJECTS, projects);
  return new Promise((res) => setTimeout(() => res({ projectId: id }), 300));
}

export async function getProject(
  projectId: string
): Promise<ProjectMeta | null> {
  if (IS_REMOTE) {
    return http<ProjectMeta>(`/projects/${projectId}`);
  }
  const projects = read<Record<string, ProjectMeta>>(LS_PROJECTS, {});
  return projects[projectId] ?? null;
}

export async function updateProject(
  projectId: string,
  patch: Partial<ProjectMeta>
): Promise<void> {
  if (IS_REMOTE) {
    await http<void>(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    return;
  }
  const projects = read<Record<string, ProjectMeta>>(LS_PROJECTS, {});
  const current = projects[projectId];
  if (!current) return;
  projects[projectId] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  } as ProjectMeta;
  write(LS_PROJECTS, projects);
}

export async function createRun(input: {
  projectId: string;
  snapshot?: { brand?: BrandInputs; strategy?: StrategyInputs };
}): Promise<{ runId: string }> {
  if (IS_REMOTE) {
    return http<{ runId: string }>(`/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  const runId = nanoid(10);
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  runs[runId] = {
    runId,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
    results: {},
    calendar: {},
  };
  write(LS_RUNS, runs);
  return new Promise((res) => setTimeout(() => res({ runId }), 300));
}

export async function getRun(runId: string): Promise<RunSnapshot | null> {
  if (IS_REMOTE) {
    return http<RunSnapshot>(`/runs/${runId}`);
  }
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  return runs[runId] ?? null;
}

export async function getLatestRunForProject(
  projectId: string
): Promise<RunSnapshot | null> {
  if (IS_REMOTE) {
    return http<RunSnapshot>(`/projects/${projectId}/runs/latest`);
  }
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  const list = Object.values(runs).filter((r) => r.projectId === projectId);
  if (!list.length) return null;
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]!;
}

export async function savePhaseResult(
  runId: string,
  result: PhaseResult
): Promise<void> {
  if (IS_REMOTE) return; // backend persists
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  const run = runs[runId];
  if (!run) return;
  run.results[String(result.phase)] = result;
  write(LS_RUNS, runs);
}

export async function selectStrategy(
  runId: string,
  selectedStrategyId: string
): Promise<{ selectedStrategyId: string }> {
  if (IS_REMOTE) {
    return http<{ selectedStrategyId: string }>(
      `/runs/${runId}/select-strategy`,
      { method: "POST", body: JSON.stringify({ selectedStrategyId }) }
    );
  }
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  const run = runs[runId];
  if (!run) return { selectedStrategyId };
  run.selectedStrategyId = selectedStrategyId;
  write(LS_RUNS, runs);
  return { selectedStrategyId };
}

export async function appendCalendarDay(
  runId: string,
  date: string,
  entries: CalendarEntry[]
): Promise<void> {
  if (IS_REMOTE) return; // backend persists
  const runs = read<Record<string, RunSnapshot>>(LS_RUNS, {});
  const run = runs[runId];
  if (!run) return;
  run.calendar[date] = [...(run.calendar[date] || []), ...entries];
  write(LS_RUNS, runs);
}

// Simulated extraction from uploaded files/images
export async function extractBusinessDNA(input: {
  projectId?: string;
  files: BrandInputs["files"];
  images: BrandInputs["images"];
}): Promise<
  Pick<BrandInputs, "toneOfVoice" | "primaryColors" | "guidelinesText">
> {
  if (IS_REMOTE && input.projectId) {
    return http(`/projects/${input.projectId}/extract-dna`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }
  // Pretend “analysis”: seed from filenames to vary results
  const names = [
    ...input.files.map((f) => f.name.toLowerCase()),
    ...input.images.map((i) => i.name.toLowerCase()),
  ].join(" ");
  const tones = [
    "Confident",
    "Witty",
    "Practical",
    "Friendly",
    "Bold",
    "Helpful",
  ];
  const colors = [
    "#0ea5e9",
    "#111827",
    "#f59e0b",
    "#10b981",
    "#8b5cf6",
    "#ef4444",
  ];
  const pick = (seed: number, list: string[], n: number) =>
    Array.from({ length: n }, (_, i) => list[(seed + i) % list.length]);
  const seed = names.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
  return new Promise((res) =>
    setTimeout(
      () =>
        res({
          toneOfVoice: pick(seed, tones, 3),
          primaryColors: pick(seed + 2, colors, 3),
        }),
      400
    )
  );
}

export async function getAssetVersions(
  projectId: string,
  entryId: string
): Promise<AssetVersion[]> {
  if (IS_REMOTE) {
    return http<AssetVersion[]>(
      `/projects/${projectId}/entries/${entryId}/asset-versions`
    );
  }
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  return store[versionKey(projectId, entryId)] || [];
}

export async function generateAssetVersion(input: {
  projectId: string;
  entry: EntryLike;
  baseText?: string;
  changeRequest?: string;
  uploadPrompt?: string;
  imageOverrideUrl?: string;
}): Promise<AssetVersion> {
  const baseText = (input.baseText || "").trim() || defaultBaseTextForEntry(input.entry);

  if (IS_REMOTE) {
    return http<AssetVersion>(
      `/projects/${input.projectId}/entries/${input.entry.id}/asset-versions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: input.entry.date,
          baseText,
          changeRequest: input.changeRequest,
          uploadPrompt: input.uploadPrompt,
          imageOverrideUrl: input.imageOverrideUrl,
        }),
      }
    );
  }

  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  const key = versionKey(input.projectId, input.entry.id);
  const versions = store[key] || [];

  const v: AssetVersion = {
    id: nanoid(10),
    projectId: input.projectId,
    entryId: input.entry.id,
    date: input.entry.date,
    createdAt: new Date().toISOString(),
    baseText,
    changeRequest: input.changeRequest,
    uploadPrompt: input.uploadPrompt,
    assets: generateAssetsMock({
      entry: input.entry,
      baseText,
      imageOverrideUrl: input.imageOverrideUrl,
    }),
  };

  store[key] = [...versions, v];
  write(LS_ASSET_VERSIONS, store);
  return new Promise((res) => setTimeout(() => res(v), 250));
}

export async function ensureDemoAssetVersion(input: {
  projectId: string;
  entry: EntryLike;
}): Promise<AssetVersion[]> {
  if (IS_REMOTE) return [];
  const existing = await getAssetVersions(input.projectId, input.entry.id);
  if (existing.length) return existing;
  const v = await generateAssetVersion({
    projectId: input.projectId,
    entry: input.entry,
    baseText: defaultBaseTextForEntry(input.entry),
    changeRequest: "Initial demo generation",
  });
  return [v];
}

export async function ensureDemoProjects(): Promise<void> {
  if (IS_REMOTE) return;
  const existing = read<Record<string, ProjectMeta>>(LS_PROJECTS, {});
  if (Object.keys(existing).length) return;

  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 28)
    .toISOString()
    .slice(0, 10);

  const demo: Record<string, ProjectMeta> = {};
  const mk = (name: string, region: string): ProjectMeta => {
    const createdAt = new Date(now.getTime() - Math.random() * 7 * 864e5).toISOString();
    const updatedAt = new Date(now.getTime() - Math.random() * 2 * 864e5).toISOString();
    return {
      id: nanoid(8),
      name,
      region,
      duration: { start, end },
      createdAt,
      updatedAt,
    };
  };

  const a = mk("Demo: Q1 Awareness", "US");
  demo[a.id] = a;
  const b = mk("Demo: Creator Launch", "EU");
  demo[b.id] = b;

  write(LS_PROJECTS, demo);
}

export async function getProjects(): Promise<ProjectMeta[]> {
  if (IS_REMOTE) {
    return http<ProjectMeta[]>(`/projects`);
  }
  // Fallback for local storage mode (if needed)
  const projects = read<Record<string, ProjectMeta>>("sim:projects", {});
  return Object.values(projects).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function resetPhase4(runId: string): Promise<void> {
  if (IS_REMOTE) {
    await http(`/runs/${runId}/reset-phase-4`, { method: "DELETE" });
    return;
  }
  // Mock mode fallback (optional)
  console.log("Mock reset phase 4");
}


export async function deleteProject(id: string): Promise<void> {
  if (IS_REMOTE) {
    await http(`/projects/${id}`, { method: "DELETE" });
    return;
  }
  
  // Mock Mode: Delete from Local Storage
  const projects = read<Record<string, ProjectMeta>>(LS_PROJECTS, {});
  if (projects[id]) {
    delete projects[id];
    write(LS_PROJECTS, projects);
  }
}