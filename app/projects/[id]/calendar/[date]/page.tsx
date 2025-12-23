"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { PromptModal } from "../../../../../components/common/PromptModal";
import { useRunStore, type CalendarEntry } from "../../../../../store/useRunStore";
import { IS_REMOTE } from "../../../../../lib/config";
import { uploadFilesRemote } from "../../../../../lib/upload";
import {
  ensureDemoAssetVersion,
  generateAssetVersion,
  getAssetVersions,
  getLatestRunForProject,
  type Asset,
  type AssetVersion,
} from "../../../../../lib/api";

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

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => dayEntries.find((e) => e.id === selectedEntryId) || null,
    [dayEntries, selectedEntryId]
  );

  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [cursor, setCursor] = useState<number>(0);
  const current = versions[cursor] || null;

  const [draftBaseText, setDraftBaseText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editRequest, setEditRequest] = useState<string | null>(null);

  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [uploadPromptOpen, setUploadPromptOpen] = useState(false);
  const [pendingUploadPrompt, setPendingUploadPrompt] = useState<string | null>(
    null
  );

  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState<null | "loadingVersions" | "generating" | "uploading">(null);
  const [error, setError] = useState<string | null>(null);

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
        const fromSnap: CalendarEntry[] =
          (snap?.calendar?.[date] ?? []) as unknown as CalendarEntry[];
        if (snap) {
          run.setRunId(snap.runId);
          run.setCalendar(snap.calendar as unknown as Record<string, CalendarEntry[]>);
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

  useEffect(() => {
    if (!dayEntries.length) {
      setSelectedEntryId(null);
      return;
    }
    setSelectedEntryId((prev) => prev || dayEntries[0]!.id);
  }, [dayEntries]);

  useEffect(() => {
    if (!selectedEntry) return;
    let mounted = true;
    (async () => {
      setBusy("loadingVersions");
      setError(null);
      try {
        await ensureDemoAssetVersion({ projectId: id, entry: selectedEntry });
        const list = await getAssetVersions(id, selectedEntry.id);
        if (!mounted) return;
        setVersions(list);
        setCursor(Math.max(0, list.length - 1));
        setIsEditing(false);
        setEditRequest(null);
      } catch (_err) {
        if (!mounted) return;
        setVersions([]);
        setCursor(0);
        setError("Failed to load asset versions.");
      } finally {
        if (mounted) setBusy(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, selectedEntry?.id]);

  useEffect(() => {
    if (!selectedEntry) return;
    if (isEditing) return;
    setDraftBaseText(current?.baseText || defaultBaseText(selectedEntry));
  }, [selectedEntry?.id, isEditing, current?.id]);

  const prettyDate = useMemo(() => {
    const d = dayjs(date);
    if (!d.isValid()) return date;
    return d.format("dddd, MMM D, YYYY");
  }, [date]);

  async function refreshVersions(entry: CalendarEntry) {
    const list = await getAssetVersions(id, entry.id);
    setVersions(list);
    setCursor(Math.max(0, list.length - 1));
  }

  // --- UPDATED LOGIC: Polling for Completion ---
  async function onGenerateNew() {
    if (!selectedEntry) return;
    setBusy("generating");
    setError(null);
    try {
      // 1. Start generation (Backend returns pending version immediately)
      const newVersion = await generateAssetVersion({
        projectId: id,
        entry: selectedEntry,
        baseText: draftBaseText,
        changeRequest: editRequest || undefined,
      });

      // Wait 10 seconds before checking the server for the first time.
      await new Promise((r) => setTimeout(r, 10000));

      // 2. Poll until the asset is ready (has visuals)
      const MAX_RETRIES = 30; // 60 seconds (2s interval)
      const INTERVAL = 3000;
      let isReady = false;

      for (let i = 0; i < MAX_RETRIES; i++) {
        // Wait
        await new Promise((r) => setTimeout(r, INTERVAL));

        // Fetch latest state from server
        const list = await getAssetVersions(id, selectedEntry.id);
        const specificVersion = list.find((v) => v.id === newVersion.id);

        // Check if visuals exist (Image URL, Video URL, or Carousel Items)
        // Note: The backend always returns a 'text' asset, so we look for others.
        const hasVisuals = specificVersion?.assets.some((a) => 
          (a.kind === 'image' && a.url) || 
          (a.kind === 'carousel' && a.items && a.items.length > 0) ||
          (a.kind === 'video' )
          // (a.kind === 'video' && a.url)
        );

        if (hasVisuals) {
          setVersions(list);
          setCursor(Math.max(0, list.length - 1)); // NOW we switch
          isReady = true;
          break;
        }
      }

      if (!isReady) {
        // If timed out, we still refresh to show whatever state we have
        await refreshVersions(selectedEntry);
        // Optional: you could setError("Generation took too long, check back later.")
      }

      setIsEditing(false);
      setEditRequest(null);
    } catch (_err) {
      console.error(_err);
      setError("Failed to generate assets.");
    } finally {
      setBusy(null);
    }
  }

  function beginEdit(prompt: string) {
    setEditRequest(prompt);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditRequest(null);
    if (selectedEntry) setDraftBaseText(current?.baseText || defaultBaseText(selectedEntry));
  }

  function beginUpload(prompt: string) {
    setPendingUploadPrompt(prompt);
    setUploadPromptOpen(false);
    fileRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedEntry) return;
    const prompt = pendingUploadPrompt;
    setPendingUploadPrompt(null);
    if (!prompt) return;

    setBusy("uploading");
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (IS_REMOTE) {
        const uploaded = await uploadFilesRemote([file], "image", id);
        imageUrl = uploaded[0]?.url;
      } else {
        imageUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onerror = () => rej(new Error("read_failed"));
          reader.onload = () => res(String(reader.result || ""));
          reader.readAsDataURL(file);
        });
      }

      await generateAssetVersion({
        projectId: id,
        entry: selectedEntry,
        baseText: draftBaseText,
        uploadPrompt: prompt,
        imageOverrideUrl: imageUrl,
      });
      await refreshVersions(selectedEntry);
    } catch (_err) {
      setError("Failed to upload image.");
    } finally {
      setBusy(null);
    }
  }

  const canPrev = cursor > 0;
  const canNext = cursor < versions.length - 1;

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
        <div className="grid gap-4 md:grid-cols-5">
          <aside className="md:col-span-2 border rounded-lg p-3">
            <div className="text-sm font-medium mb-2">Events</div>
            <div className="space-y-2">
              {dayEntries.map((e) => {
                const active = e.id === selectedEntryId;
                return (
                  <button
                    key={e.id}
                    className={`w-full text-left border rounded p-3 ${
                      active ? "border-black bg-gray-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedEntryId(e.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{e.title}</div>
                        <div className="text-xs text-gray-600">
                          {e.channel} • {e.type}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{e.effort || ""}</div>
                    </div>
                    {e.description ? (
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                        {e.description}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="md:col-span-3 border rounded-lg p-4 space-y-4">
            {!selectedEntry ? null : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-600">
                      {selectedEntry.channel} • {selectedEntry.type}
                    </div>
                    <div className="text-lg font-medium">{selectedEntry.title}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border disabled:opacity-50"
                      disabled={!canPrev}
                      onClick={() => setCursor((c) => Math.max(0, c - 1))}
                      title="Previous version"
                    >
                      ←
                    </button>
                    <div className="text-xs text-gray-600">
                      Version {versions.length ? cursor + 1 : 0}/{versions.length}
                    </div>
                    <button
                      className="px-2 py-1 rounded border disabled:opacity-50"
                      disabled={!canNext}
                      onClick={() => setCursor((c) => Math.min(versions.length - 1, c + 1))}
                      title="Next version"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      Asset Brief (editable)
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <button
                          className="text-sm px-3 py-1 rounded border"
                          onClick={() => setEditPromptOpen(true)}
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          className="text-sm px-3 py-1 rounded border"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        className="text-sm px-3 py-1 rounded bg-black text-white disabled:opacity-50 flex items-center gap-2"
                        disabled={busy === "generating" || busy === "loadingVersions"}
                        onClick={onGenerateNew}
                      >
                         {busy === "generating" && (
                           <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                         )}
                        {busy === "generating" ? "Generating..." : "Generate New Version"}
                      </button>
                    </div>
                  </div>

                  {editRequest && isEditing ? (
                    <div className="text-xs text-gray-600">
                      Edit prompt: <span className="font-medium">{editRequest}</span>
                    </div>
                  ) : null}

                  <textarea
                    value={draftBaseText}
                    onChange={(e) => setDraftBaseText(e.target.value)}
                    readOnly={!isEditing}
                    className="w-full border rounded px-3 py-2 h-32 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Generated Assets</div>
                  <div className="flex gap-2">
                    <button
                      className="text-sm px-3 py-1 rounded border"
                      onClick={() => setUploadPromptOpen(true)}
                      disabled={busy === "uploading" || busy === "loadingVersions"}
                    >
                      {busy === "uploading" ? "Uploading..." : "Upload Image"}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onFilePicked}
                    />
                  </div>
                </div>

                {busy === "loadingVersions" ? (
                  <div className="border rounded p-3 text-sm text-gray-600">
                    Loading assets...
                  </div>
                ) : !current ? (
                  <div className="border rounded p-3 text-sm text-gray-600">
                    No generated versions yet. Click “Generate New Version”.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="text-xs text-gray-500">
                      Generated {new Date(current.createdAt).toLocaleString()}
                    </div>
                    {current.changeRequest ? (
                      <div className="text-xs text-gray-600">
                        Change request:{" "}
                        <span className="font-medium">{current.changeRequest}</span>
                      </div>
                    ) : null}
                    {current.uploadPrompt ? (
                      <div className="text-xs text-gray-600">
                        Upload prompt:{" "}
                        <span className="font-medium">{current.uploadPrompt}</span>
                      </div>
                    ) : null}
                    <AssetGrid assets={current.assets} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {editPromptOpen && (
        <PromptModal
          title="Edit Prompt (required)"
          description="Before editing the brief, describe what you want to change."
          placeholder="e.g., Make it more playful, add a stronger CTA, shorten the hook..."
          confirmLabel="Start Editing"
          onConfirm={(prompt) => {
            setEditPromptOpen(false);
            beginEdit(prompt);
          }}
          onClose={() => setEditPromptOpen(false)}
        />
      )}

      {uploadPromptOpen && (
        <PromptModal
          title="Upload Prompt (required)"
          description="Before uploading an image, add context on how it should be used."
          placeholder="e.g., Use this image as the hero visual; keep brand colors; crop for 1:1..."
          confirmLabel="Choose Image"
          onConfirm={beginUpload}
          onClose={() => setUploadPromptOpen(false)}
        />
      )}
    </div>
  );
}

function AssetGrid({ assets }: { assets: Asset[] }) {
  return (
    <div className="grid gap-3">
      {assets.map((a) => {
        if (a.kind === "text") {
          return (
            <div key={a.id} className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-1">{a.title}</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">
                {a.text}
              </div>
            </div>
          );
        }
        if (a.kind === "image") {
          return (
            <div key={a.id} className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Image</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.alt || "Generated image"}
                className="w-full rounded border"
              />
            </div>
          );
        }
        if (a.kind === "carousel") {
          return (
            <div key={a.id} className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Carousel</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {a.items.map((it, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={it.url}
                    alt={it.alt || `Slide ${i + 1}`}
                    className="h-40 rounded border"
                  />
                ))}
              </div>
            </div>
          );
        }
        
        // --- ADDED VIDEO SUPPORT IN GRID ---
        if (a.kind === "video") {
          return (
            <div key={a.id} className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2 flex justify-between items-center">
                 <span>Video Asset</span>
                 {/* Show visual cue if we have script but no video URL yet (though polling usually handles this) */}
                 {/* {!a.url && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded animate-pulse">Processing...</span>} */}
              </div>
              
              {/* {a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <video 
                  src={a.url} 
                  controls 
                  className="w-full rounded border mb-2 bg-black aspect-video"
                  poster={a.thumbnailUrl}
                />
              ) : (
                <>
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnailUrl}
                        alt="Video thumbnail"
                        className="w-full rounded border mb-2 opacity-50 grayscale"
                      />
                    ) : null}
                    <div className="text-xs font-semibold text-gray-500 mb-1">Script:</div>
                    <pre className="text-xs whitespace-pre-wrap bg-gray-50 border rounded p-2 h-32 overflow-y-auto">
                        {a.script}
                    </pre>
                </>
              )} */}
            </div>
          );
        }
        
        return null;
      })}
    </div>
  );
}