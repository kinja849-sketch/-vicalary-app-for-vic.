# VICALARY - AI-Powered Nutrition & Spiritual Wellness

VICALARY is a next-generation health, nutrition, and spiritual wellness application. It combines advanced AI-powered food analysis with spiritual mindfulness, providing users with a holistic approach to their daily routines.


## 🌟 Key Features

### 🥗 Smart Nutrition & Progress
- **AI Food Analysis**: Snap a photo and get instant nutritional insights using OpenAI GPT-4o.
- **Product Scanner**: Integrated barcode scanning for quick food logging.
- **Progress Tracking**: Monitor weight, height, and daily calorie goals with beautiful charts.
- **Budget Management**: Track your food spending and manage transactions with multi-currency support.
- **Time-Aware Recipes**: Get meal suggestions optimized for the current time of day (Breakfast/Lunch/Dinner).

### 💬 Advanced Chat System
- **WhatsApp-Style UX**: Real-time messaging with read receipts and typing indicators.
- **Verified Identity**: Secure contact addition via verified phone numbers or QR codes.
- **Rich Media Support**: Send voice notes, images, videos, and shared locations.
- **Calling**: Integrated voice and video calling infrastructure.

### 🕌 Spiritual Integration
- **Contextual Reminders**: Receive Quranic verses and Hadiths tailored to your health goals.
- **Prayer Window Triggers**: Spiritual content appears during local prayer times for mindful reflection.
- **Time Analysis**: IP-based prayer time detection for global accuracy.

## 💻 Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS & Vanilla CSS
- **Animations**: Framer Motion for smooth, premium transitions
- **State Management**: Tanstack Query (React Query) for robust API synchronization
- **Routing**: React Router DOM

### Backend & Infrastructure
- **Platform**: [Supabase](https://supabase.com)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Real-Time**: Supabase Realtime for chat and presence
- **Storage**: Supabase Storage for avatars and media
- **AI**: OpenAI (GPT-4o) for food recognition

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (recommended)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd vic-20app-20-main
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root:
   ```env
   VITE_NEXT_PUBLIC_SUPABASE_URL=your_NEXT_PUBLIC_SUPABASE_URL
   VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY=your_NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. **Run Development Server**:
   ```bash
   pnpm dev
   ```

## 🏗️ Project Structure

- `client/`: React application source code.
  - `components/`: Reusable UI components.
  - `pages/`: Main application screens (Dashboard, Chat, Progress, etc.).
  - `lib/api/`: API integration layer for Supabase services.
- `supabase/`: Database migrations and Edge Functions.
- `shared/`: Shared types and utilities.

## 🔒 Security & Performance

- **RLS Policies**: Every database table is protected by fine-grained Row Level Security.
- **Optimistic UI**: React Query ensures a snappy experience even on slower connections.
- **Error Boundaries**: Global error catching to prevent application crashes.

## 📜 License

This project belongs to Vic. All rights reserved.
