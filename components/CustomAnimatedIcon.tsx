"use client"
import React, { useRef } from 'react';

interface CustomAnimatedIconProps {
    src: string;
    size?: number;
    className?: string;
    playbackRate?: number;
    loop?: boolean;
}

export const CustomAnimatedIcon: React.FC<CustomAnimatedIconProps> = ({
    src,
    size = 40,
    className,
    playbackRate = 1.0,
    loop = false
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const isMounted = useRef(true);

    React.useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (videoRef.current) {
                videoRef.current.pause();
            }
        };
    }, []);

    // Initial play if loop is true
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (loop) {
            video.playbackRate = playbackRate;
            playPromiseRef.current = video.play();
            if (playPromiseRef.current !== undefined) {
                playPromiseRef.current.catch(() => { /* Ignore interruption errors */ });
            }
        } else {
            video.pause();
            video.currentTime = 0;
        }
    }, [loop, playbackRate]);

    const handleMouseEnter = () => {
        const video = videoRef.current;
        if (!loop && video) {
            // Prevent multiple simultaneous play requests
            if (playPromiseRef.current) return;

            video.currentTime = 0;
            video.playbackRate = playbackRate;
            
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromiseRef.current = playPromise;
                playPromise
                    .catch((err) => {
                        if (err.name !== 'AbortError') {
                            console.error("Video play failed:", err);
                        }
                    })
                    .finally(() => {
                        // We don't clear playPromiseRef here if we want to pause it later
                        // but we need a way to know it's done.
                    });
            }
        }
    };

    const handleMouseLeave = () => {
        const video = videoRef.current;
        if (!loop && video) {
            const pauseVideo = () => {
                if (isMounted.current && video) {
                    video.pause();
                    video.currentTime = 0;
                }
                playPromiseRef.current = null;
            };

            if (playPromiseRef.current) {
                playPromiseRef.current
                    .then(pauseVideo)
                    .catch(() => {
                        // If play was aborted, ensure it's paused
                        pauseVideo();
                    });
            } else {
                pauseVideo();
            }
        }
    };

    const isGif = src.toLowerCase().endsWith('.gif');

    if (isGif) {
        return (
            <div
                className={`relative inline-flex items-center justify-center overflow-hidden ${className}`}
                style={{ width: size, height: size }}
            >
                <img
                    src={src}
                    alt="Animated Icon"
                    className="w-full h-full object-contain pointer-events-none dark:mix-blend-screen dark:brightness-150 mixed-blend-multiply"
                    style={{ mixBlendMode: 'inherit' }}
                />
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 dark:opacity-40 pointer-events-none" />
            </div>
        );
    }

    return (
        <div
            className={`relative inline-flex items-center justify-center overflow-hidden ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ width: size, height: size }}
        >
            <video
                ref={videoRef}
                src={src}
                muted
                playsInline
                loop={loop}
                preload="auto"
                className="w-full h-full object-contain pointer-events-none dark:mix-blend-screen dark:brightness-150 mixed-blend-multiply"
                style={{ mixBlendMode: 'inherit' }} // Controlled by tailwind classes instead for flexibility
            />
            {/* Dark mode gradient highlight behind icon */}
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 dark:opacity-40 pointer-events-none" />
        </div>
    );
};
