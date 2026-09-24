import { permissionManager, AppPermissionStatus } from '@/lib/services/PermissionManager';
import { toast } from 'sonner';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export const checkPermission = async (name: PermissionName): Promise<PermissionStatus> => {
  const type = name === ('camera' as any) ? 'camera' : 'microphone';
  const status = await permissionManager.checkPermission(type);
  if (status.browserState === 'denied') return 'denied';
  if (status.browserState === 'granted' || status.appOnboarded) return 'granted';
  return 'prompt';
};

export const requestCameraAccess = async (options: MediaStreamConstraints = { video: { facingMode: 'environment' } }) => {
  try {
    return await permissionManager.requestPermission('camera', options);
  } catch (err: any) {
    if (err.code === 'PERMISSION_DENIED_BROWSER' || err.code === 'USER_REJECTED') {
      const lastAlert = sessionStorage.getItem('camera_denied_alert');
      if (!lastAlert) {
        toast.error("Camera access is blocked. Please enable it in your browser settings.", { duration: 5000 });
        sessionStorage.setItem('camera_denied_alert', 'true');
      }
    }
    throw err;
  }
};

export const requestMicrophoneAccess = async (options: MediaStreamConstraints = { audio: true }) => {
  try {
    return await permissionManager.requestPermission('microphone', options);
  } catch (err: any) {
    if (err.code === 'PERMISSION_DENIED_BROWSER' || err.code === 'USER_REJECTED') {
      const lastAlert = sessionStorage.getItem('mic_denied_alert');
      if (!lastAlert) {
        toast.error("Microphone access is blocked. Please enable it in your browser settings.", { duration: 5000 });
        sessionStorage.setItem('mic_denied_alert', 'true');
      }
    }
    throw err;
  }
};
