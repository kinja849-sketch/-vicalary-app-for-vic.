"use client"
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    AlertCircle, ArrowLeft, Mic, Play, Pause, 
    ChevronRight, ChevronLeft, Timer, Flame, Droplets, 
    Wheat, Beef, Share2, Loader2, Ear, Camera, CheckCircle2, RefreshCw, X, SwitchCamera, Volume2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getRecipeDetails } from "@/lib/api/recipes";
import { useTranslation } from "@/lib/api/translation";
import { toast } from "sonner";
import { FavoriteButton } from "@/components/FavoriteButton";
import { MealImage } from "@/components/MealImage";
import ChefAvatar from "@/components/guide/ChefAvatar";
import { getFoodImageUrl } from "@/lib/services/FoodImageService";
import {
    SequentialSpeechPlayer,
    SpeechListener,
    TurnSession,
    backoffMs,
    getSpeechRecognitionCtor,
    isLikelyTranscriptStub,
    splitIntoSpeechChunks,
    type SpeechEndResult,
} from "@/lib/voice/VoiceTurnController";

export default function RecipeDetails() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t, lang } = useTranslation();

    // Guided AI Session State
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isOrchestrating, setIsOrchestrating] = useState(false);
    
    const [sessionData, setSessionData] = useState<any>(null); 
    const sessionDataRef = useRef<any>(null);
    useEffect(() => { sessionDataRef.current = sessionData; }, [sessionData]);

    const [currentStepIdx, setCurrentStepIdx] = useState(-1); 
    const currentStepIdxRef = useRef<number>(-1);
    useEffect(() => { currentStepIdxRef.current = currentStepIdx; }, [currentStepIdx]);
    
    // Typewriter State
    const [fullText, setFullText] = useState("");
    const [typedText, setTypedText] = useState("");
    const typewriterRef = useRef<NodeJS.Timeout | null>(null);

    // Two-Way Interactive Dialogue Flow
    interface CookingChatMessage {
        id: string;
        sender: 'chef' | 'user';
        text: string;
        photo?: string;
        timestamp: number;
    }
    const [chatMessages, setChatMessages] = useState<CookingChatMessage[]>([]);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    // Chat / Voice State
    const [userSpeech, setUserSpeech] = useState("");
    const [isChefThinking, setIsChefThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Auto-scroll chat to latest message smoothly
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [chatMessages, userSpeech, isChefThinking, typedText]);

    // Step Photo Authentication State & Native Device Camera Viewpoint
    const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
    const [stepVerificationPhoto, setStepVerificationPhoto] = useState<string | null>(null);
    const [stepVerificationStatus, setStepVerificationStatus] = useState<'idle' | 'success' | 'retry'>('idle');
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const recognitionRef = useRef<any>(null);

    // Media State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [stepImages, setStepImages] = useState<Record<number, string>>({});
    const [isImageLoading, setIsImageLoading] = useState(false);

    // Timer State
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // --- WHISPER / MEDIA RECORDER VAD STATE ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const vadFrameRef = useRef<number>(0);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const isRecordingRef = useRef<boolean>(false);

    // --- SHARED VOICE ENGINE REFS ---
    const turnRef = useRef(new TurnSession());
    const playerRef = useRef<SequentialSpeechPlayer | null>(null);
    const listenerRef = useRef<SpeechListener | null>(null);
    const processingRef = useRef<boolean>(false);          // single-flight lock (STT -> chat -> TTS)
    const sttFailuresRef = useRef<number>(0);
    const vadPausedUntilRef = useRef<number>(0);
    const ttsCooldownUntilRef = useRef<number>(0);
    const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const historyRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);
    const spokenTextRef = useRef<string>('');
    const submitVoiceQueryRef = useRef<(q: string, lockHeld?: boolean) => Promise<void>>(async () => {});

    // Cleanup on unmount: abort fetches, stop audio, cancel timers, release mic - every time.
    useEffect(() => {
        return () => {
            if (typewriterRef.current) clearInterval(typewriterRef.current);
            stopCamera();
            stopAllVoice();
        };
    }, []);

    // Fetch recipe details
    const { data: recipe, isLoading, isError, error, refetch } = useQuery<any>({
        queryKey: ['recipe', id],
        queryFn: () => getRecipeDetails(id!),
        enabled: !!id,
        retry: 1
    });

    useEffect(() => {
        if (recipe && !isVoiceMode) {
            setTimeLeft((recipe.prep_time_minutes || 10) * 60);
        }
    }, [recipe, isVoiceMode]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const toggleTimer = () => {
        if (isTimerRunning) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
        } else {
            setIsTimerRunning(true);
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        setIsTimerRunning(false);
                        toast.success("Timer finished!");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    // --- NATIVE CAMERA ENGINE (MATCHING Camera.tsx) ---
    const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
        try {
            if (cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach(track => {
                    try { track.stop(); } catch (e) {}
                });
                cameraStreamRef.current = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            cameraStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try {
                    await videoRef.current.play();
                } catch (playErr) {
                    console.warn("Camera auto-play warning:", playErr);
                }
            }
        } catch (err) {
            console.warn("Native camera stream unavailable:", err);
        }
    };

    const stopCamera = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch (e) {}
            });
            cameraStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const switchCamera = async () => {
        const nextFacing: 'environment' | 'user' = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(nextFacing);
        await startCamera(nextFacing);
    };

    const takeLiveViewPhoto = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.85);

        // Freeze snapshot into preview frame
        setStepVerificationPhoto(base64Data);

        // Submit to Vision AI verification
        await verifyStepWithPhoto(base64Data);
    };

    // --- VOICE DIALOGUE ENGINE (shared module: lib/voice/VoiceTurnController) ---
    // Web Speech path: SpeechListener (tight 500ms commit, echo-safe barge-in, no stale handlers, bounded restarts).
    // Fallback path (no Web Speech): MediaRecorder VAD -> Whisper, single-flight with failure backoff.
    const startListening = () => {
        if (!isVoiceModeRef.current) return;

        if (getSpeechRecognitionCtor()) {
            // Fresh listener every time: stale handlers can never fire, and speaker echo captured while the
            // chef was talking can never be committed as a user turn.
            if (listenerRef.current) {
                try { listenerRef.current.stop(); } catch (e) {}
            }
            const listener = new SpeechListener({
                lang: lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-US',
                onInterim: (text) => setUserSpeech(text),
                onActive: (active) => setIsListening(active),
                isAssistantSpeaking: () => !!playerRef.current?.isActive && isSpeakingRef.current,
                getSpokenText: () => spokenTextRef.current || playerRef.current?.queuedText || '',
                // Hard barge-in: stop audio + progressive text + in-flight chat/TTS, then the new words are the only request.
                onBarge: () => bargeIn(),
                onCommit: (text) => {
                    setIsListening(false);
                    void submitVoiceQueryRef.current(text);
                },
                onFatal: (code) => {
                    setIsListening(false);
                    if (code === 'not-allowed' || code === 'service-not-allowed') {
                        toast.error("Please allow microphone access to talk to the Chef.");
                    } else {
                        toast.error("Voice listening stopped. Tap the mic to talk again.");
                    }
                }
            });
            listenerRef.current = listener;
            if (listener.start()) return;
            listenerRef.current = null;
        }

        // Fallback to MediaStream VAD loop
        startMediaStreamVAD();
    };

    const startMediaStreamVAD = async () => {
        // Already initialised: just make sure the single VAD loop is running (never stack streams/contexts).
        if (audioStreamRef.current && mediaRecorderRef.current && analyserRef.current) {
            startVADLoop();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            if (!isVoiceModeRef.current) {
                stream.getTracks().forEach(track => { try { track.stop(); } catch {} });
                return;
            }
            audioStreamRef.current = stream;
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceNodeRef.current = source;

            let selectedMime = 'audio/webm';
            if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    selectedMime = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                    selectedMime = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    selectedMime = 'audio/mp4';
                }
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMime });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                setIsListening(false);
                isRecordingRef.current = false;
                const audioBlob = new Blob(chunksRef.current, { type: selectedMime });
                chunksRef.current = [];

                // Leaving voice mode / mic released: never transcribe after exit.
                if (!isVoiceModeRef.current) return;

                if (audioBlob.size > 1200) { 
                    await transcribeAudio(audioBlob);
                } else {
                    startVADLoop();
                }
            };

            // Any recorder error stops the VAD completely (no spinning).
            mediaRecorder.onerror = () => {
                console.warn("MediaRecorder error: stopping voice capture.");
                stopListening();
            };

            setIsListening(true);
            startVADLoop();
        } catch (err) {
            console.error("Microphone access error:", err);
            toast.error("Please allow microphone access to talk to the Chef.");
        }
    };

    const startVADLoop = () => {
        if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
        let loudSince = 0;

        const checkVolume = () => {
            // Mic released / voice mode ended: stop the loop entirely (no rAF spam).
            if (!isVoiceModeRef.current || !analyserRef.current || !dataArrayRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
                sum += dataArrayRef.current[i];
            }
            const average = sum / dataArrayRef.current.length;
            const speaking = isSpeakingRef.current;
            const THRESHOLD = speaking ? 45 : 18;
            const now = performance.now();

            // Hard barge-in on sustained loud speech while the chef is talking.
            if (speaking) {
                if (average > 55) {
                    if (!loudSince) loudSince = now;
                    if (now - loudSince > 180) {
                        loudSince = 0;
                        bargeIn();
                    }
                } else {
                    loudSince = 0;
                }
            } else {
                loudSince = 0;
            }

            // Ignore triggers while a turn is processing/speaking, or during failure backoff.
            const canRecord = !isSpeakingRef.current && !processingRef.current && Date.now() >= vadPausedUntilRef.current;

            if (canRecord && average > THRESHOLD) {
                if (!isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                    isRecordingRef.current = true;
                    chunksRef.current = [];
                    try {
                        mediaRecorderRef.current.start();
                        setIsListening(true);
                    } catch (recErr) {
                        isRecordingRef.current = false;
                        console.warn("MediaRecorder start failed: stopping voice capture.", recErr);
                        stopListening();
                        return;
                    }
                }

                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                
                // Natural end-of-utterance window (was 600ms)
                silenceTimeoutRef.current = setTimeout(() => {
                    if (isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        isRecordingRef.current = false;
                        try {
                            mediaRecorderRef.current.stop();
                        } catch (stopErr) {}
                        setIsListening(false);
                    }
                }, 1200);
            }

            vadFrameRef.current = requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
    };

    const stopListening = () => {
        if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
        if (listenerRef.current) {
            try { listenerRef.current.stop(); } catch (e) {}
            listenerRef.current = null;
        }
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) {}
            recognitionRef.current = null;
        }
        if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { mediaRecorderRef.current.stop(); } catch (err) {}
        }
        mediaRecorderRef.current = null;
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch {}
            });
            audioStreamRef.current = null;
        }
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => {});
            }
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        
        setIsListening(false);
        isRecordingRef.current = false;
    };

    /** Stop everything voice-related: active turn (fetches), speech audio, mic. Safe to call repeatedly. */
    const stopAllVoice = () => {
        turnRef.current.cancel();
        const p = playerRef.current;
        playerRef.current = null;
        if (p) p.stop();
        audioRef.current = null;
        processingRef.current = false;
        stopListening();
    };

    const isSpeakingRef = useRef(isSpeaking);
    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    const isChefThinkingRef = useRef(isChefThinking);
    useEffect(() => {
        isChefThinkingRef.current = isChefThinking;
    }, [isChefThinking]);

    const isVoiceModeRef = useRef(isVoiceMode);
    useEffect(() => {
        isVoiceModeRef.current = isVoiceMode;
        if (isVoiceMode) {
            historyRef.current = [];
            sttFailuresRef.current = 0;
            startCamera('environment');
            startListening();
        } else {
            stopCamera();
            stopAllVoice();
        }
    }, [isVoiceMode]);

    // Transcribe audio using Whisper API (fallback path when Web Speech is unavailable).
    // Single-flight: one utterance => one transcription => one reply.
    const transcribeAudio = async (blob: Blob) => {
        if (processingRef.current) return; // duplicate VAD trigger while a turn is in flight
        processingRef.current = true;
        setUserSpeech("...");

        const releaseAndRearm = (failed: boolean) => {
            processingRef.current = false;
            setUserSpeech("");
            if (failed) {
                sttFailuresRef.current += 1;
                if (sttFailuresRef.current >= 3) {
                    // Do not keep the mic spinning against a failing STT service.
                    toast.error("Voice recognition is unavailable right now. Please try again in a moment.");
                    stopListening();
                    sttFailuresRef.current = 0;
                    return;
                }
                vadPausedUntilRef.current = Date.now() + backoffMs(sttFailuresRef.current, 600, 4000);
            } else {
                sttFailuresRef.current = 0;
            }
            if (isVoiceModeRef.current) startVADLoop();
        };

        try {
            const formData = new FormData();
            formData.append('file', blob);

            const res = await fetch('/api/cooking-assistant/transcribe', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                releaseAndRearm(true);
                return;
            }
            const data = await res.json();
            const whisperText = (data?.text || '').trim();

            if (!whisperText || isLikelyTranscriptStub(whisperText)) {
                releaseAndRearm(false); // silence / hallucinated stub: ignore, no reply
                return;
            }
            sttFailuresRef.current = 0;
            setUserSpeech(whisperText);
            await submitVoiceQuery(whisperText, true);
        } catch (err) {
            console.warn("Transcription error", err);
            releaseAndRearm(true);
        }
    };


    // --- NEW AI ORCHESTRATION LAYER ---
    const startVoiceGuidance = async () => {
        if (!recipe || !recipe.title) return;
        const validInstructions = Array.isArray(recipe.instructions)
            ? recipe.instructions.filter(Boolean)
            : (typeof recipe.instructions === 'string' && recipe.instructions.trim().length > 0 ? [recipe.instructions] : []);

        if (validInstructions.length === 0) {
            toast.error(t('no_instructions_available') || "Cooking instructions not available for this recipe.");
            return;
        }

        setIsVoiceMode(true);
        setIsOrchestrating(true);
        try {
            const normalizedRecipe = {
                ...recipe,
                ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
                instructions: validInstructions
            };

            const res = await fetch('/api/cooking-assistant/orchestrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipe: normalizedRecipe, userId: user?.id, language: lang })
            });
            const data = await res.json();
            if (data?.session) {
                setSessionData(data.session);
                setCurrentStepIdx(-1); 
                
                if (data.session.overview?.ingredients_image_prompt) {
                    fetchImage(-1, data.session.overview.ingredients_image_prompt);
                }

                if (data.session.overview?.text) {
                    setChatMessages([
                        {
                            id: `chef-init-${Date.now()}`,
                            sender: 'chef',
                            text: data.session.overview.text,
                            timestamp: Date.now()
                        }
                    ]);
                    playTTS(data.session.overview.text);
                }
            } else {
                throw new Error(data?.error || "Invalid session data");
            }
        } catch(e: any) {
            console.warn("Orchestration network/AI issue, using client fallback session:", e);
            // Graceful non-AI fallback from stored recipe instructions
            const rawIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
            const ingNames = rawIngredients
                .map((i: any) => typeof i === 'string' ? i : `${i.amount || ''} ${i.unit || ''} ${i.item || i.name || ''}`.trim())
                .filter(Boolean);
            const ingText = ingNames.length > 0 ? ingNames.join(', ') : 'all required ingredients';

            const fallbackSession = {
                overview: {
                    text: `Let's make ${recipe.title}. To start, make sure you have ${ingText} ready. You can follow each step at your own pace.`,
                    equipment: [],
                    ingredients_image_prompt: ""
                },
                steps: validInstructions.map((inst: any, idx: number) => ({
                    instruction: typeof inst === 'string' ? inst : (inst.step || inst.instruction || `Step ${idx + 1}`),
                    duration_seconds: 180,
                    ingredients_used: [],
                    image_prompt: ""
                }))
            };
            setSessionData(fallbackSession);
            setCurrentStepIdx(-1);
            if (fallbackSession.overview.text) {
                setChatMessages([
                    {
                        id: `chef-init-${Date.now()}`,
                        sender: 'chef',
                        text: fallbackSession.overview.text,
                        timestamp: Date.now()
                    }
                ]);
                playTTS(fallbackSession.overview.text);
            }
        } finally {
            setIsOrchestrating(false);
        }
    };

    const fetchImage = async (idx: number, prompt: string) => {
        if (stepImages[idx]) return;
        setIsImageLoading(true);
        try {
            // Strictly bind step visuals to verified dish photography from canonical recipe
            const verifiedUrl = recipe?.image_url || getFoodImageUrl(recipe?.title, recipe?.cuisine_type, recipe?.meal_type);
            setStepImages(prev => ({ ...prev, [idx]: verifiedUrl }));
            setIsImageLoading(false);
        } catch(e) {
            console.error("Image fetch failed", e);
            if (recipe?.image_url) {
                setStepImages(prev => ({ ...prev, [idx]: recipe.image_url }));
            }
            setIsImageLoading(false);
        }
    };

    // --- SHARED VOICE ENGINE HELPERS (lib/voice/VoiceTurnController) ---
    const fetchTtsBlobUrl = async (text: string, signal: AbortSignal): Promise<string | null> => {
        if (Date.now() < ttsCooldownUntilRef.current) return null; // recent TTS failure: skip network, show text-only
        try {
            const res = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
                // No `voice` here: the server locks the single human voice (OpenAI nova -> Gemini Aoede).
                body: JSON.stringify({ text, speed: 1.05, language: lang || 'en' })
            });
            if (!res.ok) {
                // Provider failure (e.g. 502 / 429) -> enter cooldown immediately so other chunks don't spam 502s
                ttsCooldownUntilRef.current = Date.now() + 60000;
                return null;
            }
            const blob = await res.blob();
            if (!blob.size) return null;
            return URL.createObjectURL(blob);
        } catch (e: any) {
            if (e?.name === 'AbortError') return null;
            ttsCooldownUntilRef.current = Date.now() + 30000;
            return null;
        }
    };

    /** Hard stop of whatever the chef is saying (audio, progressive text, in-flight TTS fetches). */
    const stopSpeech = () => {
        spokenTextRef.current = '';
        const p = playerRef.current;
        playerRef.current = null;
        if (p) p.stop();
        audioRef.current = null;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
    };

    /** Cancel the whole active turn: chat fetch, TTS, audio, and release the single-flight lock. */
    const cancelTurn = () => {
        turnRef.current.cancel();
        stopSpeech();
        processingRef.current = false;
        setIsChefThinking(false);
    };

    /** User spoke over the chef: drop the incomplete assistant turn; the new utterance becomes the only active request. */
    const bargeIn = () => {
        cancelTurn();
    };

    const resumeListeningSoon = () => {
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            if (!isVoiceModeRef.current) return;
            if (playerRef.current?.isActive || processingRef.current) return;
            startListening();
        }, 220);
    };

    const playTTS = (text: string, opts?: {
        onFirstChunk?: (info: { textOnly: boolean }) => void;
        onEnd?: (r: SpeechEndResult) => void;
        recordHistory?: boolean;
    }): Promise<SpeechEndResult> => {
        // Never start a new playback until the previous one is explicitly stopped.
        stopSpeech();
        const clean = (text || '').replace(/[*_#`~]/g, '').trim();
        const chunks = splitIntoSpeechChunks(clean);

        return new Promise<SpeechEndResult>((resolve) => {
            if (chunks.length === 0) {
                const empty: SpeechEndResult = { reason: 'completed', deliveredText: '', textOnlyText: '', anyAudio: false };
                opts?.onEnd?.(empty);
                resolve(empty);
                return;
            }

            setFullText(clean);
            spokenTextRef.current = clean;
            setTypedText('\u200B'); // hide full text until it is actually revealed with the audio

            const player: SequentialSpeechPlayer = new SequentialSpeechPlayer({
                onFirstChunk: (info) => {
                    if (playerRef.current !== player) return;
                    if (info.textOnly) {
                        setIsSpeaking(false);
                        isSpeakingRef.current = false;
                        setTypedText(clean); // reveal full text immediately in text-only mode
                        toast.message("Voice unavailable - showing the chef's reply as text.");
                    }
                    opts?.onFirstChunk?.(info);
                },
                onProgress: (revealed) => {
                    if (playerRef.current === player) setTypedText(revealed);
                },
                onAudioElement: (a) => { if (playerRef.current === player) audioRef.current = a; },
                onEnd: (r) => {
                    const stillOwner = playerRef.current === player;
                    if (stillOwner) {
                        playerRef.current = null;
                        audioRef.current = null;
                        setIsSpeaking(false);
                        isSpeakingRef.current = false;
                        setTypedText(r.deliveredText || '');
                    }
                    if (r.reason === 'text_only') {
                        // Backoff: do not hammer a failing TTS provider every turn.
                        ttsCooldownUntilRef.current = Math.max(ttsCooldownUntilRef.current, Date.now() + 60000);
                    }
                    if (r.deliveredText && opts?.recordHistory !== false) {
                        historyRef.current.push({ role: 'assistant', text: r.deliveredText });
                        if (historyRef.current.length > 24) historyRef.current.splice(0, historyRef.current.length - 24);
                    }
                    opts?.onEnd?.(r);
                    // Interrupted turns are resumed by whoever interrupted; natural ends return to listening.
                    if (stillOwner && r.reason !== 'interrupted' && isVoiceModeRef.current) {
                        resumeListeningSoon();
                    }
                    resolve(r);
                }
            });
            playerRef.current = player;
            setIsSpeaking(true);
            isSpeakingRef.current = true;

            chunks.forEach((c) => player.enqueue({ text: c, fetchSrc: (signal) => fetchTtsBlobUrl(c, signal) }));
            player.end();

            // Keep the mic open (barge mode) while the chef speaks so the user can interrupt.
            if (isVoiceModeRef.current) startListening();
        });
    };

    const togglePlayback = () => {
        const a = audioRef.current;
        if (!a) return;
        if (isSpeaking) {
            a.pause();
            setIsSpeaking(false);
            isSpeakingRef.current = false;
        } else {
            a.play().catch(() => {});
            setIsSpeaking(true);
            isSpeakingRef.current = true;
        }
    };

    const navigateStep = async (direction: 'next' | 'prev') => {
        if (!sessionData) return;
        
        stopSpeech();

        let newIdx = currentStepIdx + (direction === 'next' ? 1 : -1);
        if (newIdx < -1) newIdx = -1;
        
        if (newIdx >= sessionData.steps.length) {
            playTTS(t('voice_done') || 'You have finished cooking! Enjoy your beautiful meal.');
            setTimeout(() => {
                setIsVoiceMode(false);
                setSessionData(null);
            }, 5000);
            return;
        }

        setCurrentStepIdx(newIdx);
        const newStep = newIdx === -1 ? sessionData.overview : sessionData.steps[newIdx];
        
        const textToSpeak = newIdx === -1 ? newStep.text : newStep.instruction;
        setChatMessages(prev => [
            ...prev,
            {
                id: `chef-step-${newIdx}-${Date.now()}`,
                sender: 'chef',
                text: textToSpeak,
                timestamp: Date.now()
            }
        ]);
        playTTS(textToSpeak);

        const imagePrompt = newIdx === -1 ? newStep.ingredients_image_prompt : newStep.image_prompt;
        if (imagePrompt) {
            fetchImage(newIdx, imagePrompt);
        }
        
        // Reset photo state for new step
        setStepVerificationPhoto(null);
        setStepVerificationStatus('idle');

        if (newIdx >= 0 && newStep.duration_seconds) {
            setTimeLeft(newStep.duration_seconds);
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    // --- TWO-WAY VOICE CHAT ---
    const submitVoiceQuery = async (query: string, lockHeld = false) => {
        const currentSession = sessionDataRef.current;
        if (!currentSession) {
            if (lockHeld) processingRef.current = false;
            return;
        }
        const cleanQuery = (query || '').trim();
        if (!cleanQuery) {
            if (lockHeld) processingRef.current = false;
            return;
        }

        // Only one active turn: cancel any in-flight chat/TTS/audio of the previous turn.
        stopSpeech();
        processingRef.current = true;
        const turn = turnRef.current.begin();

        // Append user's message exactly once, in order.
        setChatMessages(prev => [
            ...prev,
            { id: `user-${Date.now()}-${turn.id}`, sender: 'user', text: cleanQuery, timestamp: Date.now() }
        ]);
        historyRef.current.push({ role: 'user', text: cleanQuery });
        setUserSpeech("");
        setTypedText("");
        setIsChefThinking(true);
        if (isTimerRunning) toggleTimer(); 

        const idx = currentStepIdxRef.current;
        const currentStep = idx === -1 ? currentSession.overview : currentSession.steps[idx];
        const instr = idx === -1 ? currentStep.text : currentStep.instruction;
        const allInstructions = Array.isArray(currentSession.steps)
            ? currentSession.steps.map((s: any) => s?.instruction || '')
            : [];

        try {
            const res = await fetch('/api/cooking-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: turn.signal,
                body: JSON.stringify({
                    query: cleanQuery,
                    recipeTitle: recipe.title,
                    currentStepIdx: idx,
                    currentInstruction: instr,
                    ingredients: recipe.ingredients || [],
                    allInstructions,
                    // recent dialogue (excluding the question being asked now)
                    history: historyRef.current.slice(0, -1).slice(-8),
                    language: lang,
                    userId: user?.id
                })
            });
            if (!turn.isCurrent()) return;
            if (!res.ok) throw new Error(`Chef chat HTTP ${res.status}`);
            const data = await res.json();
            if (!turn.isCurrent()) return;
            if (!data?.answer) throw new Error('Empty chef answer');

            setIsChefThinking(false);
            const replyId = `chef-reply-${Date.now()}-${turn.id}`;
            let appended = false;
            await playTTS(data.answer, {
                onFirstChunk: () => {
                    if (appended || !turn.isCurrent()) return;
                    appended = true;
                    setChatMessages(prev => [
                        ...prev,
                        { id: replyId, sender: 'chef', text: '', timestamp: Date.now() }
                    ]);
                },
                onEnd: (r) => {
                    // The stored reply is exactly what was delivered (full, or only the part spoken before barge-in).
                    if (!appended) return;
                    setChatMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: r.deliveredText } : m));
                }
            });
        } catch (err: any) {
            if (err?.name === 'AbortError' || !turn.isCurrent()) return;
            console.warn("Chef chat error", err?.message || err);
            toast.error("Chef couldn't answer that. Please ask again.");
        } finally {
            // Only the still-current turn may release the lock / spinner (a superseding turn owns them).
            if (turn.isCurrent()) {
                setIsChefThinking(false);
                processingRef.current = false;
                if (isVoiceModeRef.current && !playerRef.current?.isActive) resumeListeningSoon();
            }
        }
    };

    submitVoiceQueryRef.current = submitVoiceQuery;

    // --- VISION AI STEP AUTHENTICATION ---
    const verifyStepWithPhoto = async (fileOrBase64: File | string) => {
        const currentSession = sessionDataRef.current;
        if (!currentSession) return;

        setIsVerifyingPhoto(true);
        setIsChefThinking(true);
        stopSpeech();

        const processBase64 = async (base64Data: string) => {
            setStepVerificationPhoto(base64Data);

            // Add photo into conversation timeline
            setChatMessages(prev => [
                ...prev,
                {
                    id: `user-photo-${Date.now()}`,
                    sender: 'user',
                    text: 'Captured dish photo',
                    photo: base64Data,
                    timestamp: Date.now()
                }
            ]);

            const idx = currentStepIdxRef.current;
            const currentStep = idx === -1 ? currentSession.overview : currentSession.steps[idx];
            const instr = idx === -1 ? currentStep.text : currentStep.instruction;

            try {
                const res = await fetch('/api/cooking-assistant/verify-step', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageBase64: base64Data,
                        recipeTitle: recipe.title,
                        stepIndex: idx,
                        stepInstruction: instr,
                        ingredients: recipe.ingredients || [],
                        language: lang,
                        userId: user?.id
                    })
                });

                const data = await res.json();
                if (data.success && data.authenticated) {
                    setStepVerificationStatus('success');
                    const praise = data.feedback || "Excellent job! Your dish is right on track. Let's move to the next step.";
                    setChatMessages(prev => [
                        ...prev,
                        {
                            id: `chef-praise-${Date.now()}`,
                            sender: 'chef',
                            text: praise,
                            timestamp: Date.now()
                        }
                    ]);
                    setTypedText("");
                    await playTTS(praise);
                    // Chef is strictly in control of moving to the next step!
                    setTimeout(() => {
                        navigateStep('next');
                    }, 1200);
                } else {
                    setStepVerificationStatus('retry');
                    const guidance = data.feedback || data.advice || "Let's check this step again before continuing.";
                    setChatMessages(prev => [
                        ...prev,
                        {
                            id: `chef-guidance-${Date.now()}`,
                            sender: 'chef',
                            text: guidance,
                            timestamp: Date.now()
                        }
                    ]);
                    setTypedText("");
                    await playTTS(guidance);
                }
            } catch (err: any) {
                console.error("Step verification error", err);
                toast.error("Could not verify photo. Please try again.");
            } finally {
                setIsVerifyingPhoto(false);
                setIsChefThinking(false);
            }
        };

        if (typeof fileOrBase64 === 'string') {
            await processBase64(fileOrBase64);
        } else {
            const reader = new FileReader();
            reader.readAsDataURL(fileOrBase64);
            reader.onload = async () => {
                const base64Data = reader.result as string;
                await processBase64(base64Data);
            };
            reader.onerror = () => {
                setIsVerifyingPhoto(false);
                setIsChefThinking(false);
                toast.error("Failed to read image file.");
            };
        }
    };



    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="size-20 bg-vic-green/20 rounded-full mb-4 flex items-center justify-center">
                        <Loader2 className="animate-spin text-vic-green" size={32} />
                    </div>
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
            </div>
        );
    }

    if (isError || !recipe) {
        const errorMessage = (error as Error)?.message || '';
        const isNotFound = errorMessage.toLowerCase().includes('not found') || (!recipe && !isError);

        return (
            <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-white dark:bg-[#0d1418]">
                <AlertCircle className="text-vic-pink mb-4" size={48} />
                <h2 className="text-xl font-black mb-2 dark:text-white uppercase tracking-tight">
                    {isNotFound ? (t('recipe_missing') || 'Recipe Not Found') : (t('recipe_error') || 'Unable to Load Recipe')}
                </h2>
                <p className="text-sm text-slate-500 max-w-xs mb-6 font-medium">
                    {isNotFound
                        ? 'The recipe you requested could not be found or may have been removed.'
                        : (errorMessage || 'There was a problem connecting to the server. Please try again.')}
                </p>
                <div className="flex gap-4">
                    {!isNotFound && (
                        <button
                            onClick={() => refetch()}
                            className="bg-vic-green text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                        >
                            {t('retry') || 'Retry'}
                        </button>
                    )}
                    <button
                        onClick={() => router.back()}
                        className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/20 transition-all"
                    >
                        {t('go_back') || 'Go Back'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418] overflow-hidden">
            {/* Normal UI hidden when Voice Mode is active */}
            <div className={`flex flex-col h-full overflow-hidden ${isVoiceMode ? 'hidden' : 'block'}`}>
                {/* Immersive Header */}
                <div className="relative h-80 shrink-0 bg-slate-800">
                    <MealImage 
                        src={recipe.image_url} 
                        alt={recipe.title || 'Recipe'} 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
                        <button onClick={() => router.back()} className="size-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex gap-2">
                            <button className="size-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                <Share2 size={18} />
                            </button>
                            <FavoriteButton recipeId={id} className="relative !bg-white/20 !backdrop-blur-md" />
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="flex gap-2 mb-2">
                            {recipe.dietary_tags?.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-[10px] font-bold uppercase tracking-widest bg-vic-green text-slate-900 px-2 py-1 rounded">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-tight">
                            {recipe.title}
                        </h1>
                    </div>
                </div>

                {/* Content Dashboard */}
                <main className="flex-1 overflow-y-auto no-scrollbar bg-slate-50 dark:bg-[#0d1418] rounded-t-[40px] -mt-10 relative z-10 p-6">
                    
                    {/* Nutritional Dashboard */}
                    {/* Nutritional Dashboard */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Flame className="mx-auto text-vic-orange mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">{recipe.total_calories || recipe.calories || 0}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('kcal') || 'Kcal'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Beef className="mx-auto text-vic-red mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">
                                {recipe.protein_g != null && Number(recipe.protein_g) > 0 ? `${recipe.protein_g}g` : (recipe.total_calories > 50 ? '—' : '0g')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('prot') || 'Prot'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Wheat className="mx-auto text-vic-green mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">
                                {recipe.carbs_g != null && Number(recipe.carbs_g) > 0 ? `${recipe.carbs_g}g` : (recipe.total_calories > 50 ? '—' : '0g')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('carb') || 'Carb'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Droplets className="mx-auto text-vic-blue mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">
                                {recipe.fat_g != null && Number(recipe.fat_g) > 0 ? `${recipe.fat_g}g` : (recipe.total_calories > 50 ? '—' : '0g')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('fat') || 'Fat'}</div>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-white dark:bg-[#1f2c34] p-4 rounded-3xl shadow-sm flex items-center gap-4">
                            <div className="size-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-500">
                                <Timer size={24} />
                            </div>
                            <div>
                                <div className="text-sm font-black dark:text-white leading-none">
                                    {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} MIN
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('total_time') || 'Total Time'}</div>
                            </div>
                        </div>
                        <div className="flex-1 bg-white dark:bg-[#1f2c34] p-4 rounded-3xl shadow-sm flex items-center gap-4">
                            <div className="size-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-500">
                                <Timer size={24} />
                            </div>
                            <div>
                                <div className="text-sm font-black dark:text-white leading-none">
                                    {recipe.servings || 2} PERS
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('servings') || 'Servings'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Clinical Justification / Why This Meal Card */}
                    {(recipe.clinical_justification || recipe.description) && (
                        <div className="mb-8 p-5 bg-gradient-to-br from-emerald-500/10 via-vic-green/5 to-transparent border border-vic-green/30 rounded-3xl shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="size-2 rounded-full bg-vic-green animate-pulse" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-vic-green">
                                    {t('why_this_meal') || 'Why We Chose This For You'}
                                </h4>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                {recipe.clinical_justification || recipe.description}
                            </p>
                        </div>
                    )}

                    {/* Voice Guidance Toggle */}
                    {(() => {
                        const validInstructions = Array.isArray(recipe.instructions)
                            ? recipe.instructions.filter(Boolean)
                            : (typeof recipe.instructions === 'string' && recipe.instructions.trim().length > 0 ? [recipe.instructions] : []);
                        const hasInstructions = validInstructions.length > 0;

                        return (
                            <div className="mb-8">
                                <button 
                                    onClick={startVoiceGuidance}
                                    disabled={isLoading || isOrchestrating || !hasInstructions}
                                    className="w-full bg-vic-green text-slate-900 py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                                >
                                    <Mic size={20} />
                                    {t('start_cooking') || "Let's start cooking"}
                                </button>
                                {!hasInstructions && !isLoading && (
                                    <p className="text-center text-xs text-slate-400 mt-2 font-medium">
                                        {t('instructions_not_available') || "Cooking steps not available for this meal"}
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    {/* Ingredients */}
                    <h3 className="text-xl font-black dark:text-white mb-4 uppercase tracking-tight">{t('ingredients') || 'Ingredients'}</h3>
                    <div className="bg-white dark:bg-[#1f2c34] rounded-3xl p-6 shadow-sm mb-8">
                        <div className="space-y-4">
                            {recipe.ingredients && recipe.ingredients.length > 0 ? (
                                recipe.ingredients.map((ing: any, i: number) => {
                                    const itemText = typeof ing === 'string' ? ing : (ing?.item || ing?.name || '');
                                    const amountText = typeof ing === 'object' && (ing?.amount || ing?.unit)
                                        ? `${ing?.amount || ''} ${ing?.unit || ''}`.trim()
                                        : '';

                                    return (
                                        <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-3 last:border-none">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{itemText}</span>
                                            {amountText && <span className="text-sm font-black dark:text-white">{amountText}</span>}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-slate-400 italic">No specific ingredients listed for this meal.</p>
                            )}
                        </div>
                    </div>

                    {/* Instructions */}
                    <h3 className="text-xl font-black dark:text-white mb-4 uppercase tracking-tight">{t('instructions') || 'Instructions'}</h3>
                    <div className="space-y-6 mb-20">
                        {recipe.instructions && recipe.instructions.length > 0 ? (
                            recipe.instructions.map((step: any, i: number) => {
                                const stepText = typeof step === 'string' ? step : (step?.step || step?.instruction || String(step));

                                return (
                                    <div key={i} className="flex gap-4">
                                        <div className="size-8 rounded-xl bg-vic-green/10 text-vic-green flex items-center justify-center font-black shrink-0">
                                            {i + 1}
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                                            {stepText}
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-slate-400 italic">No specific instructions listed for this meal.</p>
                        )}
                    </div>
                </main>
            </div>

            {/* IMMERSIVE AI COOKING MODE OVERLAY */}
            {isVoiceMode && (
                <div className="fixed inset-0 z-[100] bg-white dark:bg-[#0A1014] flex flex-col px-6 pt-5 pb-8 text-slate-900 dark:text-white overflow-hidden animate-in fade-in duration-300">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex flex-col">
                            <h2 className="text-vic-green font-black uppercase tracking-widest text-xs">{t('cooking_mode') || 'Cooking Mode'}</h2>
                            <p className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate max-w-[250px]">{recipe.title}</p>
                        </div>
                        <button onClick={() => { setIsVoiceMode(false); if(audioRef.current) audioRef.current.pause(); stopListening(); }} className="size-10 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors rounded-full flex items-center justify-center shrink-0">
                            <AlertCircle size={20} className="text-slate-600 dark:text-white" />
                        </button>
                    </div>

                    {isOrchestrating ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="size-32 bg-vic-green/10 border border-vic-green/30 rounded-full flex items-center justify-center mb-8 shadow-[0_0_100px_rgba(19,236,55,0.15)] relative">
                                <div className="absolute inset-0 rounded-full border-4 border-vic-green/50 border-t-vic-green animate-spin" />
                                <Mic className="text-vic-green animate-pulse" size={40} />
                            </div>
                            <p className="text-xl font-black uppercase tracking-widest text-vic-green animate-pulse">
                                Chef is reviewing recipe...
                            </p>
                            <p className="text-slate-400 mt-2 text-sm font-medium">Preparing your interactive session</p>
                        </div>
                    ) : sessionData && (
                        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full relative min-h-0 pb-2">
                            
                            {/* Top Visual Layer: Verified Meal Dish Photography (Maintained as Initially) */}
                            <div className="w-full h-[28vh] min-h-[200px] bg-slate-100 dark:bg-black/40 rounded-[32px] mb-4 overflow-hidden relative shadow-2xl border border-slate-200 dark:border-white/10 shrink-0">
                                {isImageLoading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vic-green"></div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-vic-green animate-pulse">Visualizing...</span>
                                    </div>
                                ) : (stepImages[currentStepIdx] || recipe.image_url) ? (
                                    <MealImage 
                                        src={stepImages[currentStepIdx] || recipe.image_url} 
                                        alt={recipe.title || "Dish Visual"} 
                                        className="w-full h-full object-cover animate-in fade-in duration-700" 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#d4f8d9] to-[#f0f9f0] dark:from-[#1a2e21] dark:to-[#0A1014]">
                                        <ChefAvatar
                                            state={
                                                isSpeaking ? 'speaking' :
                                                isChefThinking ? 'thinking' :
                                                isListening ? 'listening' : 'idle'
                                            }
                                            chefName="Chef Vic"
                                            size="md"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {/* Seamless Two-Way Conversational Layer (Conversational Dialogue Thread) */}
                            <div className="flex-1 flex flex-col min-h-0 relative">
                                <div 
                                    ref={chatContainerRef}
                                    className="flex-1 overflow-y-auto no-scrollbar mask-image-bottom space-y-3 pb-3 pr-1"
                                >
                                    {chatMessages.map((msg, idx) => {
                                        const isLastChef = msg.sender === 'chef' && idx === chatMessages.length - 1;
                                        
                                        if (msg.sender === 'chef') {
                                            return (
                                                <div 
                                                    key={msg.id} 
                                                    className="flex items-start gap-2.5 max-w-[92%] animate-in fade-in slide-in-from-bottom-2 duration-300"
                                                >
                                                    <div className="size-8 rounded-full bg-vic-green/20 border border-vic-green/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                                        <Volume2 size={16} className={`text-vic-green ${isSpeaking && isLastChef ? 'animate-pulse' : ''}`} />
                                                    </div>
                                                    <div className="bg-white/10 dark:bg-white/5 border border-white/15 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-sm shadow-md">
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-vic-green mb-1">Chef Vic</p>
                                                        <p className="text-sm md:text-base font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                                                            {isLastChef && typedText ? typedText : msg.text}
                                                            {isSpeaking && isLastChef && <span className="inline-block w-1.5 h-4 bg-vic-green ml-1.5 animate-pulse align-middle" />}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // User message (Speech or Photo)
                                        return (
                                            <div key={msg.id} className="flex flex-col items-end gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                {msg.photo ? (
                                                    <div className="flex items-center gap-3 bg-white/10 dark:bg-white/5 border border-white/15 px-3 py-2 rounded-2xl w-fit shadow-md">
                                                        <div className="size-10 rounded-xl overflow-hidden shrink-0 border border-vic-green">
                                                            <img src={msg.photo} alt="Captured dish" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-200 pr-1">
                                                            <p className="text-[10px] text-vic-green uppercase tracking-wider">Photo</p>
                                                            <span>Dish Verification</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-vic-green/20 border border-vic-green/50 px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] shadow-md">
                                                        <p className="text-vic-green text-[10px] font-black uppercase tracking-wider mb-0.5">You</p>
                                                        <p className="text-slate-900 dark:text-white font-medium text-sm">{msg.text}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Live Interim Speech Bubble while user is currently talking */}
                                    {userSpeech && (
                                        <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <div className="bg-vic-green/15 border border-dashed border-vic-green/60 px-4 py-2 rounded-2xl rounded-br-sm max-w-[85%] shadow-md">
                                                <p className="text-vic-green text-[9px] font-black uppercase tracking-wider mb-0.5 animate-pulse">Listening...</p>
                                                <p className="text-slate-900 dark:text-white font-medium text-sm italic">{userSpeech}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Chef Thinking Indicator directly below user message */}
                                    {isChefThinking && (
                                        <div className="flex items-start gap-2.5 max-w-[90%] animate-in fade-in duration-300">
                                            <div className="size-8 rounded-full bg-vic-green/20 border border-vic-green/40 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                                <Loader2 size={16} className="text-vic-green animate-spin" />
                                            </div>
                                            <div className="bg-white/10 dark:bg-white/5 border border-white/15 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-md">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-vic-green mb-0.5">Chef Vic</p>
                                                <p className="text-xs font-bold text-slate-300 animate-pulse flex items-center gap-1.5">
                                                    Chef is preparing advice...
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Controls Layer */}
                            <div className="pt-2 border-t border-white/10 shrink-0">
                                {/* Context Timer */}
                                {currentStepIdx >= 0 && (
                                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl mb-3">
                                        <div className="flex items-center gap-3">
                                            <Timer className="text-vic-green" size={20} />
                                            <div>
                                                <div className="text-xl font-black font-mono leading-none text-white">{formatTime(timeLeft)}</div>
                                            </div>
                                        </div>
                                        <button onClick={toggleTimer} className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors">
                                            {isTimerRunning ? 'PAUSE' : 'START'}
                                        </button>
                                    </div>
                                )}

                                {/* Centered Circular Capture Button & Audio Controls (No manual arrow navigation) */}
                                <div className="flex items-center justify-center gap-6 px-4 py-1">
                                    {/* Play / Pause Voice */}
                                    <button 
                                        type="button"
                                        onClick={togglePlayback} 
                                        className={`size-14 rounded-full flex items-center justify-center transition-all ${isSpeaking ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300 hover:text-white'}`}
                                        title={isSpeaking ? 'Pause Chef' : 'Replay Chef'}
                                    >
                                        {isSpeaking ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                                    </button>

                                    {/* Perfectly Centered Circular Capture Button */}
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setIsCameraModalOpen(true);
                                            startCamera(facingMode);
                                        }}
                                        disabled={isVerifyingPhoto}
                                        className="size-20 rounded-full border-4 border-white/30 bg-vic-green hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(19,236,55,0.4)] disabled:opacity-50"
                                        title="Capture meal progress"
                                    >
                                        <div className="size-16 rounded-full bg-white/20 flex items-center justify-center">
                                            <Camera size={28} className="text-slate-900" />
                                        </div>
                                    </button>

                                    {/* Mic Status Indicator / Toggle */}
                                    <div 
                                        className="size-14 rounded-full bg-white/10 flex items-center justify-center text-vic-green"
                                        title="Microphone active"
                                    >
                                        <Mic size={22} className={isListening ? 'animate-pulse' : 'opacity-60'} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LIVE DEVICE CAMERA VIEWPOINT MODAL (NATIVE CAMERA EXPERIENCE MATCHING Camera.tsx) */}
                    {isCameraModalOpen && (
                        <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-between p-4 backdrop-blur-md animate-in fade-in duration-200">
                            {/* Header */}
                            <div className="w-full max-w-md flex items-center justify-between pt-3 px-4 text-white">
                                <div className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-full bg-vic-green animate-pulse" />
                                    <span className="text-sm font-black uppercase tracking-widest text-white">Kitchen</span>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsCameraModalOpen(false);
                                        stopCamera();
                                    }}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Viewfinder Video Frame */}
                            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl flex items-center justify-center mx-auto my-auto">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-x-6 bottom-6 flex items-center justify-center pointer-events-none">
                                    <span className="text-xs font-bold tracking-wider uppercase text-white bg-black/70 px-4 py-2 rounded-full backdrop-blur-md shadow-lg border border-white/10">
                                        {currentStepIdx === -1 ? 'Frame your ingredients' : 'Frame your dish progress'}
                                    </span>
                                </div>
                            </div>

                            {/* Camera Shutter & Flip Controls */}
                            <div className="w-full max-w-md flex items-center justify-around pb-6 pt-2">
                                <button
                                    type="button"
                                    onClick={switchCamera}
                                    className="p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                                    title="Switch Camera"
                                >
                                    <SwitchCamera size={22} />
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await takeLiveViewPhoto();
                                        setIsCameraModalOpen(false);
                                        stopCamera();
                                    }}
                                    className="size-20 rounded-full border-4 border-white bg-vic-green hover:scale-105 active:scale-90 transition-all flex items-center justify-center shadow-[0_0_35px_rgba(19,236,55,0.5)]"
                                    title="Take Photo"
                                >
                                    <div className="size-16 rounded-full bg-white/20 flex items-center justify-center">
                                        <Camera size={32} className="text-slate-900" />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCameraModalOpen(false);
                                        stopCamera();
                                    }}
                                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
