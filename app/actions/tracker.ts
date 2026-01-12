'use server'

import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

const DATA_FILE = path.join(process.cwd(), 'tracker-data.json');

export type Session = {
    id: string;
    startTime: string;
    endTime: string;
    duration: number; // in milliseconds
};

async function ensureFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]), 'utf-8');
    }
}

export async function getSessions(): Promise<Session[]> {
    await ensureFile();
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Error parsing tracker data:', error);
        return [];
    }
}

export async function saveSession(startTime: string, endTime: string): Promise<Session> {
    await ensureFile();
    const sessions = await getSessions();

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;

    const newSession: Session = {
        id: nanoid(),
        startTime,
        endTime,
        duration,
    };

    sessions.push(newSession);
    await fs.writeFile(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf-8');

    return newSession;
}
