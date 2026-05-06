import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Syne } from "next/font/google";
import { ThemeProvider }          from "@/components/providers/ThemeProvider";
import { AuthProvider }           from "@/components/auth/AuthContext";
import { ClientLayout }           from "@/components/layout/ClientLayout";
import { FooterConditional }      from "@/components/layout/FooterConditional";
// ── Zencra Runtime Infrastructure ───────────────────────────────────────────
// These three are the ONLY mounting points for the async job runtime.
// Do not scatter these hooks across individual studio layouts.
import { AppBootstrap }           from "@/components/system/AppBootstrap";
import { GlobalToastRenderer }    from "@/components/jobs/GlobalToastRenderer";
import { GlobalJobsPanel }        from "@/components/jobs/GlobalJobsPanel";
import "./globals.css";

// ─────────────────────────────────────────────────────────────────────────────
// Font Configuration — Zencra cinematic typography system
//
// Display / Headings → --font-display
//   Syne — bold geometric, cinematic at large sizes
//
// Body / UI / Forms → --font-sans  (also aliased as --font-body)
//   Familjen Grotesk — clean modern grotesque
//   FCS typography intentionally untouched — separate font system to be added later.
// ─────────────────────────────────────────────────────────────────────────────

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

const neueMontreal = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// Site Metadata
// Update these values before going live.
// og:image should be a 1200×630px image in /public/images/og-image.png
// ─────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL("https://zencralabs.com"), // ← Update with your domain
  title: {
    default: "Zencra Labs – Intelligence by Design",
    template: "%s | Zencra Labs",
  },
  description:
    "Zencra Labs is a modern AI-driven digital platform. We build intelligent web experiences, AI-powered tools, and scalable digital products.",
  keywords: [
    "AI platform",
    "web development",
    "AI tools",
    "digital products",
    "SaaS",
    "Zencra Labs",
  ],
  authors: [{ name: "Zencra Labs" }],
  creator: "Zencra Labs",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zencralabs.com",
    title: "Zencra Labs – Intelligence by Design",
    description:
      "Modern AI-driven digital platform building intelligent web experiences and AI-powered tools.",
    siteName: "Zencra Labs",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zencra Labs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zencra Labs – Intelligence by Design",
    description: "Modern AI-driven digital platform.",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1A32",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      {/*
        suppressHydrationWarning is REQUIRED for next-themes to work correctly.
        It suppresses the mismatch warning caused by theme injection on mount.
      */}
      <body className={`${syne.variable} ${neueMontreal.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {/*
              ── Zencra Runtime Infrastructure ────────────────────────────────
              AppBootstrap    — job recovery, stale-detection, transition toasts
              GlobalToastRenderer — top-right job lifecycle toast stack
              GlobalJobsPanel    — bottom-right pending jobs drawer
              All three are auth-aware and mount ONCE here.
            */}
            <AppBootstrap />
            <GlobalToastRenderer />
            <GlobalJobsPanel />

            {/* Main site wrapper */}
            <div className="relative flex min-h-screen flex-col" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
              <ClientLayout>
                <main className="flex-1">
                  {children}
                </main>
                <FooterConditional />
              </ClientLayout>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
