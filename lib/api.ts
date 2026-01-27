import { nanoid } from "nanoid";
import { IS_REMOTE } from "./config";
import { http } from "./http";
import { AssetVersion, PhaseResult, GenerateAssetRequest, EditAssetRequest } from "../types/assets";
import { EventSelection } from "../types/events";
export * from "../types/assets";

export type Duration = { start: string; end: string };

export type ProjectMeta = {
  id: string;
  name: string;
  // region removed
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

// PhaseResult moved to types/assets.ts

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


// AssetMediaItem moved to types/assets.ts

// AssetVersion moved to types/assets.ts

// ... (keep Mock storage keys)
const LS_ASSET_VERSIONS = "sim:assetVersions";

// ... (keep read/write helpers)

// --- Video Types ---
export type VideoOverrides = {
  camera?: string;
  lighting?: string;
  action?: string;
};

export type VideoOptions = {
  cameras: string[];
  lighting: string[];
  actions: string[];
};

export async function getVideoOptions(): Promise<VideoOptions> {
  // Mocking simple options
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        cameras: ["Close Up", "Wide Angle", "Drone Shot", "Handheld", "Dolly Zoom"],
        lighting: ["Cinematic", "Natural", "Neon", "Studio", "Golden Hour"],
        actions: ["Slow Motion", "Time Lapse", "Tracking", "Pan", "Zoom In"]
      });
    }, 500);
  });
}

// --- Style Endpoints ---

interface StyleResponse {
  styles: string[];
}

export async function fetchStyleClasses(): Promise<string[]> {
  const MOCK_STYLES = [
    "Neon Cyberpunk",
    "Minimalist Clean",
    "Corporate Professional",
    "Playful Pop",
    "Cinematic Dark",
    "Luxury Gold",
    "Retro 80s",
    "Nature Organic"
  ];

  if (IS_REMOTE) {
    try {
      const data = await http<StyleResponse>('/api/styles');
      if (data.styles && data.styles.length > 0) return data.styles;
    } catch (e) {
      console.warn("Failed to fetch styles, using fallback", e);
    }
  }

  // Mock / Fallback Styles
  return new Promise(resolve => {
    // Return immediately if fallback, or small delay for mock feel
    setTimeout(() => resolve(MOCK_STYLES), 200);
  });
}

// --- Studio Endpoints ---

export async function getAssetHistory(assetId: string): Promise<AssetVersion[]> {
  if (IS_REMOTE) {
    return http<AssetVersion[]>(`/api/assets/${assetId}/versions`);
  }
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  // For mock: assetId is treated as entryId for simplicity in migration
  return (store[assetId] || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function previewPlan(assetId: string, slideCount?: number, overrides?: VideoOverrides): Promise<{ resolved_prompt: string; blueprint?: any }> {
  if (IS_REMOTE) {
    return http<{ resolved_prompt: string; blueprint?: any }>(`/api/assets/${assetId}/plan-preview`, {
      method: "POST",
      body: JSON.stringify({ slide_count: slideCount, blueprint_overrides: overrides })
    });
  }

  // Mock Logic
  return new Promise(resolve => setTimeout(() => {
    if (slideCount && slideCount > 1) {
      resolve({
        resolved_prompt: `A carousel with ${slideCount} slides about ocean opulence.`,
        blueprint: {
          image_prompt: "A highly detailed description of a luxurious yacht...",
          slides: Array.from({ length: slideCount }).map((_, i) => ({
            slide_num: i + 1,
            image_prompt: `[Slide ${i + 1}] Detailed composition for slide ${i + 1} with visual description...`
          }))
        }
      });
    } else {
      resolve({
        resolved_prompt: "A cinematic shot of a futuristic coffee shop with neon signs, 8k resolution, photorealistic."
      });
    }
  }, 1000));
}

export async function editAsset(assetId: string, payload: EditAssetRequest): Promise<{ task_id: string; new_version_id: string }> {
  if (IS_REMOTE) {
    return http<{ task_id: string; new_version_id: string }>(`/api/assets/${assetId}/edit`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  // Mock Logic
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ task_id: `mock-task-edit-${nanoid()}`, new_version_id: `mock-ver-edit-${nanoid()}` });
    }, 800);
  });
}

