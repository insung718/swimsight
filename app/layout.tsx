import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { OptionalClerkProvider } from "@/components/auth/optional-clerk-provider";
import { TranslationLayer } from "@/components/i18n/translation-layer";

export const metadata: Metadata = {
  title: "SwimSight",
  description: "Data-driven swim analytics for competitive swimmers and coaches.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('swimsight-theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `
          }}
        />
        <OptionalClerkProvider>{children}</OptionalClerkProvider>
        <TranslationLayer />
        <Analytics />
      </body>
    </html>
  );
}
