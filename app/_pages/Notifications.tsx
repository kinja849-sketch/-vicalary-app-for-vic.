"use client"
import Link from "next/link";
import { ArrowLeft, Sparkles, MoveLeft, CheckCircle, AlertCircle, Info, X, BellOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getNotifications, markNotificationAsRead } from "@/lib/api/settings";
import { useTranslation } from "@/lib/api/translation";
import { getPrayerTimes, getPersonalizedSpiritualReminder, getPrayerWindow } from "@/lib/api/prayerTimes";
import { useNotificationStore } from "@/store/notificationStore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { NotificationSkeleton } from "@/components/NotificationSkeleton";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  
  // Local Notifications Store
  const { 
    notifications: localNotifications, 
    markAsRead, 
    markAllAsRead, 
    clearAll, 
    removeNotification 
  } = useNotificationStore();

  // Fetch Supabase Notifications
  const { data: dbNotifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user?.id
  });

  // Fetch Prayer Times
  const { data: prayerTimes } = useQuery({
    queryKey: ['prayer-times', user?.id],
    queryFn: () => getPrayerTimes(),
    enabled: !!user?.id,
    staleTime: 3600000 // 1 hour
  });

  const prayerWindow = prayerTimes ? getPrayerWindow(prayerTimes) : { inWindow: false, phase: 'none' as const };

  // Fetch Personalized Spiritual Reminder if it's prayer time
  const { data: spiritualReminder } = useQuery({
    queryKey: ['spiritual-reminder', user?.id, prayerWindow.phase],
    queryFn: () => getPersonalizedSpiritualReminder(user!.id, prayerWindow.phase as 'pre-prayer' | 'post-prayer'),
    enabled: !!user?.id && prayerWindow.inWindow && prayerWindow.phase !== 'none',
    staleTime: 300000 // 5 minutes
  });

  const contextualReminder = spiritualReminder ? {
    title: spiritualReminder.type === 'quran' ? t('quran_verse') : t('hadith'),
    content: spiritualReminder.content,
    reference: spiritualReminder.reference
  } : null;

  // Mark DB notification as read mutation
  const markDbAsReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });

  const handleMarkAllRead = () => {
    markAllAsRead();
    if (dbNotifications) {
      dbNotifications.forEach((n: any) => {
        if (!n.is_read) markDbAsReadMutation.mutate(n.id);
      });
    }
    toast.success("All marked as read");
  };

  if (isLoading) {
    return <NotificationSkeleton />;
  }

  // Combine and sort notifications
  const allNotifications = [
    ...localNotifications.map(n => ({ ...n, source: 'local' as const })),
    ...(dbNotifications || []).map((n: any) => ({
      id: n.id,
      type: n.type === 'alert' ? 'warning' : 'info',
      message: n.content,
      timestamp: new Date(n.created_at).getTime(),
      isRead: n.is_read,
      title: n.title,
      source: 'db' as const
    }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} />;
      case 'error': return <AlertCircle size={18} />;
      case 'warning': return <AlertCircle size={18} />;
      default: return <Info size={18} />;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-[#0d1418]">
        <Link href="/dashboard" className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('notifications_section')}</h1>
        <div className="flex gap-2">
          {allNotifications.length > 0 && (
            <button 
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-vic-green hover:underline"
            >
              Mark All Read
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {contextualReminder && (
          <div className="m-4 p-4 bg-vic-green/10 border border-vic-green/20 rounded-2xl">
            <div className="flex items-center gap-3 mb-2 text-vic-green">
              <Sparkles size={18} />
              <h4 className="font-bold text-sm uppercase tracking-wider">{contextualReminder.title}</h4>
            </div>
            <p className="text-sm italic text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
              "{contextualReminder.content}"
            </p>
            {contextualReminder.reference && (
              <p className="text-[11px] text-vic-green font-bold text-right">
                — {contextualReminder.reference}
              </p>
            )}
          </div>
        )}

        {allNotifications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <AnimatePresence mode="popLayout">
              {allNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                  drag={notification.source === 'local' ? "x" : false}
                  dragConstraints={{ left: -100, right: 0 }}
                  dragElastic={0.1}
                  onDragEnd={(_, info) => {
                    if (notification.source === 'local' && info.offset.x < -60) {
                      removeNotification(notification.id);
                    }
                  }}
                  onClick={() => {
                    if (!notification.isRead) {
                      if (notification.source === 'local') markAsRead(notification.id);
                      else markDbAsReadMutation.mutate(notification.id);
                    }
                  }}
                  className={`p-4 flex gap-4 transition-colors cursor-pointer group relative touch-pan-y ${notification.isRead ? 'bg-transparent' : 'bg-vic-green/5 dark:bg-vic-green/10'}`}
                >
                  {/* Swipe indicator for local notifications */}
                  {notification.source === 'local' && (
                    <div className="absolute inset-y-0 right-0 w-16 bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                       <MoveLeft className="text-red-500/40" size={18} />
                    </div>
                  )}
                  <div className={`size-10 rounded-full flex items-center justify-center shrink-0 
                    ${notification.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                      notification.type === 'error' ? 'bg-red-100 text-red-600' :
                      notification.type === 'success' ? 'bg-green-100 text-green-600' :
                      'bg-vic-green/20 text-vic-green'}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`font-bold text-sm ${notification.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                        {(notification as any).title || (notification.type.toUpperCase())}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.source === 'local') removeNotification(notification.id);
                          }}
                          className={`${notification.source === 'local' ? 'opacity-0 group-hover:opacity-100' : 'hidden'} text-slate-400 hover:text-red-500 transition-opacity`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="size-2 rounded-full bg-vic-green mt-2"></div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {localNotifications.length > 0 && (
              <div className="p-4 text-center">
                <button 
                  onClick={clearAll}
                  className="text-sm font-bold text-slate-400 hover:text-red-500"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="size-20 bg-slate-100 dark:bg-[#1f2c34] rounded-full flex items-center justify-center mb-4">
              <BellOff className="text-slate-400" size={36} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('no_notifications')}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('notifications_desc')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