export async function generateAsset(
  assetId: string,
  finalPrompt: string | undefined,
  stepByStep: boolean = false,
  targetSlideCount: number = 1,
  options: { aspect_ratio?: string; style_class?: string; use_custom_styles?: boolean } = {}
): Promise<AssetVersion> {
  if (IS_REMOTE) {
    // ✅ AUTOPILOT MODE: Only include final_prompt if it has content
    // Backend triggers auto-planner when final_prompt is NOT provided
    const payload: any = { // Using any temporarily if type isn't updated yet, or I update type next
      step_by_step: stepByStep,
      slide_count: targetSlideCount,
      aspect_ratio: options.aspect_ratio as any,
      style_class: options.style_class,
      use_custom_styles: options.use_custom_styles ?? true
    };

    // Only add final_prompt if user provided content (Manual Mode)
    if (finalPrompt && finalPrompt.trim()) {
      payload.final_prompt = finalPrompt;
    }

    return http<AssetVersion>(`/api/assets/${assetId}/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Mock Logic
  const versionId = `ver_${nanoid(6)}`;
  const v: AssetVersion = {
    id: versionId,
    status: "processing",
    createdAt: new Date().toISOString(),
    assets: [],
    edit_reason: "Generated from Prompt",
    final_used_prompt: finalPrompt,
    blueprint: { image_prompt: finalPrompt, aspect_ratio: options.aspect_ratio }
  };

  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  // Prevent duplicate writes in mock
  const list = store[assetId] || [];
  if (!list.some(x => x.id === v.id)) {
    store[assetId] = [...list, v];
    write(LS_ASSET_VERSIONS, store);
  }

  // Simulate completion
  setTimeout(() => {
    const updatedStore = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
    const t = updatedStore[assetId]?.find(x => x.id === versionId);
    if (!t) return;

    if (targetSlideCount > 1) {
      // Carousel Logic
      if (stepByStep) {
        // Step 1 only
        t.assets = [{
          type: "image",
          url: `https://picsum.photos/seed/${versionId}-1/1080/1080`,
          slide_num: 1
        }];
        t.status = "waiting_for_approval";
        write(LS_ASSET_VERSIONS, updatedStore);
      } else {
        // All at once
        t.assets = Array.from({ length: targetSlideCount }).map((_, i) => ({
          type: "image",
          url: `https://picsum.photos/seed/${versionId}-${i}/1080/1080`,
          slide_num: i + 1
        }));
        t.status = "completed";
        write(LS_ASSET_VERSIONS, updatedStore);
      }
    } else {
      // Single Image
      t.status = "completed";
      const seed = Math.random();
      t.assets = [{ type: "image", url: `https://picsum.photos/seed/${versionId}/1080/1080` }];
      write(LS_ASSET_VERSIONS, updatedStore);
    }
  }, 2000);

  return v;
}

