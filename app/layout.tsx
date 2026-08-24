import type { Metadata } from "next";
import { GlobalProviders } from "@/components/GlobalProviders";
import "./global.css";

export const metadata: Metadata = {
  title: "VICALARY",
  description: "AI-powered nutrition tracking",
  icons: {
    icon: "/app logo.png",
    apple: "/app logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.lordicon.com/lordicon.js" async />
        <script
          id="suppress-plaid-warn"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalWarn = console.warn;
                console.warn = (...args) => {
                  if (args[0] && typeof args[0] === 'string' && args[0].includes('The Plaid link-initialize.js script was embedded more than once')) return;
                  originalWarn(...args);
                };
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
