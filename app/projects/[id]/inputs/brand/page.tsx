"use client";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "../../../../../store/useProjectStore";
import { IS_REMOTE } from "../../../../../lib/config";
import { uploadFilesRemote } from "../../../../../lib/upload";
import { updateProject, checkInstagramCache, analyzeVisuals, type AnalyzeVisualsRequest } from "../../../../../lib/api";
import { nanoid } from "nanoid";
import { useState } from "react";
import { VisualDNAModal } from "../../../../../components/common/VisualDNAModal";

export default function BrandInputsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useProjectStore();

  // --- STATE ---
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Visual Source Tab: 'instagram' or 'upload'
  const [visualSource, setVisualSource] = useState<'instagram' | 'upload'>('instagram');

  // Instagram State
  const [instagramUrl, setInstagramUrl] = useState("");
  const [postCount, setPostCount] = useState<3 | 5 | 10 | 12>(5);
  const [scrapeType, setScrapeType] = useState<"images" | "videos" | "all">("all");
  const [forceRescrape, setForceRescrape] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ images: number; videos: number } | null>(null);

  // Analysis Results
  const [analysisResult, setAnalysisResult] = useState<{ images: number; videos: number } | null>(null);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  // --- HANDLERS: STRATEGY DOCS (PDF/TXT) ---
  async function onStrategyDocs(e: React.ChangeEvent<HTMLInputElement>) {
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

  // --- HANDLERS: VISUAL MEDIA (Images + Videos) ---
  // We store these in the 'images' array of the store so the backend finds them
  async function onVisualMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    try {
      if (IS_REMOTE) {
        // Note: passing "image" kind helps backend grouping, but it accepts videos too
        const uploaded = await uploadFilesRemote(Array.from(files), "image", id);
        const newItems = uploaded.map((u) => ({ id: u.id, name: u.name, previewUrl: u.url }));

        const updatedImages = [...store.brand.images, ...newItems];
        store.updateBrand({ images: updatedImages });

        // Immediate save ensures backend can see them for analysis
        await updateProject(id, { brand: { ...store.brand, images: updatedImages } } as any);
      } else {
        const items = Array.from(files).map((f) => ({ id: nanoid(10), name: f.name, previewUrl: "" }));
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

  async function removeVisual(imageId: string) {
    const next = store.brand.images.filter((img) => img.id !== imageId);
    store.updateBrand({ images: next });
    try { await updateProject(id, { brand: store.brand } as any); } catch { }
  }

  // --- ANALYSIS LOGIC ---
  async function handleCheckCache() {
    if (!instagramUrl.trim()) return;
    setIsCheckingCache(true);
    try {
      const result = await checkInstagramCache(instagramUrl, id);
      if (result.exists) setCacheInfo({ images: result.images, videos: result.videos });
      else setCacheInfo(null);
    } catch (err) {
      console.error(err);
      setCacheInfo(null);
    } finally {
      setIsCheckingCache(false);
    }
  }

  async function handleAnalyze() {
    // Validation
    if (visualSource === 'instagram' && !instagramUrl.trim()) {
      alert("Please enter an Instagram URL.");
      return;
    }
    if (visualSource === 'upload' && store.brand.images.length === 0) {
      alert("Please upload at least one image or video.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setShowResults(false);

    try {
      const options: AnalyzeVisualsRequest = {
        // Only send URL if in Instagram mode
        instagramUrl: visualSource === 'instagram' ? instagramUrl : undefined,
        // Backend handles uploads automatically from DB
        scrapeType: scrapeType,
        forceRescrape,
        maxCount: postCount,
      };

      const result = await analyzeVisuals(id, options);

      setAnalysisResult({
        images: result.image_analysis?.length || 0,
        videos: result.video_analysis?.length || 0,
      });
      setFullAnalysisResult(result);
      setCacheInfo(null);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold">Brand Intelligence</h1>
        <p className="text-gray-600 mt-1">Provide the raw materials for the AI to understand your brand.</p>
      </div>

      {/* --- SECTION 1: STRATEGY DOCUMENTS --- */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">1. Strategic Context</h2>
        <p className="text-sm text-gray-500 mb-4">Upload Brand Guidelines, Tone of Voice docs, or Manifestos (PDF/TXT).</p>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.doc,.docx"
              onChange={onStrategyDocs}
              disabled={isUploading}
              className="hidden"
              id="strategy-upload"
            />
            <label htmlFor="strategy-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <span className="text-2xl text-gray-400">📄</span>
              <span className="text-sm font-medium text-gray-700">Click to upload documents</span>
            </label>
          </div>

          {/* File List */}
          {store.brand.files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {store.brand.files.map((f, i) => (
                <div key={`${f.id}-${i}`} className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border text-sm">
                  <span>{f.name}</span>
                  <button onClick={() => removeFile(f.id)} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 2: VISUAL DNA --- */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold mb-1">2. Visual DNA</h2>
          <p className="text-sm text-gray-500 mb-4">How should your content look? Choose a source.</p>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-gray-100 mb-6">
            <button
              onClick={() => setVisualSource('instagram')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${visualSource === 'instagram' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Instagram Scrape
            </button>
            <button
              onClick={() => setVisualSource('upload')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${visualSource === 'upload' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Manual Upload
            </button>
          </div>

          {/* --- TAB CONTENT: INSTAGRAM --- */}
          {visualSource === 'instagram' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Profile URL</label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://www.instagram.com/yourbrand/"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    onBlur={handleCheckCache}
                    disabled={isAnalyzing || isCheckingCache}
                    className="block w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                  />
                  {isCheckingCache && (
                    <div className="absolute right-3 top-3">
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin block"></span>
                    </div>
                  )}
                </div>
              </div>

              {cacheInfo && (
                <div className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded p-3">
                  <strong>Found in cache:</strong> {cacheInfo.images} images, {cacheInfo.videos} videos from this profile.
                </div>
              )}

              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Posts to Analyze</label>
                  <select
                    value={postCount}
                    onChange={(e) => setPostCount(Number(e.target.value) as any)}
                    disabled={isAnalyzing}
                    className="px-2 py-1.5 border rounded text-sm bg-gray-50"
                  >
                    <option value={3}>3 (Fast)</option>
                    <option value={5}>5 (Standard)</option>
                    <option value={10}>10 (Deep)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Content Type</label>
                  <select
                    value={scrapeType}
                    onChange={(e) => setScrapeType(e.target.value as any)}
                    disabled={isAnalyzing}
                    className="px-2 py-1.5 border rounded text-sm bg-gray-50 h-[34px]"
                  >
                    <option value="all">All Media</option>
                    <option value="images">Images Only</option>
                    <option value="videos">Videos Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="forceRescrape"
                    checked={forceRescrape}
                    onChange={(e) => setForceRescrape(e.target.checked)}
                    disabled={isAnalyzing}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <label htmlFor="forceRescrape" className="text-sm text-gray-600 select-none">Force re-scrape</label>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB CONTENT: MANUAL UPLOAD --- */}
          {visualSource === 'upload' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-400 transition-colors bg-gray-50/50">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={onVisualMedia}
                  disabled={isUploading || isAnalyzing}
                  className="hidden"
                  id="visual-upload"
                />
                <label htmlFor="visual-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-sm font-medium text-gray-700">Drop Images & Videos here</span>
                  <span className="text-xs text-gray-400">Supports JPG, PNG, MP4</span>
                </label>
              </div>

              {/* Visuals Grid */}
              {store.brand.images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {store.brand.images.map((img, i) => (
                    <div key={`${img.id}-${i}`} className="relative aspect-square bg-gray-100 rounded-md overflow-hidden group border">
                      {img.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.previewUrl} className="w-full h-full object-cover" alt="prev" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">MEDIA</div>
                      )}
                      <button
                        onClick={() => removeVisual(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- ACTION AREA --- */}
        <div className="bg-gray-50 p-6 border-t mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {analysisResult ? (
              <span className="text-green-600 font-medium">
                ✓ Analysis Complete ({analysisResult.images} imgs, {analysisResult.videos} vids)
              </span>
            ) : (
              "Ready to analyze."
            )}
          </div>

          <div className="flex gap-3">
            {analysisResult && (
              <button onClick={() => setShowResults(true)} className="px-4 py-2 text-sm underline text-gray-600 hover:text-black">
                View DNA Report
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isCheckingCache}
              className="px-6 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
            >
              {isAnalyzing && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isAnalyzing ? "Extracting DNA..." : "Analyze Brand Style"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <VisualDNAModal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        data={fullAnalysisResult}
      />

      {/* FOOTER */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <button className="px-5 py-2.5 rounded-lg border hover:bg-gray-50 transition-colors" onClick={() => router.push(`/projects/${id}`)} disabled={isUploading || isAnalyzing}>
          Cancel
        </button>
        <button
          className="px-6 py-2.5 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          disabled={isUploading || isAnalyzing || isSaving}
          onClick={() => {
            setIsSaving(true);
            updateProject(id, { brand: store.brand } as any)
              .then(() => {
                router.push(`/projects/${id}/inputs/strategy`);
              })
              .catch(() => setIsSaving(false));
          }}
        >
          {isSaving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : isUploading ? "Uploading..." : "Save & Continue"}
        </button>
      </div>
    </div >
  );
}