"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: number;
    isRead: boolean;
}

interface NotificationStore {
    notifications: Notification[];
    addNotification: (type: NotificationType, message: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>()(
    persist(
        (set) => ({
            notifications: [],
            addNotification: (type, message) => set((state) => ({
                notifications: [
                    {
                        id: Math.random().toString(36).substring(2, 9),
                        type,
                        message,
                        timestamp: Date.now(),
                        isRead: false,
                    },
                    ...state.notifications,
                ],
            })),
            markAsRead: (id) => set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, isRead: true } : n
                ),
            })),
            markAllAsRead: () => set((state) => ({
                notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            })),
            clearAll: () => set({ notifications: [] }),
            removeNotification: (id) => set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            })),
        }),
        {
            name: 'vic-notifications',
        }
    )
)
