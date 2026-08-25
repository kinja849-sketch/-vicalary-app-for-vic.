import { useEffect } from 'react';

export function useDailySummaryTracker(userId: string | null) {
    useEffect(() => {
        if (!userId) return;

        const checkAndTriggerSummary = async () => {
            try {
                const now = new Date();
                
                // ONLY trigger at 12:00 a.m. (hour 0)
                if (now.getHours() !== 0) return;
                
                // We trigger the summary for *yesterday* strictly after midnight.
                // It ensures the user gets yesterday's full logical summary.
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const targetDate = yesterday.toISOString().split('T')[0];

                // Check if we already successfully generated a summary for yesterday
                const lastRunDate = localStorage.getItem('last_daily_summary_date');
                if (lastRunDate === targetDate) {
                    return; // Already ran
                }

                // If it's a new day and hasn't been run, run it!
                // Attempt to generate summary
                    const res = await fetch('/api/daily-summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, targetDate })
                    });
                    
                    const data = await res.json();
                    
                // If successful or already generated remotely, mark it local to prevent spamming
                if (data.summary || data.alreadySent) {
                    localStorage.setItem('last_daily_summary_date', targetDate);
                }
            } catch (err) {
                console.error("[DailySummaryTracker] Failed to trigger summary:", err);
            }
        };

        // Check immediately on mount
        checkAndTriggerSummary();

        // Check every 15 minutes to catch the midnight crossover if they leave the app open
        const intervalId = setInterval(checkAndTriggerSummary, 15 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [userId]);
}
