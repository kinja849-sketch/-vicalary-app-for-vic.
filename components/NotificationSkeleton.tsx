"use client"
import React from 'react';
import { Skeleton } from './ui/skeleton';

export const NotificationSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418]">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-16" />
            </div>

            {/* List Skeleton */}
            <div className="flex-1 p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton className="size-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