export async function resumeGeneration(versionId: string): Promise<void> {
  if (IS_REMOTE) {
    return http<void>(`/api/assets/versions/${versionId}/resume`, {
      method: "POST",
    });
  }
  // Mock Logic
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  // Find version across all assets (inefficient mock but fine)
  for (const assetId in store) {
    const v = store[assetId].find(x => x.id === versionId);
    if (v) {
      v.status = "processing";
      write(LS_ASSET_VERSIONS, store);
      setTimeout(() => {
        const refreshedStore = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
        const refreshedV = refreshedStore[assetId].find(x => x.id === versionId);
        if (refreshedV) {
          // Add remaining slides
          const currentCount = refreshedV.assets.length;
          // Finish the rest
          // In real step-by-step we might restart after every slide, but for mock let's just finish up or Add 1 by 1
          const nextSlideNum = currentCount + 1;
          refreshedV.assets.push({
            type: "image",
            url: `https://picsum.photos/seed/${versionId}-${nextSlideNum}/1080/1080`,
            slide_num: nextSlideNum
          });

          if (refreshedV.assets.length >= 5) { // Or target count.. hard to know target in resume mock unless stored
            refreshedV.status = "completed";
          } else {
            // Continue step by step? Let's say yes for the mock
            refreshedV.status = "waiting_for_approval";
          }

          write(LS_ASSET_VERSIONS, refreshedStore);
        }
      }, 2000);
      break;
    }
  }
}

export async function createFreshVersion(assetId: string): Promise<{ versionId: string; status: string; blueprint: any }> {
  if (IS_REMOTE) {
    return http<{ versionId: string; status: string; blueprint: any }>(`/api/assets/${assetId}/versions`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  // Mock Logic
  const versionId = `ver_${nanoid(6)}`;
  const v: AssetVersion = {
    id: versionId,
    status: "created",
    createdAt: new Date().toISOString(),
    assets: [],
    edit_reason: "Fresh Start",
    blueprint: {
      image_prompt: "", // Empty start
    }
  };

  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  store[assetId] = [...(store[assetId] || []), v];
  write(LS_ASSET_VERSIONS, store);

  return { versionId, status: "created", blueprint: v.blueprint };
}

export async function planAsset(assetId: string, overrides: { image_prompt?: string } = {}): Promise<{ versionId: string; status: string; blueprint: any }> {
  if (IS_REMOTE) {
    return http(`/api/assets/${assetId}/plan`, {
      method: "POST",
      body: JSON.stringify({ blueprint_overrides: overrides }),
    });
  }

  // Mock Logic
  const versionId = `ver_${nanoid(6)}`;
  const v: AssetVersion = {
    id: versionId,
    status: "ready_to_render",
    createdAt: new Date().toISOString(),
    assets: [],
    edit_reason: "Initial Plan",
    blueprint: {
      image_prompt: overrides.image_prompt || "A futuristic city with neons...",
      composition_notes: "Focus on high contrast and vibrant colors."
    }
  };

  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  store[assetId] = [...(store[assetId] || []), v];
  write(LS_ASSET_VERSIONS, store);

  return { versionId, status: "ready_to_render", blueprint: v.blueprint };
}

export async function updateBlueprint(versionId: string, blueprint: any): Promise<void> {
  if (IS_REMOTE) {
    await http(`/api/assets/versions/${versionId}`, {
      method: "PATCH",
      body: JSON.stringify({ blueprint }),
    });
    return;
  }

  // Mock Logic
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  let found = false;
  for (const list of Object.values(store)) {
    const v = list.find(x => x.id === versionId);
    if (v) {
      v.blueprint = { ...v.blueprint, ...blueprint };
      found = true;
      break;
    }
  }
  if (found) write(LS_ASSET_VERSIONS, store);
}

export async function executeGeneration(assetId: string, targetVersionId: string): Promise<void> {
  if (IS_REMOTE) {
    await http(`/api/assets/${assetId}/generate`, {
      method: "POST",
      body: JSON.stringify({ target_version_id: targetVersionId }),
    });
    return;
  }

  // Mock Logic
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  const list = store[assetId] || [];
  const target = list.find(x => x.id === targetVersionId);

  if (target) {
    target.status = "processing";
    write(LS_ASSET_VERSIONS, store);

    setTimeout(() => {
      const updatedStore = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
      const t = updatedStore[assetId]?.find(x => x.id === targetVersionId);
      if (t) {
        t.status = "completed";
        // Generate mock assets based on plan
        const seed = Math.random();
        const type = seed > 0.7 ? "video" : seed > 0.4 ? "carousel" : "image";

        if (type === "image") {
          t.assets = [{ type: "image", url: `https://picsum.photos/seed/${targetVersionId}/1080/1080` }];
        } else if (type === "carousel") {
          t.assets = Array.from({ length: 4 }).map((_, i) => ({
            type: "image",
            url: `https://picsum.photos/seed/${targetVersionId}-${i}/1080/1080`,
            slide_num: i + 1
          }));
        } else {
          t.assets = [{
            type: "video",
            url: "", // No actual video for mock
            thumbnail: `https://picsum.photos/seed/${targetVersionId}-thumb/1080/1920`
          }];
        }
        write(LS_ASSET_VERSIONS, updatedStore);
      }
    }, 4000);
  }


}

export async function submitEdit(
  assetId: string,
  payload: { sourceVersionId: string; prompt: string; slideNum?: number; aspect_ratio?: string }
): Promise<{ newVersionId: string; statusUrl: string }> {
  if (IS_REMOTE) {
    return http<{ newVersionId: string; statusUrl: string }>(`/api/assets/${assetId}/edit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Mock Logic
  const newVersionId = `ver_${nanoid(6)}`;
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  const source = store[assetId]?.find(x => x.id === payload.sourceVersionId);

  const v: AssetVersion = {
    id: newVersionId,
    status: "processing",
    createdAt: new Date().toISOString(),
    assets: [], // Start empty
    edit_reason: `User Edit: ${payload.prompt}`,
    blueprint: source?.blueprint // Copy context
  };

  store[assetId] = [...(store[assetId] || []), v];
  write(LS_ASSET_VERSIONS, store);

  setTimeout(() => {
    const updatedStore = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
    const target = updatedStore[assetId]?.find(x => x.id === newVersionId);
    const original = updatedStore[assetId]?.find(x => x.id === payload.sourceVersionId);

    if (target && original) {
      target.status = "completed";
      // Copy assets from source and modify one if slideNum is present, or replace all if not
      if (payload.slideNum !== undefined) {
        target.assets = original.assets.map(a =>
          a.slide_num === payload.slideNum
            ? { ...a, url: `https://picsum.photos/seed/${newVersionId}/1080/1080` } // "Redraw"
            : a
        );
      } else {
        // Global edit
        target.assets = original.assets.map((a, i) => ({
          ...a,
          url: `https://picsum.photos/seed/${newVersionId}-${i}/1080/1080`
        }));
      }
      write(LS_ASSET_VERSIONS, updatedStore);
    }
  }, 4000);

  return { newVersionId, statusUrl: `/assets/versions/${newVersionId}` };
}

