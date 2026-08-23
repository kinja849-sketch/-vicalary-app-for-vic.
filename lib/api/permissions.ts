import { toast } from 'sonner';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export const checkPermission = async (name: PermissionName): Promise<PermissionStatus> => {
    try {
        if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
            const cached = localStorage.getItem(`permission_${name}`);
            if (cached === 'granted' || cached === 'denied') return cached as PermissionStatus;
            return 'prompt';
        }
        const result = await navigator.permissions.query({ name } as any);
        if (result.state) {
            localStorage.setItem(`permission_${name}`, result.state);
            return result.state as PermissionStatus;
        }
        return 'prompt';
    } catch (e) {
        const cached = localStorage.getItem(`permission_${name}`);
        if (cached === 'granted' || cached === 'denied') return cached as PermissionStatus;
        return 'prompt';
    }
};

export const requestCameraAccess = async (options: MediaStreamConstraints = { video: { facingMode: 'environment' } }) => {
    const status = await checkPermission('camera' as any);

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
        localStorage.setItem('permission_camera', 'granted');
        sessionStorage.removeItem('camera_denied_alert');
        return stream;
    } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            localStorage.setItem('has_granted_camera', 'false');
            localStorage.setItem('permission_camera', 'denied');
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
        localStorage.setItem('permission_microphone', 'granted');
        sessionStorage.removeItem('mic_denied_alert');
        return stream;
    } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            localStorage.setItem('has_granted_mic', 'false');
            localStorage.setItem('permission_microphone', 'denied');
        }
        throw err;
    }
};
