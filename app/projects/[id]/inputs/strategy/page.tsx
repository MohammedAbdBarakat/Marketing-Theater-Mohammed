"use client";
import { useParams, useRouter } from "next/navigation";
// --- !!! تم إصلاح مسارات الاستيراد هنا !!! ---
import { useProjectStore } from "../../../../../store/useProjectStore";
import { useState } from "react";
// --- !!! الخطوة 1: استيراد وظيفة الـ API والأنواع ---
import { updateProject } from "../../../../../lib/api";
import type { StrategyInputs } from "../../../../../lib/api";

export default function StrategyInputsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useProjectStore();

  // (الحالة المحلية للنموذج الأساسي - تبقى كما هي)
  const [goal, setGoal] = useState(store.strategy.goal);
  const [audience, setAudience] = useState(store.strategy.audience);
  const [styles, setStyles] = useState<string[]>(store.strategy.campaignStyles);
  const [align, setAlign] = useState<boolean>(store.strategy.alignWithEvents);
  const [region, setRegion] = useState(store.strategy.region || "US");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- !!! (الإضافة 1): إضافة حالات للحقول المتقدمة !!! ---
  const [preferencesTags, setPreferencesTags] = useState(
    store.strategy.preferences?.tags?.join(", ") || ""
  );
  // UGC removed
  const [constraints, setConstraints] = useState(
    store.strategy.preferences?.constraints || ""
  );

  // --- !!! الخطوة 2: إضافة حالة للتحميل وإدارة الأخطاء ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStyle(s: string) {
    setStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // --- !!! الخطوة 3: إنشاء وظيفة معالجة (Handler) جديدة لحفظ البيانات ---
  async function handleReviewClick() {
    setIsLoading(true); // (إظهار مؤشر التحميل)
    setError(null);

    // --- !!! (التعديل 3): تجميع كائن التفضيلات (Preferences) ---
    // نبدأ بالبيانات الكاملة من الـ store
    const strategyData: StrategyInputs = {
      ...store.strategy,
      // ثم نكتب فوقها بالقيم الجديدة من الحالة المحلية
      goal: goal,
      audience: audience,
      campaignStyles: styles,
      alignWithEvents: align,
      region: region,
      // --- الإضافة الجديدة هنا ---
      preferences: {
        ...store.strategy.preferences, // (الحفاظ على أي قيم أخرى)
        // تحويل النص المفصول بفواصل إلى مصفوفة نصوص
        tags: preferencesTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        // ugc removed
        constraints: constraints,
      },
      // --- نهاية الإضافة ---
    };
    // --- نهاية الإصلاح ---

    try {
      // إرسال البيانات (الكاملة) إلى الـ Backend أولاً
      // هذا يستدعي (PUT /projects/{id})
      await updateProject(id, { strategy: strategyData });

      // إذا نجح الإرسال، قم بتحديث الـ Store المحلي
      store.updateStrategy(strategyData);

      // الانتقال إلى الصفحة التالية
      router.push(`/projects/${id}/review`);
    } catch (err) {
      console.error(err);
      setError("Failed to save strategy. Please try again."); // إظهار خطأ للمستخدم
    } finally {
      setIsLoading(false); // (إخفاء مؤشر التحميل)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Strategy Inputs</h1>
        <p className="text-sm text-gray-600">
          Minimal fields with progressive disclosure.
        </p>
      </div>

      {/* ... (بقية كود النموذج يبقى كما هو) ... */}
      <div className="border rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm mb-1">Primary Goal</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., Awareness + Signups"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Audience</label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., Busy pros in tech hubs"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Campaign Styles</label>
          <div className="flex flex-wrap gap-2">
            {["Social", "Events", "Email", "PR", "Influencers"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStyle(s)}
                className={`text-xs px-3 py-1 rounded-full border ${styles.includes(s) ? "bg-black text-white" : ""
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="align"
            type="checkbox"
            checked={align}
            onChange={(e) => setAlign(e.target.checked)}
          />
          <label htmlFor="align" className="text-sm">
            Align with upcoming events?
          </label>
        </div>
        {align && (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="Global">Global</option>
                <option value="North America">North America</option>
                <option value="Latin America">Latin America</option>
                <option value="Europe">Europe</option>
                <option value="Middle East">Middle East</option>
                <option value="GCC">GCC (Gulf Cooperation Council)</option>
                <option value="Africa">Africa</option>
                <option value="Asia Pacific">Asia Pacific</option>
              </select>
            </div>
          </div>
        )}
        <button
          className="text-sm text-gray-700 underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide" : "Show"} details
        </button>

        {/* --- !!! (التعديل 2): ربط الحالة بالمدخلات --- */}
        {showAdvanced && (
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm mb-1">Preferences (tags)</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="e.g., UGC, creators"
                value={preferencesTags}
                onChange={(e) => setPreferencesTags(e.target.value)}
              />
            </div>
            {/* UGC option removed */}
            <div>
              <label className="block text-sm mb-1">Constraints</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="e.g., Legal approvals needed"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* --- !!! الخطوة 4: تحديث الأزرار --- */}
      <div className="flex justify-end gap-2">
        <button
          className="px-4 py-2 rounded border"
          onClick={() => router.push(`/projects/${id}/inputs/brand`)}
          disabled={isLoading}
        >
          Back
        </button>
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={handleReviewClick}
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Review"}
        </button>
      </div>

      {/* (اختياري: عرض رسالة الخطأ إذا حدث فشل) */}
      {error && (
        <div className="text-right text-sm text-red-600 mt-2">{error}</div>
      )}
    </div>
  );
}
