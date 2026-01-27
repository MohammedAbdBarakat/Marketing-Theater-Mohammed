"use client";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "../../../../store/useProjectStore";
import { createRun, extractBusinessDNA } from "../../../../lib/api";
import { useRunStore } from "../../../../store/useRunStore";
import { useEffect, useRef, useState } from "react";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useProjectStore();
  const run = useRunStore();
  const [guidelines, setGuidelines] = useState(
    project.brand.guidelinesText || ""
  );
  const [extracting, setExtracting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const auto = useRef(false);

  useEffect(() => {
    // Auto-extract once if files exist
    if (
      !auto.current &&
      (project.brand.files.length || project.brand.images.length)
    ) {
      auto.current = true;
      onExtract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onStart() {
    setIsStarting(true);
    try {
      const { runId } = await createRun({
        projectId: id,
        snapshot: { brand: project.brand, strategy: project.strategy },
      });
      run.setRunId(runId);
      router.push(`/projects/${id}/run`);
    } catch (e) {
      console.error(e);
      setIsStarting(false);
    }
  }

  async function onExtract() {
    setExtracting(true);
    const dna = await extractBusinessDNA({
      projectId: id,
      files: project.brand.files,
      images: project.brand.images,
    });
    project.updateBrand(dna);
    setGuidelines(dna.guidelinesText || "");
    setExtracting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Review & Confirm</h1>
        <p className="text-sm text-gray-600">
          Trust preview before starting the build.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Business DNA</h2>
            <button
              onClick={onExtract}
              className="text-sm px-3 py-1 rounded border"
              disabled={extracting}
            >
              {extracting ? "Extracting…" : "Extract"}
            </button>
          </div>
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-1">Tone of Voice</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {project.brand.toneOfVoice.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-black text-white"
                >
                  {t}
                  <button
                    className="ml-1 text-white/80"
                    onClick={() =>
                      project.updateBrand({
                        toneOfVoice: project.brand.toneOfVoice.filter(
                          (x) => x !== t
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="tone"
                placeholder="Add tone..."
                className="border rounded px-2 py-1 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v)
                      project.updateBrand({
                        toneOfVoice: Array.from(
                          new Set([...(project.brand.toneOfVoice || []), v])
                        ),
                      });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <button
                className="px-3 py-1 rounded border"
                onClick={() => {
                  const el = document.getElementById(
                    "tone"
                  ) as HTMLInputElement;
                  const v = el?.value.trim();
                  if (v) {
                    project.updateBrand({
                      toneOfVoice: Array.from(
                        new Set([...(project.brand.toneOfVoice || []), v])
                      ),
                    });
                    el.value = "";
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Primary Colors</div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {project.brand.primaryColors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border"
                >
                  <span
                    className="inline-block w-4 h-4 rounded"
                    style={{ background: c }}
                  />
                  {c}
                  <button
                    className="ml-1"
                    onClick={() =>
                      project.updateBrand({
                        primaryColors: project.brand.primaryColors.filter(
                          (x) => x !== c
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="color"
                placeholder="#0ea5e9"
                className="border rounded px-2 py-1 flex-1"
              />
              <button
                className="px-3 py-1 rounded border"
                onClick={() => {
                  const el = document.getElementById(
                    "color"
                  ) as HTMLInputElement;
                  const v = el?.value.trim();
                  if (v) {
                    project.updateBrand({
                      primaryColors: Array.from(
                        new Set([...(project.brand.primaryColors || []), v])
                      ),
                    });
                    el.value = "";
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-1">Guidelines</div>
            <textarea
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="Paste guidelines or notes here..."
              className="w-full border rounded px-2 py-2 h-28"
            />
          </div>
        </section>
        <section className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Strategy Brief</h2>
          <ul className="text-sm space-y-1">
            <li>
              <b>Goal:</b> {project.strategy.goal}
            </li>
            <li>
              <b>Audience:</b> {project.strategy.audience}
            </li>
            <li>
              <b>Channels:</b> {project.strategy.campaignStyles.join(", ")}
            </li>
            <li>
              <b>Align with events:</b>{" "}
              {project.strategy.alignWithEvents ? "Yes" : "No"}
            </li>
          </ul>
        </section>
      </div>
      <div className="flex justify-end gap-2">
        <button
          className="px-4 py-2 rounded border"
          onClick={() => router.push(`/projects/${id}/inputs/strategy`)}
          disabled={extracting} // Disable back during extraction too
        >
          Back
        </button>
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 flex items-center gap-2"
          disabled={extracting} // Disable during extraction
          onClick={() => {
            project.updateBrand({ guidelinesText: guidelines });
            onStart();
          }}
        >
          {extracting ? (
            <>Wait for DNA...</>
          ) : "Start Strategy Build"}
        </button>
      </div>
    </div>
  );
}
