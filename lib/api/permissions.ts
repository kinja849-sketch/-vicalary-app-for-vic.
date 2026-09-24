import { toast } from 'sonner';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export const checkPermission = async (name: PermissionName): Promise<PermissionStatus> => {
    try {
        const isGrantedInStorage = typeof window !== 'undefined' && (
            (name === 'camera' as any && (localStorage.getItem('has_granted_camera') === 'true' || localStorage.getItem('permission_camera') === 'granted')) ||
            (name === 'microphone' as any && (localStorage.getItem('has_granted_mic') === 'true' || localStorage.getItem('permission_microphone') === 'granted')) ||
            localStorage.getItem(`permission_${name}`) === 'granted'
        );

        if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
            if (isGrantedInStorage) return 'granted';
            const cached = localStorage.getItem(`permission_${name}`);
            if (cached === 'denied') return 'denied';
            return 'prompt';
        }
        const result = await navigator.permissions.query({ name } as any);
        if (result.state === 'granted') {
            localStorage.setItem(`permission_${name}`, 'granted');
            if (name === 'camera' as any) localStorage.setItem('has_granted_camera', 'true');
            if (name === 'microphone' as any) localStorage.setItem('has_granted_mic', 'true');
            return 'granted';
        }
        if (result.state === 'denied') {
            localStorage.setItem(`permission_${name}`, 'denied');
            if (name === 'camera' as any) localStorage.setItem('has_granted_camera', 'false');
            if (name === 'microphone' as any) localStorage.setItem('has_granted_mic', 'false');
            return 'denied';
        }

        if (isGrantedInStorage) {
            return 'granted';
        }

        localStorage.setItem(`permission_${name}`, result.state);
        return result.state as PermissionStatus;
    } catch (e) {
        const isGrantedInStorage = typeof window !== 'undefined' && (
            (name === 'camera' as any && (localStorage.getItem('has_granted_camera') === 'true' || localStorage.getItem('permission_camera') === 'granted')) ||
            (name === 'microphone' as any && (localStorage.getItem('has_granted_mic') === 'true' || localStorage.getItem('permission_microphone') === 'granted')) ||
            localStorage.getItem(`permission_${name}`) === 'granted'
        );
        if (isGrantedInStorage) return 'granted';
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`permission_${name}`) : null;
        if (cached === 'denied') return 'denied';
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
