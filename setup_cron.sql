-- Enables pg_cron if not already enabled (Requires Supabase Pro/Team, or run via SQL Editor in Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule a cron job to run every hour at minute 0. 
-- It calls a wrapper function that queries the edge function for users whose local time is exactly 8:00 PM.
SELECT cron.schedule(
  'invoke-daily-summary-edge-function',
  '0 * * * *', -- Run every hour
  $$
    -- Make a POST request to the Supabase Edge Function
    -- Note: You MUST replace [YOUR_PROJECT_REF] and [YOUR_ANON_KEY] with your actual Supabase project reference and anon key.
    SELECT net.http_post(
        url:='https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-summary',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
