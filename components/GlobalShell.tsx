"use client"
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomNavbar } from "./BottomNavbar";
import IncomingCallModal from "@/components/calls/IncomingCallModal";
import StreamCallOverlay from "@/components/calls/StreamCallOverlay";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
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

  // Global Stream Call State
  const [incomingStreamCall, setIncomingStreamCall] = useState<{
    callId: string;
    conversationId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string | null;
    callType: 'voice' | 'video';
  } | null>(null);

  const [activeStreamCall, setActiveStreamCall] = useState<{
    active: boolean;
    conversationId: string;
    callType: 'audio' | 'video';
    partnerName?: string;
    partnerAvatar?: string | null;
    receiverId?: string;
  } | null>(null);

  // Global Stream Call Listener
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`user_calls_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('[GlobalShell] Incoming call DB insert:', payload.new);
          if (payload.new && payload.new.status === 'ringing') {
            const { data: callerProfile } = await supabase
              .from('user_profiles')
              .select('full_name, username, avatar_url')
              .eq('id', payload.new.caller_id)
              .maybeSingle();

            const name = callerProfile?.full_name || callerProfile?.username || 'Vicalary User';
            setIncomingStreamCall({
              callId: payload.new.id,
              conversationId: payload.new.conversation_id,
              callerId: payload.new.caller_id,
              callerName: name,
              callerAvatar: callerProfile?.avatar_url || null,
              callType: payload.new.type === 'video' ? 'video' : 'voice'
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const status = payload.new?.status;
          if (status === 'ended' || status === 'declined' || status === 'cancelled') {
            setIncomingStreamCall(null);
            setActiveStreamCall(null);
          }
        }
      )
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        if (payload.payload) {
          console.log('[GlobalShell] Incoming call broadcast:', payload.payload);
          setIncomingStreamCall({
            callId: payload.payload.callId,
            conversationId: payload.payload.conversationId,
            callerId: payload.payload.callerId,
            callerName: payload.payload.callerName || 'Vicalary User',
            callerAvatar: payload.payload.callerAvatar || null,
            callType: payload.payload.callType || 'voice'
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Global Chat Listener for Restoration & Updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = subscribeToUserConversations(user.id, (payload) => {
      const key1 = ['conversations', user.id];
      const key2 = ['unread-messages-global', user.id];

      console.log("[App] Global chat update, invalidating:", key1, key2);
      queryClient.invalidateQueries({ queryKey: key1 });
      queryClient.invalidateQueries({ queryKey: key2 });
    });

    return () => {
      unsubscribeFromMessages(channel);
    };
  }, [user?.id]);

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
  }, [user?.id]);

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
      {/* Global Incoming Call Screen */}
      {incomingStreamCall && (
        <IncomingCallModal
          callId={incomingStreamCall.callId}
          conversationId={incomingStreamCall.conversationId}
          callerId={incomingStreamCall.callerId}
          callerName={incomingStreamCall.callerName}
          callerAvatar={incomingStreamCall.callerAvatar}
          callType={incomingStreamCall.callType}
          onAccept={(type) => {
            const callData = incomingStreamCall;
            setIncomingStreamCall(null);
            setActiveStreamCall({
              active: true,
              conversationId: callData.conversationId,
              callType: type === 'video' ? 'video' : 'audio',
              partnerName: callData.callerName,
              partnerAvatar: callData.callerAvatar,
              receiverId: callData.callerId
            });
          }}
          onDecline={() => setIncomingStreamCall(null)}
        />
      )}

      {/* Global Active Call Overlay for Accepted Receiver Call */}
      {activeStreamCall && user?.id && (
        <StreamCallOverlay
          conversationId={activeStreamCall.conversationId}
          userId={user.id}
          receiverId={activeStreamCall.receiverId}
          userName={user.user_metadata?.full_name || 'User'}
          partnerName={activeStreamCall.partnerName || 'Vicalary User'}
          partnerAvatar={activeStreamCall.partnerAvatar}
          callType={activeStreamCall.callType}
          onClose={() => setActiveStreamCall(null)}
        />
      )}

      <main className={`flex-1 ${!isChatConversation && pathname !== '/onboarding' ? 'pb-16' : ''}`}>
        {children}
      </main>
      {!isChatConversation && <BottomNavbar />}
    </div>
  );
}
