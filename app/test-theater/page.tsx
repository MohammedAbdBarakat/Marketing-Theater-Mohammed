"use client";
import { useEffect, useState } from "react";
import { MeetingTheater } from "../../components/run/MeetingTheater";
import type { TheaterLog } from "../../store/useRunStore";

const MOCK_DATA = [
    `data: {"type": "status_update", "status": "completed", "ts": 1768388224974}
`,
    `data: {"type": "phase_start", "phase": 1, "title": "Strategy Generation", "participants": ["CEO", "CreativeDirector", "MediaBuyer"]}
`,
    `data: {"type": "log", "phase": 1, "speaker": "CEO", "text": "Let's begin by considering our first strategy. **Proposed Strategy 1:** VIP Ocean Experience Package.", "ts": 1768387535708}
`,
    `data: {"type": "log", "phase": 1, "speaker": "CreativeDirector", "text": "As the Creative Director, I find the VIP Ocean Experience Package to be well-aligned with our brand.", "ts": 1768387546299}
`,
    `data: {"type": "log", "phase": 1, "speaker": "MediaBuyer", "text": "From a media buying perspective, this seems feasible. Leveraging social media is key.", "ts": 1768387558572}
`,
    `data: {"type": "log", "phase": 1, "speaker": "CEO", "text": "Great! Let's move to **Proposed Strategy 2:** Corporate Cruise Collaboration.", "ts": 1768387569195}
`,
    `data: {"type": "done"}
`
];

export default function TestTheaterPage() {
    const [logs, setLogs] = useState<TheaterLog[]>([]);
    const [isDone, setIsDone] = useState(false);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (index >= MOCK_DATA.length) return;

        const timer = setTimeout(() => {
            const line = MOCK_DATA[index];
            if (line.startsWith("data: ")) {
                const jsonStr = line.replace("data: ", "").trim();
                try {
                    const data = JSON.parse(jsonStr);

                    if (data.type === "log") {
                        setLogs(prev => [...prev, {
                            phase: data.phase,
                            speaker: data.speaker,
                            text: data.text,
                            ts: data.ts
                        }]);
                    } else if (data.type === "done") {
                        setIsDone(true);
                    }
                } catch (e) {
                    console.error("Parse error", e);
                }
            }
            setIndex(prev => prev + 1);
        }, 1500); // Simulate delay between messages

        return () => clearTimeout(timer);
    }, [index]);

    return (
        <div className="p-12 bg-gray-100 min-h-screen">
            <h1 className="text-2xl font-bold mb-8">Theater Demo (Typewriter Test)</h1>
            <div className="max-w-2xl mx-auto">
                <MeetingTheater
                    logs={logs.reduce((acc, log) => {
                        const p = log.phase || 1;
                        if (!acc[p]) acc[p] = [];
                        acc[p].push(log);
                        return acc;
                    }, {} as Record<number, TheaterLog[]>)}
                    currentPhase={logs.length > 0 ? (logs[logs.length - 1].phase || 1) : 1}
                    isDone={isDone}
                />
            </div>
            <div className="mt-8 text-center">
                <button onClick={() => { setLogs([]); setIsDone(false); setIndex(0); }} className="bg-black text-white px-4 py-2 rounded">Restart Demo</button>
            </div>
        </div>
    );
}
