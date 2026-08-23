import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    // 1. Get IP from headers (Supabase automatically adds x-real-ip)
    const ip = req.headers.get("x-real-ip") || "unknown";
    
    // 2. Fetch from a reliable backend API (ip-api.com is free for HTTP/Server calls usually)
    // We can also try multiple here if one fails.
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,timezone,currency`);
    const data = await res.json();

    if (data.status !== "success") {
      throw new Error(data.message || "IP lookup failed");
    }

    return new Response(JSON.stringify({
      country_code: data.countryCode,
      country_name: data.country,
      city: data.city,
      timezone: data.timezone,
      currency: data.currency,
      ip: ip,
      method: 'EDGE'
    }), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, fallback: true }), { 
      status: 200, // Return 200 so the client knows to use its own fallback
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
