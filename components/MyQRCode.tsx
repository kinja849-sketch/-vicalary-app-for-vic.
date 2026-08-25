"use client"
import React from 'react';
import QRCode from 'react-qr-code';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Share2 } from 'lucide-react';

interface MyQRCodeProps {
    data: string;
    fullName?: string;
}

export const MyQRCode: React.FC<MyQRCodeProps> = ({ data, fullName }) => {
    const handleDownload = () => {
        const svg = document.getElementById("my-qr-code");
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width || 256;
            canvas.height = img.height || 256;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = "my-qr-code.png";
            downloadLink.href = pngFile;
            downloadLink.click();
        };
        // Safe base64 encoding for UTF-8 SVG content
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
    };

    const handleShare = async () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: 'My VicCode',
                    text: 'Scan this to chat with me on VicCalary!',
                    url: window.location.href
                });
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.warn("Share failed:", err);
                }
            }
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(window.location.href);
        }
    };

    return (
        <Card className="w-full max-w-sm mx-auto overflow-hidden bg-white/5 backdrop-blur-lg border-white/10 shadow-2xl">
            <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Your VicCode
                </CardTitle>
                <p className="text-sm text-gray-400">Share this code with friends to start chatting</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pb-8">
                <div className="p-4 bg-white rounded-2xl shadow-inner">
                    <QRCode
                        id="my-qr-code"
                        size={200}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        value={data}
                        viewBox={`0 0 256 256`}
                    />
                </div>

                {fullName && (
                    <div className="text-lg font-medium text-white">
                        {fullName}
                    </div>
                )}

                <div className="flex gap-3 w-full">
                    <Button
                        variant="secondary"
                        aria-label="Download QR Code"
                        className="flex-1 bg-white/10 hover:bg-white/20 border-white/10 text-white"
                        onClick={handleDownload}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                    </Button>
                    <Button
                        variant="default"
                        aria-label="Share QR Code"
                        className="flex-1 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white border-0"
                        onClick={handleShare}
                    >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
