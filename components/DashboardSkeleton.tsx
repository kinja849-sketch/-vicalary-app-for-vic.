"use client"
import React from 'react';
import { Skeleton } from './ui/skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="mx-auto flex h-auto min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-[#0d1418] p-4 overflow-hidden">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between mb-8">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="size-8 rounded-full" />
            </div>

            {/* Welcome Section */}
            <div className="space-y-2 mb-8">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>

            {/* Progress Card Skeleton */}
            <Skeleton className="h-[280px] w-full rounded-2xl mb-8" />

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-4 gap-3 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <Skeleton className="aspect-square w-full rounded-2xl" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                ))}
            </div>

            {/* Calendar Skeleton */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {[...Array(28)].map((_, i) => (
                        <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
};
