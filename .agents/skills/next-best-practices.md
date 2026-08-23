# Next.js 14 App Router & React Best Practices

## Guidelines
- **App Router Architecture**: Keep UI components inside `app/` clean and declarative. Presentational logic lives in components (`components/`), page routing in `app/`.
- **Server vs Client Components**: Use `'use client'` explicitly only when using state (`useState`), effects (`useEffect`), event listeners, browser APIs, or client side libraries (Zustand, TanStack Query). Keep data-fetching server-side where possible.
- **State Management**:
  - Global client state uses **Zustand** (`store/`).
  - Server data fetching, caching, and optimistic updates use **TanStack Query** (`@tanstack/react-query`).
- **UI Components & Styling**:
  - Use Tailwind CSS classes matching design system tokens.
  - Utilize Radix UI / shadcn primitives from `components/ui/` for accessible dialogs, popovers, dropdowns, and tabs.
  - Animate smooth UI transitions using `framer-motion`.
- **Error Boundaries & Loading**:
  - Provide fallback components with `loading.tsx` and `error.tsx` in routes.
