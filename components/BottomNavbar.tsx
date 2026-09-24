"use client"
import React from 'react';
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@/lib/api/translation';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNotificationStore } from '@/store/notificationStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { Home, Bell, MessageSquare, UserCircle } from 'lucide-react';

export const BottomNavbar: React.FC = () => {
    const { t } = useTranslation();
    const pathname = usePathname();
    const router = useRouter();
    const isNavbarHidden = useAnalysisStore(state => state.isNavbarHidden);

    const { user } = useAuth();

    // Eagerly prefetch all bottom navigation routes for instant single-click rendering
    React.useEffect(() => {
        router.prefetch('/dashboard');
        router.prefetch('/notifications');
        router.prefetch('/chat');
        router.prefetch('/settings');
    }, [router]);

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

    // STRICT USER CONTRACT: Bottom navigation strictly only appears on the main dashboard and nowhere else.
    // Also suppressed if any modal or analysis view is open.
    const allowedPaths = ['/dashboard'];
    if (isNavbarHidden || !allowedPaths.includes(pathname)) {
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

    const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
        if (pathname === path) {
            e.preventDefault();
        }
    };

    return (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[999] bg-white/95 dark:bg-[#0d1418]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-area-bottom shadow-[0_-4px_16px_rgba(0,0,0,0.08)] select-none">
            <div className="flex items-center justify-around h-16 w-full px-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            onClick={(e) => handleNavigation(e, item.path)}
                            className={`
                                flex-1 flex flex-col items-center justify-center h-full py-1 gap-1 transition-all duration-100 relative cursor-pointer select-none min-w-0 active:scale-95
                                ${isActive ? 'text-vic-green font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}
                            `}
                        >
                            <div className="w-6 h-6 flex items-center justify-center relative shrink-0 pointer-events-none">
                                <item.icon size={22} className="shrink-0" />
                                {/* Red Dot Badge */}
                                {!!item.badge && item.badge > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0d1418] pointer-events-none">
                                        {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-tight text-center truncate max-w-full px-1 whitespace-nowrap leading-none pointer-events-none">
                                {item.label}
                            </span>

                            {/* Active Indicator Bar */}
                            {isActive && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-vic-green rounded-full shadow-[0_2px_8px_rgba(19,236,55,0.4)] pointer-events-none" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
