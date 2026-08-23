"use client"
import React from 'react';
import Link from 'next/link'
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@/lib/api/translation';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNotificationStore } from '@/store/notificationStore';
import { Home, Bell, MessageSquare, UserCircle } from 'lucide-react';

export const BottomNavbar: React.FC = () => {
    const { t } = useTranslation();
    const pathname = usePathname();

    const { user } = useAuth();

    // Fetch unread count using the efficient RPC fix (V10)
    const { data: unreadCount = 0, refetch } = useQuery({
        queryKey: ['unread-messages-global', user?.id],
        queryFn: async () => {
            if (!user) return 0;
            const { data, error } = await (supabase as any).rpc('get_unread_count', { p_user_id: user.id });
            if (error) {
                console.error('[Navbar] Error fetching unread count:', error);
                return 0;
            }
            return Number(data || 0);
        },
        enabled: !!user,
        refetchInterval: 30000 // Polling backup
    });

    // Global listener in App.tsx handles real-time updates for unread counts
    const { notifications } = useNotificationStore();
    const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

    // Hide navbar on certain pages
    const hiddenPaths = ['/', '/auth', '/onboarding', '/phone-input', '/verification-code'];
    const isChatDetail = pathname.startsWith('/chat/') && pathname !== '/chat';
    const isExpertDetail = pathname.startsWith('/expert/');

    if (hiddenPaths.includes(pathname) || isChatDetail || isExpertDetail) {
        return null;
    }

    const navItems = [
        {
            path: '/dashboard',
            label: t('home') || 'Home',
            icon: Home,
        },
        {
            path: '/notifications',
            label: t('alerts') || 'Alerts',
            icon: Bell,
            badge: unreadNotificationsCount,
        },
        {
            path: '/chat',
            label: t('chat') || 'Chat',
            icon: MessageSquare,
            badge: unreadCount,
        },
        {
            path: '/settings',
            label: t('profile') || 'Profile', // The request specifically asked for Profile to lead to Settings
            icon: UserCircle,
        },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0d1418] border-t border-slate-200 dark:border-slate-800 safe-area-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto relative px-2">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`
                            flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 relative
                            ${pathname === item.path ? 'text-vic-green' : 'text-slate-400 dark:text-slate-500'}
                        `}
                    >
                        <div className="relative">
                            <item.icon className={`transition-all duration-300 ${pathname === item.path ? 'scale-110' : 'scale-100'}`} size={24} />
                            {/* Red Dot Badge */}
                            {!!item.badge && item.badge > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0d1418]">
                                    {item.badge > 9 ? '9+' : item.badge}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {item.label}
                        </span>

                        {/* Active Indicator Bar */}
                        {pathname === item.path && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-vic-green rounded-full shadow-[0_2px_8px_rgba(19,236,55,0.4)]" />
                        )}
                    </Link>
                ))}
            </div>
        </nav>
    );
};
