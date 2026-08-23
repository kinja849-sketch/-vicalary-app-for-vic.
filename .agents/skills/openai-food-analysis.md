# AI Food Analysis & Barcode Pipeline Skill

## Capabilities
- **Food Photo Vision Analysis**: Route `/api/analyze-food-image` calls OpenAI GPT-4o / Google Generative AI vision models to detect dishes, estimate portion sizes, calories, and macronutrients (protein, carbs, fat, fiber).
- **Barcode Product Scanning**: Route `/api/analyze-product-barcode` decodes barcodes (EAN/UPC via ZXing/HTML5-QRCode) and fetches nutrition data from OpenFoodFacts / internal product catalog.

## Security & Reliability Rules
- All AI API calls (`OPENAI_API_KEY`, `GEMINI_API_KEY`) MUST remain server-side inside API routes or Supabase Edge Functions. Never execute AI model client-side.
- Validate and sanitize input payloads (Base64 image strings, image URLs, barcode strings) using Zod.
- Always attach analysis output to `user_id` before saving to `food_analysis_history` or `daily_progress`.
- Provide fallback nutrition estimates if AI service times out or fails parsing structured JSON outputs.
