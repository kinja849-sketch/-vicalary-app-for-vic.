"use client"
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { X, SwitchCamera, Send } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [captured, setCaptured] = useState(false);

    useEffect(() => {
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [facingMode]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            toast.error('Camera access denied');
            onClose();
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
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
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
                <button onClick={onClose} className="text-white p-2">
                    <X className="text-3xl" size={30} />
                </button>
                {!captured && (
                    <button
                        onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                        className="text-white p-2"
                    >
                        <SwitchCamera size={30} />
                    </button>
                )}
            </div>

            {/* Camera View */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`max-w-full max-h-full ${captured ? 'hidden' : 'block'}`}
                />
                <canvas
                    ref={canvasRef}
                    className={`max-w-full max-h-full ${captured ? 'block' : 'hidden'}`}
                />
            </div>

            {/* Controls */}
            <div className="p-6 bg-black/50 backdrop-blur-sm flex items-center justify-center gap-6">
                {!captured ? (
                    <button
                        onClick={capturePhoto}
                        className="size-16 rounded-full bg-white border-4 border-gray-300 hover:scale-110 transition-transform active:scale-95"
                    />
                ) : (
                    <>
                        <button
                            onClick={retake}
                            className="px-6 py-3 bg-gray-600 text-white rounded-full font-bold hover:bg-gray-700 transition-colors"
                        >
                            Retake
                        </button>
                        <button
                            onClick={sendPhoto}
                            className="px-6 py-3 bg-vic-green text-slate-900 rounded-full font-bold hover:bg-vic-green/90 transition-colors flex items-center gap-2"
                        >
                            <Send size={18} />
                            Send
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
