"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { requestMicrophoneAccess } from "@/lib/api/permissions";
import { AlertCircle, MapPin, Navigation, Plus, Link as LinkIcon, FileText, ArrowLeft, Bookmark, Video, VideoOff, Phone, PhoneOff, Trash2, MoreVertical, Smile, Paperclip, Mic, Send, CheckCheck, Lock, Image, Headphones, User, BarChart, ChevronLeft, TriangleAlert, X, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { saveFoodAnalysis } from '@/lib/api/food';
import { getConversationById, getMessages, sendMessage, uploadChatMedia, markAsRead, sendTypingIndicator, initiateCallV2, updateCallStatus, softDeleteConversation, findUserByIdSecure, provisionAndSendMessage, findConversationByParticipants, archiveConversation, muteConversation, clearChatHistory } from '@/lib/api/chat';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/lib/api/auth';
import { toast } from 'sonner';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { useTranslation } from '@/lib/api/translation';
import CameraCapture from '@/components/CameraCapture';
import { useAnalysisStore } from '@/store/analysisStore';
import { useCoachInjectionStore } from '@/store/coachInjectionStore';
import { useCall } from '@/lib/CallContext';
import IncomingCallModal from '@/components/calls/IncomingCallModal';
import AICoachVoiceModal from '@/components/AICoachVoiceModal';
import { Sparkles } from 'lucide-react';

// --- Constants ---
const COACH_ID = '00000000-0000-0000-0000-000000000001';

// --- Sub-components ---

const AudioMessage = ({ src }: { src: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [internalSrc, setInternalSrc] = useState(src);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [duration, setDuration] = useState(0);
    const MAX_RETRIES = 3;

    useEffect(() => {
        setInternalSrc(src);
        setIsPlaying(false);
        setProgress(0);
        setError(false);
        setRetryCount(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.load();
        }
    }, [src]);

    const performRetry = async (currentAttempt: number) => {
        const delay = Math.pow(2, currentAttempt) * 1000;
        setTimeout(async () => {
            try {
                let blob: Blob;
                if (src.startsWith('blob:')) {
                    const res = await fetch(src);
                    blob = await res.blob();
                } else {
                    const match = src.match(/object\/public\/([^\/]+)\/(.+)/);
                    if (match) {
                        const { data, error: downloadErr } = await supabase.storage.from(match[1]).download(match[2]);
                        if (downloadErr) throw downloadErr;
                        blob = data!;
                    } else {
                        const res = await fetch(src, { mode: 'cors' });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        blob = await res.blob();
                    }
                }
                const objUrl = URL.createObjectURL(blob);
                setInternalSrc(objUrl);
            } catch (err) {
                if (currentAttempt < MAX_RETRIES) {
                    performRetry(currentAttempt + 1);
                } else {
                    setError(true);
                }
            }
        }, delay);
    };

    const togglePlay = () => {
        if (audioRef.current && !error) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => setError(true));
            }
        }
    };

    const handleTogglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        togglePlay();
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-md p-3 px-4 rounded-2xl border border-emerald-500/20 min-w-[240px] shadow-sm group hover:bg-emerald-500/10 transition-all duration-300">
                <button
                    onClick={handleTogglePlay}
                    disabled={error}
                    className="size-11 flex items-center justify-center bg-vic-green text-white rounded-full shadow-lg shadow-vic-green/20 hover:scale-105 active:scale-95 transition-all shrink-0"
                >
                    {error ? <AlertCircle size={20} /> : (
                        isPlaying ? (
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-4 bg-white rounded-full animate-pulse"></div>
                                <div className="w-1.5 h-4 bg-white rounded-full animate-pulse [animation-delay:200ms]"></div>
                            </div>
                        ) : (
                            <div className="translate-x-0.5">
                                <div className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[14px] border-l-white rounded-sm"></div>
                            </div>
                        )
                    )}
                </button>

                <div className="flex-1 space-y-1.5">
                    <div className="flex items-end gap-1 h-6">
                        {[...Array(24)].map((_, i) => (
                            <div
                                key={i}
                                className={`w-[3px] rounded-full transition-all duration-500 ease-out`}
                                style={{ 
                                    height: `${20 + (Math.sin(i * 0.8) * 30) + 30}%`,
                                    backgroundColor: (progress * 24 / 100) > i ? '#10B981' : '#CBD5E1',
                                    opacity: (progress * 24 / 100) > i ? 1 : 0.3
                                }}
                            />
                        ))}
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">
                        <span className="animate-pulse">{isPlaying ? 'Playing Audio' : 'Voice Message'}</span>
                        <span>{duration > 0 ? `${Math.floor((audioRef.current?.currentTime || 0) / 60)}:${Math.floor((audioRef.current?.currentTime || 0) % 60).toString().padStart(2, '0')}` : '0:00'}</span>
                    </div>
                </div>

                <audio
                    ref={audioRef}
                    src={internalSrc}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => { setIsPlaying(false); setProgress(0); }}
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
                            setProgress(p || 0);
                        }
                    }}
                    onLoadedMetadata={() => {
                        if (audioRef.current) setDuration(audioRef.current.duration);
                    }}
                    onError={() => {
                        if (!internalSrc.startsWith('blob:') && retryCount < MAX_RETRIES) {
                            setRetryCount(prev => prev + 1);
                            performRetry(retryCount + 1);
                        } else {
                            setError(true);
                        }
                    }}
                    className="hidden"
                />
            </div>
        </div>
    );
};

