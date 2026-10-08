import { useEffect } from 'react';

const HEARTBEAT_MS = 60_000;

function stampLastSeen() {
    // keepalive lets the request survive tab close / navigation. Cookies carry the session.
    try {
        fetch('/api/presence/last-seen', {
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
        }).catch(() => {});
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

        stampLastSeen();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') stampLastSeen();
        }, HEARTBEAT_MS);

        const onVisibility = () => {
            stampLastSeen();
        };
        const onPageHide = () => stampLastSeen();

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
            stampLastSeen();
        };
    }, [userId]);
}
