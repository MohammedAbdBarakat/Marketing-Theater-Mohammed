"use client";
import { useState, useEffect, useRef } from "react";
import type { TheaterLog } from "../../store/useRunStore";
import ReactMarkdown from "react-markdown";

type ViewMode = "collapsed" | "default" | "expanded";

interface MeetingTheaterProps {
  logs: Record<number, TheaterLog[]>;
  currentPhase: number;
  isDone?: boolean;
}

export function MeetingTheater({ logs, currentPhase, isDone }: MeetingTheaterProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("default");
  const [activeTab, setActiveTab] = useState<number>(currentPhase || 1);
  const [reduceMotion, setReduce] = useState(false);

  // Sync active tab with current phase updates, unless user manually switched (optional logic, sticking to sync for now)
  useEffect(() => {
    if (currentPhase) setActiveTab(currentPhase);
  }, [currentPhase]);

  // Auto-collapse when done
  useEffect(() => {
    if (isDone) {
      setViewMode("collapsed");
    }
  }, [isDone]);

  // Auto-scroll logic (scoped to the active tab's logs)
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLogs = logs[activeTab] || [];
  const lastLogIndex = activeLogs.length - 1;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    }
  }, [activeLogs.length, viewMode, reduceMotion, activeTab]);

  if (viewMode === "collapsed") {
    return (
      <div
        className="mb-4 rounded-lg border p-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:shadow-md transition-all duration-300"
        onClick={() => setViewMode("default")}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Meeting Theater</span>
          {currentPhase !== 5 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Phase {activeTab} • {activeLogs.length} msgs
            </span>
          )}
        </div>
        <button className="text-xs text-gray-600 font-medium hover:text-black hover:underline transition-colors">Expand</button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg bg-white shadow-lg flex flex-col transition-all duration-300 overflow-hidden ${viewMode === "expanded" ? "fixed inset-4 z-50 shadow-2xl" : "relative mb-4"}`}>

      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold tracking-wide text-gray-900">Meeting Theater</div>

          {/* Phase Tabs */}
          <div className="flex items-center gap-1 bg-gray-200/50 p-1 rounded-lg">
            {[1, 2, 4].map((p) => (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                className={`text-xs px-3 py-1 rounded transition-all duration-200 ${activeTab === p
                  ? "bg-white text-black font-bold shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                  }`}
              >
                Phase {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-gray-900 transition-colors select-none">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduce(e.target.checked)}
              className="rounded border-gray-300 text-black focus:ring-black focus:ring-offset-0 bg-white w-3.5 h-3.5"
            />
            Reduce motion
          </label>

          <div className="h-4 w-[1px] bg-gray-300 mx-1" />

          <button
            className={`transition-colors hover:text-black ${viewMode === 'default' ? 'text-black font-bold' : ''}`}
            onClick={() => setViewMode("default")}
            disabled={viewMode === "default"}
          >
            Box
          </button>
          <button
            className={`transition-colors hover:text-black ${viewMode === 'expanded' ? 'text-black font-bold' : ''}`}
            onClick={() => setViewMode("expanded")}
            disabled={viewMode === "expanded"}
          >
            Full
          </button>
          <button
            className="text-gray-400 hover:text-red-500 transition-colors ml-2"
            onClick={() => setViewMode("collapsed")}
          >
            Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className={`overflow-y-auto p-5 space-y-6 custom-scrollbar bg-white ${viewMode === 'expanded' ? 'flex-1' : 'h-96'}`}
      >
        {activeLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
            {!isDone && activeTab === currentPhase ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs">Waiting for messages...</span>
              </div>
            ) : (
              <span className="text-xs italic">No logs for Phase {activeTab} yet.</span>
            )}
          </div>
        ) : (
          activeLogs.map((l, idx) => (
            <div key={idx} className="flex items-start gap-3 text-sm group animate-in fade-in slide-in-from-bottom-1 duration-300">
              <span className="inline-flex items-center justify-center w-8 h-8 min-w-[2rem] rounded-full bg-black text-white text-xs font-bold flex-shrink-0 shadow-sm ring-2 ring-gray-50 group-hover:ring-gray-200 transition-all">
                {avatar(l.speaker)}
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                    {l.speaker}
                  </div>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {l.ts ? new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                  </span>
                </div>
                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none prose-p:my-0 prose-ul:my-1 prose-li:my-0 prose-strong:font-bold prose-headings:font-bold prose-headings:text-xs prose-headings:uppercase prose-a:text-blue-600">
                  {/* Only animate the VERY LAST message if it's new and motion is allowed */}
                  {idx === lastLogIndex && !reduceMotion && activeTab === currentPhase ? (
                    <Typewriter text={l.text} />
                  ) : (
                    <ReactMarkdown>{l.text}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Live Indicator (only if not done and on current phase tab) */}
        {!isDone && activeTab === currentPhase && activeLogs.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full border shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse delay-75" />
              </div>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Live</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Typewriter({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");
  const targetTextRef = useRef(text);
  const currentDisplayRef = useRef("");

  useEffect(() => {
    targetTextRef.current = text;
  }, [text]);

  useEffect(() => {
    const interval = setInterval(() => {
      const target = targetTextRef.current;
      const current = currentDisplayRef.current;
      if (current === target) return;
      if (!target.startsWith(current)) {
        currentDisplayRef.current = "";
        setDisplayedText("");
        return;
      }
      const nextString = current + target.charAt(current.length);
      currentDisplayRef.current = nextString;
      setDisplayedText(nextString);
    }, 8);

    return () => clearInterval(interval);
  }, []);

  return <ReactMarkdown>{displayedText}</ReactMarkdown>;
}

function avatar(name: string) {
  if (name.includes("CEO")) return "C";
  if (name.includes("Creative")) return "D";
  if (name.includes("Media")) return "M";
  if (name.includes("Copy")) return "W";
  if (name.includes("Art")) return "A";
  if (name.includes("Social")) return "S";
  return name[0] || "?";
}
