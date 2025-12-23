"use client";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "../../../../../store/useProjectStore";
import { IS_REMOTE } from "../../../../../lib/config";
import { uploadFilesRemote } from "../../../../../lib/upload";
import { updateProject } from "../../../../../lib/api";
import { nanoid } from "nanoid";
import { useState } from "react";

export default function BrandInputsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useProjectStore();
  
  // --- ADDED LOADING STATE ---
  const [isUploading, setIsUploading] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true); // START
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
        setIsUploading(false); // END
    }
  }

  async function onImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true); // START
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
        setIsUploading(false); // END
    }
  }

  async function removeFile(fileId: string) {
    const next = store.brand.files.filter((f) => f.id !== fileId);
    store.updateBrand({ files: next });
    try { await updateProject(id, { brand: store.brand } as any); } catch {}
  }

  async function removeImage(imageId: string) {
    const next = store.brand.images.filter((img) => img.id !== imageId);
    store.updateBrand({ images: next });
    try { await updateProject(id, { brand: store.brand } as any); } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Brand & Assets</h1>
        <p className="text-sm text-gray-600">Upload docs/images. We’ll extract “Business DNA” (tone, colors, etc.) for you to review and edit on the next step.</p>
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
      </div>
      <div className="flex justify-end gap-2">
        <button className="px-4 py-2 rounded border" onClick={() => router.push(`/projects/${id}`)} disabled={isUploading}>Back</button>
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 flex items-center gap-2"
          disabled={isUploading}
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