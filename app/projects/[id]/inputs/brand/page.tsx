"use client";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "../../../../../store/useProjectStore";
import { IS_REMOTE } from "../../../../../lib/config";
import { uploadFilesRemote } from "../../../../../lib/upload";
import { updateProject, checkInstagramCache, analyzeVisuals, type AnalyzeVisualsRequest } from "../../../../../lib/api";
import { nanoid } from "nanoid";
import { useState } from "react";

export default function BrandInputsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useProjectStore();

  // --- LOADING STATES ---
  const [isUploading, setIsUploading] = useState(false);

  // --- INSTAGRAM VISUAL DNA STATE ---
  const [instagramUrl, setInstagramUrl] = useState("");
  const [postCount, setPostCount] = useState<3 | 5 | 10 | 12>(5);
  const [forceRescrape, setForceRescrape] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ images: number; videos: number } | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    try {
      if (IS_REMOTE) {
        const uploaded = await uploadFilesRemote(Array.from(files), "doc", id);
        store.updateBrand({ files: [...store.brand.files, ...uploaded as any] });
        await updateProject(id, { id: id as any });
      } else {
        const items = Array.from(files).map((f) => ({ id: nanoid(10), name: f.name, type: f.type, size: f.size }));
        store.updateBrand({ files: [...store.brand.files, ...items] });
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function onImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    try {
      if (IS_REMOTE) {
        const uploaded = await uploadFilesRemote(Array.from(files), "image", id);
        store.updateBrand({ images: [...store.brand.images, ...uploaded.map((u) => ({ id: u.id, name: u.name, previewUrl: u.url }))] });
        await updateProject(id, { id: id as any });
      } else {
        const items = Array.from(files).map((f) => ({ id: nanoid(10), name: f.name }));
        store.updateBrand({ images: [...store.brand.images, ...items] });
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function removeFile(fileId: string) {
    const next = store.brand.files.filter((f) => f.id !== fileId);
    store.updateBrand({ files: next });
    try { await updateProject(id, { brand: store.brand } as any); } catch { }
  }

  async function removeImage(imageId: string) {
    const next = store.brand.images.filter((img) => img.id !== imageId);
    store.updateBrand({ images: next });
    try { await updateProject(id, { brand: store.brand } as any); } catch { }
  }

  // --- INSTAGRAM HANDLERS ---
  async function handleCheckCache() {
    if (!instagramUrl.trim()) return;
    try {
      const result = await checkInstagramCache(instagramUrl);
      if (result.exists) {
        setCacheInfo({ images: result.images, videos: result.videos });
      } else {
        setCacheInfo(null);
      }
    } catch (err) {
      console.error("Cache check failed:", err);
      setCacheInfo(null);
    }
  }

  async function handleAnalyzeVisuals() {
    if (!instagramUrl.trim()) {
      alert("Please enter an Instagram URL");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    try {
      const options: AnalyzeVisualsRequest = {
        instagramUrl,
        scrapeType: "all",
        forceRescrape,
        maxCount: postCount,
      };
      await analyzeVisuals(id, options);
      setAnalysisComplete(true);
      setCacheInfo(null);
    } catch (err) {
      alert("Analysis failed. Please try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Brand & Assets</h1>
        <p className="text-sm text-gray-600">Upload docs/images. We'll extract "Business DNA" (tone, colors, etc.) for you to review and edit on the next step.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Uploads</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Documents</label>
              <input type="file" multiple onChange={onFiles} disabled={isUploading} className="block w-full disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-sm mb-1">Images</label>
              <input type="file" multiple accept="image/*" onChange={onImages} disabled={isUploading} className="block w-full disabled:opacity-50" />
            </div>
            <div className="flex flex-wrap gap-2">
              {store.brand.files.map((f, i) => (
                <span key={`${f.id}-${i}`} className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-100">
                  {f.name}
                  <button aria-label="Remove file" className="text-gray-600 hover:text-black" onClick={() => removeFile(f.id)}>×</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {store.brand.images.map((img, i) => (
                <span key={`${img.id}-${i}`} className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-100">
                  {img.name}
                  <button aria-label="Remove image" className="text-gray-600 hover:text-black" onClick={() => removeImage(img.id)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Instagram Visual DNA Section */}
        <section className="border rounded-lg p-4">
          <h2 className="font-medium mb-2">Visual DNA (Instagram)</h2>
          <p className="text-xs text-gray-500 mb-3">Analyze your brand's Instagram to extract visual style patterns.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Instagram URL</label>
              <input
                type="url"
                placeholder="https://www.instagram.com/yourbrand/"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                onBlur={handleCheckCache}
                disabled={isAnalyzing}
                className="block w-full px-3 py-2 border rounded text-sm disabled:opacity-50"
              />
            </div>

            {/* Cache info banner */}
            {cacheInfo && (
              <div className="text-xs bg-gray-50 border rounded p-2">
                Found cached data: {cacheInfo.images} images, {cacheInfo.videos} videos.
                <span className="text-gray-500 ml-1">Enable "Force refresh" to re-scrape.</span>
              </div>
            )}

            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <label className="block text-sm mb-1">Posts to analyze</label>
                <select
                  value={postCount}
                  onChange={(e) => setPostCount(Number(e.target.value) as 3 | 5 | 10 | 12)}
                  disabled={isAnalyzing}
                  className="w-full px-3 py-2 border rounded text-sm disabled:opacity-50"
                >
                  <option value={3}>3 posts</option>
                  <option value={5}>5 posts</option>
                  <option value={10}>10 posts</option>
                  <option value={12}>12 posts</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="forceRescrape"
                  checked={forceRescrape}
                  onChange={(e) => setForceRescrape(e.target.checked)}
                  disabled={isAnalyzing}
                  className="w-4 h-4"
                />
                <label htmlFor="forceRescrape" className="text-sm">Force refresh</label>
              </div>
            </div>

            <button
              onClick={handleAnalyzeVisuals}
              disabled={isAnalyzing || !instagramUrl.trim()}
              className="w-full px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Brand Style"
              )}
            </button>

            {analysisComplete && (
              <div className="text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded p-2">
                ✓ Visual DNA extracted successfully!
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 rounded border" onClick={() => router.push(`/projects/${id}`)} disabled={isUploading || isAnalyzing}>Back</button>
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 flex items-center gap-2"
          disabled={isUploading || isAnalyzing}
          onClick={() => {
            updateProject(id, { brand: store.brand } as any).finally(() => {
              router.push(`/projects/${id}/inputs/strategy`);
            });
          }}
        >
          {isUploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
              Uploading...
            </>
          ) : "Continue"}
        </button>
      </div>
    </div>
  );
}