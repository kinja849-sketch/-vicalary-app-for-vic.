"use client"
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomNavbar } from "./BottomNavbar";
import { useAuth } from "@/lib/AuthContext";
import { subscribeToUserConversations, unsubscribeFromMessages } from "@/lib/api/chat";
import { useTranslation } from "@/lib/api/translation";
import { useQueryClient } from "@tanstack/react-query";

export function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const isChatConversation = pathname.startsWith('/chat/') && pathname !== '/chat';

  useEffect(() => {
    document.documentElement.dir = (lang === 'ar' || lang === 'ur') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Global Chat Listener for Restoration & Updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = subscribeToUserConversations(user.id, () => {
      const key1 = ['conversations', user.id];
      const key2 = ['unread-messages-global', user.id];

      console.log("[App] Global chat update, invalidating:", key1, key2);
      queryClient.invalidateQueries({ queryKey: key1 });
      queryClient.invalidateQueries({ queryKey: key2 });
    });

    return () => {
      unsubscribeFromMessages(channel);
    };
  }, [user?.id, queryClient]);

  // AI Coach Midnight Trigger
  useEffect(() => {
    if (!user?.id) return;

    const checkAndTriggerSummary = async () => {
      try {
        const now = new Date();
        
        // ONLY trigger at 12:00 a.m. (hour 0)
        if (now.getHours() !== 0) return;

        const dateStr = now.toISOString().split('T')[0];
        const lastTriggered = localStorage.getItem(`coach_summary_triggered_${dateStr}`);
        
        if (!lastTriggered) {
          console.log("[Coach] Triggering midnight summary...");
          localStorage.setItem(`coach_summary_triggered_${dateStr}`, 'true');
          
          await fetch('/api/chat/coach-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          });
          
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      } catch (e) {
        console.error("[Coach] Trigger failed:", e);
      }
    };

    checkAndTriggerSummary();
    const interval = setInterval(checkAndTriggerSummary, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id, queryClient]);

  // Global Auth Loader to prevent flashing
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0b141a] flex items-center justify-center z-[9999]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-vic-green border-t-transparent rounded-full animate-spin"></div>
          <p className="text-vic-green font-bold tracking-widest text-xs uppercase animate-pulse">Loading VICALARY...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className={`flex-1 ${!isChatConversation && pathname !== '/onboarding' ? 'pb-16' : ''}`}>
        {children}
      </main>
      {!isChatConversation && <BottomNavbar />}
    </div>
  );
}
