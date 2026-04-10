import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Syne } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

// ─────────────────────────────────────────────────────────────────────────────
// Font Configuration — Framek-inspired typography
// Syne        → Display / headings  (bold geometric, large titles)
// Familjen Grotesk → Body / UI text (clean modern grotesque)
// ─────────────────────────────────────────────────────────────────────────────
const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1A32" },
  ],
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
    <html lang="en" suppressHydrationWarning>
      {/*
        suppressHydrationWarning is REQUIRED for next-themes to work correctly.
        It suppresses the mismatch warning caused by theme injection on mount.
      */}
      <body className={`${syne.variable} ${familjen.variable} font-body antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {/* Main site wrapper */}
            <div className="relative flex min-h-screen flex-col" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
