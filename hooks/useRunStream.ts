
import { useEffect, useRef } from 'react';
import { API_BASE } from '../lib/config';
import { AssetUpdateEvent } from '../types/assets';

// Use a simplified approach if API_BASE_URL is not exported or different.
// Ideally usage is like: const eventSource = new EventSource(`${API_BASE_URL}/stream/${runId}`);

export function useRunStream(runId: string | undefined, onAssetUpdate: (event: AssetUpdateEvent) => void) {
    // 1. Use a ref to track the latest callback request.
    // This allows the callback to change without re-triggering the effect (reconnecting).
    const onUpdateRef = useRef(onAssetUpdate);

    useEffect(() => {
        onUpdateRef.current = onAssetUpdate;
    }, [onAssetUpdate]);

    useEffect(() => {
        if (!runId) return;

        // Aligning with lib/sseClient.ts which uses /runs/{run_id}/stream
        const url = `${API_BASE}/runs/${runId}/stream`;

        console.log("🔌 Connecting to Stream:", url);
        const eventSource = new EventSource(url, { withCredentials: true });

        // Handler for generic messages (if backend sends JSON with type field)
        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                // UNWRAP logic: If the payload has a 'data' field, use that.
                // The user logs show: {"type": "asset_update", "data": { ...actual event... }}
                let eventData = payload;
                if (payload.type === 'asset_update' && payload.data) {
                    eventData = payload.data;
                }

                if (eventData.version_id || eventData.asset_id) {
                    onUpdateRef.current(eventData);
                }
            } catch (e) {
                // Ignore parse errors for other event types
            }
        };

        // Also listen for named events just in case
        eventSource.addEventListener("asset_update", (event) => {
            try {
                const payload = JSON.parse(event.data);
                let eventData = payload;
                if (payload.data) {
                    eventData = payload.data;
                }
                onUpdateRef.current(eventData);
            } catch (e) {
                console.error("Failed to parse asset_update event", e);
            }
        });

        eventSource.onopen = () => console.log("✅ Stream Connected");
        eventSource.onerror = (e) => {
            // Only log strict errors, avoid noise on re-connects
            if (eventSource.readyState === EventSource.CLOSED) {
                console.error("❌ Stream Error. Connection failed.", { url, api_base: API_BASE }, e);
            }
        };

        return () => {
            console.log("🔌 Closing Stream");
            eventSource.close();
        };
    }, [runId]); // Only reconnect if runId changes (removed onAssetUpdate)
}