export async function pollAssetVersion(versionId: string): Promise<AssetVersion | null> {
  // In real remote, we might fetch /assets/versions/:id
  // But our manual said GET /api/assets/versions/{version_id}
  if (IS_REMOTE) {
    return http<AssetVersion>(`/api/assets/versions/${versionId}`);
  }

  // Mock: search all stores (inefficient but works for mock)
  const store = read<Record<string, AssetVersion[]>>(LS_ASSET_VERSIONS, {});
  for (const list of Object.values(store)) {
    const found = list.find(v => v.id === versionId);
    if (found) return found;
  }
  return null;
}

// ... (Simulate deprecating old functions or redirecting them if needed, but keeping them for now to avoid breaking other imports until full migration)
// Legacy types might break, so I will comment out or adapt the OLD AssetVersion if it conflicts. 
// Actually, I am replacing the types, so old code using AssetVersion will break. 
// I must migrate old functions to return new types or update them.
// The old functions: getAssetVersions, generateAssetVersion etc.
// The manual implies "Studio Mode" replaces inline. 
// I will keep old functions for reference but they might need type adjustments to compile.
// Let's redefine old AssetVersion as LegacyAssetVersion if needed, or just let them break and I fix the page next.
// Wait, I am replacing "AssetVersion" and "Asset" types. 
// So `generateAssetVersion` signature in `lib/api.ts` will break.
// I should update old functions to return/work with NEW types if possible, OR just deprecate them.
// Since I am rewriting the CalendarDayPage to use Studio, the old functions might not be used there anymore.
// But valid TS is needed.
// I will comment out or update the old functions to essentially be stubs or simple adapters if possible.
// Or just remove them if I am confident.
// I'll comment out the old "Phase 5 (Assets)" section.


