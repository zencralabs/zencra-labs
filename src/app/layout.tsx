import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { FooterConditional } from "@/components/layout/FooterConditional";
import "./globals.css";

// ─────────────────────────────────────────────────────────────────────────────
// Font Configuration — Zencra cinematic typography system
//
// Display / Headings → --font-display
//   Space Grotesk (Google Fonts stand-in for Clash Display)
//   To swap in Clash Display: replace this with next/font/local pointing to
//   /public/fonts/clash-display/ClashDisplay-Variable.woff2
//
// Body / UI / Forms → --font-sans  (also aliased as --font-body)
//   Familjen Grotesk — approved Neue Montreal stand-in per spec
//   To swap in Neue Montreal: replace this with next/font/local pointing to
//   /public/fonts/neue-montreal/NeueMontreal-{Regular,Medium,Bold}.woff2
// ─────────────────────────────────────────────────────────────────────────────

const clashDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      <body className={`${clashDisplay.variable} ${neueMontreal.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {/* Main site wrapper */}
            <div className="relative flex min-h-screen flex-col" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <FooterConditional />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
