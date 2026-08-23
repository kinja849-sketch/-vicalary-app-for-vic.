import { toast } from 'sonner';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export const checkPermission = async (name: PermissionName): Promise<PermissionStatus> => {
    try {
        if (!navigator.permissions || !navigator.permissions.query) {
            return 'prompt';
        }
        const result = await navigator.permissions.query({ name });
        return result.state as PermissionStatus;
    } catch (e) {
        console.warn(`Permission query for ${name} not supported:`, e);
        return 'prompt';
    }
};

export const requestCameraAccess = async (options: MediaStreamConstraints = { video: { facingMode: 'environment' } }) => {
    const status = await checkPermission('camera' as any);

    // If we know it's denied, don't even try to request it again in this session to avoid browser "Blocked" alerts
    if (status === 'denied') {
        const lastAlert = sessionStorage.getItem('camera_denied_alert');
        if (!lastAlert) {
            toast.error("Camera access is blocked. Please enable it in your browser settings.", {
                duration: 5000
            });
            sessionStorage.setItem('camera_denied_alert', 'true');
        }
        throw new Error('Permission denied');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia(options);
        localStorage.setItem('has_granted_camera', 'true');
        return stream;
    } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            localStorage.setItem('has_granted_camera', 'false');
        }
        throw err;
    }
};

export const requestMicrophoneAccess = async (options: MediaStreamConstraints = { audio: true }) => {
    const status = await checkPermission('microphone' as any);

    if (status === 'denied') {
        const lastAlert = sessionStorage.getItem('mic_denied_alert');
        if (!lastAlert) {
            toast.error("Microphone access is blocked. Please enable it in your browser settings.");
            sessionStorage.setItem('mic_denied_alert', 'true');
        }
        throw new Error('Permission denied');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia(options);
        localStorage.setItem('has_granted_mic', 'true');
        return stream;
    } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            localStorage.setItem('has_granted_mic', 'false');
        }
        throw err;
    }
};
