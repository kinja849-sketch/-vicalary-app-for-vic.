"use client"
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    AlertCircle, ArrowLeft, Mic, Play, Pause, 
    ChevronRight, ChevronLeft, Timer, Flame, Droplets, 
    Wheat, Beef, Share2, Loader2, Ear
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getRecipeDetails } from "@/lib/api/recipes";
import { useTranslation } from "@/lib/api/translation";
import { toast } from "sonner";
import { FavoriteButton } from "@/components/FavoriteButton";
import ChefAvatar from "@/components/guide/ChefAvatar";

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

    // Chat / Voice State
    const [userSpeech, setUserSpeech] = useState("");
    const [isChefThinking, setIsChefThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);

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
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const vadFrameRef = useRef<number>(0);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const isRecordingRef = useRef<boolean>(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) audioRef.current.pause();
            if (typewriterRef.current) clearInterval(typewriterRef.current);
            stopListening();
        };
    }, []);

    // Fetch recipe details
    const { data: recipe, isLoading } = useQuery<any>({
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

    // --- VAD & RECORDING ENGINE (WHISPER) ---
    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
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

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                setIsListening(false);
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                chunksRef.current = []; // reset

                // Only transcribe if we have a reasonable amount of audio
                if (audioBlob.size > 2000) { 
                    await transcribeAudio(audioBlob);
                } else {
                    // Restart listening if they just bumped the mic
                    if (isVoiceModeRef.current) startVADLoop();
                }
            };

            setIsListening(true); // Wait, this just means mic is active.
            startVADLoop();

        } catch (err) {
            console.error("Microphone access denied or error:", err);
            toast.error("Please allow microphone access to talk to the Chef.");
        }
    };

    const startVADLoop = () => {
        const checkVolume = () => {
            if (!analyserRef.current || !dataArrayRef.current || isSpeakingRef.current) {
                vadFrameRef.current = requestAnimationFrame(checkVolume);
                return;
            }

            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
                sum += dataArrayRef.current[i];
            }
            const average = sum / dataArrayRef.current.length;

            const THRESHOLD = 40; // Increased threshold to avoid hallucinated noise triggers

            if (average > THRESHOLD) {
                // USER MADE A SOUND
                
                // 1. Pause AI instantly if it's talking
                if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                    setIsSpeaking(false);
                    if (typewriterRef.current) clearInterval(typewriterRef.current);
                }

                // 2. Start recording if we aren't already
                if (!isRecordingRef.current && mediaRecorderRef.current) {
                    isRecordingRef.current = true;
                    chunksRef.current = [];
                    mediaRecorderRef.current.start();
                    setIsListening(true);
                }

                // 3. Reset silence timeout
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                
                silenceTimeoutRef.current = setTimeout(() => {
                    // Silence detected for 800ms -> Stop recording immediately to reduce latency!
                    if (isRecordingRef.current && mediaRecorderRef.current) {
                        isRecordingRef.current = false;
                        mediaRecorderRef.current.stop();
                        setIsListening(false); // UI hides "LISTENING..." while processing
                    }
                }, 800);
            }

            vadFrameRef.current = requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
    };

    const stopListening = () => {
        if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        
        setIsListening(false);
        isRecordingRef.current = false;
    };

    // Use a ref for isSpeaking to access inside VAD loop
    const isSpeakingRef = useRef(isSpeaking);
    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    // Use a ref for isVoiceMode to access inside callbacks
    const isVoiceModeRef = useRef(isVoiceMode);
    useEffect(() => {
        isVoiceModeRef.current = isVoiceMode;
        if (isVoiceMode) {
            startListening();
        } else {
            stopListening();
        }
    }, [isVoiceMode]);

    // Transcribe audio using Whisper API
    const transcribeAudio = async (blob: Blob) => {
        setIsChefThinking(true);
        setUserSpeech("..."); // Show indicator
        
        try {
            const formData = new FormData();
            formData.append('file', blob);
            
            const res = await fetch('/api/cooking-assistant/transcribe', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            // Prevent Whisper Hallucinations on silence
            const whisperText = data.text?.trim();
            if (whisperText) {
                const lowerText = whisperText.toLowerCase();
                const isHallucination = lowerText.length < 3 || 
                                      ['thank you.', 'thanks.', 'yes.', 'okay.', 'ok.'].includes(lowerText) ||
                                      whisperText.startsWith('(') || whisperText.startsWith('[');
                
                if (!isHallucination) {
                    setUserSpeech(whisperText);
                    await submitVoiceQuery(whisperText);
                } else {
                    setUserSpeech("");
                    setIsChefThinking(false);
                    if (isVoiceModeRef.current) startVADLoop();
                }
            } else {
                setUserSpeech("");
                setIsChefThinking(false);
                if (isVoiceModeRef.current) startVADLoop(); // Restart listening loop
            }
        } catch (err) {
            console.error("Transcription error", err);
            toast.error("Network issue. Could not hear you.");
            setUserSpeech("");
            setIsChefThinking(false);
            if (isVoiceModeRef.current) startVADLoop(); 
        }
    };


    // --- TYPEWRITER EFFECT ---
    const startTypewriter = (text: string) => {
        setFullText(text);
        setTypedText("");
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        
        let i = 0;
        typewriterRef.current = setInterval(() => {
            setTypedText(text.slice(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(typewriterRef.current!);
            }
        }, 35); 
    };

    // --- NEW AI ORCHESTRATION LAYER ---
    const startVoiceGuidance = async () => {
        setIsVoiceMode(true);
        setIsOrchestrating(true);
        try {
            const res = await fetch('/api/cooking-assistant/orchestrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipe, userId: user?.id })
            });
            const data = await res.json();
            if (data.session) {
                setSessionData(data.session);
                setCurrentStepIdx(-1); 
                
                if (data.session.overview.ingredients_image_prompt) {
                    fetchImage(-1, data.session.overview.ingredients_image_prompt);
                }

                playTTS(data.session.overview.text);
            } else {
                throw new Error("Invalid session data");
            }
        } catch(e) {
            console.error("Orchestration failed", e);
            toast.error(t('orchestration_failed') || "Failed to start AI Chef. Please try again.");
            setIsVoiceMode(false);
        } finally {
            setIsOrchestrating(false);
        }
    };

    const fetchImage = async (idx: number, prompt: string) => {
        if (stepImages[idx]) return;
        setIsImageLoading(true);
        try {
            // Use open source image fetching (loremflickr) based on step ingredients or title to show real process photos!
            let searchKeyword = recipe.title || 'cooking';
            if (sessionData && sessionData.steps) {
                const currentStep = idx === -1 ? sessionData.overview : sessionData.steps[idx];
                if (currentStep?.ingredients_used?.length > 0) {
                    searchKeyword = currentStep.ingredients_used.slice(0, 2).join(',');
                } else if (currentStep?.instruction) {
                    // Extract action verbs for process images (e.g. "mix,bake")
                    searchKeyword = currentStep.instruction.split(' ').slice(0, 3).join(',');
                }
            }
            
            // Clean keyword for LoremFlickr (must be comma separated, no spaces or weird characters)
            const cleanKeyword = searchKeyword.replace(/[^a-zA-Z]/g, ',').replace(/,+/g, ',').toLowerCase();
            const dynamicUrl = `https://loremflickr.com/1024/768/${cleanKeyword},food,cooking/all`;
            
            // To ensure 100% stability without overwhelming AI, we load the image object directly
            const img = new Image();
            img.onload = () => {
                setStepImages(prev => ({ ...prev, [idx]: dynamicUrl }));
                setIsImageLoading(false);
            };
            img.onerror = () => {
                if (recipe?.image_url) setStepImages(prev => ({ ...prev, [idx]: recipe.image_url }));
                setIsImageLoading(false);
            };
            img.src = dynamicUrl;
        } catch(e) {
            console.error("Image fetch failed", e);
            if (recipe?.image_url) {
                setStepImages(prev => ({ ...prev, [idx]: recipe.image_url }));
            }
            setIsImageLoading(false);
        }
    };

    const playTTS = async (text: string) => {
        setIsSpeaking(true);
        if (audioRef.current) {
            audioRef.current.pause();
        }
        
        // Wait for audio to actually play before typing begins
        try {
            const res = await fetch('/api/cooking-assistant/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (!res.ok) throw new Error("TTS Failed");
            
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            
            audio.onplay = () => {
                startTypewriter(text);
            };

            audio.onended = () => {
                // Add a small debounce to allow room reverb to die out before unmuting mic
                setTimeout(() => {
                    setIsSpeaking(false);
                    // When Chef stops talking, restart listening loop if we aren't already
                    if (isVoiceModeRef.current && !isRecordingRef.current) {
                        startVADLoop();
                    }
                }, 300);
            };

            await audio.play();
        } catch(e: any) {
            if (e.name === 'AbortError') {
                return; // Audio was intentionally paused by VAD interrupt
            }
            console.error("TTS playback error:", e);
            setIsSpeaking(false);
            startTypewriter(text); // Type anyway if audio fails
            toast.error("Voice playback failed");
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isSpeaking) {
            audioRef.current.pause();
            setIsSpeaking(false);
            if (typewriterRef.current) clearInterval(typewriterRef.current);
        } else {
            audioRef.current.play();
            setIsSpeaking(true);
            if (typedText.length < fullText.length) {
                let i = typedText.length;
                typewriterRef.current = setInterval(() => {
                    setTypedText(fullText.slice(0, i + 1));
                    i++;
                    if (i >= fullText.length) clearInterval(typewriterRef.current!);
                }, 35);
            }
        }
    };

    const navigateStep = async (direction: 'next' | 'prev') => {
        if (!sessionData) return;
        
        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }
        if (typewriterRef.current) clearInterval(typewriterRef.current);

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
        playTTS(textToSpeak);

        const imagePrompt = newIdx === -1 ? newStep.ingredients_image_prompt : newStep.image_prompt;
        if (imagePrompt) {
            fetchImage(newIdx, imagePrompt);
        }
        
        if (newIdx >= 0 && newStep.duration_seconds) {
            setTimeLeft(newStep.duration_seconds);
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    // --- TWO-WAY VOICE CHAT ---
    const submitVoiceQuery = async (query: string) => {
        const currentSession = sessionDataRef.current;
        if (!currentSession) return;

        setIsChefThinking(true);
        if (audioRef.current) audioRef.current.pause(); 
        if (isTimerRunning) toggleTimer(); 

        const idx = currentStepIdxRef.current;
        const currentStep = idx === -1 ? currentSession.overview : currentSession.steps[idx];
        const instr = idx === -1 ? currentStep.text : currentStep.instruction;

        try {
            const res = await fetch('/api/cooking-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    recipeTitle: recipe.title,
                    currentStepIdx: idx,
                    currentInstruction: instr
                })
            });
            const data = await res.json();
            if (data.answer) {
                // Remove typed text to make room for new answer
                setTypedText("");
                playTTS(data.answer);
            }
        } catch(err) {
            console.error("Chat error", err);
            toast.error("Failed to ask Chef.");
        } finally {
            setIsChefThinking(false);
            // Wait for TTS to finish before listening loop restarts
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="size-20 bg-vic-green/20 rounded-full mb-4" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
            </div>
        );
    }

    if (!recipe) {
        return (
            <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-white dark:bg-[#0d1418]">
                <AlertCircle className="text-vic-pink mb-4" size={48} />
                <h2 className="text-xl font-bold mb-2">{t('recipe_missing') || 'Recipe Missing'}</h2>
                <button onClick={() => router.back()} className="text-vic-green font-bold">{t('go_back') || 'Go Back'}</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418] overflow-hidden">
            {/* Normal UI hidden when Voice Mode is active */}
            <div className={`flex flex-col h-full overflow-hidden ${isVoiceMode ? 'hidden' : 'block'}`}>
                {/* Immersive Header */}
                <div className="relative h-80 shrink-0">
                    <img 
                        src={recipe.image_url} 
                        alt={recipe.title} 
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
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Flame className="mx-auto text-vic-orange mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">{recipe.total_calories || 0}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('kcal') || 'Kcal'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Beef className="mx-auto text-vic-red mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">{recipe.protein_g || 0}g</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('prot') || 'Prot'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Wheat className="mx-auto text-vic-green mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">{recipe.carbs_g || 0}g</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('carb') || 'Carb'}</div>
                        </div>
                        <div className="bg-white dark:bg-[#1f2c34] p-3 rounded-2xl shadow-sm text-center">
                            <Droplets className="mx-auto text-vic-blue mb-1" size={20} />
                            <div className="text-lg font-black dark:text-white leading-none">{recipe.fat_g || 0}g</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('fat') || 'Fat'}</div>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-8">
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

                    {/* Voice Guidance Toggle */}
                    <button 
                        onClick={startVoiceGuidance}
                        className="w-full bg-vic-green text-slate-900 py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 mb-8 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Mic size={20} />
                        {t('start_cooking') || "Let's start cooking"}
                    </button>

                    {/* Ingredients */}
                    <h3 className="text-xl font-black dark:text-white mb-4 uppercase tracking-tight">{t('ingredients') || 'Ingredients'}</h3>
                    <div className="bg-white dark:bg-[#1f2c34] rounded-3xl p-6 shadow-sm mb-8">
                        <div className="space-y-4">
                            {recipe.ingredients?.map((ing: any, i: number) => (
                                <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-3 last:border-none">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{ing.item}</span>
                                    <span className="text-sm font-black dark:text-white">{ing.amount} {ing.unit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Instructions */}
                    <h3 className="text-xl font-black dark:text-white mb-4 uppercase tracking-tight">{t('instructions') || 'Instructions'}</h3>
                    <div className="space-y-6 mb-20">
                        {recipe.instructions?.map((step: string, i: number) => (
                            <div key={i} className="flex gap-4">
                                <div className="size-8 rounded-xl bg-vic-green/10 text-vic-green flex items-center justify-center font-black shrink-0">
                                    {i + 1}
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                                    {step}
                                </p>
                            </div>
                        ))}
                    </div>
                </main>
            </div>

            {/* IMMERSIVE AI COOKING MODE OVERLAY */}
            {isVoiceMode && (
                <div className="fixed inset-0 z-[100] bg-white dark:bg-[#0A1014] flex flex-col p-6 text-slate-900 dark:text-white overflow-hidden animate-in fade-in duration-300">
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
                        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full relative h-full pb-4">
                            
                            {/* Visual Layer */}
                            <div className="w-full h-[30vh] min-h-[220px] bg-slate-100 dark:bg-black/40 rounded-[32px] mb-6 overflow-hidden relative shadow-2xl border border-slate-200 dark:border-white/5 shrink-0">
                                {isImageLoading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vic-green"></div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-vic-green animate-pulse">Visualizing...</span>
                                    </div>
                                ) : stepImages[currentStepIdx] ? (
                                    <img src={stepImages[currentStepIdx]} alt="Step visual" className="w-full h-full object-cover animate-in fade-in duration-700" />
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
                            
                            {/* Conversational Text Layer */}
                            <div className="flex-1 flex flex-col min-h-0 relative">
                                <div className="mb-2 text-vic-green font-black uppercase tracking-widest text-xs shrink-0 flex justify-between">
                                    <span>{currentStepIdx === -1 ? 'INGREDIENTS & OVERVIEW' : `STEP ${currentStepIdx + 1} OF ${sessionData.steps.length}`}</span>
                                    {isChefThinking && <span className="text-vic-orange flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> CHEF IS THINKING...</span>}
                                    {isListening && !isChefThinking && !isSpeaking && <span className="text-vic-green flex items-center gap-1 animate-pulse"><Ear size={14} /> LISTENING...</span>}
                                </div>
                                
                                <div className="flex-1 overflow-y-auto no-scrollbar mask-image-bottom pb-4">
                                    <p className="text-2xl md:text-3xl font-black leading-tight uppercase tracking-tighter">
                                        {typedText}
                                        {isSpeaking && <span className="inline-block w-2 h-6 bg-vic-green ml-1 animate-pulse align-middle" />}
                                    </p>

                                    {/* User Live Transcription Bubble */}
                                    {userSpeech && (
                                        <div className="mt-6 flex justify-end">
                                            <div className="bg-vic-green/20 border border-vic-green/50 p-4 rounded-2xl rounded-br-sm max-w-[80%] shadow-lg">
                                                <p className="text-vic-green text-sm font-bold uppercase tracking-wider mb-1">You</p>
                                                <p className="text-slate-900 dark:text-white font-medium">{userSpeech}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Controls Layer */}
                            <div className="pt-2 border-t border-white/10 shrink-0">
                                {/* Context Timer */}
                                {currentStepIdx >= 0 && (
                                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl mb-4">
                                        <div className="flex items-center gap-3">
                                            <Timer className="text-vic-green" size={24} />
                                            <div>
                                                <div className="text-2xl font-black font-mono leading-none text-white">{formatTime(timeLeft)}</div>
                                            </div>
                                        </div>
                                        <button onClick={toggleTimer} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors">
                                            {isTimerRunning ? 'PAUSE' : 'START'}
                                        </button>
                                    </div>
                                )}

                                {/* Navigation & Playback */}
                                <div className="flex items-center justify-between px-2 mt-4">
                                    <button onClick={() => navigateStep('prev')} disabled={currentStepIdx === -1} className="size-14 bg-white/10 rounded-full flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-all">
                                        <ChevronLeft size={28} />
                                    </button>
                                    
                                    <button onClick={togglePlayback} className={`size-20 rounded-full flex items-center justify-center transition-all ${isSpeaking ? 'bg-vic-green text-slate-900 shadow-[0_0_30px_rgba(19,236,55,0.3)]' : 'bg-white/10 text-white'}`}>
                                        {isSpeaking ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />}
                                    </button>

                                    <button onClick={() => navigateStep('next')} className="size-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                                        <ChevronRight size={28} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
