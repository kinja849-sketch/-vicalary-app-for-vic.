import { supabase } from '@/lib/supabase';

export type PermissionType = 'camera' | 'microphone';
export type BrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable';

export interface AppPermissionStatus {
  browserState: BrowserPermissionState;
  appOnboarded: boolean;
}

export class PermissionError extends Error {
  code: 'PERMISSION_DENIED_BROWSER' | 'MEDIA_UNAVAILABLE' | 'USER_REJECTED';
  
  constructor(message: string, code: 'PERMISSION_DENIED_BROWSER' | 'MEDIA_UNAVAILABLE' | 'USER_REJECTED') {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
  }
}

class PermissionManager {
  private localCache: Map<PermissionType, boolean> = new Map();
  private syncedDbCache: Set<string> = new Set();
  private inFlightSyncs: Map<string, Promise<void>> = new Map();

  /**
   * Queries real-time browser/OS permission status where supported.
   */
  async getBrowserPermissionState(type: PermissionType): Promise<BrowserPermissionState> {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return 'unavailable';
    }

    try {
      const result = await navigator.permissions.query({ name: type as any });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Gets combined application onboarding & browser permission status.
   */
  async checkPermission(type: PermissionType, userId?: string): Promise<AppPermissionStatus> {
    const browserState = await this.getBrowserPermissionState(type);
    
    const storageKey = `vic_permission_${type}_onboarded`;
    let appOnboarded = false;

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(storageKey);
      if (cached === 'true') {
        appOnboarded = true;
      } else {
        const legacyCamera = localStorage.getItem('has_granted_camera') === 'true' || localStorage.getItem('permission_camera') === 'granted';
        const legacyMic = localStorage.getItem('has_granted_mic') === 'true' || localStorage.getItem('permission_microphone') === 'granted';
        if ((type === 'camera' && legacyCamera) || (type === 'microphone' && legacyMic)) {
          appOnboarded = true;
          localStorage.setItem(storageKey, 'true');
        }
      }
    }

    if (!appOnboarded && typeof window !== 'undefined') {
      try {
        let currentUserId = userId;
        if (!currentUserId) {
          const { data } = await supabase.auth.getSession();
          currentUserId = data?.session?.user?.id;
        }

        if (currentUserId) {
          const client = supabase as any;
          const { data, error } = await client
            .from('user_permissions')
            .select('*')
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (!error && data) {
            const field = type === 'camera' ? 'camera_permission_onboarded' : 'microphone_permission_onboarded';
            if (data[field]) {
              appOnboarded = true;
              localStorage.setItem(storageKey, 'true');
              const dbSyncKey = `vic_permission_${type}_db_synced_${currentUserId}`;
              localStorage.setItem(dbSyncKey, 'true');
              this.syncedDbCache.add(`${currentUserId}:${type}`);
            }
          }
        }
      } catch (err) {
        console.warn(`[PermissionManager] Error fetching user_permissions for ${type}:`, err);
      }
    }

    if (browserState === 'denied') {
      return { browserState: 'denied', appOnboarded };
    }

    if (browserState === 'granted' && !appOnboarded) {
      this.markOnboarded(type, userId).catch(() => {});
      appOnboarded = true;
    }

    return { browserState, appOnboarded };
  }

  /**
   * Persists application-level permission onboarding completion to Supabase & localStorage.
   */
  async markOnboarded(type: PermissionType, userId?: string): Promise<void> {
    const storageKey = `vic_permission_${type}_onboarded`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
      if (type === 'camera') {
        localStorage.setItem('has_granted_camera', 'true');
        localStorage.setItem('permission_camera', 'granted');
      } else {
        localStorage.setItem('has_granted_mic', 'true');
        localStorage.setItem('permission_microphone', 'granted');
      }
    }

    this.localCache.set(type, true);

    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data } = await supabase.auth.getSession();
        currentUserId = data?.session?.user?.id;
      }

      if (!currentUserId) return;

      const cacheKey = `${currentUserId}:${type}`;
      const dbSyncKey = `vic_permission_${type}_db_synced_${currentUserId}`;
      if (this.syncedDbCache.has(cacheKey)) {
        return;
      }
      if (typeof window !== 'undefined' && localStorage.getItem(dbSyncKey) === 'true') {
        this.syncedDbCache.add(cacheKey);
        return;
      }

      const existingInFlight = this.inFlightSyncs.get(cacheKey);
      if (existingInFlight) {
        await existingInFlight;
        return;
      }

      const syncPromise = (async () => {
        try {
          const field = type === 'camera' ? 'camera_permission_onboarded' : 'microphone_permission_onboarded';
          const client = supabase as any;
          const { error } = await client
            .from('user_permissions')
            .upsert(
              {
                user_id: currentUserId,
                [field]: true,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'user_id' }
            );

          if (!error) {
            this.syncedDbCache.add(cacheKey);
            if (typeof window !== 'undefined') {
              localStorage.setItem(dbSyncKey, 'true');
            }
          }
        } finally {
          this.inFlightSyncs.delete(cacheKey);
        }
      })();

      this.inFlightSyncs.set(cacheKey, syncPromise);
      await syncPromise;
    } catch (err) {
      console.warn(`[PermissionManager] Error updating user_permissions for ${type}:`, err);
    }
  }

  /**
   * Safe stream initialization: Checks permission first, avoiding repeated requests when denied.
   */
  async requestPermission(
    type: PermissionType,
    constraints?: MediaStreamConstraints,
    userId?: string
  ): Promise<MediaStream> {
    const status = await this.checkPermission(type, userId);

    if (status.browserState === 'denied') {
      throw new PermissionError(
        `${type === 'camera' ? 'Camera' : 'Microphone'} permission is blocked in browser settings.`,
        'PERMISSION_DENIED_BROWSER'
      );
    }

    const defaultConstraints: MediaStreamConstraints = type === 'camera'
      ? { video: { facingMode: { ideal: 'environment' } }, audio: false }
      : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

    const mediaConstraints = constraints || defaultConstraints;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      await this.markOnboarded(type, userId);
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new PermissionError(
          `${type === 'camera' ? 'Camera' : 'Microphone'} access was denied by user.`,
          'USER_REJECTED'
        );
      }
      throw new PermissionError(
        `Failed to acquire ${type} stream: ${err.message || err}`,
        'MEDIA_UNAVAILABLE'
      );
    }
  }
}

export const permissionManager = new PermissionManager();
