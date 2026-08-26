import type { Metadata } from "next";
import Script from "next/script";
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
      <head suppressHydrationWarning />
      <body suppressHydrationWarning>
        <GlobalProviders>{children}</GlobalProviders>
        <Script 
          src="https://cdn.lordicon.com/lordicon.js" 
          strategy="lazyOnload" 
        />
      </body>
    </html>
  );
}
