'use client';

import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { getSessions, saveSession, type Session } from '@/app/actions/tracker';

dayjs.extend(duration);

export default function Tracker() {
    const [isTracking, setIsTracking] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load sessions on mount
    useEffect(() => {
        async function loadData() {
            const data = await getSessions();
            setSessions(data);

            // Check for active session in localStorage
            const savedStart = localStorage.getItem('tracker_startTime');
            if (savedStart) {
                setStartTime(parseInt(savedStart));
                setIsTracking(true);
            }
            setLoading(false);
        }
        loadData();
    }, []);

    // Timer logic
    useEffect(() => {
        if (isTracking && startTime) {
            timerRef.current = setInterval(() => {
                setElapsed(Date.now() - startTime);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTracking, startTime]);

    const handleStart = () => {
        const now = Date.now();
        setStartTime(now);
        setIsTracking(true);
        localStorage.setItem('tracker_startTime', now.toString());
    };

    const handleStop = async () => {
        if (!startTime) return;

        const endTime = new Date();
        const startTimeIso = new Date(startTime).toISOString();

        // Optimistic update
        const newSessionLocal: Session = {
            id: 'temp-' + Date.now(),
            startTime: startTimeIso,
            endTime: endTime.toISOString(),
            duration: Date.now() - startTime
        };

        setIsTracking(false);
        setStartTime(null);
        setElapsed(0);
        localStorage.removeItem('tracker_startTime');

        setSessions(prev => [...prev, newSessionLocal]);

        // Save to server
        try {
            const savedSession = await saveSession(startTimeIso, endTime.toISOString());
            // Replace temp session with real one
            setSessions(prev => prev.map(s => s.id === newSessionLocal.id ? savedSession : s));
        } catch (e) {
            console.error('Failed to save session', e);
            // Revert state if save failed (optional, for now just log)
        }
    };

    const formatDuration = (ms: number) => {
        const d = dayjs.duration(ms);
        const hours = Math.floor(d.asHours());
        const minutes = d.minutes();
        const seconds = d.seconds();
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const todaySessions = sessions.filter(s => dayjs(s.startTime).isSame(dayjs(), 'day'));
    const todayTotal = todaySessions.reduce((acc, s) => acc + s.duration, 0);

    const currentMonthSessions = sessions.filter(s => dayjs(s.startTime).isSame(dayjs(), 'month'));
    const monthTotal = currentMonthSessions.reduce((acc, s) => acc + s.duration, 0);

    // Add current elapsed time to today/month totals if tracking
    const displayTodayTotal = todayTotal + (isTracking ? elapsed : 0);
    const displayMonthTotal = monthTotal + (isTracking ? elapsed : 0);

    if (loading) return <div className="p-8 text-center">Loading tracker...</div>;

    return (
        <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">

            {/* Header */}
            <h2 className="text-xl font-semibold mb-6 text-zinc-800 dark:text-zinc-100">Ishraqa Time Tracker</h2>

            {/* Main Timer */}
            <div className="flex flex-col items-center justify-center p-8 mb-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className={`text-6xl font-mono font-bold tracking-wider mb-2 ${isTracking ? 'text-green-600 dark:text-green-500' : 'text-zinc-400'}`}>
                    {formatDuration(elapsed)}
                </div>
                <div className="text-sm font-medium text-zinc-500 uppercase tracking-widest">
                    {isTracking ? 'Tracking Active' : 'Ready to Start'}
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                {!isTracking ? (
                    <button
                        onClick={handleStart}
                        className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-semibold text-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Start Working
                    </button>
                ) : (
                    <button
                        onClick={handleStop}
                        className="w-full py-4 bg-red-500 text-white rounded-xl font-semibold text-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        Stop & Save
                    </button>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Today</div>
                    <div className="text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatDuration(displayTodayTotal)}
                    </div>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">This Month</div>
                    <div className="text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatDuration(displayMonthTotal)}
                    </div>
                </div>
            </div>

            {/* Recent History */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-500 mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">Recent Sessions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {sessions.slice().reverse().map(session => (
                        <div key={session.id} className="flex justify-between items-center text-sm p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded-lg transition-colors">
                            <div className="text-zinc-600 dark:text-zinc-400">
                                {dayjs(session.startTime).format('MMM D, HH:mm')}
                            </div>
                            <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                                {formatDuration(session.duration)}
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center text-zinc-400 text-sm py-4">No sessions recorded yet</div>
                    )}
                </div>
            </div>
        </div>
    );
}
