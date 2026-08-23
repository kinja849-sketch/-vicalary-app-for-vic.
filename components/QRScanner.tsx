"use client"
import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';

interface QRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
    onManualCapture?: (blob: Blob) => void;
    isAnalyzing?: boolean;
}

export default function QRScanner({ onScan, onClose, onManualCapture, isAnalyzing }: QRScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const hasScannedRef = useRef(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [status, setStatus] = useState<'scanning' | 'detected'>('scanning');

    useEffect(() => {
        const scannerId = "reader";
        hasScannedRef.current = false;
        setStatus('scanning');

        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        const config = { 
            fps: 10,
            disableFlip: false,
            formatsToSupport: [
                0, // QR_CODE
                9, // EAN_13
                10, // EAN_8
                14, // UPC_A
                15 // UPC_E
            ],
            qrbox: { width: window.innerWidth * 0.8, height: window.innerHeight * 0.4 },
            videoConstraints: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                advanced: [{ focusMode: "continuous" }]
            }
        };

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: facingMode },
                    config,
                    (decodedText) => {
                        if (hasScannedRef.current || isAnalyzing) return;
                        hasScannedRef.current = true;
                        setStatus('detected');
                        html5QrCode.stop().catch(console.error);
                        
                        // Tiny delay for visual feedback before firing API
                        setTimeout(() => onScan(decodedText), 150);
                    },
                    (errorMessage) => {
                        // Suppress continuous fail errors
                    }
                );
            } catch (err: any) {
                console.error("Camera startup error:", err);
                // toast.error("Could not access camera. Please check permissions.");
            }
        };

        startScanner();

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(console.error);
            }
            html5QrCode.clear();
        };
    }, [facingMode]);

    const toggleCamera = () => {
        if (scannerRef.current?.isScanning) {
            scannerRef.current.stop().then(() => {
                setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
            }).catch(console.error);
        } else {
            setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
        }
    };

    const handleManualCapture = () => {
        if (!onManualCapture || isAnalyzing) return;
        
        const video = document.querySelector('#reader video') as HTMLVideoElement;
        if (!video) {
            toast.error("Camera feed not available");
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1080;
        canvas.height = video.videoHeight || 1920;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    if (scannerRef.current?.isScanning) {
                        scannerRef.current.stop().catch(console.error);
                    }
                    onManualCapture(blob);
                }
            }, 'image/jpeg', 0.8);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center">
            {/* Header / Actions */}
            <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-5 mt-10">
                <button
                    onClick={() => { 
                        if (scannerRef.current?.isScanning) {
                            scannerRef.current.stop().catch(console.error);
                        }
                        onClose(); 
                    }}
                    className="size-11 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center border border-white/10"
                >
                    <X className="w-6 h-6" />
                </button>

                <button
                    onClick={toggleCamera}
                    className="size-11 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center border border-white/10"
                >
                    <RefreshCw className="w-6 h-6" />
                </button>
            </div>

            {/* Html5Qrcode injects the video element into this div */}
            <div id="reader" className="w-full h-full max-h-screen relative overflow-hidden bg-black" style={{ height: '100dvh' }}>
            </div>

            {/* Status indicator ?" bottom of screen */}
            <div className="absolute bottom-0 inset-x-0 pb-12 flex flex-col items-center gap-6 z-20">
                {isAnalyzing ? (
                    <div className="flex flex-col items-center gap-4 bg-black/60 p-6 rounded-3xl backdrop-blur-md border border-white/10">
                        <div className="w-10 h-10 border-4 border-vic-green border-t-transparent rounded-full animate-spin" />
                        <span className="text-white font-bold tracking-widest uppercase text-sm">
                            Analyzing Product...
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        <button 
                            onClick={handleManualCapture}
                            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-all shadow-2xl z-50"
                        >
                            <div className="w-16 h-16 rounded-full bg-white opacity-80 hover:opacity-100 transition-opacity shadow-inner" />
                        </button>
                        
                        <div className="pointer-events-none">
                            {status === 'detected' ? (
                                <div className="flex items-center gap-2 px-6 py-3 bg-emerald-500 rounded-full shadow-2xl">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                                    <span className="text-white font-black text-sm tracking-widest uppercase">
                                        Barcode Detected
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-6 py-3 bg-black/50 backdrop-blur-md rounded-full border border-white/10 shadow-xl">
                                    <div className="w-2.5 h-2.5 rounded-full bg-vic-green animate-pulse" />
                                    <span className="text-white/90 text-xs font-bold tracking-widest uppercase">
                                        Scanning Product...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                #reader video {
                    object-fit: cover !important;
                    width: 100vw !important;
                    height: 100dvh !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    filter: contrast(1.1) brightness(1.1) saturate(1.2) sharpness(1.1);
                }
                /* completely hide the internal cropping box UI so it feels full-screen */
                #qr-shaded-region {
                    display: none !important;
                    border: none !important;
                    background: transparent !important;
                }
            `}} />
        </div>
    );
}
