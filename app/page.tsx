"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "../lib/api";
import { useProjectStore } from "../store/useProjectStore";

export default function Home() {
  const router = useRouter();
  const projectStore = useProjectStore();

  useEffect(() => {
    projectStore.reset();
  }, []);

  const [name, setName] = useState("Untitled Project");
  // region state removed

  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10)
  );

  const [loading, setLoading] = useState(false);

  // --- ADDED: Validation Logic ---
  // Simple string comparison works reliably for YYYY-MM-DD format
  const isDateInvalid = start > end;
  // -------------------------------

  async function onContinue() {
    if (isDateInvalid) return; // Extra safety check

    setLoading(true);
    const duration = { start, end };
    const { projectId } = await createProject({
      name,
      duration,
    });
    projectStore.updateMeta({ name, duration });
    projectStore.setProjectId(projectId);
    router.push(`/projects/${projectId}/inputs/brand`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-xl p-6 border rounded-lg shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Welcome</h1>
            <p className="text-sm text-gray-600">Create a project to begin.</p>
          </div>
          <Link href="/projects" className="text-sm underline">
            All projects
          </Link>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Q1 Awareness"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End</label>
              <input
                type="date"
                min={start} /* ADDED: Prevents picking earlier dates in UI */
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={`w-full border rounded px-3 py-2 ${isDateInvalid ? "border-red-500 focus:ring-red-500" : ""
                  }`}
              />
            </div>
          </div>

          {/* --- ADDED: Error Message --- */}
          {isDateInvalid && (
            <p className="text-sm text-red-500">
              End date cannot be earlier than start date.
            </p>
          )}
          {/* ---------------------------- */}

          <button
            onClick={onContinue}
            disabled={loading || isDateInvalid} /* ADDED: Disable if invalid */
            className="mt-2 inline-flex items-center justify-center rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}