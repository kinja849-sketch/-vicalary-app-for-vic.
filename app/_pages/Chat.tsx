"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, ArrowLeft, MoreVertical, Search, Bookmark, CheckCheck, Image, Mic, Video, FileText, MessageSquarePlus, Trash2, X, ScanLine, UserSearch, UserPlus, UserRound } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getConversationsV2, isChatVerified, findUserByIdentifier, softDeleteConversation, getMyQRCodeData, getContacts, addContactPure } from "@/lib/api/chat";
import { searchUsers, getUserProfile } from "@/lib/api/auth";
import { MyQRCode } from "@/components/MyQRCode";
import { useTranslation } from "@/lib/api/translation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
const QRScanner = dynamic(() => import("@/components/QRScanner"), { ssr: false });
import { Button } from "@/components/ui/button";

const COACH_ID = '00000000-0000-0000-0000-000000000001';

// Avatar helper: handles relative paths, supabase URLs, and fallbacks
function AvatarImg({ src, name, size = 14 }: { src?: string | null; name?: string; size?: number }) {
  const [error, setError] = useState(false);
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=25D366&color=fff&size=200`;
  const imgSrc = error ? fallback : (src || fallback);
  return (
    <img
      src={imgSrc}
      className={`w-full h-full object-cover`}
      onError={() => setError(true)}
      alt={name || ''}
    />
  );
}

export default function Chat() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [currentView, setCurrentView] = useState<"chats" | "contacts">("chats");
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState("");
  const [isSearchingIdentifier, setIsSearchingIdentifier] = useState(false);
  const [contactFound, setContactFound] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showMyQR, setShowMyQR] = useState(false);
  const [qrData, setQrData] = useState<string>("");

  // Long-press state
  const [longPressConv, setLongPressConv] = useState<any>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id
  });

  const { data: contactsData = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: () => getContacts(user!.id),
    enabled: !!user?.id  // Always fetch, not gated by currentView
  });

  const { data: verified, isLoading: isVerifying } = useQuery({
    queryKey: ['chat-verified', user?.id],
    queryFn: () => isChatVerified(user!.id),
    enabled: !!user?.id,
    staleTime: Infinity
  });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => getConversationsV2(user!.id),
    enabled: !!user?.id && !!verified
  });

  // Search users for discovery
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['user-search', discoveryQuery],
    queryFn: () => searchUsers(discoveryQuery, user!.id),
    enabled: !!user?.id && discoveryQuery.length >= 2
  });

  // ── Real-time setup ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !verified) return;

    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    };
    window.addEventListener('focus', handleFocus);

    if (searchParams.get('openDiscovery')) {
      setIsDiscoveryOpen(true);
      router.replace(pathname);
    }
    if (searchParams.get('view') === 'contacts') {
      setCurrentView('contacts');
      router.replace(pathname);
    }

    // Online presence
    const presenceChannel = supabase.channel('online-users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => { if (p.user_id) online.add(p.user_id); });
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    // V10: Unified Real-time Manager for the Sidebar/Chat List
    const listUpdateChannel = supabase
      .channel('chat-list-global-manager')
      .on('postgres_changes', {
        event: '*', // Listen to INSERT, UPDATE, DELETE for full sync
        schema: 'public',
        table: 'messages'
      }, (payload: any) => {
        // A message change happened. Invalidate conversations and contacts if needed.
        console.log(`[Chat] V10 Global message event [${payload.eventType}]:`, payload.new?.id || payload.old?.id);
        queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // User was added to a new conversation (either they sent a first message or someone added them)
        console.log("[Chat] V10 Participant event: refreshing list");
        queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contacts',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // New contact added to the address book
        console.log("[Chat] V10 Contact event: refreshing address book");
        queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[Chat] V10 Global List Manager Subscribed.");
        }
      });

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(listUpdateChannel);
    };
  }, [user?.id, verified, queryClient, router, pathname, searchParams]);

  // ── Mutations ────────────────────────────────────────────────────
  const addContactMutation = useMutation({
    mutationFn: (otherUserId: string) => addContactPure(user!.id, otherUserId),
    onSuccess: (_, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', user?.id] });
      setIsDiscoveryOpen(false);
      setShowManualEntry(false);
      setContactFound(null);
      toast.success("Contact added to address book");
      // Auto-navigate to conversation
      handleContactTap({ id: otherUserId });
    },
    onError: (err: any) => toast.error(`Failed to add contact: ${err.message}`)
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (convId: string) => softDeleteConversation(convId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
      setLongPressConv(null);
      toast.success("Conversation deleted");
    },
    onError: () => toast.error("Failed to delete conversation")
  });

  // ── Long-press handlers ──────────────────────────────────────────
  const handleLongPressStart = useCallback((conv: any) => {
    longPressTimer.current = setTimeout(() => {
      // Don't allow deletion of system conversations (self/ai)
      if (conv.conversation_type === 'self' || conv.conversation_type === 'ai') return;
      setLongPressConv(conv);
    }, 600);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // ── Contact resolution ───────────────────────────────────────────
  const resolveContact = async (identifier: string) => {
    try {
      setIsSearchingIdentifier(true);
      const targetUser = await findUserByIdentifier(identifier);

      if (!targetUser || !targetUser.is_verified) {
        toast.error("User not found or not verified for chat");
        return;
      }

      // V7: If we found a user, check if we already have a conversation with them
      const existingConv = conversations?.find((conv: any) =>
        conv.conversation_type !== 'self' &&
        conv.conversation_type !== 'ai' &&
        conv.conversation_participants?.some((p: any) => p.user_id === targetUser.id)
      );

      if (existingConv) {
        router.push(`/chat/${existingConv.id}`);
        setIsDiscoveryOpen(false);
        setContactFound(null);
        return;
      }

      setContactFound(targetUser);
      setShowManualEntry(false);
    } catch (err: any) {
      toast.error(`Resolution failed: ${err.message}`);
    } finally {
      setIsSearchingIdentifier(false);
    }
  };

  const handleManualContact = async () => {
    if (!manualIdentifier || manualIdentifier.trim().length < 3) {
      toast.error("Please enter a valid phone number or username");
      return;
    }
    await resolveContact(manualIdentifier);
  };

  const handleQRScan = async (data: string) => {
    console.log("[Chat] QR Data scanned:", data);
    setShowQRScanner(false);

    try {
      let targetId = data;
      // 1. Try to parse as JSON first (standard payload)
      try {
        const parsed = JSON.parse(data);
        if (parsed.userId) targetId = parsed.userId;
      } catch (e) {
        // Fallback: use raw data if not JSON (maybe just a UUID or phone)
      }

      toast.loading("Resolving contact...", { id: 'qr-resolve' });
      const targetUser = await findUserByIdentifier(targetId);

      if (!targetUser || !targetUser.is_verified) {
        toast.error("User not found or not verified", { id: 'qr-resolve' });
        return;
      }

      toast.success(`Found ${targetUser.full_name || 'User'}!`, { id: 'qr-resolve' });
      setContactFound(targetUser);
      setIsDiscoveryOpen(true); // Open discovery to show the "Add" button
    } catch (err: any) {
      console.error("[Chat] QR Resolution failed:", err);
      toast.error("Failed to resolve QR code", { id: 'qr-resolve' });
    }
  };

  const openSelfChat = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: user.id });
      if (error) throw error;
      const selfConvId = data?.self_conversation_id;
      if (!selfConvId) throw new Error('No self conversation returned');
      router.push(`/chat/${selfConvId}`);
    } catch (err: any) {
      console.error("Failed to open self-chat:", err);
      toast.error("Could not open personal notes. Please try again.");
    }
  };

  // ── Derived data ─────────────────────────────────────────────────
  const selfConv = conversations?.find((c: any) => c.conversation_type === 'self');
  const coachConv = conversations?.find((c: any) => c.conversation_type === 'ai');

  // V7: Merge actual conversations and contacts who don't have a conversation yet
  const peerConvs = useMemo(() => {
    // Inject display properties correctly from the new optimized payload
    const baseConvs = (conversations || [])
      .filter((c: any) => c.conversation_type !== 'self' && c.conversation_type !== 'ai')
      .map((c: any) => ({
        ...c,
        display_name: c.name || c.other_participant_info?.full_name || c.other_participant_info?.username || c.other_participant_info?.phone_number || 'User',
        display_avatar: c.other_participant_info?.avatar_url,
        display_phone: c.other_participant_info?.phone_number
      }));

    // CRITICAL FIX: DO NOT create "Virtual" contactConvs and merge them into peerConvs.
    // That causes the duplicate/respawn bug. Active chats should only be active chats.
    return baseConvs;
  }, [conversations, user?.id]);

  const isActuallyUnread = (conv: any) => (conv?.unread_count || 0) > 0;

  const filteredPeerConvs = (() => {
    const seen = new Set<string>();
    return peerConvs.filter((conv: any) => {
      if (seen.has(conv.id)) return false;
      seen.add(conv.id);
      const matchesSearch = (
        (conv.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.display_phone || '').includes(searchQuery) ||
        (conv.last_message?.content || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!matchesSearch) return false;
      if (activeTab === 'Unread') return isActuallyUnread(conv);
      if (activeTab === 'Groups') return conv.is_group;
      return true;
    });
  })();

  // Contacts tab = PURE address book: list ALL friends/contacts
  // This matches WhatsApp's design of having a complete contact list
  const contactList = useMemo(() => {
    return contactsData
      .filter((c: any) => c && (c.full_name || c.phone_number || c.username))
      .sort((a: any, b: any) =>
        (a.full_name || a.phone_number || '').localeCompare(b.full_name || b.phone_number || '')
      );
  }, [contactsData]);

  // When tapping a contact: navigate to existing conversation or create one
  // When tapping a contact: navigate to existing conversation or a "new chat" virtual route
  const handleContactTap = (contact: any) => {
    const existingConv = conversations?.find((conv: any) =>
      conv.conversation_type !== 'self' &&
      conv.conversation_type !== 'ai' &&
      conv.conversation_participants?.some((p: any) => p.user_id === contact.id)
    );
    if (existingConv) {
      router.push(`/chat/${existingConv.id}`);
    } else {
      // Navigate using a special prefix or state to signal this is a NEW conversation
      router.push(`/chat/new-${contact.id}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0b141a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-vic-green"></div>
      </div>
    );
  }

  if (!verified && user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-white dark:bg-[#0d1418] overflow-y-auto">
        <div className="size-24 bg-vic-green/10 rounded-full flex items-center justify-center mb-6 shrink-0">
          <MessageCircle className="text-vic-green" size={48} />
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xs">{t('chat_desc')}</p>
        {(typeof window !== 'undefined' && localStorage.getItem("pending_otp") === "true") ? (
          <div className="w-full max-w-xs space-y-3 shrink-0">
            <button onClick={() => router.push("/verification-code")} className="w-full py-4 bg-vic-green text-slate-900 font-bold rounded-2xl shadow-lg">
              Masukkan Kode
            </button>
            <button onClick={() => { localStorage.removeItem("pending_otp"); router.push("/phone-input"); }} className="w-full py-4 bg-transparent border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl">
              Ganti Nomor Telepon
            </button>
          </div>
        ) : (
          <button onClick={() => router.push("/phone-input")} className="w-full max-w-xs py-4 bg-vic-green text-slate-900 font-bold rounded-2xl shadow-lg shrink-0">
            {t('verify_phone')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full bg-white dark:bg-[#0b141a] h-[100dvh] font-sans">
      <header className="px-4 py-3 bg-white dark:bg-[#0d1418] sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-vic-deep-blue dark:text-vic-green hover:opacity-70 transition-opacity">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-vic-deep-blue dark:text-white tracking-tight">VicCalary</h1>
              <p className="text-[10px] font-bold text-vic-green uppercase tracking-widest">{t('messages')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#54656F] dark:text-[#8696A0] hover:bg-black/5 rounded-full p-2 transition-colors">
                <MoreVertical size={20} />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#233138] rounded-xl shadow-xl border border-slate-100 dark:border-white/5 z-50 py-2">
                  <button onClick={() => { setIsDiscoveryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-slate-50 dark:hover:bg-white/5">New Chat</button>
                  <button onClick={async () => {
                    const data = await getMyQRCodeData(user!.id);
                    setQrData(data);
                    setShowMyQR(true);
                    setIsMenuOpen(false);
                  }} className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-slate-50 dark:hover:bg-white/5">My VicCode (QR)</button>
                  <button onClick={() => { router.push('/profile'); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm dark:text-white hover:bg-slate-50 dark:hover:bg-white/5">Profile</button>
                </div>
              )}
            </div>
          </div>
        </div>


        {currentView === 'chats' && (
          <div className="grid grid-cols-3 gap-2 mt-2 pb-1">
            {['All', 'Unread', 'Groups'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`py-2 rounded-full text-xs font-bold transition-all ${activeTab === tab ? 'bg-vic-green/20 text-vic-green border border-vic-green/30' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Search bar */}
      <div className="px-4 py-2 bg-white dark:bg-[#0d1418] border-b border-slate-50 dark:border-white/[0.02]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 rounded-xl text-sm outline-none dark:text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-vic-green"></div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/[0.02]">

            {/* ── Health Coach (pinned AI chat) ── */}
            {coachConv && (
              <Link href={`/chat/${coachConv.id}`}
                className={`flex gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors ${isActuallyUnread(coachConv) ? 'bg-vic-green/5' : ''}`}>
                <div className="size-14 rounded-full overflow-hidden shrink-0 border-2 border-vic-green/30">
                  <AvatarImg src="/app-logo.png" name="Health Coach" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold dark:text-white">Health Coach</h3>
                      <span className="text-[10px] font-bold bg-vic-green text-white px-2 py-0.5 rounded-full shadow-sm">AI</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {coachConv.last_message ? new Date(coachConv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[13px] truncate ${isActuallyUnread(coachConv) ? 'font-bold text-[#111B21] dark:text-[#E9EDEF]' : 'text-slate-500'}`}>
                      {coachConv.last_message ? (
                        <>
                          {coachConv.last_message.sender_id === user?.id && <span className="text-[#8696A0]">You: </span>}
                          {coachConv.last_message.message_type === 'image' ? '📷 Image' :
                            coachConv.last_message.message_type === 'voice' ? '🎤 Voice Message' :
                              coachConv.last_message.message_type === 'video' ? '📹 Video' :
                                coachConv.last_message.message_type === 'file' ? '📄 Document' :
                                  coachConv.last_message.content}
                        </>
                      ) : "Ask your Health Coach anything..."}
                    </p>
                    {isActuallyUnread(coachConv) && (
                      <div className="min-w-[20px] h-5 px-1.5 bg-vic-green rounded-full flex items-center justify-center ml-2">
                        <span className="text-[10px] font-bold text-white">{coachConv.unread_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )}

            {/* ── Message Yourself (self chat) ── */}
            <button
              onClick={() => selfConv ? router.push(`/chat/${selfConv.id}`) : openSelfChat()}
              className={`w-full flex gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left transition-colors ${selfConv && isActuallyUnread(selfConv) ? 'bg-vic-green/5' : ''}`}>
              <div className="size-14 rounded-full overflow-hidden border-2 border-vic-pink/30 shrink-0 relative">
                <AvatarImg src={profile?.avatar_url} name="Me" />
                <div className="absolute inset-0 flex items-end justify-end p-1">
                  <div className="w-5 h-5 bg-vic-pink rounded-full border-2 border-white dark:border-[#0b141a] flex items-center justify-center">
                    <Bookmark className="text-white" size={10} />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold dark:text-white">Message Yourself</h3>
                    <span className="text-[10px] font-bold bg-vic-pink text-white px-2 py-0.5 rounded-full shadow-sm">Notes</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {selfConv?.last_message ? new Date(selfConv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className={`text-[13px] truncate ${selfConv && isActuallyUnread(selfConv) ? 'font-bold text-[#111B21] dark:text-[#E9EDEF]' : 'text-slate-500'}`}>
                  {selfConv?.last_message ? (
                    <>
                      {selfConv.last_message.message_type === 'image' ? '📷 Image' :
                        selfConv.last_message.message_type === 'voice' ? '🎤 Voice Message' :
                          selfConv.last_message.message_type === 'video' ? '📹 Video' :
                            selfConv.last_message.message_type === 'file' ? '📄 Document' :
                              selfConv.last_message.content}
                    </>
                  ) : "Send a message to yourself..."}
                </p>
              </div>
            </button>

            {/* ── Peer conversations ── */}
            {filteredPeerConvs.map((conv: any) => {
              const isUnread = isActuallyUnread(conv);
              const otherParticipant = conv.conversation_participants?.find((p: any) => p.user_id !== user?.id && p.user_id !== COACH_ID);
              const isOnline = otherParticipant && onlineUsers.has(otherParticipant.user_id);
              return (
                <div
                  key={conv.id}
                  className={`flex gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors ${isUnread ? 'bg-vic-green/5' : ''} select-none cursor-pointer`}
                  onClick={() => router.push(`/chat/${conv.id}`)}
                  onTouchStart={() => handleLongPressStart(conv)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(conv)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onContextMenu={(e) => { e.preventDefault(); setLongPressConv(conv); }}
                >
                  <div className="size-14 rounded-full overflow-hidden shrink-0 relative">
                    <AvatarImg src={conv.display_avatar} name={conv.display_name} />
                    {isOnline && (
                      <div className="absolute bottom-0.5 right-0.5 size-3.5 bg-[#25D366] rounded-full border-2 border-white dark:border-[#0b141a]"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={`truncate dark:text-white ${isUnread ? 'font-black' : 'font-bold'}`}>{conv.display_name}</h3>
                      <span className={`text-[10px] ${isUnread ? 'text-vic-green font-bold' : 'text-slate-400'}`}>
                        {new Date(conv.last_message?.created_at || conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-[13px] truncate ${isUnread ? 'font-bold text-[#111B21] dark:text-[#E9EDEF]' : 'text-slate-500'}`}>
                        {conv.last_message ? (
                          <>
                            {conv.last_message.sender_id === user?.id && (
                              <CheckCheck className={`inline align-middle mr-1 ${conv.last_message.read_at ? 'text-[#34B7F1]' : 'text-[#8696A0]'}`} size={15} />
                            )}
                            {conv.last_message.message_type === 'image' ? (
                              <span className="flex items-center gap-1"><Image size={16} /> Image</span>
                            ) : conv.last_message.message_type === 'voice' ? (
                              <span className="flex items-center gap-1"><Mic size={16} /> Voice Message</span>
                            ) : conv.last_message.message_type === 'video' ? (
                              <span className="flex items-center gap-1"><Video size={16} /> Video</span>
                            ) : conv.last_message.message_type === 'file' ? (
                              <span className="flex items-center gap-1"><FileText size={16} /> Document</span>
                            ) : conv.last_message.content}
                          </>
                        ) : "No messages yet"}
                      </p>
                      {isUnread && (
                        <div className="min-w-[20px] h-5 px-1.5 bg-vic-green rounded-full flex items-center justify-center ml-2">
                          <span className="text-[10px] font-bold text-white">{conv.unread_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && filteredPeerConvs.length === 0 && !coachConv && (
              <div className="p-12 text-center">
                <MessageCircle className="text-slate-300 mb-3 mx-auto" size={36} />
                <p className="text-slate-500">No conversations yet. Add a friend to get started!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => setIsDiscoveryOpen(true)} className="fixed bottom-24 right-6 size-14 bg-vic-pink text-white rounded-full shadow-lg flex items-center justify-center z-20">
        <MessageSquarePlus size={22} />
      </button>

      {/* ── Long-press delete sheet ── */}
      {longPressConv && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setLongPressConv(null)}>
          <div className="w-full max-w-2xl mx-auto bg-white dark:bg-[#1f2c34] rounded-t-3xl overflow-hidden pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-white/5 flex items-center gap-3">
              <div className="size-12 rounded-full overflow-hidden shrink-0">
                <AvatarImg src={longPressConv.display_avatar} name={longPressConv.display_name} />
              </div>
              <div>
                <p className="font-bold dark:text-white">{longPressConv.display_name}</p>
                <p className="text-xs text-slate-500">{longPressConv.last_message?.content?.slice(0, 40) || 'No messages yet'}</p>
              </div>
            </div>
            <button
              onClick={() => deleteConversationMutation.mutate(longPressConv.id)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
            >
              <Trash2 size={20} />
              <span className="font-semibold">Delete Conversation</span>
            </button>
            <button
              onClick={() => setLongPressConv(null)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 transition-colors"
            >
              <X size={20} />
              <span className="font-semibold">Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Discovery modal ── */}
      {isDiscoveryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]">
            <div className="p-6 border-b dark:border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-2xl font-black dark:text-white tracking-tight">New Message</h2>
              <button
                onClick={() => {
                  setIsDiscoveryOpen(false);
                  setDiscoveryQuery("");
                }}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {/* Actions Header */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => { setShowQRScanner(true); setIsDiscoveryOpen(false); }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-black/20 rounded-2xl group active:scale-95 transition-transform">
                  <ScanLine className="text-vic-green group-hover:scale-110 transition-transform" size={28} />
                  <span className="text-xs font-bold dark:text-white text-center">Scan VicCode</span>
                </button>
                <button onClick={() => { setShowManualEntry(true); setIsDiscoveryOpen(false); }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-black/20 rounded-2xl group active:scale-95 transition-transform">
                  <UserSearch className="text-vic-pink group-hover:scale-110 transition-transform" size={28} />
                  <span className="text-xs font-bold dark:text-white text-center">Search for Friends</span>
                </button>
              </div>

              {/* Discovery Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Type a name or username..."
                  value={discoveryQuery}
                  onChange={(e) => setDiscoveryQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 rounded-xl outline-none dark:text-white placeholder:text-slate-400"
                />
              </div>

              {/* Results Area */}
              <div className="space-y-4">
                {discoveryQuery.length > 0 ? (
                  <>
                    <p className="text-[10px] font-bold text-vic-pink uppercase tracking-widest pl-2">Global Search</p>
                    {isSearching && <div className="p-4 text-center text-slate-500 text-sm">Searching...</div>}
                    <div className="space-y-1">
                      {searchResults?.map((result: any) => {
                        const isAlreadyContact = contactsData?.some((c: any) => c.id === result.id);
                        return (
                          <button
                            key={result.id}
                            onClick={() => !isAlreadyContact && addContactMutation.mutate(result.id)}
                            disabled={isAlreadyContact || addContactMutation.isPending}
                            className={`w-full flex items-center gap-4 p-3 rounded-xl text-left transition-colors ${isAlreadyContact ? 'hover:bg-slate-50 dark:hover:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                          >
                            <div className="size-12 rounded-full overflow-hidden shrink-0 border-2 border-transparent group-hover:border-vic-green/30">
                              <AvatarImg src={result.avatar_url} name={result.full_name} />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold dark:text-white">{result.full_name}</h4>
                              <p className="text-xs text-slate-500">{result.username || result.phone_number}</p>
                              {isAlreadyContact && <p className="text-[10px] text-vic-green font-bold mt-0.5">ALREADY IN CONTACTS</p>}
                            </div>
                            {!isAlreadyContact && (
                              <UserPlus className="text-vic-green" size={20} />
                            )}
                          </button>
                        );
                      })}
                      {searchResults?.length === 0 && !isSearching && (
                        <div className="p-4 text-center text-slate-400 text-sm italic">No people found matching "{discoveryQuery}"</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-vic-green uppercase tracking-widest pl-2">Your Friends</p>
                    <div className="space-y-1">
                      {contactList.map((contact: any) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            handleContactTap(contact);
                            setIsDiscoveryOpen(false);
                          }}
                          className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-left transition-colors group"
                        >
                          <div className="size-12 rounded-full overflow-hidden shrink-0 relative">
                            <AvatarImg src={contact.avatar_url} name={contact.full_name} />
                            {onlineUsers.has(contact.id) && (
                              <div className="absolute bottom-0 right-0 size-3 bg-vic-green rounded-full border-2 border-white dark:border-[#1f2c34]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold dark:text-white group-hover:text-vic-green transition-colors">{contact.full_name}</h4>
                            <p className="text-xs text-slate-500">{contact.phone_number}</p>
                          </div>
                        </button>
                      ))}
                      {contactList.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                          <UserRound className="text-slate-200 mb-2" size={36} />
                          <p className="text-sm">You haven't added any friends yet.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual identifier entry ── */}
      {showManualEntry && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl p-8">
            <h2 className="text-2xl font-black dark:text-white mb-2 tracking-tight">Add Friend</h2>
            <p className="text-sm text-slate-500 mb-8">Enter a username or phone number (with country code).</p>
            <input autoFocus type="text" placeholder="@username or +1234..."
              value={manualIdentifier} onChange={(e) => setManualIdentifier(e.target.value)}
              className="w-full h-16 p-5 bg-slate-50 dark:bg-black/40 rounded-2xl border-2 border-transparent focus:border-vic-pink outline-none text-xl font-bold dark:text-white mb-8" />
            <div className="flex flex-col gap-3">
              <button onClick={handleManualContact} disabled={manualIdentifier.trim().length === 0 || isSearchingIdentifier}
                className="w-full py-5 bg-vic-green text-slate-900 font-black rounded-2xl shadow-xl disabled:opacity-50">
                {isSearchingIdentifier ? "SEARCHING..." : "SEARCH & ADD"}
              </button>
              <button onClick={() => setShowManualEntry(false)} className="w-full py-4 text-slate-500 font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Scanner ── */}
      {showQRScanner && (
        <QRScanner
          onScan={(data) => handleQRScan(data)}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* ── Contact confirmation modal ── */}
      {contactFound && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f2c34] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center">
            <div className="size-24 rounded-full overflow-hidden mb-6 ring-4 ring-vic-green/20">
              <AvatarImg src={contactFound.avatar_url} name={contactFound.full_name} />
            </div>
            <h2 className="text-2xl font-black dark:text-white mb-1">{contactFound.full_name}</h2>
            <p className="text-vic-green font-bold text-sm mb-8">{contactFound.phone_number}</p>
            <div className="flex flex-col w-full gap-3">
              {contactsData?.some((c: any) => c.id === contactFound.id) ? (
                <div className="w-full py-5 bg-vic-green/10 text-vic-green font-black rounded-2xl border border-vic-green/20">
                  ALREADY IN CONTACTS
                </div>
              ) : (
                <button onClick={() => addContactMutation.mutate(contactFound.id)} className="w-full py-5 bg-vic-green text-slate-900 font-black rounded-2xl shadow-xl">ADD CONTACT</button>
              )}
              <button onClick={() => setContactFound(null)} className="w-full py-4 text-slate-500 font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── My VicCode Modal ── */}
      {showMyQR && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowMyQR(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <MyQRCode data={qrData} fullName={profile?.full_name} />
            <Button
              variant="ghost"
              className="w-full mt-4 text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => setShowMyQR(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
