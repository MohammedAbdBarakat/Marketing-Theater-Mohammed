"use client";
import ReactMarkdown from "react-markdown";

// --- HELPER: Clean up raw LLM output for better display ---
function preprocessMarkdown(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. Fix the "Title**:" pattern (common AutoGen artifact)
  // Changes "Luxury Sunset Showcase**:" to "**Luxury Sunset Showcase**:"
  clean = clean.replace(/(?<!\*\*)\b([A-Za-z0-9\s\-_]+)\*\*:/g, "\n\n**$1**:");

  // 2. Fix specific Phase 3 headers like "1. Headline Insight:"
  // Changes "1. Headline Insight: Text" to "\n\n**1. Headline Insight:** Text"
  clean = clean.replace(/(\d+\.)\s*([A-Za-z\s]+):/g, "\n\n**$1 $2:**");

  // 3. Force newlines before numbered lists if they are stuck to previous text
  // Changes "end of sentence. 2. Strengths:" to "end of sentence.\n\n2. Strengths:"
  clean = clean.replace(/([^\n])\s+(\d+\.)/g, "$1\n\n$2");

  // 4. Ensure bullet points start on new lines
  clean = clean.replace(/([^\n])\s*•/g, "$1\n•"); // For bullets
  clean = clean.replace(/([^\n])\s*-\s/g, "$1\n- "); // For dashes

  return clean;
}

export function PhaseResultCard({
  phase,
  summary,
  artifacts,
}: {
  phase: number;
  summary: string;
  artifacts: any[];
}) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm h-full flex flex-col">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        {/* meaningful labels based on phase */}
        {phase === 1 && "Strategy Drafts"}
        {phase === 2 && "Creative Concepts"}
        {phase === 3 && "Media Analysis"}
        {phase === 4 && "Campaign Plan"}
        {phase > 4 && `Phase ${phase} Output`}
      </div>
      
      <div className="font-semibold text-gray-900 mb-3">{summary}</div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar flex-1">
        {artifacts.map((a: any, i: number) => {
          // 1. Handle Plain Strings (Raw LLM Output)
          // We preprocess the string to fix formatting, then render Markdown
          if (typeof a === "string") {
            const formattedText = preprocessMarkdown(a);
            return (
              <div
                key={i}
                className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3 mb-2 prose prose-sm max-w-none leading-relaxed"
              >
                <ReactMarkdown>{formattedText}</ReactMarkdown>
              </div>
            );
          }

          // 2. Handle Structured Objects (Legacy/Alternative format)
          return (
            <div key={i} className="rounded border p-3 bg-gray-50">
              {a.title && (
                <div className="font-medium text-sm mb-1 text-gray-900">
                  {a.title}
                </div>
              )}

              {a.bullets && (
                <ul className="list-disc pl-4 text-sm text-gray-600 space-y-1">
                  {a.bullets.map((b: string, j: number) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}

              {a.items && (
                <ul className="list-disc pl-4 text-sm text-gray-600 space-y-1">
                  {a.items.map((b: string, j: number) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}

              {a.channel && (
                <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="font-semibold">Channel:</span> {a.channel}
                  </div>
                  <div>
                    <span className="font-semibold">Budget:</span> {a.budget}
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">KPIs:</span>{" "}
                    {(a.kpis || []).join(", ")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}