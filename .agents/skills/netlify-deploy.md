# Netlify Deployment & Environment Skill

## Deployment Standards
- Configuration file: `netlify.toml`.
- Plugin: `@netlify/plugin-nextjs`.
- Build command: `npm run build`.

## Serverless Function Constraints
- Serverless API routes on Netlify have execution timeouts (typically 10s default, configurable up to 26s). Keep API routes thin and optimize external API response times (OpenAI, Plaid, Supabase).
- Ensure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, etc.) are configured in Netlify dashboard for production.
- Do not commit `.env` or `.env.local` secret files to Git.
