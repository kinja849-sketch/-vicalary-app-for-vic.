import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_MS = 60_000;

async function stampLastSeen() {
    // keepalive lets the request survive tab close / navigation. Authorization header carries the session JWT.
    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        await fetch('/api/presence/last-seen', {
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    } catch {
        /* non-blocking */
    }
}

/**
 * Keeps user_profiles.last_seen fresh for the signed-in user:
 * on mount, every minute while visible, when the tab hides, and on page unload/unmount.
 */
export function useLastSeenHeartbeat(userId?: string | null) {
    useEffect(() => {
        if (!userId) return;

        void stampLastSeen();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') void stampLastSeen();
        }, HEARTBEAT_MS);

        const onVisibility = () => {
            void stampLastSeen();
        };
        const onPageHide = () => {
            void stampLastSeen();
        };

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
            void stampLastSeen();
        };
    }, [userId]);
}