// Simple localStorage-backed simulation
const LS_PROJECTS = "sim:projects";
const LS_RUNS = "sim:runs";


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



// [LEGACY HELPERS REMOVED]
// Inline mock generation helpers...


export async function createProject(input: {
  name: string;
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

export async function startRun(runId: string): Promise<{ message: string; status: string }> {
  if (IS_REMOTE) {
    return http<{ message: string; status: string }>(`/runs/${runId}/start`, {
      method: "POST",
    });
  }
  // Mock mode: auto-success
  return { message: "Run started (mock)", status: "started" };
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

// [LEGACY / REMOVED]
// Inline generation logic replaced by Studio Mode.
// Former functions: getAssetVersions, generateAssetVersion, ensureDemoAssetVersion


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
      duration: { start, end },
      createdAt,
      updatedAt,
      strategy: {
        goal: "Demo Goal",
        audience: "Demo Audience",
        campaignStyles: [],
        alignWithEvents: false,
        region: region
      }
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
    await http(`/runs/${runId}/reset-phase-4`, { method: "POST" });
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

// --- PDF Report Generation ---
export async function downloadReport(runId: string): Promise<{ url: string }> {
  if (IS_REMOTE) {
    return http<{ url: string }>(`/runs/${runId}/report`);
  }
  // Mock: return a placeholder URL
  return { url: `https://example.com/mock-report-${runId}.pdf` };
}

// --- Events Selection ---
export type { EventSelection, CampaignDay, RegionalEvent } from "../types/events";

export async function confirmEventSelection(
  runId: string,
  selectedEvents: EventSelection[]
): Promise<{ status: string; event_count: number }> {
  if (IS_REMOTE) {
    return http<{ status: string; event_count: number }>(`/runs/${runId}/confirm-events`, {
      method: "POST",
      body: JSON.stringify({ selected_events: selectedEvents }),
    });
  }
  // Mock: return success
  return { status: "confirmed", event_count: selectedEvents.length };
}

// --- Instagram Visual DNA ---
export type InstagramCacheResult = {
  exists: boolean;
  images: number;
  videos: number;
};

export type AnalyzeVisualsRequest = {
  instagramUrl?: string;
  scrapeType: "images" | "videos" | "all";
  forceRescrape: boolean;
  maxCount: 3 | 5 | 10 | 12;
};

export async function checkInstagramCache(instagramUrl: string, projectId?: string): Promise<InstagramCacheResult> {
  if (IS_REMOTE) {
    return http<InstagramCacheResult>(`/projects/check-instagram-cache`, {
      method: "POST",
      body: JSON.stringify({ instagramUrl, projectId }),
    });
  }
  // Mock: pretend cache exists
  return { exists: true, images: 8, videos: 3 };
}

export async function analyzeVisuals(
  projectId: string,
  options: AnalyzeVisualsRequest
): Promise<{
  summary?: string;
  image_analysis: any[];
  video_analysis: any[];
  scraped_samples?: { name: string; url: string; type: "image" | "video" }[];
}> {
  if (IS_REMOTE) {
    return http(`/projects/${projectId}/analyze-visuals`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }
  // Mock: return empty results after delay
  return new Promise((resolve) =>
    setTimeout(() => resolve({ summary: "Mock: 0 images, 0 videos", image_analysis: [], video_analysis: [], scraped_samples: [] }), 2000)
  );
}