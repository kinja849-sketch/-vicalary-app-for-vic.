"use client"
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { X, SwitchCamera, Send, AlertCircle } from 'lucide-react';
import { permissionManager } from '@/lib/services/PermissionManager';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [captured, setCaptured] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {}
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    useEffect(() => {
        startCamera();
        return () => {
            stopStream();
        };
    }, [facingMode]);

    const startCamera = async () => {
        stopStream();
        await new Promise(r => setTimeout(r, 80));
        try {
            const mediaStream = await permissionManager.requestPermission('camera', {
                video: { facingMode: { ideal: facingMode } },
                audio: false
            });

            if (!mediaStream) return;
            streamRef.current = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                try {
                    await videoRef.current.play();
                } catch (e) {}
            }
        } catch (error: any) {
            console.error("Camera access failed:", error);
            if (error.code === 'PERMISSION_DENIED_BROWSER' || error.code === 'USER_REJECTED') {
                setIsPermissionBlocked(true);
                toast.error('Camera access is blocked in your browser settings.');
            } else {
                toast.error('Camera access denied or unavailable');
                onClose();
            }
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                setCaptured(true);
                stopStream();
            }
        }
    };

    const retake = () => {
        setCaptured(false);
        startCamera();
    };

    const sendPhoto = () => {
        if (canvasRef.current) {
            canvasRef.current.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    onClose();
                }
            }, 'image/jpeg', 0.9);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
                <button onClick={onClose} aria-label="Close camera" className="text-white p-2">
                    <X className="text-3xl" size={30} />
                </button>
                {!captured && !isPermissionBlocked && (
                    <button
                        onClick={async () => {
                            if (isSwitching) return;
                            setIsSwitching(true);
                            setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
                            setTimeout(() => setIsSwitching(false), 500);
                        }}
                        disabled={isSwitching}
                        aria-label="Switch camera"
                        className="text-white p-2 active:scale-90 transition-transform disabled:opacity-50"
                    >
                        <SwitchCamera size={30} className={isSwitching ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>

            {/* Camera View */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                {isPermissionBlocked ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm text-slate-200 space-y-4">
                        <AlertCircle size={48} className="text-amber-400" />
                        <h3 className="text-lg font-bold text-white">Camera Access Blocked</h3>
                        <p className="text-sm text-slate-300">
                            Please enable camera access in your browser or device settings to capture food photos.
                        </p>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`max-w-full max-h-full transition-transform duration-300 ${
                                facingMode === 'user' ? '-scale-x-100' : 'scale-x-100'
                            } ${captured ? 'hidden' : 'block'}`}
                        />
                        <canvas
                            ref={canvasRef}
                            className={`max-w-full max-h-full ${captured ? 'block' : 'hidden'}`}
                        />
                    </>
                )}
            </div>

            {/* Controls */}
            {!isPermissionBlocked && (
                <div className="p-6 bg-black/50 backdrop-blur-sm flex items-center justify-center gap-6">
                    {!captured ? (
                        <button
                            onClick={capturePhoto}
                            aria-label="Capture photo"
                            className="size-16 rounded-full bg-white border-4 border-gray-300 hover:scale-110 transition-transform active:scale-95"
                        />
                    ) : (
                        <>
                            <button
                                onClick={retake}
                                aria-label="Retake photo"
                                className="px-6 py-3 bg-gray-600 text-white rounded-full font-bold hover:bg-gray-700 transition-colors"
                            >
                                Retake
                            </button>
                            <button
                                onClick={sendPhoto}
                                aria-label="Send photo"
                                className="px-6 py-3 bg-emerald-500 text-slate-950 rounded-full font-bold hover:bg-emerald-400 transition-colors flex items-center gap-2"
                            >
                                <Send size={18} />
                                Send
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