// --- Location Message Component (WhatsApp-style) ---
const LocationMessage = ({ lat, lng, name }: { lat: number; lng: number; name?: string }) => {
    const [imgError, setImgError] = useState(false);
    // Use OpenStreetMap static tile via Leaflet's tile convention (free, no API key needed)
    const zoom = 15;
    // Static map URL using OpenStreetMap Nominatim/Overpass static image via geoapify (free tier)
    // Fallback: show a placeholder with coordinates if image fails
    const mapUrl = `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lng},${lat}&z=${zoom}&l=map&size=400,200&pt=${lng},${lat},pm2rdm`;
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${lat},${lng}`;

    const openMap = () => {
        // Open native app or browser maps
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        window.open(isIOS ? appleMapsUrl : googleMapsUrl, '_blank');
    };

    return (
        <div
            className="relative overflow-hidden rounded-xl cursor-pointer group"
            style={{ minWidth: 220, maxWidth: 280 }}
            onClick={openMap}
        >
            {/* Map Preview */}
            {!imgError ? (
                <img
                    src={mapUrl}
                    alt="Location"
                    onError={() => setImgError(true)}
                    className="w-full h-[140px] object-cover rounded-t-xl"
                />
            ) : (
                // Fallback: OpenStreetMap tile via a different provider
                <div className="w-full h-[140px] bg-[#e8f4e8] dark:bg-[#1a2e1a] flex flex-col items-center justify-center gap-2 rounded-t-xl">
                    <MapPin className="text-vic-green" size={48} />
                    <p className="text-xs text-[#667781] font-mono">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                </div>
            )}

            {/* Red Pin Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                    <MapPin className="text-red-500 drop-shadow-lg" size={36} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
                </div>
            </div>

            {/* Dark Overlay on Hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-t-xl" />

            {/* Location Info Bar */}
            <div className="bg-white dark:bg-[#202c33] px-3 py-2 flex items-center gap-2 border-t border-black/5 rounded-b-xl">
                <Navigation className="text-vic-green shrink-0" size={18} />
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111B21] dark:text-[#E9EDEF] truncate">
                        {name || 'Shared Location'}
                    </p>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                        Tap to open in Maps
                    </p>
                </div>
            </div>
        </div>
    );
};

// UUID v4 validation - prevents sending "self" or any invalid string to Supabase
const isValidUUID = (id: string | undefined): boolean => {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export default function ChatConversation() {
    const { id: activeId } = useParams() as { id: string };
    const searchParams = useSearchParams();
    const targetHint = searchParams.get('target');
    
    // V18: localActiveId allows for seamless transitions without full page reloads
    const [localActiveId, setLocalActiveId] = useState(activeId);
    
    // Sync localActiveId with URL params when they change externally (e.g. sidebar tap)
    useEffect(() => {
        if (activeId && activeId !== localActiveId) {
            console.log(`[Chat] URL Sync: Updating localActiveId to ${activeId}`);
            setLocalActiveId(activeId);
        }
    }, [activeId]);

    const isVirtual = localActiveId?.startsWith('new-');
    const virtualTargetId = isVirtual ? localActiveId.replace('new-', '') : (targetHint || null);

    const { user } = useAuth();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();

    // V12: Robust stabilization
    const pendingAnalysisContext = useAnalysisStore(state => state.pendingAnalysisContext);
    const clearPendingAnalysisContext = useAnalysisStore(state => state.clearPendingAnalysisContext);
    const lastMarkedId = useRef<string | null>(null);
    const activeSubscriptionIdRef = useRef<string | null>(null);
    const renderCount = useRef(0);
    renderCount.current++;

    if (renderCount.current % 20 === 0) {
        console.log(`[Chat] Render #${renderCount.current} for ${activeId}`);
    }

    const [hasSentInitial, setHasSentInitial] = useState(false);
    const [message, setMessage] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'preview'>('idle');
    const [isRecordingLocked, setIsRecordingLocked] = useState(false);
    const [activeMediaTab, setActiveMediaTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
    const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string } | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const [otherUserOnline, setOtherUserOnline] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const [recordingDragY, setRecordingDragY] = useState(0);
    const [recordingDragX, setRecordingDragX] = useState(0);
    const [recordingStartY, setRecordingStartY] = useState<number | null>(null);
    const [recordingStartX, setRecordingStartX] = useState<number | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const { startCall } = useCall();
    const [showAiVoiceModal, setShowAiVoiceModal] = useState(false);

    const [showLastSeen, setShowLastSeen] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const shouldSendOnStopRef = useRef(false);
    const recordingStartTimeRef = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        } else if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Visualizer Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [isDictating, setIsDictating] = useState(false);
    const recognitionRef = useRef<any>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Sub-components ---
    const ContextAttachment = () => {
        if (!pendingAnalysisContext) return null;
        const ctx = pendingAnalysisContext;
        return (
            <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="mx-4 mb-6 p-4 bg-white/5 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-vic-green/30 shadow-2xl relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-2 z-10">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            clearPendingAnalysisContext();
                        }}
                        className="p-1.5 bg-black/20 hover:bg-black/40 rounded-full transition-all text-white/60 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                </div>
                
                <div className="flex gap-4 relative z-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                        <img src={ctx.productImage} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-black text-slate-800 dark:text-white text-sm truncate uppercase tracking-tight">{ctx.productName}</h4>
                            {ctx.healthStatus && (
                                <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md border ${
                                    ctx.healthStatus === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    ctx.healthStatus === 'POOR' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}>
                                    {ctx.healthStatus}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase overflow-x-auto no-scrollbar">
                            <span className="shrink-0">{ctx.calories} kcal</span>
                            <span className="shrink-0 opacity-20">|</span>
                            <span className="shrink-0 text-vic-blue">{ctx.protein}g P</span>
                            <span className="shrink-0 text-amber-400">{ctx.carbs}g C</span>
                            <span className="shrink-0 text-rose-400">{ctx.fat}g F</span>
                        </div>
                    </div>
                </div>
                
                {ctx.political_warning && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                        <TriangleAlert size={12} className="text-rose-500 shrink-0" />
                        <p className="text-[9px] font-black text-rose-400 uppercase leading-tight tracking-wider">{ctx.political_warning}</p>
                    </div>
                )}
            </motion.div>
        );
    };

    // --- Queries ---

    const { data: conversationData, isLoading: isLoadingConv } = useQuery({
        queryKey: ['conversation', localActiveId],
        queryKeyHashFn: () => `conversation-${localActiveId}`, // Force unique hash
        queryFn: () => getConversationById(localActiveId!, user!.id),
        enabled: isValidUUID(localActiveId) && !!user,
        refetchOnWindowFocus: false // Don't refetch on window focus to avoid jumps
    });

    const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
        queryKey: ['messages', localActiveId],
        queryFn: async () => {
            if (isVirtual && virtualTargetId) {
                // V7/V8: Check if a direct conversation already exists to load history using RPC
                const existingId = await findConversationByParticipants(user!.id, virtualTargetId);

                if (existingId) {
                    return getMessages(existingId, user!.id);
                }
                return [];
            }
            return getMessages(localActiveId!, user!.id);
        },
        enabled: (isValidUUID(localActiveId) || !!isVirtual) && !!user?.id,
        refetchOnWindowFocus: false
    });

    const { data: profile } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: () => getUserProfile(user!.id),
        enabled: !!user?.id
    });

    const { data: virtualProfile } = useQuery({
        queryKey: ['profile', virtualTargetId],
        queryFn: () => findUserByIdSecure(virtualTargetId!),
        enabled: !!isVirtual && !!virtualTargetId
    });

    // V17: Robust AI/Self detection even during loading/transitions
    const isAI = useMemo(() => {
        if (localActiveId === 'ai-coach' || localActiveId?.includes(COACH_ID)) return true;
        if (isVirtual && virtualTargetId === COACH_ID) return true;
        
        // Check conversation object
        if (conversationData?.conversation_type === 'ai' || conversationData?.is_ai_coach) return true;
        
        // Check participants if available
        const participants = conversationData?.participants || conversationData?.conversation_participants;
        if (participants?.some((p: any) => p.user_id === COACH_ID)) return true;

        // Check global cache if we just transitioned and conversationData is loading
        const cachedConvs = queryClient.getQueryData<any[]>(['conversations', user?.id]);
        const currentConv = cachedConvs?.find(c => c.id === localActiveId);
        if (currentConv?.conversation_type === 'ai' || currentConv?.is_ai_coach) return true;
        
        return false;
    }, [conversationData, isVirtual, virtualTargetId, localActiveId, queryClient, user?.id]);

    const isSelf = useMemo(() => {
        if (conversationData?.conversation_type === 'self') return true;
        if (isVirtual && virtualTargetId === user?.id) return true;
        
        const cachedConvs = queryClient.getQueryData<any[]>(['conversations', user?.id]);
        const currentConv = cachedConvs?.find(c => c.id === localActiveId);
        if (currentConv?.conversation_type === 'self') return true;

        return false;
    }, [conversationData, isVirtual, virtualTargetId, localActiveId, user?.id, queryClient]);

    // Construct a "resolvedConversation" that handles virtual IDs for the UI to render
    const conversation = useMemo(() => {
        if (conversationData) return conversationData;
        if (isVirtual && virtualProfile) {
            return {
                id: activeId,
                conversation_type: isAI ? 'ai' : isSelf ? 'self' : 'direct',
                conversation_participants: [
                    { user_id: user?.id, user_profiles: profile },
                    { user_id: virtualTargetId, user_profiles: virtualProfile }
                ]
            };
        }
        return null;
    }, [conversationData, isVirtual, virtualProfile, activeId, isAI, isSelf, user?.id, profile, virtualTargetId]);

    const isDirect = useMemo(() => conversation?.conversation_type === 'private' || conversation?.conversation_type === 'direct', [conversation]);

    const otherParticipant = useMemo(() => {
        if (isSelf) return null;
        return conversation?.conversation_participants?.find((p: any) => p.user_id !== user?.id);

    }, [conversation, user, isSelf]);

    const otherParticipantId = otherParticipant?.user_id;

    const { data: otherUserProfile } = useQuery({
        queryKey: ['profile', otherParticipantId || virtualTargetId],
        queryFn: () => findUserByIdSecure((otherParticipantId || virtualTargetId)!),
        enabled: !!(otherParticipantId || virtualTargetId) && !isAI && !isSelf
    });

    // Profile Realtime Sync
    useEffect(() => {
        if (!otherParticipantId) return;

        const profileChannel = supabase
            .channel(`profile:${otherParticipantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user_profiles',
                    filter: `id=eq.${otherParticipantId}`
                },
                (payload) => {
                    queryClient.setQueryData(['profile', otherParticipantId], payload.new);
                    queryClient.invalidateQueries({ queryKey: ['conversation', activeId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
        };
    }, [otherParticipantId, queryClient, activeId]);

    // V13: Handle initial message and context from navigation state or stores (Moved down)


    const displayName = useMemo(() => {
        if (isAI) return 'Health Coach';
        if (isSelf) return (profile?.full_name ? `${profile.full_name} (Me)` : 'Personal Notes');
        
        // If loading, try to find the profile in the virtual cache or global search cache
        const rawP = isVirtual ? virtualProfile : (otherUserProfile || otherParticipant?.user_profiles);
        const p = Array.isArray(rawP) ? rawP[0] : rawP;
        
        if (p?.full_name || p?.username) return p.full_name || p.username;
        if (conversation?.display_name && conversation.display_name !== 'User') return conversation.display_name;
        if (otherParticipant?.chat_users?.phone_number) return otherParticipant.chat_users.phone_number;
        
        // Final fallback: Check the conversations list cache for a pre-loaded name
        const cachedConvs = queryClient.getQueryData<any[]>(['conversations', user?.id]);
        const currentConv = cachedConvs?.find(c => c.id === localActiveId);
        if (currentConv?.display_name && currentConv.display_name !== 'User') return currentConv.display_name;

        return 'User';
    }, [conversation, isAI, isSelf, profile, otherParticipant, otherUserProfile, isVirtual, virtualProfile, queryClient, user?.id, localActiveId]);

    const displayAvatar = useMemo(() => {
        if (isAI) return '/app logo.png';
        if (isSelf) return profile?.avatar_url;
        
        const rawP = isVirtual ? virtualProfile : (otherUserProfile || otherParticipant?.user_profiles);
        const p = Array.isArray(rawP) ? rawP[0] : rawP;
        
        if (p?.avatar_url) return p.avatar_url;
        if (conversation?.display_avatar) return conversation.display_avatar;
        
        const cachedConvs = queryClient.getQueryData<any[]>(['conversations', user?.id]);
        const currentConv = cachedConvs?.find(c => c.id === localActiveId);
        if (currentConv?.display_avatar) return currentConv.display_avatar;

        return null;
    }, [conversation, isAI, isSelf, profile, otherParticipant, otherUserProfile, isVirtual, virtualProfile, queryClient, user?.id, localActiveId]);

    // Handle initial scroll
    useEffect(() => {
        if (scrollRef.current && !isLoadingMessages) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isLoadingMessages, activeId]);

    // V13: Robust Smart Scroll
    const isAtBottom = useRef(true);
    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        // 100px threshold to be considered "at bottom"
        const atBottom = scrollHeight - scrollTop - clientHeight < 100;
        isAtBottom.current = atBottom;
    }, []);


    // Scroll when messages changes or AI is typing
    useEffect(() => {
        if (isAtBottom.current) {
            scrollToBottom('smooth');
        }
    }, [messages.length, otherUserTyping]);

    // V13: Also scroll when the LAST message content changes (for AI streaming)
    const lastMessageContent = messages[messages.length - 1]?.content;
    useEffect(() => {
        if (isAI && otherUserTyping && isAtBottom.current) {
            scrollToBottom('smooth');
        }
    }, [lastMessageContent, isAI, otherUserTyping]);

    // Presence Logic
    useEffect(() => {
        if (!user?.id) return;

        const presenceChannel = supabase.channel('online-users');
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const online = new Set<string>();
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.user_id) online.add(p.user_id);
                    });
                });
                setOnlineUsers(online);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            supabase.removeChannel(presenceChannel);
        };
    }, [user?.id]);


    const resolvedOtherUserId = otherParticipant?.user_id || virtualTargetId;
    const isOnline = resolvedOtherUserId && onlineUsers.has(resolvedOtherUserId);
    const displayStatus = useMemo(() => {
        if (isOnline) return "online";
        
        // Prevent empty arrays from useQuery from overwriting the pre-fetched profile from conversation
        const resolvedUserProfile = (Array.isArray(otherUserProfile) && otherUserProfile.length === 0) ? null : otherUserProfile;
        const rawP = isVirtual ? virtualProfile : (resolvedUserProfile || otherParticipant?.user_profiles);
        const p = Array.isArray(rawP) ? rawP[0] : rawP;
        
        const lastSeenStr = p?.last_seen || p?.updated_at;
        
        if (lastSeenStr) {
            const date = new Date(lastSeenStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return `last seen today at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else if (diffDays === 1) {
                return `last seen yesterday at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else {
                return `last seen ${date.toLocaleDateString()}`;
            }
        }
        return "Offline";
    }, [isOnline, isVirtual, virtualProfile, otherUserProfile, otherParticipant]);

    // --- Actions ---

    const handleStartCall = async (type: 'audio' | 'video' | 'voice') => {
        const callType: 'voice' | 'video' = (type === 'video') ? 'video' : 'voice';

        if (!user?.id || !localActiveId) {
            toast.error("Unable to start call: Session invalid");
            return;
        }

        if (isSelf) {
            toast.error("Cannot call yourself.");
            return;
        }

        if (isAI) {
            toast.error("Calls are not supported with Health Coach.");
            return;
        }

        const targetUserId = otherParticipantId || virtualTargetId;
        if (!targetUserId || targetUserId === user.id) {
            toast.error("Call participant not found");
            return;
        }

        await startCall({
            conversationId: localActiveId,
            receiverId: targetUserId,
            type: callType,
            partnerName: displayName || 'Vicalary User',
            partnerAvatar: displayAvatar || null,
            isSelf,
            isAI
        });
    };

    const onEmojiClick = (emojiData: any) => {
        setMessage(prev => prev + emojiData.emoji);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        toast.loading("Sending media...");
        try {
            const publicUrl = await uploadChatMedia(user.id, file);
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
            sendMutation.mutate({ content: file.name, type, metadata: { url: publicUrl } });
            toast.dismiss();
            toast.success("Sent!");
        } catch (err) {
            toast.dismiss();
            toast.error("Failed to upload");
        }
    };

    // Recording Logic
    const startRecording = async (e?: React.MouseEvent | React.TouchEvent) => {
        try {
            console.log("[Voice] Starting recording session...");
            const stream = await requestMicrophoneAccess({ audio: true });

            // Determine optimal supported audio MIME type for cross-browser compatibility
            let mimeType = '';
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4'; // Safari preferred
            } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus'; // Chrome preferred
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                const finalMimeType = mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: finalMimeType });

                stream.getTracks().forEach(track => track.stop());

                if (audioContextRef.current) {
                    audioContextRef.current.close().catch(console.error);
                    audioContextRef.current = null;
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }

                if (blob.size < 1000) {
                    // Too small / cancelled
                    setRecordedAudio(null);
                    setRecordingStatus('idle');
                    return;
                }

                if (shouldSendOnStopRef.current) {
                    // Send immediately! No preview.
                    setRecordingStatus('idle');
                    const uploadAndSend = async () => {
                        toast.loading("Sending audio...", { id: 'voice-upload' });
                        try {
                            const actualDuration = Math.max(1, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
                            const audioFile = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                            const publicUrl = await uploadChatMedia(user!.id, audioFile);
                            sendMutation.mutate({
                                content: "Voice Message",
                                type: 'voice',
                                metadata: { url: publicUrl, duration: actualDuration }
                            });
                            toast.success("Sent!", { id: 'voice-upload' });
                        } catch (err) {
                            console.error("Failed to upload audio:", err);
                            toast.error("Failed to send audio", { id: 'voice-upload' });
                        }
                    };
                    uploadAndSend();
                } else {
                    // Show preview (because they locked it)
                    const url = URL.createObjectURL(blob);
                    setRecordedAudio({ blob, url });
                    setRecordingStatus('preview');
                }
            };

            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 64;
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                audioContextRef.current = audioContext;
                analyserRef.current = analyser;
            } catch (e) {
                console.error("Audio Context Init Failed", e);
            }

            recordingStartTimeRef.current = Date.now();
            recorder.start(1000);
            setIsRecording(true);
            setRecordingStatus('recording');
            setIsRecordingLocked(false);
            setRecordingDragY(0);

            if (e) {
                const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
                const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
                setRecordingStartY(y);
                setRecordingStartX(x);
            }
        } catch (err) {
            console.error("[Voice] Mic access denied:", err);
            toast.error("Microphone access denied");
        }
    };

    const startDictation = () => {
        if (isDictating) {
            recognitionRef.current?.stop();
            setIsDictating(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Speech recognition not supported in this browser");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = document.documentElement.lang || 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
            setIsDictating(true);
            toast.info("Listening...", { id: 'stt-status' });
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                setMessage(prev => prev + (prev ? ' ' : '') + finalTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("STT Error:", event.error);
            setIsDictating(false);
            toast.error(`Error: ${event.error}`, { id: 'stt-status' });
        };

        recognition.onend = () => {
            setIsDictating(false);
            toast.dismiss('stt-status');
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopRecording = (cancel = false, sendImmediately = false) => {
        if (mediaRecorderRef.current && isRecording) {
            if (cancel) {
                shouldSendOnStopRef.current = false;
                mediaRecorderRef.current.onstop = () => {
                    console.log("[Voice] Recording cancelled");
                    setIsRecording(false);
                    setRecordingStatus('idle');
                    setIsRecordingLocked(false);
                    setRecordedAudio(null);
                    setRecordingDragY(0);
                };
            } else {
                shouldSendOnStopRef.current = sendImmediately;
            }
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const confirmVoiceSend = async () => {
        if (!recordedAudio || !user?.id) return;

        const { blob } = recordedAudio;
        if (blob.size < 100) {
            toast.error("Audio recording too short");
            setRecordedAudio(null);
            setRecordingStatus('idle');
            return;
        }

        toast.loading("Sending audio...", { id: 'voice-upload' });
        if (isAI) setIsProcessingVoice(true);
        try {
            const audioFile = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
            const publicUrl = await uploadChatMedia(user.id, audioFile);

            sendMutation.mutate({
                content: "Voice Message",
                type: 'voice',
                metadata: { 
                    url: publicUrl, 
                    duration: recordingDuration,
                    mimeType: blob.type
                }
            });

            toast.success("Sent!", { id: 'voice-upload' });
        } catch (err) {
            console.error("Failed to upload audio:", err);
            toast.error("Failed to send audio", { id: 'voice-upload' });
            setIsProcessingVoice(false);
        } finally {
            setRecordedAudio(null);
            setRecordingStatus('idle');
        }
    };

    const discardRecording = () => {
        setRecordedAudio(null);
        setRecordingStatus('idle');
        toast.info("Recording discarded");
    };

    const handleRecordingMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isRecording || isRecordingLocked || recordingStartY === null) return;

        const currentY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;

        const deltaY = recordingStartY - currentY; // positive is upwards
        const deltaX = recordingStartX !== null ? currentX - recordingStartX : 0; // negative is leftwards

        setRecordingDragY(deltaY);
        setRecordingDragX(deltaX);

        if (deltaY > 80) { // Lock threshold
            setIsRecordingLocked(true);
            setRecordingStartY(null);
            setRecordingStartX(null);
            setRecordingDragY(0);
            setRecordingDragX(0);
            toast.success("Recording locked", { duration: 1000 });
        } else if (deltaX < -100) { // Cancel threshold
            stopRecording(true);
        }
    }, [isRecording, isRecordingLocked, recordingStartY]);

    useEffect(() => {
        if (isRecording && !isRecordingLocked) {
            window.addEventListener('mousemove', handleRecordingMove);
            window.addEventListener('touchmove', handleRecordingMove);
            window.addEventListener('mouseup', () => !isRecordingLocked && stopRecording());
            window.addEventListener('touchend', () => !isRecordingLocked && stopRecording());
        }
        return () => {
            window.removeEventListener('mousemove', handleRecordingMove);
            window.removeEventListener('touchmove', handleRecordingMove);
        };
    }, [isRecording, isRecordingLocked, handleRecordingMove]);

    const toggleRecordingLock = () => {
        setIsRecordingLocked(prev => !prev);
    };

    // Recording Timer
    useEffect(() => {
        let interval: any;
        if (isRecording) {
            setRecordingDuration(0);
            const start = Date.now();
            interval = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        } else {
            setRecordingDuration(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Waveform Animation Loop
    useEffect(() => {
        if (!isRecording) return;

        const animate = () => {
            if (!analyserRef.current || !canvasRef.current) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = 3;
            const gap = 3;
            const barsToDraw = Math.floor(canvas.width / (barWidth + gap));
            const centerHeight = canvas.height / 2;

            // Gradient for the bars
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#10B981'); // Emerald-500
            gradient.addColorStop(0.5, '#34D399'); // Emerald-400
            gradient.addColorStop(1, '#10B981'); // Emerald-500

            ctx.fillStyle = gradient;

            for (let i = 0; i < barsToDraw; i++) {
                // Use frequency data for more movement
                const value = dataArray[i % bufferLength] || 0;
                const percent = value / 255;
                const height = Math.max(percent * (canvas.height * 0.8), 6); // Min height 6px

                const x = i * (barWidth + gap);
                const y = centerHeight - (height / 2);

                // Rounded bars for premium look with fallback
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, barWidth, height, 4);
                    ctx.fill();
                } else {
                    ctx.fillRect(x, y, barWidth, height);
                }
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isRecording]);

    // --- Real-time Sync Logic ---

    // Robust Read Status Sync
    const markConversationAsReadLocal = useCallback(async (convId: string, force = false) => {
        if (!user?.id || !convId) return;

        // Loop Guard: If we JUST marked this ID as read in this component instance, STOP.
        // Unless it's a forced update (e.g. new message came in)
        if (!force && lastMarkedId.current === convId) {
            return;
        }

        let realId = convId;

        // If it's a virtual ID, resolve it
        if (convId.startsWith('new-')) {
            const targetId = convId.replace('new-', '');
            const existingId = await findConversationByParticipants(user.id, targetId);
            if (!existingId) return;
            realId = existingId;
        } else if (!isValidUUID(convId)) {
            return;
        }

        // --- Double Guard: Check local cache unread status ---
        const conversations = queryClient.getQueryData<any[]>(['conversations', user.id]);
        const currentConv = conversations?.find(c => c.id === realId);

        // If unread_count is already 0 in the UI and we are not forced, we can skip
        if (!force && currentConv && currentConv.unread_count === 0 && lastMarkedId.current === convId) {
            return;
        }

        if (lastMarkedId.current === realId && !force) {
            return;
        }

        console.log(`[Chat] Marking as read (API call): ${realId} (Force: ${force})`);
        lastMarkedId.current = realId; // Set guard IMMEDIATELY using the resolved realId

        // 1. Optimistic UI update
        queryClient.setQueryData(['conversations', user.id], (old: any) => {
            if (!old) return old;
            return old.map((c: any) => c.id === realId ? { ...c, unread_count: 0, is_read: true } : c);
        });

        try {
            await markAsRead(user.id, realId);
            // Clear unread count globally too
            queryClient.invalidateQueries({ queryKey: ['unread-messages-global', user.id] });
            queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        } catch (err) {
            console.error('[Chat] Failed to clear unread:', err);
            lastMarkedId.current = null; // Reset guard on failure to allow retry
        }
    }, [user?.id, queryClient]);

    // V11: Ground Truth Persistence Logic
    const activeChannelRef = useRef<any>(null);
    const lastReadAtTimestampRef = useRef<string | null>(null);

    // Refs for handlers to avoid useEffect dependency churn
    const onMessageEventRef = useRef<((payload: any) => void) | null>(null);

    useEffect(() => {
        onMessageEventRef.current = (payload: any) => {
            console.log(`[Chat] V11 Real-time event [${payload.eventType}]:`, payload);

            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new;
                if (newMessage.sender_id === COACH_ID) {
                    setIsProcessingVoice(false);
                    // V18: Don't clear typing on INSERT, wait for UPDATE with content
                    // setOtherUserTyping(false); 
                }

                // 1. Update local cache with deduplication
                queryClient.setQueryData(['messages', localActiveId], (old: any) => {
                    const base = Array.isArray(old) ? old : [];

                    // Already have this real message? (Check by ID)
                    if (base.some((m: any) => m.id === newMessage.id)) {
                        console.log(`[Chat] Message ${newMessage.id} already in cache, skipping.`);
                        return old;
                    }

                    // DEDUPLICATION: If we have an optimistic message with same content/type, REPLACE it
                    const optIndex = base.findIndex(m =>
                        (m.id?.toString().startsWith('opt-') || m.id?.toString().startsWith('temp-')) &&
                        m.content === newMessage.content &&
                        m.message_type === newMessage.message_type &&
                        m.sender_id === newMessage.sender_id
                    );

                    if (optIndex > -1) {
                        console.log(`[Chat] Dedup: Replacing optimistic message with real message ${newMessage.id}`);
                        const updated = [...base];
                        updated[optIndex] = newMessage;
                        return updated;
                    }

                    console.log(`[Chat] Appending new message ${newMessage.id} to conversation ${localActiveId}`);
                    const next = [...base, newMessage].sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );

                    return next;
                });

                // Clear AI typing state if we received an AI message
                if (newMessage.sender_id === COACH_ID) {
                    setOtherUserTyping(false);
                }

                // 2. Mark as read if not from us
                if (newMessage.sender_id !== user?.id && localActiveId) {
                    markConversationAsReadLocal(localActiveId, true); // TRUE: Force read for new message
                }

                // --- Sidebar Sync ---
                queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
            } else if (payload.eventType === 'UPDATE') {
                const updatedMessage = payload.new;

                // If AI message is updating (streaming), ensure typing is false once it has content
                if (updatedMessage.sender_id === COACH_ID && updatedMessage.content?.length > 0) {
                    setOtherUserTyping(false);
                }

                queryClient.setQueryData(['messages', localActiveId], (old: any) => {
                    if (!old) return old;
                    return old.map((m: any) => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m);
                });
            } else if (payload.eventType === 'DELETE') {
                queryClient.setQueryData(['messages', activeId], (old: any) => {
                    if (!old) return old;
                    return old.filter((m: any) => m.id !== payload.old.id);
                });
            }
        };
    }, [localActiveId, user?.id, queryClient, markConversationAsReadLocal]);

    useEffect(() => {
        if (!activeId || !user?.id) return;

        // Skip for uninitialized virtual chats until first message
        const isV = localActiveId.startsWith('new-');
        const vTargetId = isV ? localActiveId.replace('new-', '') : null;

        // STABILIZATION GUARD: Don't re-subscribe if already on this channel for this user
        const currentSubKey = `${user.id}:${localActiveId}`;
        if (activeSubscriptionIdRef.current === currentSubKey && activeChannelRef.current) {
            return;
        }
        
        activeSubscriptionIdRef.current = currentSubKey;
        const channelName = isAI ? `chat_room_${localActiveId}` : (localActiveId === user.id ? `private_chat_self_${localActiveId}` : `private_chat_${[user.id, localActiveId].sort().join('_')}`);
        
        console.log(`[Chat] V12 Subscribing to: ${channelName} for ${localActiveId}`);

        const initChannel = () => {
            if (activeChannelRef.current) {
                console.log(`[Chat] V12 Cleaning up stale channel: ${activeChannelRef.current.topic}`);
                supabase.removeChannel(activeChannelRef.current);
                activeChannelRef.current = null;
            }

            const channel = supabase.channel(channelName)
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    let isTyping = false;
                    let isOnline = false;
                    const targetId = isV ? vTargetId : otherParticipantId;

                    Object.values(state).forEach((presences: any) => {
                        presences.forEach((p: any) => {
                            if (p.user_id === targetId) {
                                isOnline = true;
                                if (p.typing && (p.conversation_id === localActiveId || isV)) {
                                    isTyping = true;
                                }
                            }
                        });
                    });

                    if (!isAI) {
                        setOtherUserTyping(prev => (prev !== isTyping ? isTyping : prev));
                    }
                    setOtherUserOnline(prev => (prev !== isOnline ? isOnline : prev));
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                    // V13: NO FILTER HERE. We filter manually in the handler to ensure 100% reliability.
                }, (payload) => {
                    const incomingConvId = payload.new ? (payload.new as any).conversation_id : (payload.old as any)?.conversation_id;
                    
                    // Only process messages for the CURRENT conversation (Case-Insensitive UUID check)
                    const isMatch = incomingConvId?.toString().toLowerCase() === localActiveId?.toString().toLowerCase();

                    if (isMatch || (isV && incomingConvId)) {
                        console.log(`[Chat] Real-time event [${payload.eventType}] matching ${localActiveId}. Incoming: ${incomingConvId}`);
                        onMessageEventRef.current?.(payload);
                    } else {
                        console.log(`[Chat] Skipping real-time event [${payload.eventType}] - No match. Target: ${localActiveId}, Received: ${incomingConvId}`);
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`[Chat] V12 channel ${channelName} SUBSCRIBED`);
                        await channel.track({
                            user_id: user.id,
                            conversation_id: localActiveId,
                            online_at: new Date().toISOString(),
                            typing: false
                        });
                    }
                });

            activeChannelRef.current = channel;
        };

        initChannel();

        const activeIdCopy = localActiveId;
        return () => {
            console.log(`[Chat] V12 Hook Cleanup for realtime:${channelName} (ID: ${activeIdCopy})`);
            if (activeChannelRef.current) {
                supabase.removeChannel(activeChannelRef.current);
                activeChannelRef.current = null;
            }
            activeSubscriptionIdRef.current = null;
        };
    }, [activeId, user?.id]); // Dependencies are correct, but ref-guard prevents churn

    // On mount or switch: clear unread
    useEffect(() => {
        if (activeId && user?.id && lastMarkedId.current !== activeId) {
            console.log(`[Chat] Effect: Checking read status for ${activeId}`);
            markConversationAsReadLocal(activeId);
            lastMarkedId.current = activeId;
        }

        // Also clear unread when the window gains focus (e.g. user comes back to the tab)
        const handleFocus = () => {
            if (activeId && user?.id) {
                console.log("[Chat] Window focused, refreshing read status");
                markConversationAsReadLocal(activeId);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
            // Reset lastMarkedId on unmount if we want it to run again on remount
            // lastMarkedId.current = null; 
        };
    }, [activeId, user?.id, markConversationAsReadLocal]);

    // --- Call Handlers (Handled by handleStartCall under Actions) ---

    // --- Message Actions ---

    // --- Message Actions ---

    const sendMutation = useMutation({
        mutationFn: async (args: { content: string, type?: string, metadata?: any }) => {
            if (!user?.id || !activeId) throw new Error("Missing context");

            if (isVirtual && virtualTargetId) {
                console.log("[Chat] V11 Provisioning new conversation for virtual ID:", activeId);
                const newId = await provisionAndSendMessage(user.id, virtualTargetId, args.content, args.type || 'text', args.metadata);
                // The navigate will happen in onSettled or handleSend to avoid race conditions with Query cache
                return { id: 'new', realId: newId };
            }

            // Inject context and location if sending to AI
            const { latestAnalysis, clearLatestAnalysis } = useCoachInjectionStore.getState();
            let userLocation = null;
            try {
                const locCache = localStorage.getItem('vicalary_location_v2');
                if (locCache) userLocation = JSON.parse(locCache).data;
            } catch(e) {}

            const messageMetadata = {
                ...args.metadata,
                latest_analysis: isAI ? latestAnalysis : null,
                user_location: isAI ? userLocation : null
            };

            // Clear analysis after injection to prevent stale context next time
            if (isAI && latestAnalysis) {
                clearLatestAnalysis();
            }

            const result = await sendMessage(user.id, localActiveId, args.content, (args.type as any) || 'text', messageMetadata, isAI, isSelf);
            return result;
        },
        onMutate: async (newMsg) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['messages', localActiveId] });

            // Snapshot the previous value
            const previousMessages = queryClient.getQueryData(['messages', localActiveId]);
            const previousConvs = queryClient.getQueryData(['conversations', user?.id]);

            // Optimistically update to the new value
            const optimisticId = `opt-${Date.now()}`;
            const optimisticMsg = {
                id: optimisticId,
                content: newMsg.content,
                sender_id: user?.id,
                conversation_id: localActiveId,
                created_at: new Date().toISOString(),
                message_type: newMsg.type || 'text',
                metadata: newMsg.metadata,
                is_optimistic: true
            };

            if (isAI) {
                queryClient.setQueryData(['messages', localActiveId], (old: any) => [...(old || []), optimisticMsg]);
            } else {
                queryClient.setQueryData(['messages', localActiveId], (old: any) => [...(old || []), optimisticMsg]);
            }

            // --- Optimistic Sidebar Sync ---
            queryClient.setQueryData(['conversations', user?.id], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((conv: any) => {
                    if (conv.id === localActiveId) {
                        return {
                            ...conv,
                            last_message_content: newMsg.content,
                            last_message_at: new Date().toISOString(),
                            last_message_sender_id: user?.id
                        };
                    }
                    return conv;
                }).sort((a: any, b: any) => {
                    const timeA = new Date(a.last_message_at || 0).getTime();
                    const timeB = new Date(b.last_message_at || 0).getTime();
                    return timeB - timeA;
                });
            });

            setMessage("");
            setShowEmoji(false);
            scrollToBottom();

            return { previousMessages, previousConvs };
        },
        onError: (err, newMsg, context: any) => {
            queryClient.setQueryData(['messages', localActiveId], context?.previousMessages);
            queryClient.setQueryData(['conversations', user?.id], context?.previousConvs);
            toast.error("Message failed to send");
        },
        onSuccess: (data: any, variables: any) => {
            if (data?.realId) {
                const id = typeof data.realId === 'object' ? (data.realId.id || data.realId.conversation_id || data.realId.r_id) : data.realId;
                
                // V16: Migrate optimistic messages and conversation metadata to the new real ID cache
                const virtualMsgs = queryClient.getQueryData(['messages', localActiveId]);
                if (virtualMsgs) {
                    queryClient.setQueryData(['messages', String(id)], virtualMsgs);
                }

                const virtualConv = queryClient.getQueryData(['conversation', localActiveId]);
                if (virtualConv) {
                    queryClient.setQueryData(['conversation', String(id)], virtualConv);
                }

                // V18: SEAMLESS TRANSITION - Update local state and navigate
                setLocalActiveId(String(id));
                const newUrl = `/chat/${String(id)}${virtualTargetId ? `?target=${virtualTargetId}` : ''}`;
                router.push(newUrl, { scroll: false });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', localActiveId] });
            queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['contacts', user?.id] });
        }
    });

    const handleSend = async () => {
        if (!message.trim() || !user || !activeId || isSubmitting) return;
        const content = message.trim();

        console.log(`[Chat] handleSend to ${activeId}`);

        // Instant simulated response indicator for AI
        if (isAI) {
            setOtherUserTyping(true);
        }
        // Attach any pending analysis context when sending to the coach
        const contextMetadata = isAI && pendingAnalysisContext
            ? { 
                scannedProductContext: pendingAnalysisContext,
                url: pendingAnalysisContext.productImage
              }
            : undefined;

        if (isAI && pendingAnalysisContext) {
            clearPendingAnalysisContext();
        }

        sendMutation.mutate({ content, metadata: contextMetadata });
    };

    // --- Context Injection: Pre-populate input from navigation state ---
    useEffect(() => {
        if (hasSentInitial || isLoadingConv) return;
        
        const initialMsg = sessionStorage.getItem('chatInitialMessage');
        let autoSendMessage = initialMsg;
        
        if (initialMsg) {
            console.log("[Chat] Auto-sending initial context message...");
            sessionStorage.removeItem('chatInitialMessage');
        } else if (pendingAnalysisContext && isAI) {
            const ctx = pendingAnalysisContext;
            autoSendMessage = `I just analyzed ${ctx.productName} (${ctx.calories} kcal). ${ctx.political_warning ? 'It has an ethical warning.' : ''} How does this look for me?`;
        }

        if (autoSendMessage) {
            setHasSentInitial(true);
            
            const contextMetadata = isAI && pendingAnalysisContext
                ? { 
                    scannedProductContext: pendingAnalysisContext,
                    url: pendingAnalysisContext.productImage
                  }
                : undefined;

            if (isAI && pendingAnalysisContext) {
                clearPendingAnalysisContext();
            }

            if (isAI) {
                setOtherUserTyping(true);
            }

            sendMutation.mutate({ content: autoSendMessage, metadata: contextMetadata });
        }
    }, [hasSentInitial, isLoadingConv, isAI, pendingAnalysisContext, sendMutation, clearPendingAnalysisContext]);

    const handleLocationShare = async () => {
        if (!navigator.geolocation) {
            toast.error('Location sharing is not supported by your browser');
            return;
        }

        const toastId = 'location-share';
        toast.loading('Getting your location...', { id: toastId });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lng } = position.coords;

                // Reverse geocode for a nice address using Nominatim (free)
                let locationName = 'Current Location';
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    const data = await res.json();
                    if (data?.display_name) {
                        // Trim to just neighborhood + city
                        locationName = data.address?.suburb || data.address?.quarter || data.address?.city || data.display_name.split(',')[0];
                    }
                } catch {
                    // Silently fall back to generic name
                }

                toast.dismiss(toastId);
                sendMutation.mutate({
                    content: locationName,
                    type: 'location',
                    metadata: { lat, lng, name: locationName }
                });
                toast.success('Location sent!');
            },
            (error) => {
                toast.dismiss(toastId);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error('Location permission denied. Please enable it in browser settings.');
                } else {
                    toast.error('Could not get your location. Please try again.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const lastTypingSentRef = useRef<number>(0);
    const handleTyping = async () => {
        if (!user || !activeId || !activeChannelRef.current) return;

        // Throttle presence updates to once every 2 seconds to avoid channel noise
        const now = Date.now();
        if (now - lastTypingSentRef.current < 2000) return;
        lastTypingSentRef.current = now;

        // EPHEMERAL PRESENCE TYPING
        await sendTypingIndicator(activeChannelRef.current, user.id, activeId, true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            if (activeChannelRef.current) {
                await sendTypingIndicator(activeChannelRef.current, user.id, activeId, false);
            }
        }, 3000);
    };

    // --- Rendering Helpers ---

    const formatMessageTime = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            // Using a stable locale for hydration consistency
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return '';
        }
    };

    const renderMessageContent = (msg: any) => {
        // Handle new JSON metadata vs old raw string metadata
        const metadata = msg.metadata;
        const mediaUrl = (typeof metadata === 'object' && metadata !== null) ? metadata.url : metadata;

        const handleLogFood = async (foodData: any) => {
            if (!user?.id) return;
            const tid = toast.loading("Adding to your daily log...");
            try {
                await saveFoodAnalysis(user.id, {
                    ...foodData,
                    image_url: mediaUrl || foodData.image_url
                });
                toast.success(`${foodData.name} logged successfully!`, { id: tid });
                queryClient.invalidateQueries({ queryKey: ['daily-progress'] });
            } catch (err) {
                console.error("Log failed:", err);
                toast.error("Failed to log food", { id: tid });
            }
        };

        switch (msg.message_type) {
            case 'image':
                return (
                    <div className="flex flex-col gap-2">
                        <img src={mediaUrl} alt="Shared" className="max-w-full rounded-lg cursor-pointer" onClick={() => window.open(mediaUrl)} />
                        {/* Check for food analysis results in metadata */}
                        {metadata?.foodAnalysis && (
                            <div className="mt-3 p-4 bg-white/5 dark:bg-black/40 rounded-3xl border border-vic-green/30 backdrop-blur-md shadow-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-black text-vic-green text-sm uppercase tracking-tight">{metadata.foodAnalysis.name}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${metadata.foodAnalysis.healthStatus === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                metadata.foodAnalysis.healthStatus === 'POOR' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>
                                                {metadata.foodAnalysis.healthStatus || 'Neutral'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase overflow-x-auto no-scrollbar">
                                            <span className="shrink-0">{metadata.foodAnalysis.calories} kcal</span>
                                            <span className="shrink-0 text-white/20">|</span>
                                            <span className="shrink-0 text-vic-blue">{metadata.foodAnalysis.protein}g P</span>
                                            <span className="shrink-0 text-amber-400">{metadata.foodAnalysis.carbs}g C</span>
                                            <span className="shrink-0 text-rose-400">{metadata.foodAnalysis.fat}g F</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleLogFood(metadata.foodAnalysis)}
                                        className="shrink-0 w-10 h-10 bg-vic-green text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-vic-green/20"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                {metadata.foodAnalysis.clinical_synopsis && (
                                    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                                        <p className="text-[11px] leading-relaxed italic text-slate-600 dark:text-slate-400 font-medium">
                                            "{metadata.foodAnalysis.clinical_synopsis}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 'call': {
                const isMissed = msg.metadata?.call_status === 'missed' || msg.metadata?.call_status === 'declined';
                const isVideo = msg.metadata?.call_type === 'video';
                const durationSecs = msg.metadata?.duration || 0;
                const formatDur = (s: number) => {
                    if (!s) return '';
                    const m = Math.floor(s / 60);
                    const sec = s % 60;
                    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
                };

                return (
                    <div className="flex items-center gap-3 py-1.5 px-3 select-none bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 my-1 max-w-xs">
                        <div className={`p-2.5 rounded-full ${isMissed ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'}`}>
                            {isVideo ? (
                                isMissed ? <VideoOff size={18} /> : <Video size={18} />
                            ) : (
                                isMissed ? <PhoneOff size={18} /> : <Phone size={18} />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {isMissed ? (isVideo ? 'Missed Video Call' : 'Missed Voice Call') : (isVideo ? 'Video Call' : 'Voice Call')}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {isMissed ? 'No answer' : (durationSecs > 0 ? formatDur(durationSecs) : 'Call completed')}
                            </span>
                        </div>
                    </div>
                );
            }
            case 'video':
                return <video src={mediaUrl} controls className="max-w-full rounded-lg" />;
            case 'voice':
                return (
                    <div className="flex flex-col gap-2">
                        <AudioMessage src={mediaUrl} />
                        {msg.metadata?.transcription && (
                            <div className="px-3 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 relative group">
                                <div className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-vic-green/10 dark:bg-vic-green/20 rounded-md border border-vic-green/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-vic-green">Whisper Intelligence</span>
                                </div>
                                <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400 italic">
                                    "{msg.metadata.transcription}"
                                </p>
                            </div>
                        )}
                    </div>
                );
            case 'location': {
                const locMeta = typeof metadata === 'object' && metadata !== null ? metadata : {};
                const lat = Number(locMeta.lat || locMeta.latitude || 0);
                const lng = Number(locMeta.lng || locMeta.longitude || 0);
                const locName = locMeta.name || msg.content || 'Shared Location';
                if (!lat || !lng) return <p className="text-[14.2px] leading-[19px]">📍 {msg.content || 'Location'}</p>;
                return <LocationMessage lat={lat} lng={lng} name={locName} />;
            }
            case 'link':
                return (
                    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline flex items-center gap-1">
                        <LinkIcon size={14} />
                        {msg.content}
                    </a>
                );
            case 'file':
                return (
                    <div className="flex items-center gap-2 p-2 bg-black/5 rounded-lg border border-black/10">
                        <FileText size={20} />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{msg.content}</p>
                            <a href={mediaUrl} target="_blank" download className="text-vic-green text-xs font-bold uppercase">Download</a>
                        </div>
                    </div>
                );
            default:
                // Handle JSON-formatted AI responses that might contain analysis
                if (isAI && msg.content?.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(msg.content);
                        if (parsed.foodAnalysis) {
                            return (
                                <div className="p-4 bg-white/5 dark:bg-black/40 rounded-3xl border border-vic-green/30 backdrop-blur-md shadow-lg my-2 max-w-[280px] overflow-hidden">
                                    {parsed.foodAnalysis.image_url && (
                                        <div className="relative h-40 -mx-4 -mt-4 mb-4 overflow-hidden">
                                            <img 
                                                src={parsed.foodAnalysis.image_url} 
                                                alt={parsed.foodAnalysis.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-vic-green text-sm uppercase tracking-tight mb-1">{parsed.foodAnalysis.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${parsed.foodAnalysis.healthStatus === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                parsed.foodAnalysis.healthStatus === 'POOR' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>
                                                {parsed.foodAnalysis.healthStatus || 'Neutral'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleLogFood(parsed.foodAnalysis)}
                                            className="w-10 h-10 bg-vic-green text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-vic-green/20"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-black uppercase mb-4">
                                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                            <div className="text-white">{parsed.foodAnalysis.calories}</div>
                                            <div className="text-slate-500 text-[6px]">KCAL</div>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                            <div className="text-vic-blue">{parsed.foodAnalysis.protein}g</div>
                                            <div className="text-slate-500 text-[6px]">PRO</div>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                            <div className="text-amber-400">{parsed.foodAnalysis.carbs}g</div>
                                            <div className="text-slate-500 text-[6px]">CARB</div>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                            <div className="text-rose-400">{parsed.foodAnalysis.fat}g</div>
                                            <div className="text-slate-500 text-[6px]">FAT</div>
                                        </div>
                                    </div>

                                    <p className="text-[11px] leading-relaxed italic text-slate-300 border-t border-white/5 pt-3">
                                        "{parsed.foodAnalysis.clinical_synopsis || parsed.reply}"
                                    </p>
                                </div>
                            );
                        }
                    } catch (e) {
                        // Not valid JSON, fall through to text
                    }
                }
                
                // If it has scanned product context, render the custom pill
                if (metadata?.scannedProductContext) {
                    const ctx = metadata.scannedProductContext;
                    return (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#1f2c34] rounded-2xl shadow-sm border border-vic-green/20 min-w-[260px] max-w-[320px]">
                                {(ctx.productImage || ctx.image) ? (
                                    <img src={ctx.productImage || ctx.image} alt="Food" className="w-12 h-12 rounded-xl object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">No Img</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-tight truncate">{ctx.productName}</h4>
                                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500">GOOD</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase">
                                        <span className="text-slate-500">{ctx.calories} KCAL</span>
                                        <span className="text-slate-300 dark:text-slate-600">|</span>
                                        <span className="text-[#34B7F1]">{ctx.protein}G P</span>
                                        <span className="text-[#F5B400]">{ctx.carbs}G C</span>
                                        <span className="text-[#F25F5C]">{ctx.fat}G F</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
                
                return <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap">{msg.content}</p>;
        }
    };

    // Grouping messages by date
    const groupedMessages = useMemo(() => {
        const groups: { [date: string]: any[] } = {};
        messages.forEach(msg => {
            const d = new Date(msg.created_at);
            const date = isNaN(d.getTime()) ? 'Unknown Date' : d.toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
        });
        return groups;
    }, [messages]);

    // V18: Move all early returns to the end to comply with React hook rules
    if (activeId && !isValidUUID(activeId) && !isVirtual) {
        return null;
    }

    if (isLoadingConv && !conversation) {
        return (
            <div className="flex flex-col h-screen bg-[#F0F2F5] dark:bg-[#111B21] items-center justify-center">
                <div className="animate-spin size-8 border-4 border-vic-green border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-[#F0F2F5] dark:bg-[#111B21] transition-colors duration-300 overflow-hidden relative">
            {/* Background Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_tyrZ_m8E.png')] dark:invert"></div>

            <div className="relative flex flex-col h-full z-10">
                {/* Header */}
                <header className="shrink-0 h-[64px] bg-[#F0F2F5] dark:bg-[#202C33] border-b border-white/5 flex items-center px-4 gap-3 z-30 shadow-sm">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-[#54656F] dark:text-[#8696A0] hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                        <ArrowLeft size={20} />
                    </button>

                    <div className="size-10 rounded-full bg-slate-200 overflow-hidden border border-black/5 dark:border-white/10 shrink-0 flex items-center justify-center">
                        {displayAvatar ? (
                            <img
                                src={displayAvatar}
                                alt={displayName}
                                className="size-full object-cover"
                                onError={(e: any) => {
                                    e.target.style.display = 'none';
                                    const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                        ) : null}

                        {/* Initials Fallback */}
                        {(!displayAvatar) && (
                            <div className="avatar-fallback size-full bg-vic-green flex items-center justify-center text-white text-sm font-bold">
                                {isSelf ? (
                                    <Bookmark size={16} />
                                ) : (
                                    (displayName || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                )}
                            </div>
                        )}

                        {/* Hidden Fallback for Image Errors */}
                        {displayAvatar && (
                            <div className="avatar-fallback hidden size-full bg-vic-green flex items-center justify-center text-white text-sm font-bold">
                                {isSelf ? (
                                    <Bookmark size={16} />
                                ) : (
                                    (displayName || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => {
                        if (!isSelf && !isAI) {
                            const chatUser = Array.isArray(otherParticipant?.chat_users) ? otherParticipant.chat_users[0] : otherParticipant?.chat_users;
                            if (chatUser?.phone_number) router.push(`/expert/${String(chatUser.phone_number)}`);
                        }
                    }}>
                        <h2 className="text-[16px] font-semibold text-[#111B21] dark:text-[#e9edef] truncate flex items-center gap-1.5">
                            {displayName}
                            {isAI && <span className="text-[9px] font-bold bg-vic-green/20 text-vic-green px-1.5 py-0.5 rounded-full">AI</span>}
                        </h2>
                        <div className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate relative h-5 flex items-center">
                            {isProcessingVoice ? (
                                <span className="text-vic-green font-medium animate-pulse">Transcribing...</span>
                            ) : otherUserTyping ? (
                                <span className="text-vic-green font-medium animate-pulse">typing...</span>
                            ) : otherUserOnline ? (
                                <span className="text-vic-green font-medium">Online</span>
                            ) : isAI ? (
                                <span>AI Coach</span>
                            ) : isSelf ? (
                                <span>Personal Workspace</span>
                            ) : (
                                <div className="relative w-full h-full flex items-center">
                                    <span className={`absolute left-0 transition-opacity duration-[2000ms] ease-in-out whitespace-nowrap ${showLastSeen && displayStatus !== 'Offline' ? 'opacity-100' : 'opacity-0'}`}>
                                        {displayStatus}
                                    </span>
                                    <span className={`absolute left-0 transition-opacity duration-[2000ms] ease-in-out whitespace-nowrap ${!showLastSeen || displayStatus === 'Offline' ? 'opacity-100' : 'opacity-0'}`}>
                                        Offline
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {!isSelf && !isAI && (
                            <>
                                <button onClick={() => handleStartCall('video')} className="p-2 text-[#54656F] dark:text-[#8696A0] hover:bg-black/5 rounded-full">
                                    <Video size={24} />
                                </button>
                                <button onClick={() => handleStartCall('voice')} className="p-2 text-[#54656F] dark:text-[#8696A0] hover:bg-black/5 rounded-full">
                                    <Phone size={24} />
                                </button>
                            </>
                        )}
                        <div className="relative">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-[#54656F] dark:text-[#8696A0] hover:bg-black/5 rounded-full">
                                <MoreVertical size={24} />
                            </button>
                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#233138] rounded-xl shadow-2xl border border-slate-100 dark:border-white/5 z-50 py-2 animate-in fade-in zoom-in duration-100">
                                        {!isSelf && !isAI && (
                                            <>
                                                <button onClick={async () => {
                                                    setIsMenuOpen(false);
                                                    try {
                                                        await archiveConversation(user!.id, activeId!, true);
                                                        toast.success("Chat archived");
                                                        router.push('/chat');
                                                    } catch { toast.error("Failed to archive chat"); }
                                                }} className="w-full flex items-center gap-3 px-4 py-3 text-sm dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <Bookmark size={16} /> Archive Chat
                                                </button>
                                                <button onClick={async () => {
                                                    setIsMenuOpen(false);
                                                    try {
                                                        await muteConversation(user!.id, activeId!, true);
                                                        toast.success("Notifications muted");
                                                    } catch { toast.error("Failed to mute notifications"); }
                                                }} className="w-full flex items-center gap-3 px-4 py-3 text-sm dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <Mic size={16} /> Mute Notifications
                                                </button>
                                            </>
                                        )}
                                        <button onClick={async () => {
                                            setIsMenuOpen(false);
                                            if (window.confirm("Clear all messages in this chat?")) {
                                                try {
                                                    await clearChatHistory(user!.id, activeId!);
                                                    queryClient.invalidateQueries({ queryKey: ['messages', activeId] });
                                                    toast.success("Chat history cleared");
                                                } catch { toast.error("Failed to clear history"); }
                                            }
                                        }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                            <Trash2 size={16} /> Clear History
                                        </button>
                                        {!isSelf && !isAI && (
                                            <button onClick={async () => {
                                                setIsMenuOpen(false);
                                                if (window.confirm("Delete this conversation completely?")) {
                                                    try {
                                                        await softDeleteConversation(activeId!, user!.id);
                                                        toast.success("Conversation deleted");
                                                        router.push('/chat');
                                                    } catch { toast.error("Failed to delete conversation"); }
                                                }
                                            }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                                <X size={16} /> Delete Chat
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Messages Area */}
                <main
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth no-scrollbar overscroll-none"
                    onScroll={handleScroll}
                >
                    {Object.keys(groupedMessages).length > 0 ? (
                        Object.entries(groupedMessages).map(([date, dateMsgs]) => (
                            <div key={date} className="flex flex-col gap-2">
                                <div className="flex justify-center my-4">
                                    <span className="bg-white dark:bg-[#1f2c34] px-3 py-1.5 rounded-lg text-[12.5px] uppercase tracking-wide text-[#667781] dark:text-[#8696A0] shadow-sm font-medium">
                                        {date === new Date().toLocaleDateString() ? 'Today' : date}
                                    </span>
                                </div>

                                {dateMsgs.map((msg) => {
                                    const isMe = msg.sender_id === user?.id;
                                    
                                    // Hide empty placeholder messages from AI
                                    if (!isMe && !msg.content && msg.message_type === 'text') {
                                        return null;
                                    }
                                    
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1 group`}
                                        >
                                            <div
                                                className={`relative max-w-[85%] md:max-w-[65%] min-w-[100px] px-3 py-2 rounded-xl shadow-sm ${isMe
                                                    ? 'bg-[#D9FDD3] dark:bg-[#005c4b] rounded-tr-none'
                                                    : 'bg-white dark:bg-[#202c33] rounded-tl-none'
                                                    }`}
                                            >
                                                {/* Content - Wrapper to ensure spacing for timestamp */}
                                                <div className="flex flex-col">
                                                    <div className="pb-1 pr-2 break-words">
                                                        {renderMessageContent(msg)}
                                                    </div>

                                                    {/* Timestamp & Status - Right aligned within flex container */}
                                                    <div className="flex items-center justify-end gap-0.5 mt-0.5 select-none self-end">
                                                        <span className="text-[10px] text-[#667781] dark:text-white/50">
                                                            {formatMessageTime(msg.created_at)}
                                                        </span>
                                                        {isMe && (
                                                            <CheckCheck className={`-ml-0.5 ${msg.read_at ? 'text-[#34B7F1]' : 'text-[#8696A0]'}`} size={15} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-start h-full pt-8 px-8 gap-4 text-center">
                            <div className="flex flex-col items-center gap-2 max-w-[450px]">
                                <div className="p-2 bg-white/70 dark:bg-[#1f2c34]/70 backdrop-blur-md rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                    <Lock className="text-slate-500" size={14} />
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        End-to-end encrypted
                                    </p>
                                </div>
                                <p className="text-[13px] text-[#667781] dark:text-[#8696A0] leading-relaxed">
                                    {t('messages_are_end_to_end_encrypted') || "Messages and calls are end-to-end encrypted. No one outside of this chat, not even Vic, can read or listen to them. Learn more."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Typing Indicator Overlay (Outside the date groups but inside main) */}
                    { (otherUserTyping || isProcessingVoice) && (
                        <div className="flex w-full justify-start mt-1 px-3 py-1">
                            <div className="bg-white dark:bg-[#202c33] p-2 rounded-xl shadow-sm flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-vic-green">
                                    {isProcessingVoice ? <Brain className="w-4 h-4 animate-pulse" /> : <Brain className="w-4 h-4 animate-pulse" />}
                                </div>
                                <div className="flex gap-1">
                                    <div className="size-1 bg-vic-green rounded-full animate-bounce"></div>
                                    <div className="size-1 bg-vic-green rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="size-1 bg-vic-green rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </main>

                {/* Input Footer */}
                <footer className="px-3 md:px-4 py-2 bg-[#F0F2F5] dark:bg-[#202c33] flex items-end gap-2 relative z-40 pb-safe shrink-0">
                    <div className="flex-1 flex items-end gap-2 w-full max-w-[1200px] mx-auto min-w-0">
                        {(!conversation && !isVirtual) ? (
                            <div className="w-full flex items-center justify-center p-4 text-slate-500 text-sm">
                                <div className="animate-spin size-5 border-2 border-vic-green border-t-transparent rounded-full"></div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-end gap-1 md:gap-2 bg-white dark:bg-[#202C33] rounded-[24px] shadow-sm py-[8px] px-2 relative border border-black/5 dark:border-white/5 min-w-0">
                                {/* Emoji Button */}
                                <button
                                    onClick={() => setShowEmoji(!showEmoji)}
                                    className={`p-2 text-[#54656F] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#D1D7DB] transition-colors rounded-full hover:bg-black/5 ${showEmoji ? 'text-[#00A884]' : ''}`}
                                >
                                    <Smile size={26} />
                                </button>

                                {/* Pin (Attachment) Button */}
                                <button
                                    onClick={() => setShowAttachments(!showAttachments)}
                                    className={`p-2 text-[#54656F] dark:text-[#8696A0] hover:text-[#111B21] transition-colors rounded-full hover:bg-black/5 ${showAttachments ? 'text-[#00A884] bg-black/5' : ''}`}
                                >
                                    <Paperclip className="rotate-45" size={26} />
                                </button>

                                {/* STT button */}
                                <button
                                    onClick={startDictation}
                                    className={`p-2 transition-colors rounded-full hover:bg-black/5 ${isDictating ? 'text-red-500 animate-pulse bg-red-50' : 'text-[#54656F] dark:text-[#8696A0] hover:text-[#111B21]'}`}
                                    title="Dictate"
                                >
                                    <Mic size={26} />
                                </button>

                                {/* Live AI Voice Conversation Mode (ChatGPT / Gemini style) */}
                                {isAI && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAiVoiceModal(true)}
                                        className="p-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30 hover:scale-110 active:scale-95 transition-all flex items-center justify-center shrink-0 border border-emerald-400/40 animate-pulse"
                                        title="Start ChatGPT/Gemini Live Voice Conversation"
                                    >
                                        <Sparkles size={20} />
                                    </button>
                                )}

                                {/* Text Input */}
                                <textarea
                                    ref={inputRef}
                                    placeholder="Message"
                                    rows={1}
                                    value={message}
                                    onChange={(e) => {
                                        setMessage(e.target.value);
                                        handleTyping();
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    className="flex-1 bg-transparent border-none py-2 px-2 text-[15px] leading-[22px] focus:ring-0 text-[#111B21] dark:text-[#D1D7DB] placeholder-[#667781] resize-none max-h-[120px] min-h-[40px]"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2 relative">
                            {/* Recording Preview Overlay */}
                            {recordingStatus === 'preview' && recordedAudio && (
                                <div className="absolute bottom-[60px] right-0 left-[-300px] md:left-[-400px] bg-white dark:bg-[#202c33] p-3 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 flex items-center gap-4 animate-in slide-in-from-bottom-2">
                                    <button
                                        onClick={discardRecording}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Discard"
                                    >
                                        <Trash2 size={24} />
                                    </button>

                                    <div className="flex-1">
                                        <AudioMessage src={recordedAudio.url} />
                                    </div>

                                    <button
                                        onClick={confirmVoiceSend}
                                        className="size-[44px] bg-vic-green text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                                        title="Send Voice Message"
                                    >
                                        <Send size={22} />
                                    </button>
                                </div>
                            )}

                            <button
                                onMouseDown={(e) => {
                                    if (!message.trim() && recordingStatus === 'idle') {
                                        startRecording(e);
                                    }
                                }}
                                onTouchStart={(e) => {
                                    if (!message.trim() && recordingStatus === 'idle') {
                                        startRecording(e);
                                    }
                                }}
                                onClick={(e) => {
                                    if (message.trim()) {
                                        handleSend();
                                    } else if (recordingStatus === 'recording' && isRecordingLocked) {
                                        stopRecording(false, true);
                                    }
                                }}
                                onMouseUp={() => {
                                    if (recordingStatus === 'recording' && !isRecordingLocked) {
                                        if (recordingDuration < 1) {
                                            stopRecording(true);
                                            toast("Hold to record, release to send", { duration: 2000 });
                                        } else {
                                            stopRecording(false, true); // send immediately
                                        }
                                    }
                                }}
                                onTouchEnd={() => {
                                    if (recordingStatus === 'recording' && !isRecordingLocked) {
                                        if (recordingDuration < 1) {
                                            stopRecording(true);
                                            toast("Hold to record, release to send", { duration: 2000 });
                                        } else {
                                            stopRecording(false, true); // send immediately
                                        }
                                    }
                                }}
                                className={`size-[50px] shrink-0 rounded-full flex items-center justify-center transition-all duration-300 relative z-20 shadow-lg ${isRecording
                                        ? 'bg-rose-500 scale-125 shadow-rose-500/50'
                                        : message.trim()
                                            ? 'bg-vic-green text-white'
                                            : recordingStatus === 'preview'
                                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                                : 'bg-white dark:bg-[#202C33] text-[#54656F] dark:text-[#8696A0]'
                                    }`}
                                style={{
                                    transform: recordingStatus === 'recording' && !isRecordingLocked ? `translateY(${-Math.min(recordingDragY, 60)}px)` : 'none',
                                }}
                            >
                                {isRecording ? (
                                    <div className="size-4 bg-white rounded-[2px] animate-pulse" />
                                ) : message.trim() ? (
                                    <Send size={24} />
                                ) : (
                                    <Mic size={26} />
                                )}

                                {/* Pulse Effect for Recording */}
                                {isRecording && (
                                    <>
                                        <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-20" />
                                        <div className="absolute -inset-4 bg-rose-500/10 rounded-full animate-pulse" />
                                    </>
                                )}
                            </button>

                            {/* Drag to Cancel Indicator */}
                            {isRecording && !isRecordingLocked && (
                                <div className="absolute right-[60px] flex items-center gap-4 pointer-events-none">
                                    <div className="flex items-center gap-2">
                                        {/* Timer */}
                                        <span className="text-red-500 font-mono font-bold text-lg min-w-[50px]">
                                            {formatDuration(recordingDuration)}
                                        </span>
                                        <canvas ref={canvasRef} width={80} height={30} className="opacity-80" />
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500 font-medium animate-pulse whitespace-nowrap">
                                        <ChevronLeft size={20} />
                                        Slide to cancel
                                    </div>
                                </div>
                            )}

                            {/* Lock Indicator (Floating) */}
                            {isRecording && !isRecordingLocked && (
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-80 animate-bounce pointer-events-none bg-black/60 text-white rounded-full px-2 py-1"
                                    style={{
                                        top: `${-100 - Math.max(recordingDragY, 0)}px`,
                                        opacity: Math.max(0.4, 1 - (recordingDragY / 120))
                                    }}
                                >
                                    <Lock size={18} />
                                </div>
                            )}

                            {isRecordingLocked && (
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-[#00A884] p-1.5 rounded-full shadow-lg animate-pulse z-10">
                                    <Lock className="text-white" size={16} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Emoji/GIF/Sticker Picker Popover */}
                    {showEmoji && (
                        <div className="absolute bottom-[70px] left-0 md:left-auto md:w-[400px] z-40 bg-white dark:bg-[#1f2c34] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 dark:border-slate-700">
                                <button
                                    onClick={() => setActiveMediaTab('emoji')}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeMediaTab === 'emoji' ? 'text-vic-green border-b-2 border-vic-green' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    Emoji
                                </button>
                                <button
                                    onClick={() => setActiveMediaTab('gif')}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeMediaTab === 'gif' ? 'text-vic-green border-b-2 border-vic-green' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    GIF
                                </button>
                                <button
                                    onClick={() => setActiveMediaTab('sticker')}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeMediaTab === 'sticker' ? 'text-vic-green border-b-2 border-vic-green' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    Sticker
                                </button>
                            </div>
                            <div className="h-[350px] overflow-y-auto custom-scrollbar bg-[#F0F2F5] dark:bg-[#111B21]">
                                {activeMediaTab === 'emoji' && (
                                    <EmojiPicker
                                        width="100%"
                                        height={350}
                                        onEmojiClick={onEmojiClick}
                                        theme={Theme.AUTO}
                                        emojiStyle={EmojiStyle.NATIVE}
                                        previewConfig={{ showPreview: false }}
                                        searchDisabled={false}
                                    />
                                )}
                                {activeMediaTab === 'gif' && (
                                    <div className="p-2 grid grid-cols-2 gap-2">
                                        {/* Mock GIFs from Giphy/Tenor */}
                                        {[
                                            'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', // Hello
                                            'https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif', // Thumbs up
                                            'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', // OK
                                            'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', // Laugh
                                            'https://media.giphy.com/media/3o6ozh46EBuEFtl0ig/giphy.gif', // Mind blown
                                            'https://media.giphy.com/media/l41YtZOb9EUABnuqA/giphy.gif'  // Yes
                                        ].map((gifUrl, idx) => (
                                            <div key={idx} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {
                                                sendMutation.mutate({ content: "GIF", type: 'image', metadata: gifUrl });
                                                setShowEmoji(false);
                                            }}>
                                                <img src={gifUrl} alt="GIF" className="w-full h-24 object-cover rounded-lg" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeMediaTab === 'sticker' && (
                                    <div className="p-3 grid grid-cols-4 gap-3">
                                        {/* Mock Stickers (transparent emojis/icons) */}
                                        {[
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433048.png', // Heart
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433100.png', // Fire
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433066.png', // LOL
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433054.png', // Party
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433095.png', // Sad
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433050.png', // Angry
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433085.png', // Cool
                                            'https://cdn-icons-png.flaticon.com/512/10433/10433076.png'  // Thinking
                                        ].map((stickerUrl, idx) => (
                                            <div key={idx} className="cursor-pointer hover:scale-110 active:scale-95 transition-transform" onClick={() => {
                                                sendMutation.mutate({ content: "Sticker", type: 'image', metadata: stickerUrl });
                                                setShowEmoji(false);
                                            }}>
                                                <img src={stickerUrl} alt="Sticker" className="w-full h-16 object-contain drop-shadow-md" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attachment Menu (Pin) */}
                    {showAttachments && (
                        <div className="absolute bottom-[70px] left-2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
                            <div className="flex flex-col gap-2">
                                {/* Document */}
                                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.pdf,.doc,.docx,.txt,.xlsx,.ppt,.pptx';
                                    input.onchange = async (e: any) => {
                                        const file = e.target?.files?.[0];
                                        if (file) {
                                            toast.loading('Uploading document...', { id: 'doc-upload' });
                                            try {
                                                const url = await uploadChatMedia(user!.id, file);
                                                sendMutation.mutate({ content: file.name, type: 'file', metadata: url });
                                                toast.success('Document sent!', { id: 'doc-upload' });
                                                setShowAttachments(false);
                                            } catch (err) {
                                                toast.error('Failed to upload document', { id: 'doc-upload' });
                                            }
                                        }
                                    };
                                    input.click();
                                }}>
                                    <div className="size-12 rounded-full bg-gradient-to-t from-[#5F66CD] to-[#7F66FF] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <FileText className="text-white" size={22} />
                                    </div>
                                    <span className="bg-white dark:bg-[#202C33] px-2 py-1 rounded-md text-sm font-medium shadow-md">Document</span>
                                </div>

                                {/* Location */}
                                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => {
                                    handleLocationShare();
                                    setShowAttachments(false);
                                }}>
                                    <div className="size-12 rounded-full bg-gradient-to-t from-[#1F9F5F] to-[#25D366] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <MapPin className="text-white" size={22} />
                                    </div>
                                    <span className="bg-white dark:bg-[#202C33] px-2 py-1 rounded-md text-sm font-medium shadow-md">Location</span>
                                </div>

                                {/* Gallery */}
                                <label className="flex items-center gap-3 group cursor-pointer">
                                    <div className="size-12 rounded-full bg-gradient-to-t from-[#AC44CF] to-[#BF59CF] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <Image className="text-white" size={22} />
                                    </div>
                                    <span className="bg-white dark:bg-[#202C33] px-2 py-1 rounded-md text-sm font-medium shadow-md">Gallery</span>
                                    <input type="file" className="hidden" onChange={(e) => {
                                        handleFileUpload(e);
                                        setShowAttachments(false);
                                    }} accept="image/*,video/*" />
                                </label>

                                {/* Audio */}
                                <label className="flex items-center gap-3 group cursor-pointer">
                                    <div className="size-12 rounded-full bg-gradient-to-t from-[#F05522] to-[#F57143] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <Headphones className="text-white" size={22} />
                                    </div>
                                    <span className="bg-white dark:bg-[#202C33] px-2 py-1 rounded-md text-sm font-medium shadow-md">Audio</span>
                                    <input type="file" className="hidden" accept="audio/*" onChange={async (e) => {
                                        const file = e.target?.files?.[0];
                                        if (file) {
                                            toast.loading('Uploading audio...', { id: 'audio-upload' });
                                            try {
                                                const url = await uploadChatMedia(user!.id, file);
                                                sendMutation.mutate({ content: file.name, type: 'voice', metadata: url });
                                                toast.success('Audio sent!', { id: 'audio-upload' });
                                                setShowAttachments(false);
                                            } catch (err) {
                                                toast.error('Failed to upload audio', { id: 'audio-upload' });
                                            }
                                        }
                                    }} />
                                </label>

                                {/* Contact */}
                                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => {
                                    const contactPhone = window.prompt("Enter contact phone number to share:");
                                    if (contactPhone && contactPhone.trim()) {
                                        sendMutation.mutate({ content: `👤 Contact: ${contactPhone}`, type: 'text', metadata: `tel:${contactPhone}` });
                                        toast.success("Contact shared!");
                                        setShowAttachments(false);
                                    }
                                }}>
                                    <div className="size-12 rounded-full bg-gradient-to-t from-[#009DE2] to-[#00B2FF] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <User className="text-white" size={22} />
                                    </div>
                                    <span className="bg-white dark:bg-[#202C33] px-2 py-1 rounded-md text-sm font-medium shadow-md">Contact</span>
                                </div>

                                {/* Row 3 - Poll & Event (Optional/Future) */}
                                <div className="flex gap-6 justify-center">
                                    <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => {
                                        const pollQuestion = window.prompt("Enter your poll question:");
                                        if (pollQuestion && pollQuestion.trim()) {
                                            sendMutation.mutate({ content: `📊 Poll: ${pollQuestion}\n\n1️⃣ Option 1\n2️⃣ Option 2`, type: 'text' });
                                            toast.success("Poll sent!");
                                            setShowAttachments(false);
                                        }
                                    }}>
                                        <div className="size-[52px] rounded-full bg-gradient-to-t from-[#009688] to-[#1DE9B6] flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                                            <BarChart className="text-white" size={24} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </footer>

                {/* Camera Capture Modal */}
                {showCamera && (
                    <CameraCapture
                        onCapture={async (file) => {
                            try {
                                const url = await uploadChatMedia(user!.id, file);
                                sendMutation.mutate({ content: "Photo", type: 'image', metadata: url });
                                toast.success('Photo sent!');
                            } catch (error) {
                                toast.error('Failed to send photo');
                            }
                        }}
                        onClose={() => setShowCamera(false)}
                    />
                )}
                {/* AI Health Coach Live Voice Conversation Modal (ChatGPT / Gemini style) */}
                {showAiVoiceModal && user && (
                    <AICoachVoiceModal
                        userId={user.id}
                        userName={profile?.full_name || 'User'}
                        userAvatar={profile?.avatar_url}
                        conversationId={localActiveId}
                        onClose={() => setShowAiVoiceModal(false)}
                    />
                )}
            </div>
        </div>
    );
}
