"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ensureDemoProjects, getProjects, deleteProject, type ProjectMeta } from "../../lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to refresh list
  const loadProjects = async () => {
    try {
      setLoading(true);
      await ensureDemoProjects();
      const items = await getProjects();
      setProjects(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, projectId: string, projectName: string) => {
    // Stop the Link from being clicked
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${projectName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteProject(projectId);
      // Remove from UI immediately for speed
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      alert("Failed to delete project");
      console.error(err);
    }
  };

  const hasProjects = useMemo(() => projects.length > 0, [projects.length]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/projects" className="font-semibold">
            Marketing Theater
          </Link>
          <div className="flex gap-2">
            <Link
              href="/"
              className="text-sm px-3 py-2 rounded bg-black text-white"
            >
              New Project
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-gray-600">
              Pick a project to continue.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="border rounded-lg p-4 text-sm text-gray-600">
            Loading projects...
          </div>
        ) : !hasProjects ? (
          <div className="border rounded-lg p-4 text-sm text-gray-600">
            No projects yet. Create one to begin.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group relative border rounded-lg p-4 hover:bg-gray-50 transition-colors block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium group-hover:text-blue-600 transition-colors">{p.name}</div>
                    <div className="text-sm text-gray-600">
                      Region: {p.strategy?.region || "Global"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <div>Updated</div>
                    <div>{new Date(p.updatedAt).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* DELETE BUTTON */}
                <button
                  onClick={(e) => handleDelete(e, p.id, p.name)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                  title="Delete Project"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}